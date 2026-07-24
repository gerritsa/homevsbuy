import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildRentSchedule,
  buildSchedule,
  calculateExitScenario,
  calculateMortgageAmounts,
  minimumDownPaymentFor,
} from "../app/calculations.ts"

const projectRoot = new URL("../", import.meta.url)

test("calculates the default Canadian mortgage schedule", () => {
  const amounts = calculateMortgageAmounts(650_000, 20, 25)
  const schedule = buildSchedule(amounts.mortgageAmount, 4.3, 25)

  assert.equal(amounts.downPayment, 130_000)
  assert.equal(amounts.baseMortgageAmount, 520_000)
  assert.equal(amounts.cmhcPremium, 0)
  assert.equal(amounts.mortgageAmount, 520_000)
  assert.ok(Math.abs(schedule.monthlyPayment - 2820.526748) < 0.000001)
  assert.ok(schedule.years[24].endingBalance < 0.01)
  assert.ok(Math.abs(schedule.years[24].totalPrincipalPaid - 520_000) < 0.01)
})

test("adds the standard CMHC premium below 20% down", () => {
  const amounts = calculateMortgageAmounts(650_000, 10, 25)
  const schedule = buildSchedule(amounts.mortgageAmount, 4.3, 25)

  assert.equal(amounts.minimumDownPayment, 40_000)
  assert.equal(amounts.baseMortgageAmount, 585_000)
  assert.equal(amounts.cmhcPremiumRate, 3.1)
  assert.equal(amounts.cmhcPremium, 18_135)
  assert.equal(amounts.mortgageAmount, 603_135)
  assert.ok(Math.abs(schedule.monthlyPayment - 3271.458462) < 0.000001)
})

test("adds the insured 30-year premium surcharge", () => {
  const amounts = calculateMortgageAmounts(650_000, 10, 30)

  assert.equal(amounts.cmhcPremiumRate, 3.3)
  assert.equal(amounts.cmhcPremium, 19_305)
  assert.equal(amounts.mortgageAmount, 604_305)
})

test("warns instead of estimating an ineligible insured mortgage", () => {
  const belowMinimum = calculateMortgageAmounts(650_000, 5, 25)
  const overPriceCap = calculateMortgageAmounts(1_500_000, 10, 25)

  assert.match(belowMinimum.cmhcWarning ?? "", /below the minimum required amount/)
  assert.equal(belowMinimum.cmhcPremium, 0)
  assert.match(overPriceCap.cmhcWarning ?? "", /require at least 20% down/)
  assert.equal(overPriceCap.cmhcPremium, 0)
  assert.equal(minimumDownPaymentFor(500_000), 25_000)
  assert.equal(minimumDownPaymentFor(650_000), 40_000)
  assert.equal(minimumDownPaymentFor(1_500_000), 300_000)
})

test("handles a zero-rate mortgage", () => {
  const schedule = buildSchedule(300_000, 0, 25)

  assert.equal(schedule.monthlyPayment, 1_000)
  assert.equal(schedule.months[0].interestPaid, 0)
  assert.equal(schedule.years[24].endingBalance, 0)
  assert.equal(schedule.years[24].totalInterestPaid, 0)
})

test("recalculates payments at each five-year mortgage renewal", () => {
  const schedule = buildSchedule(520_000, [4.3, 6, 5.25, 4.75, 4.5], 25)
  const month60 = schedule.months[59]
  const month61 = schedule.months[60]

  assert.equal(month60.annualRate, 4.3)
  assert.equal(month61.annualRate, 6)
  assert.notEqual(month60.mortgagePayment, month61.mortgagePayment)
  assert.ok(
    Math.abs(month60.endingBalance - month61.principalPaid - month61.endingBalance) < 0.01,
  )
  assert.equal(schedule.years[5].annualRate, 6)
  assert.ok(Math.abs(schedule.years[5].monthlyPayment - month61.mortgagePayment) < 0.01)
  assert.ok(schedule.years[24].endingBalance < 0.01)
})

