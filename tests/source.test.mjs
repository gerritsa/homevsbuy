import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import test from "node:test"

const projectRoot = new URL("../", import.meta.url)

test("ships the home decision calculator features and defaults", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8")

  assert.match(page, /purchasePrice: 650000/)
  assert.match(page, /interestRate: 4\.3/)
  assert.match(page, /annualTaxes: 4400/)
  assert.match(page, /monthlyUtilities: 375/)
  assert.match(page, /monthlyRent: 2700/)
  assert.match(page, /downPaymentPercent: 20/)
  assert.match(page, /LONG_TERM_YEARS = 25/)
  assert.match(page, /useState\(1\)/)
  assert.match(page, /Canadian convention of semi-annual compounding/)
  assert.match(page, /Buying · Mortgage/)
  assert.match(page, /Buy vs\. Rent/)
  assert.match(page, /Mortgage equity built/)
  assert.match(page, /Non-equity housing cost/)
  assert.match(page, /Cash paid/)
  assert.match(page, /const \[includeOwnerExtras, setIncludeOwnerExtras\] = useState\(true\)/)
  assert.match(page, /const \[includeDownPayment, setIncludeDownPayment\] = useState\(false\)/)
  assert.match(page, /Include taxes and utilities in buying cash paid/)
  assert.match(page, /Include down payment in home equity/)
  assert.match(page, /results\.selectedPrincipalPaid \+ \(includeDownPayment \? results\.downPayment : 0\)/)
  assert.match(page, /comparisonBuyingCost/)
  assert.match(page, /Active comparison assumptions/)
  assert.match(page, /Home price/)
  assert.match(page, /Down payment · up-front equity/)
  assert.match(page, /The down payment is shown separately and included in mortgage equity/)
  assert.match(page, /Principal this year/)
  assert.match(page, /Interest this year/)
  assert.match(page, /Owner payments \(excl\. down payment\)/)
  assert.match(page, /Excluded/)
  assert.match(page, /results\.monthlyTaxes \* 12 \* row\.year/)
  assert.match(page, /results\.monthlyUtilities \* 12 \* row\.year/)
  assert.doesNotMatch(page, /lowerPaymentOption|totalPaymentDifference|comparison-difference/)
  assert.doesNotMatch(page, /annualRentIncrease/)
  assert.doesNotMatch(page, /Hydro|monthlyHydro/)
})

test("ships production metadata and social card", async () => {
  const [layout, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ])

  assert.match(layout, /Home Decision Calculator \| Buy vs\. Rent/)
  assert.match(layout, /og\.png/)
  assert.match(packageJson, /"build": "next build"/)
  assert.doesNotMatch(packageJson, /vinext|wrangler|drizzle/)
  await assert.doesNotReject(access(new URL("public/og.png", projectRoot)))
})
