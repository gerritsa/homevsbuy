"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  buildRentSchedule,
  buildSchedule,
  calculateMortgageAmounts,
  LONG_TERM_MONTHS,
} from "./calculations"

type CalculatorInputs = {
  purchasePrice: number
  downPaymentPercent: number
  interestRate: number
  amortizationYears: number
  annualTaxes: number
  monthlyUtilities: number
  monthlyRent: number
  annualRentIncrease: number
  monthlyMaintenance: number
  monthlyHomeInsurance: number
  closingCosts: number
  monthlyRentalUtilities: number
}

const initialInputs: CalculatorInputs = {
  purchasePrice: 650000,
  downPaymentPercent: 20,
  interestRate: 4.3,
  amortizationYears: 25,
  annualTaxes: 4400,
  monthlyUtilities: 375,
  monthlyRent: 2700,
  annualRentIncrease: 0,
  monthlyMaintenance: 0,
  monthlyHomeInsurance: 0,
  closingCosts: 0,
  monthlyRentalUtilities: 0,
}

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
})

const preciseCurrency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function money(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0)
}

function preciseMoney(value: number) {
  return preciseCurrency.format(Number.isFinite(value) ? value : 0)
}

function percent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`
}

function NumberField({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  min = 0,
  max,
  step = "any",
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: string
  hint?: string
  min?: number
  max?: number
  step?: number | "any"
}) {
  const [draftValue, setDraftValue] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraftValue(String(value))
    }
  }, [value])

  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">
        {label}
        {hint ? (
          <i aria-label={hint} className="info-dot" role="img" title={hint}>
            i
          </i>
        ) : null}
      </span>
      <span className="input-shell">
        {prefix ? <span className="input-affix">{prefix}</span> : null}
        <input
          id={id}
          inputMode="decimal"
          max={max}
          min={min}
          onBlur={() => {
            const parsedValue = draftValue.trim() === "" ? 0 : Number(draftValue)
            const finiteValue = Number.isFinite(parsedValue) ? parsedValue : 0
            const normalizedValue = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, finiteValue))

            setDraftValue(String(normalizedValue))
            onChange(normalizedValue)
          }}
          onChange={(event) => {
            const nextValue = event.target.value
            setDraftValue(nextValue)

            if (nextValue !== "") {
              const nextNumber = Number(nextValue)
              if (Number.isFinite(nextNumber)) {
                onChange(nextNumber)
              }
            }
          }}
          step={step}
          type="number"
          ref={inputRef}
          value={draftValue}
        />
        {suffix ? <span className="input-affix suffix">{suffix}</span> : null}
      </span>
    </label>
  )
}

function DetailRow({
  label,
  amount,
  note,
  emphasis = false,
}: {
  label: string
  amount: string
  note?: string
  emphasis?: boolean
}) {
  return (
    <div className={emphasis ? "detail-row emphasis" : "detail-row"}>
      <span>
        {label}
        {note ? <small>{note}</small> : null}
      </span>
      <strong>{amount}</strong>
    </div>
  )
}

function TimelineSlider({
  selectedMonth,
  onChange,
}: {
  selectedMonth: number
  onChange: (month: number) => void
}) {
  const selectedYear = Math.ceil(selectedMonth / 12)
  const selectedMonthInYear = ((selectedMonth - 1) % 12) + 1

  return (
    <article className="slider-card">
      <div className="slider-heading">
        <div>
          <p className="card-kicker">Timeline slider</p>
          <h3>
            Month {selectedMonth} <span>Year {selectedYear}, month {selectedMonthInYear}</span>
          </h3>
        </div>
      </div>
      <input
        aria-label="Select month in first 25 years"
        className="timeline-slider"
        max={LONG_TERM_MONTHS}
        min={1}
        onChange={(event) => onChange(Number(event.target.value))}
        step={1}
        type="range"
        value={selectedMonth}
      />
      <div className="slider-labels">
        <span>Month 1</span>
        <span>Year 5</span>
        <span>Year 10</span>
        <span>Year 15</span>
        <span>Year 20</span>
        <span>Year 25</span>
      </div>
    </article>
  )
}

export default function Home() {
  const [inputs, setInputs] = useState(initialInputs)
  const [activeTab, setActiveTab] = useState<"buy" | "rent" | "compare">("buy")
  const [selectedMonth, setSelectedMonth] = useState(1)
  const [includeOwnerExtras, setIncludeOwnerExtras] = useState(true)
  const [renewalRates, setRenewalRates] = useState([4.3, 4.3, 4.3, 4.3, 4.3])

  const results = useMemo(() => {
    const mortgageAmounts = calculateMortgageAmounts(
      inputs.purchasePrice,
      inputs.downPaymentPercent,
      inputs.amortizationYears,
    )
    const scheduleRates = [inputs.interestRate, ...renewalRates]
    const schedule = buildSchedule(
      mortgageAmounts.mortgageAmount,
      scheduleRates,
      inputs.amortizationYears,
    )
    const monthlyTaxes = Math.max(0, inputs.annualTaxes) / 12
    const monthlyUtilities = Math.max(0, inputs.monthlyUtilities)
    const monthlyMaintenance = Math.max(0, inputs.monthlyMaintenance)
    const monthlyHomeInsurance = Math.max(0, inputs.monthlyHomeInsurance)
    const closingCosts = Math.max(0, inputs.closingCosts)
    const monthlyOwnerAdvanced = monthlyMaintenance + monthlyHomeInsurance
    const safeSelectedMonth = Math.min(Math.max(1, selectedMonth), LONG_TERM_MONTHS)
    const selectedScheduleRow = schedule.months[safeSelectedMonth - 1] ?? schedule.months.at(-1)
    const selectedMonthPrincipal = selectedScheduleRow?.principalPaid ?? 0
    const selectedMonthInterest = selectedScheduleRow?.interestPaid ?? 0
    const selectedMonthMortgagePayment = selectedScheduleRow?.mortgagePayment ?? 0
    const selectedAnnualRate = selectedScheduleRow?.annualRate ?? inputs.interestRate
    const selectedMonthlyOwnerTotal =
      selectedMonthMortgagePayment + monthlyTaxes + monthlyUtilities + monthlyOwnerAdvanced
    const selectedPrincipalPaid = selectedScheduleRow?.totalPrincipalPaid ?? 0
    const selectedInterestPaid = selectedScheduleRow?.totalInterestPaid ?? 0
    const monthlyRent = Math.max(0, inputs.monthlyRent)
    const annualRentIncrease = Math.max(0, inputs.annualRentIncrease)
    const monthlyRentalUtilities = Math.max(0, inputs.monthlyRentalUtilities)
    const rentSchedule = buildRentSchedule(
      monthlyRent,
      monthlyRentalUtilities,
      annualRentIncrease,
    )
    const selectedRentRow = rentSchedule.months[safeSelectedMonth - 1]
    const selectedMonthlyRent = selectedRentRow?.monthlyRent ?? monthlyRent
    const selectedRentPaid = selectedRentRow?.totalRent ?? 0
    const selectedRentalUtilitiesPaid = selectedRentRow?.totalRentalUtilities ?? 0
    const selectedRentCash = selectedRentRow?.totalRentalCash ?? 0
    const selectedOwnerAdvancedPaid = monthlyOwnerAdvanced * safeSelectedMonth

    return {
      ...schedule,
      ...mortgageAmounts,
      monthlyTaxes,
      monthlyUtilities,
      monthlyMaintenance,
      monthlyHomeInsurance,
      monthlyOwnerAdvanced,
      closingCosts,
      monthlyRent,
      annualRentIncrease,
      selectedMonthlyRent,
      monthlyRentalUtilities,
      selectedMonth: safeSelectedMonth,
      selectedMonthPrincipal,
      selectedMonthInterest,
      selectedMonthMortgagePayment,
      selectedAnnualRate,
      selectedMonthlyOwnerTotal,
      selectedPrincipalPaid,
      selectedInterestPaid,
      selectedOwnerAdvancedPaid,
      selectedRentPaid,
      selectedRentalUtilitiesPaid,
      selectedRentCash,
      balanceAtSelectedMonth: selectedScheduleRow?.endingBalance ?? 0,
      paidOffAtSelectedMonth: selectedScheduleRow?.paidOffPercent ?? 100,
      rentYears: rentSchedule.years,
    }
  }, [inputs, renewalRates, selectedMonth])

  const updateInput = (key: keyof CalculatorInputs, value: number) => {
    setInputs((current) => ({
      ...current,
      [key]: Number.isFinite(value) ? value : 0,
    }))
  }

  const principalVsInterestTotal = results.selectedPrincipalPaid + results.selectedInterestPaid
  const selectedInterestPercent =
    principalVsInterestTotal === 0 ? 0 : (results.selectedInterestPaid / principalVsInterestTotal) * 100
  const selectedPrincipalPercent =
    principalVsInterestTotal === 0 ? 0 : (results.selectedPrincipalPaid / principalVsInterestTotal) * 100
  const selectedYear = Math.ceil(results.selectedMonth / 12)
  const selectedMonthInYear = ((results.selectedMonth - 1) % 12) + 1
  const monthlyOwnershipCosts = results.monthlyUtilities + results.monthlyOwnerAdvanced
  const selectedOwnerExtras =
    (results.monthlyTaxes + results.monthlyUtilities) * results.selectedMonth
  const selectedMaintenancePaid = results.monthlyMaintenance * results.selectedMonth
  const selectedHomeInsurancePaid = results.monthlyHomeInsurance * results.selectedMonth
  const selectedAdvancedBuyingCosts =
    selectedMaintenancePaid + selectedHomeInsurancePaid + results.closingCosts
  const comparisonBuyingTotal =
    results.downPayment +
    principalVsInterestTotal +
    (includeOwnerExtras ? selectedOwnerExtras : 0) +
    selectedAdvancedBuyingCosts
  const comparisonBuyingGraphTotal = comparisonBuyingTotal
  const comparisonHomeEquity = Math.max(
    0,
    results.purchasePrice - results.balanceAtSelectedMonth,
  )
  const comparisonBuyingCost =
    results.cmhcPremium +
    results.selectedInterestPaid +
    (includeOwnerExtras ? selectedOwnerExtras : 0) +
    selectedAdvancedBuyingCosts
  const hasAdvancedBuyingCosts =
    results.monthlyMaintenance > 0 ||
    results.monthlyHomeInsurance > 0 ||
    results.closingCosts > 0
  const hasAdvancedRentingCosts = results.monthlyRentalUtilities > 0
  const buyingTotalBreakdown = [
    "Down payment",
    "principal",
    "interest",
    ...(includeOwnerExtras ? ["taxes", "utilities"] : []),
    ...(results.monthlyMaintenance > 0 ? ["maintenance"] : []),
    ...(results.monthlyHomeInsurance > 0 ? ["insurance"] : []),
    ...(results.closingCosts > 0 ? ["closing costs"] : []),
  ].join(" + ")
  const buyingCostBreakdown = [
    ...(results.cmhcPremium > 0 ? ["CMHC premium"] : []),
    "Interest",
    ...(includeOwnerExtras ? ["taxes", "utilities"] : []),
    ...(results.monthlyMaintenance > 0 ? ["maintenance"] : []),
    ...(results.monthlyHomeInsurance > 0 ? ["insurance"] : []),
    ...(results.closingCosts > 0 ? ["closing costs"] : []),
  ].join(" + ")
  const comparisonMax = Math.max(
    1,
    comparisonBuyingGraphTotal,
    results.selectedRentCash,
  )
  const comparisonPrincipalWidth = (results.selectedPrincipalPaid / comparisonMax) * 100
  const comparisonInterestWidth = (results.selectedInterestPaid / comparisonMax) * 100
  const comparisonOwnerExtrasWidth =
    includeOwnerExtras ? (selectedOwnerExtras / comparisonMax) * 100 : 0
  const comparisonMaintenanceWidth = (selectedMaintenancePaid / comparisonMax) * 100
  const comparisonHomeInsuranceWidth = (selectedHomeInsurancePaid / comparisonMax) * 100
  const comparisonClosingCostsWidth = (results.closingCosts / comparisonMax) * 100
  const comparisonDownPaymentWidth = (results.downPayment / comparisonMax) * 100
  const comparisonRentWidth = (results.selectedRentPaid / comparisonMax) * 100
  const comparisonRentUtilitiesWidth =
    (results.selectedRentalUtilitiesPaid / comparisonMax) * 100
  const renewalTerms = Array.from(
    { length: Math.max(0, inputs.amortizationYears / 5 - 1) },
    (_, index) => ({
      index,
      startYear: (index + 1) * 5 + 1,
      endYear: (index + 2) * 5,
    }),
  )
  const updateRenewalRate = (index: number, value: number) => {
    setRenewalRates((current) =>
      current.map((rate, rateIndex) => (rateIndex === index ? value : rate)),
    )
  }
  const resetCalculator = () => {
    setInputs(initialInputs)
    setSelectedMonth(1)
    setIncludeOwnerExtras(true)
    setRenewalRates([4.3, 4.3, 4.3, 4.3, 4.3])
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Home Cash-Flow Calculator">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span>Home Cash-Flow Calculator</span>
        </a>
        <button className="reset-button" onClick={resetCalculator} type="button">
          Reset
        </button>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">Buy or rent worksheet</p>
          <h1>Simple housing cash-flow calculator.</h1>
          <p className="hero-copy">
            Use the Buying tab for the mortgage and ownership costs. Switch to Renting for a
            separate rent-growth projection, or compare simplified buying cash flow, rent, and
            estimated home equity on the same 25-year timeline.
          </p>
        </div>
        <div className="hero-note">
          <span>All amounts in CAD</span>
          <strong>25-year view</strong>
        </div>
      </section>

      <nav className="calculator-tabs" role="tablist" aria-label="Calculator sections">
        <button
          aria-controls="buying-panel"
          aria-selected={activeTab === "buy"}
          className={activeTab === "buy" ? "tab active" : "tab"}
          id="buying-tab"
          onClick={() => setActiveTab("buy")}
          role="tab"
          type="button"
        >
          Buying · Mortgage
        </button>
        <button
          aria-controls="renting-panel"
          aria-selected={activeTab === "rent"}
          className={activeTab === "rent" ? "tab active" : "tab"}
          id="renting-tab"
          onClick={() => setActiveTab("rent")}
          role="tab"
          type="button"
        >
          Renting
        </button>
        <button
          aria-controls="comparison-panel"
          aria-selected={activeTab === "compare"}
          className={activeTab === "compare" ? "tab active" : "tab"}
          id="comparison-tab"
          onClick={() => setActiveTab("compare")}
          role="tab"
          type="button"
        >
          Buy vs. Rent
        </button>
      </nav>

      {activeTab === "buy" ? (
        <>
          <div
            aria-labelledby="buying-tab"
            className="workbook"
            id="buying-panel"
            role="tabpanel"
          >
            <section className="input-book" aria-label="Buying inputs">
              <div className="tab-panel">
                <div className="sheet-title">
                  <h2>Buying inputs</h2>
                  <span>Mortgage worksheet</span>
                </div>
                <div className="field-grid">
                  <NumberField
                    id="purchase-price"
                    label="Purchase cost"
                    onChange={(value) => updateInput("purchasePrice", value)}
                    prefix="$"
                    step={1000}
                    value={inputs.purchasePrice}
                  />
                  <NumberField
                    id="down-payment-percent"
                    label="Down payment"
                    max={100}
                    onChange={(value) => updateInput("downPaymentPercent", value)}
                    step={0.5}
                    suffix="%"
                    value={inputs.downPaymentPercent}
                  />
                  <NumberField
                    id="interest-rate"
                    label="Mortgage interest rate"
                    onChange={(value) => updateInput("interestRate", value)}
                    step={0.05}
                    suffix="%"
                    value={inputs.interestRate}
                  />
                  <label className="field" htmlFor="amortization">
                    <span className="field-label">Amortization</span>
                    <span className="input-shell select-shell">
                      <select
                        id="amortization"
                        onChange={(event) =>
                          updateInput("amortizationYears", Number(event.target.value))
                        }
                        value={inputs.amortizationYears}
                      >
                        {[10, 15, 20, 25, 30].map((year) => (
                          <option key={year} value={year}>
                            {year} years
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <NumberField
                    id="annual-taxes"
                    label="Municipal taxes"
                    onChange={(value) => updateInput("annualTaxes", value)}
                    prefix="$"
                    step={100}
                    suffix="/ year"
                    value={inputs.annualTaxes}
                  />
                  <NumberField
                    id="monthly-utilities"
                    label="Utilities"
                    onChange={(value) => updateInput("monthlyUtilities", value)}
                    prefix="$"
                    step={10}
                    suffix="/ month"
                    value={inputs.monthlyUtilities}
                  />
                </div>
                <div className="formula-grid mortgage-formula-grid">
                  <div>
                    <span>Down payment amount</span>
                    <strong>{money(results.downPayment)}</strong>
                  </div>
                  <div>
                    <span>Base mortgage</span>
                    <strong>{money(results.baseMortgageAmount)}</strong>
                  </div>
                  <div>
                    <span>
                      Estimated CMHC premium
                      {results.cmhcPremiumRate > 0
                        ? ` · ${results.cmhcPremiumRate.toFixed(2)}%`
                        : ""}
                    </span>
                    <strong>{money(results.cmhcPremium)}</strong>
                  </div>
                  <div>
                    <span>Total mortgage</span>
                    <strong>{money(results.mortgageAmount)}</strong>
                  </div>
                </div>
                {results.cmhcWarning ? (
                  <p className="input-warning" role="alert">
                    {results.cmhcWarning}
                  </p>
                ) : null}
                <p className="input-note">
                  Uses Canadian semi-annual compounding. When an eligible down payment is below 20%,
                  the estimated CMHC premium is added to the mortgage. A 0.20 percentage-point
                  premium surcharge is included for a 30-year insured amortization. Provincial tax
                  on the premium is not included. A 30-year insured mortgage assumes the buyer is
                  eligible as a first-time buyer or purchaser of a new build.
                </p>
                <details className="advanced-panel" open>
                  <summary>Advanced buying costs (optional)</summary>
                  <div className="advanced-content">
                    <div className="field-grid">
                      <NumberField
                        id="monthly-maintenance"
                        label="Maintenance"
                        onChange={(value) => updateInput("monthlyMaintenance", value)}
                        prefix="$"
                        step={25}
                        suffix="/ month"
                        value={inputs.monthlyMaintenance}
                      />
                      <NumberField
                        id="monthly-home-insurance"
                        label="Homeowner insurance"
                        onChange={(value) => updateInput("monthlyHomeInsurance", value)}
                        prefix="$"
                        step={10}
                        suffix="/ month"
                        value={inputs.monthlyHomeInsurance}
                      />
                      <NumberField
                        id="closing-costs"
                        label="Closing costs"
                        hint="FCAC advises budgeting approximately 1.5% to 4% of the purchase price for upfront or closing costs."
                        onChange={(value) => updateInput("closingCosts", value)}
                        prefix="$"
                        step={500}
                        suffix="one-time"
                        value={inputs.closingCosts}
                      />
                    </div>
                    <p>
                      Maintenance and insurance recur monthly. Closing costs are paid once and
                      count as cash paid and a non-equity cost.
                    </p>
                    <div className="renewal-section">
                      <div>
                        <h3>Mortgage renewal rates</h3>
                        <p>
                          The initial rate applies in years 1–5. At each five-year renewal, the
                          payment is recalculated from the remaining balance and amortization using
                          the entered rate.
                        </p>
                      </div>
                      <div className="field-grid renewal-rate-grid">
                        {renewalTerms.map((term) => (
                          <NumberField
                            id={`renewal-rate-${term.startYear}-${term.endYear}`}
                            key={term.startYear}
                            label={`Years ${term.startYear}–${term.endYear}`}
                            max={100}
                            onChange={(value) => updateRenewalRate(term.index, value)}
                            step={0.05}
                            suffix="%"
                            value={renewalRates[term.index] ?? inputs.interestRate}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </section>

            <section className="results-book" aria-live="polite">
              <div className="sheet-title results-title">
                <div>
                  <h2>Monthly spending in month {results.selectedMonth}</h2>
                  <span>Move the timeline slider to compare any month</span>
                </div>
              </div>

              <TimelineSlider selectedMonth={results.selectedMonth} onChange={setSelectedMonth} />

              <div className="monthly-grid four-up">
                <div className="monthly-card owner">
                  <span>Mortgage payment · {percent(results.selectedAnnualRate)} rate</span>
                  <strong>{preciseMoney(results.selectedMonthMortgagePayment)}</strong>
                </div>
                <div className="monthly-card">
                  <span>Taxes / month</span>
                  <strong>{preciseMoney(results.monthlyTaxes)}</strong>
                </div>
                <div className="monthly-card">
                  <span className="label-with-info">
                    Monthly costs / month
                    <i
                      aria-label="Monthly costs include utilities, maintenance, and homeowner insurance when entered."
                      className="info-dot"
                      role="img"
                      title="Includes utilities, maintenance, and homeowner insurance when entered."
                    >
                      i
                    </i>
                  </span>
                  <strong>{preciseMoney(monthlyOwnershipCosts)}</strong>
                </div>
                <div className="monthly-card total">
                  <span>Monthly total</span>
                  <strong>{preciseMoney(results.selectedMonthlyOwnerTotal)}</strong>
                </div>
              </div>

              <div className="detail-sheet">
                <DetailRow
                  amount={preciseMoney(results.selectedMonthPrincipal)}
                  label="Principal this month"
                  note="Contributes to equity"
                />
                <DetailRow
                  amount={preciseMoney(results.selectedMonthInterest)}
                  label="Interest this month"
                  note="Cost of borrowing"
                />
                <DetailRow amount={preciseMoney(results.monthlyTaxes)} label="Municipal taxes" />
                <DetailRow
                  amount={preciseMoney(monthlyOwnershipCosts)}
                  label="Monthly costs"
                  note="Utilities + maintenance + homeowner insurance"
                />
                <DetailRow
                  amount={preciseMoney(results.selectedMonthlyOwnerTotal)}
                  emphasis
                  label="Total monthly spending"
                />
              </div>
              <p className="monthly-explainer">
                <strong>Does the monthly cost change?</strong> In this estimate, the mortgage
                payment stays level within each five-year term and is recalculated at renewal using
                the entered rate, remaining balance, and remaining amortization. Entered monthly
                ownership costs stay level. Within each term, interest generally goes down while
                principal—the part that pays off your mortgage—goes up. Once the mortgage is paid
                off, the entered ownership costs remain.
              </p>

              <div className="graph-panel" id="mortgage-graph">
                <div className="graph-heading">
                  <div>
                    <p className="card-kicker">Mortgage graph</p>
                    <h3>Where your mortgage payments went</h3>
                  </div>
                  <span>
                    Through month {results.selectedMonth} - Year {selectedYear}, month{" "}
                    {selectedMonthInYear}
                  </span>
                </div>
                <div className="payment-total">
                  <span>Total mortgage payments to date</span>
                  <strong>{money(principalVsInterestTotal)}</strong>
                  <small>
                    Down payment, taxes, utilities, and advanced costs are not included here.
                  </small>
                </div>
                <div
                  aria-label={`${money(principalVsInterestTotal)} in total mortgage payments: ${money(results.selectedPrincipalPaid)} principal and ${money(results.selectedInterestPaid)} interest`}
                  className="payment-split-bar"
                  role="img"
                >
                  <span
                    className="principal"
                    style={{ width: `${selectedPrincipalPercent}%` }}
                    title={`${percent(selectedPrincipalPercent)} principal`}
                  />
                  <span
                    className="interest"
                    style={{ width: `${selectedInterestPercent}%` }}
                    title={`${percent(selectedInterestPercent)} interest`}
                  />
                </div>
                <div className="payment-split-cards">
                  <div className="principal-card">
                    <div>
                      <i className="legend principal" />
                      <span>Principal paid</span>
                    </div>
                    <strong>{money(results.selectedPrincipalPaid)}</strong>
                    <small>
                      {percent(selectedPrincipalPercent)} of payments. This reduced your mortgage
                      balance and became home equity.
                    </small>
                  </div>
                  <div className="interest-card">
                    <div>
                      <i className="legend interest" />
                      <span>Interest paid</span>
                    </div>
                    <strong>{money(results.selectedInterestPaid)}</strong>
                    <small>
                      {percent(selectedInterestPercent)} of payments. This was the cost of
                      borrowing and did not reduce your balance.
                    </small>
                  </div>
                </div>
                <div className="mortgage-status-grid">
                  <div>
                    <span>Mortgage left to pay</span>
                    <strong>{money(results.balanceAtSelectedMonth)}</strong>
                  </div>
                  <div>
                    <span>Mortgage repaid</span>
                    <strong>{percent(results.paidOffAtSelectedMonth)}</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="schedule-section">
            <div className="schedule-heading">
              <div>
                <p className="eyebrow">Mortgage schedule</p>
                <h2>Year 1 to year 25</h2>
                <p>
                  Principal is the part of each payment that reduces what you still owe. Interest
                  is the cost of borrowing. Municipal taxes are converted from the annual amount
                  to a monthly cost. Mortgage payments are recalculated at each five-year renewal
                  using the entered rate. All entered recurring ownership costs accumulate through
                  each year; closing costs are counted once.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table
                className={
                  hasAdvancedBuyingCosts ? "buying-table with-advanced-costs" : "buying-table"
                }
              >
                <thead>
                  <tr>
                    <th>Year</th>
                    <th><span className="stacked-heading"><span>Mortgage</span><span>rate</span></span></th>
                    <th><span className="stacked-heading"><span>Monthly</span><span>payment</span></span></th>
                    <th><span className="stacked-heading"><span>Principal</span><span>this year</span></span></th>
                    <th><span className="stacked-heading"><span>Interest</span><span>this year</span></span></th>
                    <th><span className="stacked-heading"><span>Cumulative</span><span>principal</span></span></th>
                    <th><span className="stacked-heading"><span>Cumulative</span><span>interest</span></span></th>
                    <th><span className="stacked-heading"><span>Cumulative</span><span>taxes</span></span></th>
                    <th title="Utilities, maintenance, and homeowner insurance when entered.">
                      <span className="stacked-heading">
                        <span>Cumulative</span>
                        <span>monthly costs</span>
                      </span>
                    </th>
                    {results.closingCosts > 0 ? (
                      <th><span className="stacked-heading"><span>Closing</span><span>costs</span></span></th>
                    ) : null}
                    <th>
                      <span className="stacked-heading">
                        <span>Owner payments</span>
                        <span>(excl. down payment)</span>
                      </span>
                    </th>
                    <th><span className="stacked-heading"><span>Mortgage</span><span>left</span></span></th>
                    <th><span className="stacked-heading"><span>Mortgage</span><span>repaid</span></span></th>
                  </tr>
                </thead>
                <tbody>
                  {results.years.map((row) => (
                    <tr key={row.year}>
                      <td><strong>{row.year}</strong></td>
                      <td>{percent(row.annualRate)}</td>
                      <td>{preciseMoney(row.monthlyPayment)}</td>
                      <td>{money(row.principalPaid)}</td>
                      <td>{money(row.interestPaid)}</td>
                      <td>{money(row.totalPrincipalPaid)}</td>
                      <td>{money(row.totalInterestPaid)}</td>
                      <td>{money(results.monthlyTaxes * 12 * row.year)}</td>
                      <td>{money(monthlyOwnershipCosts * 12 * row.year)}</td>
                      {results.closingCosts > 0 ? <td>{money(results.closingCosts)}</td> : null}
                      <td>
                        {money(
                          row.totalPrincipalPaid +
                            row.totalInterestPaid +
                            (results.monthlyTaxes +
                              results.monthlyUtilities +
                              results.monthlyMaintenance +
                              results.monthlyHomeInsurance) *
                              12 *
                              row.year +
                            results.closingCosts,
                        )}
                      </td>
                      <td>{money(row.endingBalance)}</td>
                      <td>{percent(row.paidOffPercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : activeTab === "rent" ? (
        <>
          <div
            aria-labelledby="renting-tab"
            className="workbook rent-workbook"
            id="renting-panel"
            role="tabpanel"
          >
            <section className="input-book" aria-label="Renting inputs">
              <div className="tab-panel">
                <div className="sheet-title">
                  <h2>Renting inputs</h2>
                  <span>Rent-growth worksheet</span>
                </div>
                <div className="field-grid single">
                  <NumberField
                    id="monthly-rent"
                    label="Monthly rent"
                    onChange={(value) => updateInput("monthlyRent", value)}
                    prefix="$"
                    step={50}
                    suffix="/ month"
                    value={inputs.monthlyRent}
                  />
                  <NumberField
                    id="annual-rent-increase"
                    label="Annual rent increase"
                    max={100}
                    onChange={(value) => updateInput("annualRentIncrease", value)}
                    step={0.1}
                    suffix="% / year"
                    value={inputs.annualRentIncrease}
                  />
                </div>
                <p className="input-note">
                  The entered increase is applied once at the start of each rental year. Rental
                  utilities stay level.
                </p>
                <details className="advanced-panel" open>
                  <summary>Advanced renting costs (optional)</summary>
                  <div className="advanced-content">
                    <div className="field-grid single">
                      <NumberField
                        id="monthly-rental-utilities"
                        label="Rental utilities"
                        onChange={(value) => updateInput("monthlyRentalUtilities", value)}
                        prefix="$"
                        step={10}
                        suffix="/ month"
                        value={inputs.monthlyRentalUtilities}
                      />
                    </div>
                    <p>
                      Enter only utilities paid separately by the renter. Leave this at $0 when
                      utilities are included in rent.
                    </p>
                  </div>
                </details>
              </div>
            </section>

            <section className="results-book" aria-live="polite">
              <div className="sheet-title results-title">
                <div>
                  <h2>Monthly spending in month {results.selectedMonth}</h2>
                  <span>Move the timeline slider to compare any month</span>
                </div>
              </div>

              <TimelineSlider selectedMonth={results.selectedMonth} onChange={setSelectedMonth} />

              <div className="monthly-grid four-up rent-summary">
                <div className="monthly-card rent">
                  <span>Monthly rent in month {results.selectedMonth}</span>
                  <strong>{preciseMoney(results.selectedMonthlyRent)}</strong>
                </div>
                <div className="monthly-card">
                  <span>Rental utilities</span>
                  <strong>{preciseMoney(results.monthlyRentalUtilities)}</strong>
                </div>
                <div className="monthly-card total">
                  <span>Monthly renting total</span>
                  <strong>
                    {preciseMoney(
                      results.selectedMonthlyRent + results.monthlyRentalUtilities,
                    )}
                  </strong>
                </div>
                <div className="monthly-card total">
                  <span>Cash paid through month {results.selectedMonth}</span>
                  <strong>{money(results.selectedRentCash)}</strong>
                </div>
              </div>
            </section>
          </div>

          <section className="schedule-section">
            <div className="schedule-heading">
              <div>
                <p className="eyebrow">Rent schedule</p>
                <h2>Year 1 to year 25</h2>
                <p>
                  Monthly rent increases once per year by the entered rate. Rental utilities remain
                  level.
                </p>
              </div>
              <div className="schedule-stat rent-stat">
                <span>Total renting cash at selected month</span>
                <strong>{money(results.selectedRentCash)}</strong>
              </div>
            </div>

            <div className="table-wrap">
              <table
                className={
                  hasAdvancedRentingCosts ? "rent-table with-advanced-costs" : "rent-table"
                }
              >
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Monthly rent</th>
                    {hasAdvancedRentingCosts ? <th>Monthly utilities</th> : null}
                    <th>Rent paid this year</th>
                    <th>Total rent paid</th>
                    {hasAdvancedRentingCosts ? <th>Total utilities</th> : null}
                    <th>Total renting cash</th>
                  </tr>
                </thead>
                <tbody>
                  {results.rentYears.map((row) => (
                    <tr key={row.year}>
                      <td><strong>{row.year}</strong></td>
                      <td>{preciseMoney(row.monthlyRent)}</td>
                      {hasAdvancedRentingCosts ? (
                        <td>{preciseMoney(results.monthlyRentalUtilities)}</td>
                      ) : null}
                      <td>{money(row.annualRent)}</td>
                      <td>{money(row.totalRent)}</td>
                      {hasAdvancedRentingCosts ? (
                        <td>{money(row.totalRentalUtilities)}</td>
                      ) : null}
                      <td>{money(row.totalRentalCash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          <div
            aria-labelledby="comparison-tab"
            className="workbook comparison-workbook"
            id="comparison-panel"
            role="tabpanel"
          >
            <section className="results-book comparison-panel" aria-live="polite">
              <div className="sheet-title results-title">
                <div>
                  <h2>Buy vs. rent through month {results.selectedMonth}</h2>
                  <span>Simplified cash paid and estimated home equity on the same timeline</span>
                </div>
              </div>

              <TimelineSlider selectedMonth={results.selectedMonth} onChange={setSelectedMonth} />

              <div className="comparison-assumptions" aria-label="Active comparison assumptions">
                <div>
                  <span>Home price</span>
                  <strong>{money(results.purchasePrice)}</strong>
                </div>
                <div>
                  <span>Down payment</span>
                  <strong>{percent(results.downPaymentPercent)}</strong>
                </div>
                <div>
                  <span>Mortgage rate in month {results.selectedMonth}</span>
                  <strong>{percent(results.selectedAnnualRate)}</strong>
                </div>
                <div>
                  <span>Rent + utilities in month {results.selectedMonth}</span>
                  <strong>
                    {preciseMoney(
                      results.selectedMonthlyRent + results.monthlyRentalUtilities,
                    )}
                  </strong>
                </div>
              </div>

              <div className="comparison-options">
                <label className="comparison-option">
                  <input
                    checked={includeOwnerExtras}
                    onChange={(event) => setIncludeOwnerExtras(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Include taxes and utilities in buying cash paid</strong>
                    <small>
                      Turn off to exclude these two ownership costs. Maintenance, homeowner
                      insurance, closing costs, and rental utilities remain included when entered.
                    </small>
                  </span>
                </label>

              </div>

              <div className="comparison-overview">
                <section className="comparison-side buying-side">
                  <div className="comparison-side-heading">
                    <strong>Buying</strong>
                    <span>Through month {results.selectedMonth}</span>
                  </div>
                  <div className="comparison-metrics">
                    <div className="comparison-metric cash-metric">
                      <span>Total cash paid</span>
                      <strong>{money(comparisonBuyingTotal)}</strong>
                      <small>{buyingTotalBreakdown}</small>
                    </div>
                    <div className="comparison-metric equity-metric">
                      <span>Estimated home equity</span>
                      <strong>{money(comparisonHomeEquity)}</strong>
                      <small>Home price minus mortgage balance; home value held level</small>
                    </div>
                    <div className="comparison-metric cost-metric">
                      <span>Non-equity cost incurred</span>
                      <strong>{money(comparisonBuyingCost)}</strong>
                      <small>
                        {buyingCostBreakdown}. Maintenance, homeowner insurance, and closing costs
                        are included when entered.
                      </small>
                    </div>
                  </div>
                  <div className="comparison-upfront">
                    <span>
                      <strong>Down payment</strong>
                      <small>Up-front cash · included in total cash paid and estimated equity</small>
                    </span>
                    <strong>{money(results.downPayment)}</strong>
                  </div>
                  {results.cmhcPremium > 0 ? (
                    <div className="comparison-upfront cmhc-upfront">
                      <span>
                        <strong>Estimated CMHC premium</strong>
                        <small>Financed into the mortgage · included in non-equity cost</small>
                      </span>
                      <strong>{money(results.cmhcPremium)}</strong>
                    </div>
                  ) : null}
                  {results.closingCosts > 0 ? (
                    <div className="comparison-upfront closing-upfront">
                      <span>
                        <strong>Closing costs</strong>
                        <small>One-time cash · included in non-equity cost</small>
                      </span>
                      <strong>{money(results.closingCosts)}</strong>
                    </div>
                  ) : null}
                </section>

                <section className="comparison-side renting-side">
                  <div className="comparison-side-heading">
                    <strong>Renting</strong>
                    <span>Through month {results.selectedMonth}</span>
                  </div>
                  <div className="comparison-metrics">
                    <div className="comparison-metric cash-metric">
                      <span>Total cash paid</span>
                      <strong>{money(results.selectedRentCash)}</strong>
                      <small>
                        {results.monthlyRentalUtilities > 0
                          ? "Rent + rental utilities"
                          : "Flat rent paid to date"}
                      </small>
                    </div>
                    <div className="comparison-metric equity-metric">
                      <span>Estimated home equity</span>
                      <strong>$0</strong>
                      <small>Rent does not reduce a mortgage</small>
                    </div>
                    <div className="comparison-metric cost-metric">
                      <span>Non-equity cost incurred</span>
                      <strong>{money(results.selectedRentCash)}</strong>
                      <small>All entered renting cash is a housing cost</small>
                    </div>
                  </div>
                </section>
              </div>

              <div className="graph-panel comparison-graph">
                <div className="graph-heading">
                  <div>
                    <p className="card-kicker">Same-timescale comparison</p>
                    <h3>Total cash paid and estimated equity</h3>
                  </div>
                  <span>
                    Through month {results.selectedMonth} - Year {selectedYear}, month{" "}
                    {selectedMonthInYear}
                  </span>
                </div>

                <div className="comparison-bar-group">
                  <div className="comparison-bar-label">
                    <div>
                      <strong>Buying · cash paid</strong>
                      <small>
                        The down payment and principal repayment contribute to home equity. The
                        down payment is included in this bar.
                      </small>
                    </div>
                    <strong>{money(comparisonBuyingGraphTotal)}</strong>
                  </div>
                  <div
                    aria-label={`${money(comparisonBuyingGraphTotal)} in buying cash paid: ${money(results.downPayment)} down payment, ${money(results.selectedPrincipalPaid)} mortgage principal, ${money(results.selectedInterestPaid)} interest${includeOwnerExtras ? `, ${money(selectedOwnerExtras)} in taxes and utilities` : ""}${selectedMaintenancePaid > 0 ? `, ${money(selectedMaintenancePaid)} in maintenance` : ""}${selectedHomeInsurancePaid > 0 ? `, ${money(selectedHomeInsurancePaid)} in homeowner insurance` : ""}${results.closingCosts > 0 ? `, and ${money(results.closingCosts)} in closing costs` : ""}`}
                    className="comparison-track"
                    role="img"
                  >
                    <span
                      className="principal-fill"
                      style={{ width: `${comparisonPrincipalWidth}%` }}
                      title={`${money(results.selectedPrincipalPaid)} principal`}
                    />
                    <span
                      className="down-payment-fill"
                      style={{ width: `${comparisonDownPaymentWidth}%` }}
                      title={`${money(results.downPayment)} down payment`}
                    />
                    <span
                      className="interest-fill"
                      style={{ width: `${comparisonInterestWidth}%` }}
                      title={`${money(results.selectedInterestPaid)} interest`}
                    />
                    {includeOwnerExtras ? (
                      <span
                        className="owner-extras-fill"
                        style={{ width: `${comparisonOwnerExtrasWidth}%` }}
                        title={`${money(selectedOwnerExtras)} taxes and utilities`}
                      />
                    ) : null}
                    {selectedMaintenancePaid > 0 ? (
                      <span
                        className="maintenance-fill"
                        style={{ width: `${comparisonMaintenanceWidth}%` }}
                        title={`${money(selectedMaintenancePaid)} maintenance`}
                      />
                    ) : null}
                    {selectedHomeInsurancePaid > 0 ? (
                      <span
                        className="home-insurance-fill"
                        style={{ width: `${comparisonHomeInsuranceWidth}%` }}
                        title={`${money(selectedHomeInsurancePaid)} homeowner insurance`}
                      />
                    ) : null}
                    {results.closingCosts > 0 ? (
                      <span
                        className="closing-costs-fill"
                        style={{ width: `${comparisonClosingCostsWidth}%` }}
                        title={`${money(results.closingCosts)} closing costs`}
                      />
                    ) : null}
                  </div>
                  <div className="comparison-legend">
                    <span><i className="legend principal" />Mortgage principal {money(results.selectedPrincipalPaid)}</span>
                    <span>
                      <i className="legend down-payment" />
                      Down payment {money(results.downPayment)}
                    </span>
                    <span><i className="legend interest" />Interest {money(results.selectedInterestPaid)}</span>
                    {includeOwnerExtras ? (
                      <span>
                        <i className="legend owner-extras" />
                        Taxes + utilities {money(selectedOwnerExtras)}
                      </span>
                    ) : null}
                    {selectedMaintenancePaid > 0 ? (
                      <span>
                        <i className="legend maintenance" />
                        Maintenance {money(selectedMaintenancePaid)}
                      </span>
                    ) : null}
                    {selectedHomeInsurancePaid > 0 ? (
                      <span>
                        <i className="legend home-insurance" />
                        Homeowner insurance {money(selectedHomeInsurancePaid)}
                      </span>
                    ) : null}
                    {results.closingCosts > 0 ? (
                      <span>
                        <i className="legend closing-costs" />
                        Closing costs {money(results.closingCosts)}
                      </span>
                    ) : null}
                    {!hasAdvancedBuyingCosts ? (
                      <span>
                        <i className="legend empty-legend" />
                        Advanced costs appear here when entered
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="comparison-bar-group">
                  <div className="comparison-bar-label">
                    <div>
                      <strong>Renting · cash paid</strong>
                      <small>All rent is a housing cost; it does not build home equity.</small>
                    </div>
                    <strong>{money(results.selectedRentCash)}</strong>
                  </div>
                  <div
                    aria-label={`${money(results.selectedRentCash)} in renting cash paid: ${money(results.selectedRentPaid)} rent and ${money(results.selectedRentalUtilitiesPaid)} rental utilities`}
                    className="comparison-track"
                    role="img"
                  >
                    <span
                      className="rent-fill"
                      style={{ width: `${comparisonRentWidth}%` }}
                      title={`${money(results.selectedRentPaid)} rent`}
                    />
                    {results.selectedRentalUtilitiesPaid > 0 ? (
                      <span
                        className="rental-utilities-fill"
                        style={{ width: `${comparisonRentUtilitiesWidth}%` }}
                        title={`${money(results.selectedRentalUtilitiesPaid)} rental utilities`}
                      />
                    ) : null}
                  </div>
                  <div className="comparison-legend">
                    <span><i className="legend rent-legend" />Rent {money(results.selectedRentPaid)}</span>
                    {results.selectedRentalUtilitiesPaid > 0 ? (
                      <span>
                        <i className="legend rental-utilities" />
                        Rental utilities {money(results.selectedRentalUtilitiesPaid)}
                      </span>
                    ) : null}
                    <span><i className="legend empty-legend" />Home equity $0</span>
                  </div>
                </div>
              </div>

              <p className="comparison-note">
                Buying cash paid includes the down payment, mortgage payments, enabled ownership
                costs, and entered closing costs. Estimated home equity is the entered home price
                minus the remaining mortgage balance, so a financed CMHC premium reduces equity.
                Buying&apos;s non-equity cost incurred is
                {results.cmhcPremium > 0 ? " the estimated CMHC premium plus" : ""} interest
                {includeOwnerExtras ? " plus municipal taxes and utilities" : ""}
                {selectedMaintenancePaid > 0 ? " plus entered maintenance" : ""}
                {selectedHomeInsurancePaid > 0 ? " plus entered homeowner insurance" : ""}
                {results.closingCosts > 0 ? " plus entered closing costs" : ""};
                renting&apos;s cash paid includes rent
                {results.monthlyRentalUtilities > 0 ? " and entered rental utilities" : ""} and is
                also its included housing cost. Changes in home value and any costs left at $0
                are not included.
                {!includeOwnerExtras ? " Municipal taxes and utilities are excluded." : ""}
              </p>
            </section>
          </div>

          <section className="schedule-section">
            <div className="schedule-heading">
              <div>
                <p className="eyebrow">Buy vs. rent schedule</p>
                <h2>Year 1 to year 25</h2>
                <p>
                  Compare cumulative buying payments with cumulative rent. Principal is shown
                  separately because it reduces the mortgage. The down payment is always included
                  in buying cash paid and estimated home equity. Taxes and utilities follow the
                  checkbox above.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table
                className={
                  hasAdvancedBuyingCosts || hasAdvancedRentingCosts
                    ? "comparison-table with-advanced-costs"
                    : "comparison-table"
                }
              >
                <thead>
                  <tr>
                    <th>Year</th>
                    <th><span className="stacked-heading"><span>Buying</span><span>cash paid</span></span></th>
                    <th><span className="stacked-heading"><span>Estimated</span><span>home equity</span></span></th>
                    <th><span className="stacked-heading"><span>Down</span><span>payment</span></span></th>
                    {results.cmhcPremium > 0 ? (
                      <th><span className="stacked-heading"><span>CMHC</span><span>premium</span></span></th>
                    ) : null}
                    <th><span className="stacked-heading"><span>Principal</span><span>paid</span></span></th>
                    <th>
                      <span className="stacked-heading">
                        <span>Non-equity</span>
                        <span>buying cost</span>
                      </span>
                    </th>
                    <th><span className="stacked-heading"><span>Interest</span><span>cost</span></span></th>
                    <th><span className="stacked-heading"><span>Taxes +</span><span>utilities</span></span></th>
                    {results.monthlyMaintenance > 0 ? (
                      <th><span className="stacked-heading"><span>Main-</span><span>tenance</span></span></th>
                    ) : null}
                    {results.monthlyHomeInsurance > 0 ? (
                      <th><span className="stacked-heading"><span>Homeowner</span><span>insurance</span></span></th>
                    ) : null}
                    {results.closingCosts > 0 ? (
                      <th><span className="stacked-heading"><span>Closing</span><span>costs</span></span></th>
                    ) : null}
                    <th><span className="stacked-heading"><span>Rent</span><span>cash paid</span></span></th>
                    {hasAdvancedRentingCosts ? (
                      <th><span className="stacked-heading"><span>Rental</span><span>utilities</span></span></th>
                    ) : null}
                    <th><span className="stacked-heading"><span>Rent home</span><span>equity</span></span></th>
                  </tr>
                </thead>
                <tbody>
                  {results.years.map((row, index) => (
                    <tr key={row.year}>
                      <td><strong>{row.year}</strong></td>
                      <td>
                        {money(
                          results.downPayment +
                            row.totalPrincipalPaid +
                            row.totalInterestPaid +
                            (includeOwnerExtras
                              ? (results.monthlyTaxes + results.monthlyUtilities) *
                                12 *
                                row.year
                              : 0) +
                            (results.monthlyMaintenance + results.monthlyHomeInsurance) *
                              12 *
                              row.year +
                            results.closingCosts,
                        )}
                      </td>
                      <td>
                        {money(Math.max(0, results.purchasePrice - row.endingBalance))}
                      </td>
                      <td>{money(results.downPayment)}</td>
                      {results.cmhcPremium > 0 ? <td>{money(results.cmhcPremium)}</td> : null}
                      <td>{money(row.totalPrincipalPaid)}</td>
                      <td>
                        {money(
                          results.cmhcPremium +
                            row.totalInterestPaid +
                            (includeOwnerExtras
                              ? (results.monthlyTaxes + results.monthlyUtilities) *
                                12 *
                                row.year
                              : 0) +
                            (results.monthlyMaintenance + results.monthlyHomeInsurance) *
                              12 *
                              row.year +
                            results.closingCosts,
                        )}
                      </td>
                      <td>{money(row.totalInterestPaid)}</td>
                      <td className={!includeOwnerExtras ? "excluded-cell" : undefined}>
                        {includeOwnerExtras
                          ? money(
                              (results.monthlyTaxes + results.monthlyUtilities) *
                                12 *
                                row.year,
                            )
                          : "Excluded"}
                      </td>
                      {results.monthlyMaintenance > 0 ? (
                        <td>{money(results.monthlyMaintenance * 12 * row.year)}</td>
                      ) : null}
                      {results.monthlyHomeInsurance > 0 ? (
                        <td>{money(results.monthlyHomeInsurance * 12 * row.year)}</td>
                      ) : null}
                      {results.closingCosts > 0 ? <td>{money(results.closingCosts)}</td> : null}
                      <td>{money(results.rentYears[index]?.totalRentalCash ?? 0)}</td>
                      {hasAdvancedRentingCosts ? (
                        <td>{money(results.rentYears[index]?.totalRentalUtilities ?? 0)}</td>
                      ) : null}
                      <td>$0</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <footer>
        <p>
          Simplified cash-flow estimate only. Entered maintenance, homeowner insurance, closing
          costs, rental utilities, entered five-year renewal rates, annual rent increases, and an
          eligible estimated CMHC premium are included. These rates are scenarios, not forecasts.
          Home-price changes, investment returns, selling costs, and tenant insurance are excluded.
        </p>
      </footer>
    </main>
  )
}