test("supports accelerated mortgage payment frequencies", () => {
  const monthly = buildSchedule(520_000, 4.3, 25)
  const acceleratedBiweekly = buildSchedule(520_000, 4.3, 25, "accelerated-biweekly")
  const acceleratedWeekly = buildSchedule(520_000, 4.3, 25, "accelerated-weekly")
  const biweeklyPayoffMonth = acceleratedBiweekly.months.find(
    (row) => row.endingBalance <= 0.005,
  )?.month
  const weeklyPayoffMonth = acceleratedWeekly.months.find(
    (row) => row.endingBalance <= 0.005,
  )?.month

  assert.ok(
    Math.abs(acceleratedBiweekly.monthlyPayment - monthly.monthlyPayment * (13 / 12)) <
      0.000001,
  )
  assert.equal(acceleratedWeekly.monthlyPayment, acceleratedBiweekly.monthlyPayment)
  assert.ok(acceleratedBiweekly.months[0].principalPaid > monthly.months[0].principalPaid)
  assert.ok(acceleratedWeekly.months[0].principalPaid > acceleratedBiweekly.months[0].principalPaid)
  assert.ok(acceleratedBiweekly.months.some((row) => row.mortgagePayment > monthly.monthlyPayment * 1.4))
  assert.ok(acceleratedWeekly.months.some((row) => row.mortgagePayment > monthly.monthlyPayment * 1.2))
  assert.ok(acceleratedBiweekly.years[4].endingBalance < monthly.years[4].endingBalance)
  assert.ok(acceleratedWeekly.years[4].endingBalance < acceleratedBiweekly.years[4].endingBalance)
  assert.ok(acceleratedBiweekly.years[24].totalInterestPaid < monthly.years[24].totalInterestPaid)
  assert.ok(
    acceleratedWeekly.years[24].totalInterestPaid <
      acceleratedBiweekly.years[24].totalInterestPaid,
  )
  assert.ok(Math.abs(acceleratedBiweekly.years[4].endingBalance - 439_134.627392) < 0.000001)
  assert.ok(Math.abs(acceleratedWeekly.years[4].endingBalance - 439_051.089406) < 0.000001)
  assert.equal(biweeklyPayoffMonth, 262)
  assert.equal(weeklyPayoffMonth, 261)
  assert.equal(acceleratedBiweekly.years[24].endingBalance, 0)
})

test("applies annual rent increases at rental-year boundaries", () => {
  const schedule = buildRentSchedule(2_700, 100, 2)

  assert.equal(schedule.months[0].monthlyRent, 2_700)
  assert.equal(schedule.months[11].monthlyRent, 2_700)
  assert.equal(schedule.months[12].monthlyRent, 2_754)
  assert.equal(schedule.years[0].annualRent, 32_400)
  assert.equal(schedule.years[1].annualRent, 33_048)
  assert.equal(schedule.years[1].totalRent, 65_448)
  assert.equal(schedule.months[12].totalRentalUtilities, 1_300)
  assert.equal(schedule.months[12].totalRentalCash, 36_454)
})

test("calculates cash after sale and the full ownership result", () => {
  const result = calculateExitScenario({
    purchasePrice: 650_000,
    salePrice: 725_000,
    sellingCostPercent: 5,
    fixedSellingCosts: 2_000,
    mortgagePenalty: 4_000,
    mortgageBalance: 438_000,
    downPayment: 130_000,
    principalPaid: 82_000,
    interestPaid: 92_000,
    recurringOwnershipCosts: 38_000,
    buyingClosingCosts: 12_000,
    monthsOwned: 60,
    rentCash: 170_000,
  })

  assert.equal(result.percentageSellingCosts, 36_250)
  assert.equal(result.totalSellingCosts, 38_250)
  assert.equal(result.grossHomeEquity, 287_000)
  assert.equal(result.cashAfterSale, 244_750)
  assert.equal(result.homeValueChange, 75_000)
  assert.equal(result.totalCashPaid, 354_000)
  assert.equal(result.netOwnershipResult, -109_250)
  assert.equal(result.netOwnershipCost, 109_250)
  assert.ok(Math.abs(result.netCostPerMonth - 1_820.833333) < 0.000001)
  assert.equal(result.buyingAdvantageVsRent, 60_750)
})

