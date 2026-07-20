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
  assert.match(page, /Home equity from principal/)
  assert.match(page, /Renter home equity/)
  assert.match(page, /Total buying payments/)
  assert.match(page, /const \[includeOwnerExtras, setIncludeOwnerExtras\] = useState\(true\)/)
  assert.match(page, /Include taxes and utilities in buying total/)
  assert.match(page, /Total taxes/)
  assert.match(page, /Total utilities/)
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
