import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildRentSchedule,
  buildSchedule,
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

test("ships clear cash-flow comparison semantics and visible optional costs", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ])

  assert.match(page, /Simple housing cash-flow calculator/)
  assert.match(page, /Estimated CMHC premium/)
  assert.match(page, /Total mortgage/)
  assert.match(page, /Estimated home equity/)
  assert.match(page, /Home price minus mortgage balance/)
  assert.match(page, /Include down payment in buying cash paid/)
  assert.match(page, /comparisonDownPayment = includeDownPaymentInComparison/)
  assert.match(page, /Buying · down payment/)
  assert.match(page, /The down payment is shown as a separate up-front flow/)
  assert.match(page, /Rent cash paid includes rental\s+utilities when entered/)
  assert.match(page, /comparisonBuyingTableColumnCount/)
  assert.match(page, /table-group-buying/)
  assert.match(page, /table-group-renting/)
  assert.match(page, /Mortgage interest/)
  assert.match(page, /Costs that do not build equity/)
  assert.match(page, /table-down-payment/)
  assert.match(page, /table-rent/)
  assert.match(page, /FCAC advises budgeting approximately 1\.5% to 4%/)
  assert.match(page, /<details className="advanced-panel" open>/)
  assert.match(page, /Mortgage renewal rates/)
  assert.match(page, /Annual rent increase/)
  assert.match(page, /entered five-year renewal rates/)
  assert.match(page, /annual rent increases/)
  assert.match(page, /showCmhcDetails = results\.downPaymentPercent < 20/)
  assert.match(page, /isHintOpen/)
  assert.match(page, /field-hint-popover/)
  assert.match(page, /aria-expanded=\{isHintOpen\}/)
  assert.match(page, /setIsHintOpen\(\(current\) => !current\)/)
  assert.doesNotMatch(page, /<div className="formula-grid mortgage-formula-grid">/)
  assert.doesNotMatch(page, /Mortgage payment ·/)
  assert.match(css, /\.input-warning/)
  assert.match(css, /\.field-label-row/)
  assert.match(css, /\.field-hint-popover/)
  assert.match(css, /\.comparison-table-groups/)
  assert.match(css, /color-mix\(in srgb, var\(--rent\) 12%, white\)/)
  assert.match(css, /\.comparison-table th\.table-down-payment/)
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