test("ships clear cash-flow comparison semantics and visible optional costs", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ])

  assert.match(page, /Housing cash-flow calculator/)
  assert.doesNotMatch(page, /Use the Buying tab for the mortgage and ownership costs/)
  assert.doesNotMatch(page, /Common ownership costs/)
  assert.doesNotMatch(page, /Advanced mortgage scenarios/)
  assert.match(page, /Estimated CMHC premium/)
  assert.match(page, /Total mortgage/)
  assert.match(page, /Estimated home equity/)
  assert.match(page, /Home price minus mortgage balance/)
  assert.match(page, /Buying · upfront at purchase/)
  assert.match(page, /cash needed upfront/)
  assert.match(page, /contributes to equity/)
  assert.match(page, /Closing costs are upfront non-equity\s+costs/)
  assert.match(page, /Up-front cash · contributes to equity/)
  assert.doesNotMatch(page, /Upfront cash shown separately above/)
  assert.doesNotMatch(page, /Include down payment in buying cash paid/)
  assert.doesNotMatch(page, /includeDownPaymentInComparison/)
  assert.match(page, /Rent cash paid includes rental\s+utilities when entered/)
  assert.match(page, /comparisonBuyingTableColumnCount/)
  assert.match(page, /table-group-buying/)
  assert.match(page, /table-group-renting/)
  assert.match(page, /Mortgage interest/)
  assert.match(page, /Costs not recovered as equity/)
  assert.match(page, /The Taxes \+ utilities column adds maintenance and\s+homeowner insurance only when entered/)
  assert.match(page, /\+ maintenance/)
  assert.match(page, /\+ insurance/)
  assert.doesNotMatch(page, /table-maintenance/)
  assert.doesNotMatch(page, /table-home-insurance/)
  assert.match(page, /Property taxes\/month/)
  assert.match(page, /Cumulative cost month/)
  assert.match(page, /function InfoButton/)
  assert.match(page, /Monthly costs include utilities, maintenance, and homeowner insurance/)
  assert.match(page, /Monthly buying costs/)
  assert.match(page, /monthly-detail-sheet/)
  assert.match(page, /Upfront costs/)
  assert.match(page, /upfrontBuyingCosts/)
  assert.match(page, /table-down-payment/)
  assert.match(page, /table-rent/)
  assert.ok(
    page.indexOf('className="table-non-equity"') <
      page.indexOf('className="table-interest"'),
  )
  assert.match(page, /FCAC advises budgeting approximately 1\.5% to 4%/)
  assert.match(page, /<details className="advanced-panel" open>/)
  assert.match(page, /field-grid advanced-cost-grid/)
  assert.match(page, /Mortgage renewal rates/)
  assert.match(page, /Payment frequency/)
  assert.match(page, /Accelerated bi-weekly/)
  assert.match(page, /Accelerated weekly/)
  assert.match(page, /selected weekly\s+or bi-weekly cadence/)
  assert.match(page, /months with an extra weekly or bi-weekly payment/)
  assert.match(page, /Estimated payoff/)
  assert.match(page, /Time saved/)
  assert.match(page, /shorten the payoff timeline/)
  assert.match(page, /Mortgage frequency/)
  assert.match(page, /Annual rent increase/)
  assert.match(page, /Selling · Exit/)
  assert.match(page, /Plain-language read/)
  assert.match(page, /If you bought at/)
  assert.match(page, /At the time of selling/)
  assert.match(page, /The buying story in plain numbers/)
  assert.match(page, /Mortgage payments split in two/)
  assert.match(page, /Equity you would own before sale deductions/)
  assert.match(page, /Cash costs that did not become equity/)
  assert.match(page, /What comes back after selling/)
  assert.match(page, /Mortgage payments[\s\S]*made/)
  assert.match(page, /Principal that became equity/)
  assert.match(page, /Interest paid/)
  assert.match(page, /Principal is separated from cost/)
  assert.match(page, /Renting for[\s\S]*the same[\s\S]*period would have cost/)
  assert.match(page, /total buying cost after sale/)
  assert.match(page, /Buying total cost after sale/)
  assert.match(page, /For a sale-price comparison with selling costs/)
  assert.match(page, /Cash after sale/)
  assert.match(page, /Buying result after sale/)
  assert.doesNotMatch(page, /net cost/)
  assert.doesNotMatch(page, /Buying net cost/)
  assert.doesNotMatch(page, /left you down/)
  assert.doesNotMatch(page, /left you up/)
  assert.match(page, /What changed your result/)
  assert.match(page, /How your equity was built/)
  assert.match(page, /Original down payment/)
  assert.match(page, /Gross home equity at sale/)
  assert.doesNotMatch(page, /Price sensitivity/)
  assert.doesNotMatch(page, /If the sale price is 10% lower or higher/)
  assert.match(page, /Mortgage prepayment penalty/)
  assert.match(page, /Estimated housing cash-flow difference:/)
  assert.doesNotMatch(page, /Buying is ahead by/)
  assert.doesNotMatch(page, /Total cash paid/)
  assert.match(page, /calculateExitScenario/)
  assert.match(page, /entered five-year renewal rates/)
  assert.match(page, /annual rent increases/)
  assert.match(page, /showCmhcDetails = results\.downPaymentPercent < 20/)
  assert.match(page, /aria-expanded=\{isOpen\}/)
  assert.match(page, /setIsOpen\(\(current\) => !current\)/)
  assert.match(page, /info-popover/)
  assert.doesNotMatch(page, /<div className="formula-grid mortgage-formula-grid">/)
  assert.doesNotMatch(page, /Mortgage payment ·/)
  assert.match(css, /\.input-warning/)
  assert.match(css, /\.field-label-row/)
  assert.match(css, /\.advanced-cost-grid \.field:last-child/)
  assert.match(css, /\.info-popover/)
  assert.match(css, /\.monthly-costs/)
  assert.match(css, /\.upfront-costs/)
  assert.match(css, /\.mortgage-status-grid[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(css, /\.comparison-table-groups/)
  assert.match(css, /color-mix\(in srgb, var\(--rent\) 12%, white\)/)
  assert.match(css, /\.comparison-table th\.table-down-payment/)
  assert.match(css, /\.exit-waterfall/)
  assert.match(css, /\.exit-rent-comparison/)
  assert.match(css, /\.exit-results > \.results-title/)
  assert.match(css, /\.plain-language-summary/)
  assert.match(css, /\.exit-story-panel/)
  assert.match(css, /\.exit-story-summary/)
  assert.match(css, /\.exit-metric-strip/)
  assert.match(css, /\.exit-final-comparison/)
  assert.doesNotMatch(css, /\.exit-table/)
  assert.match(css, /overflow-wrap: anywhere/)
  assert.match(
    css,
    /@media \(max-width: 980px\)[\s\S]*\.monthly-grid\.four-up\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  )
  assert.match(
    css,
    /@media \(max-width: 700px\)[\s\S]*\.monthly-grid\.four-up[\s\S]*grid-template-columns: 1fr/,
  )
})

test("ships production metadata and social card", async () => {
  const [layout, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ])

  assert.match(layout, /Home Cash-Flow Calculator \| Buy vs\. Rent/)
  assert.match(layout, /og\.png/)
  assert.match(packageJson, /"build": "next build"/)
  await assert.doesNotReject(access(new URL("public/og.png", projectRoot)))
})

test("ships named saved configs with shared storage fallback", async () => {
  const [page, readRoute, deleteRoute, store, readme] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/saved-configs/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/saved-configs/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/saved-configs/store.ts", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ])

  assert.match(page, /Saved house/)
  assert.match(page, /Start a new house/)
  assert.match(page, /Name this house/)
  assert.match(page, /Address or scenario name/)
  assert.match(page, /Save house/)
  assert.match(page, /Saved browser-only house/)
  assert.match(page, /Delete saved house/)
  assert.match(page, /loadSavedConfig\(nextId\)/)
  assert.doesNotMatch(page, /Export config/)
  assert.doesNotMatch(page, /Import config/)
  assert.match(readRoute, /storage: "shared"/)
  assert.match(store, /KV_REST_API_URL/)
  assert.match(store, /DB_KV_REST_API_URL/)
  assert.match(deleteRoute, /DELETE/)
  assert.match(readme, /Vercel KV or Upstash Redis/)
  assert.match(readme, /KV_REST_API_TOKEN/)
})
