"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type CalculatorInputs = {
  purchasePrice: number
  downPaymentPercent: number
  interestRate: number
  amortizationYears: number
  annualTaxes: number
  monthlyUtilities: number
  monthlyRent: number
  monthlyMaintenance: number
  monthlyHomeInsurance: number
  closingCosts: number
  monthlyRentalUtilities: number
}

type MonthlyRow = {
  month: number
  principalPaid: number
  interestPaid: number
  totalPrincipalPaid: number
  totalInterestPaid: number
  endingBalance: number
  paidOffPercent: number
}

type YearRow = {
  year: number
  principalPaid: number
  interestPaid: number
  totalPrincipalPaid: number
  totalInterestPaid: number
  endingBalance: number
  paidOffPercent: number
}

const initialInputs: CalculatorInputs = {
  purchasePrice: 650000,
  downPaymentPercent: 20,
  interestRate: 4.3,
  amortizationYears: 25,
  annualTaxes: 4400,
  monthlyUtilities: 375,
  monthlyRent: 2700,
  monthlyMaintenance: 0,
  monthlyHomeInsurance: 0,
  closingCosts: 0,
  monthlyRentalUtilities: 0,
}

const LONG_TERM_YEARS = 25
const LONG_TERM_MONTHS = LONG_TERM_YEARS * 12

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

function buildSchedule(mortgageAmount: number, annualRate: number, amortizationYears: number) {
  const safeMortgage = Math.max(0, mortgageAmount)
  const safeYears = Math.max(1, Math.round(amortizationYears))
  const numberOfPayments = safeYears * 12
  const nominalAnnualRate = Math.max(0, annualRate) / 100

  // Canadian fixed mortgage rates are quoted with semi-annual compounding.
  const monthlyRate =
    nominalAnnualRate === 0 ? 0 : (1 + nominalAnnualRate / 2) ** (1 / 6) - 1
  const monthlyPayment =
    safeMortgage === 0
      ? 0
      : monthlyRate === 0
        ? safeMortgage / numberOfPayments
        : (safeMortgage * monthlyRate * (1 + monthlyRate) ** numberOfPayments) /
          ((1 + monthlyRate) ** numberOfPayments - 1)

  const months: MonthlyRow[] = []
  let balance = safeMortgage
  let totalPrincipalPaid = 0
  let totalInterestPaid = 0

  for (let month = 1; month <= Math.max(numberOfPayments, LONG_TERM_MONTHS); month += 1) {
    const interestPaid = balance > 0.005 ? balance * monthlyRate : 0
    const principalPaid =
      balance > 0.005 ? Math.min(Math.max(0, monthlyPayment - interestPaid), balance) : 0

    totalPrincipalPaid += principalPaid
    totalInterestPaid += interestPaid
    balance = Math.max(0, balance - principalPaid)

    months.push({
      month,
      principalPaid,
      interestPaid,
      totalPrincipalPaid,
      totalInterestPaid,
      endingBalance: balance,
      paidOffPercent: safeMortgage === 0 ? 100 : Math.min(100, (totalPrincipalPaid / safeMortgage) * 100),
    })
  }

  const years: YearRow[] = Array.from({ length: LONG_TERM_YEARS }, (_, index) => {
    const year = index + 1
    const yearMonths = months.slice(index * 12, year * 12)
    const lastMonth = yearMonths.at(-1) ?? months.at(-1)

    return {
      year,
      principalPaid: yearMonths.reduce((sum, row) => sum + row.principalPaid, 0),
      interestPaid: yearMonths.reduce((sum, row) => sum + row.interestPaid, 0),
      totalPrincipalPaid: lastMonth?.totalPrincipalPaid ?? 0,
      totalInterestPaid: lastMonth?.totalInterestPaid ?? 0,
      endingBalance: lastMonth?.endingBalance ?? 0,
      paidOffPercent: lastMonth?.paidOffPercent ?? 100,
    }
  })

  return { monthlyPayment, monthlyRate, months, years }
}

function NumberField({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
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
      <span className="field-label">{label}</span>
      <span className="input-shell">
        {prefix ? <span className="input-affix">{prefix}</span> : null}
        <input
          id={id}
          inputMode="decimal"
          max={max}
          min={min}
          onBlur={() => {
            if (draftValue.trim() === "") {
              setDraftValue("0")
              onChange(0)
            }
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
  const [includeDownPayment, setIncludeDownPayment] = useState(false)

  const results = useMemo(() => {
    const purchasePrice = Math.max(0, inputs.purchasePrice)
    const downPaymentPercent = Math.min(100, Math.max(0, inputs.downPaymentPercent))
    const downPayment = purchasePrice * (downPaymentPercent / 100)
    const mortgageAmount = Math.max(0, purchasePrice - downPayment)
    const schedule = buildSchedule(mortgageAmount, inputs.interestRate, inputs.amortizationYears)
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
    const selectedMonthMortgagePayment = selectedMonthPrincipal + selectedMonthInterest
    const selectedMonthlyOwnerTotal =
      selectedMonthMortgagePayment + monthlyTaxes + monthlyUtilities + monthlyOwnerAdvanced
    const selectedPrincipalPaid = selectedScheduleRow?.totalPrincipalPaid ?? 0
    const selectedInterestPaid = selectedScheduleRow?.totalInterestPaid ?? 0
    const monthlyRent = Math.max(0, inputs.monthlyRent)
    const monthlyRentalUtilities = Math.max(0, inputs.monthlyRentalUtilities)
    const selectedRentPaid = monthlyRent * safeSelectedMonth
    const selectedRentalUtilitiesPaid = monthlyRentalUtilities * safeSelectedMonth
    const selectedRentCash = selectedRentPaid + selectedRentalUtilitiesPaid
    const selectedOwnerAdvancedPaid = monthlyOwnerAdvanced * safeSelectedMonth

    const rentYears = Array.from({ length: LONG_TERM_YEARS }, (_, index) => {
      const year = index + 1
      return {
        year,
        annualRent: monthlyRent * 12,
        totalRent: monthlyRent * 12 * year,
        annualRentalUtilities: monthlyRentalUtilities * 12,
        totalRentalUtilities: monthlyRentalUtilities * 12 * year,
        totalRentalCash: (monthlyRent + monthlyRentalUtilities) * 12 * year,
      }
    })

    return {
      ...schedule,
      purchasePrice,
      downPaymentPercent,
      downPayment,
      mortgageAmount,
      monthlyTaxes,
      monthlyUtilities,
      monthlyMaintenance,
      monthlyHomeInsurance,
      monthlyOwnerAdvanced,
      closingCosts,
      monthlyRent,
      monthlyRentalUtilities,
      selectedMonth: safeSelectedMonth,
      selectedMonthPrincipal,
      selectedMonthInterest,
      selectedMonthMortgagePayment,
      selectedMonthlyOwnerTotal,
      selectedPrincipalPaid,
      selectedInterestPaid,
      selectedOwnerAdvancedPaid,
      selectedRentPaid,
      selectedRentalUtilitiesPaid,
      selectedRentCash,
      balanceAtSelectedMonth: selectedScheduleRow?.endingBalance ?? 0,
      paidOffAtSelectedMonth: selectedScheduleRow?.paidOffPercent ?? 100,
      rentYears,
    }
  }, [inputs, selectedMonth])

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
  const selectedOwnerExtras =
    (results.monthlyTaxes + results.monthlyUtilities) * results.selectedMonth
  const selectedMaintenancePaid = results.monthlyMaintenance * results.selectedMonth
  const selectedHomeInsurancePaid = results.monthlyHomeInsurance * results.selectedMonth
  const selectedAdvancedBuyingCosts =
    selectedMaintenancePaid + selectedHomeInsurancePaid + results.closingCosts
  const comparisonBuyingTotal =
    principalVsInterestTotal +
    (includeOwnerExtras ? selectedOwnerExtras : 0) +
    selectedAdvancedBuyingCosts
  const comparisonHomeEquity =
    results.selectedPrincipalPaid + (includeDownPayment ? results.downPayment : 0)
  const comparisonBuyingCost =
    results.selectedInterestPaid +
    (includeOwnerExtras ? selectedOwnerExtras : 0) +
    selectedAdvancedBuyingCosts
  const hasAdvancedBuyingCosts =
    results.monthlyMaintenance > 0 ||
    results.monthlyHomeInsurance > 0 ||
    results.closingCosts > 0
  const hasAdvancedRentingCosts = results.monthlyRentalUtilities > 0
  const buyingTotalBreakdown = [
    "Principal",
    "interest",
    ...(includeOwnerExtras ? ["taxes", "utilities"] : []),
    ...(results.monthlyMaintenance > 0 ? ["maintenance"] : []),
    ...(results.monthlyHomeInsurance > 0 ? ["insurance"] : []),
    ...(results.closingCosts > 0 ? ["closing costs"] : []),
  ].join(" + ")
  const buyingCostBreakdown = [
    "Interest",
    ...(includeOwnerExtras ? ["taxes", "utilities"] : []),
    ...(results.monthlyMaintenance > 0 ? ["maintenance"] : []),
    ...(results.monthlyHomeInsurance > 0 ? ["insurance"] : []),
    ...(results.closingCosts > 0 ? ["closing costs"] : []),
  ].join(" + ")
  const comparisonMax = Math.max(
    1,
    comparisonBuyingTotal,
    includeDownPayment ? results.downPayment : 0,
    results.selectedRentCash,
  )
  const comparisonPrincipalWidth = (results.selectedPrincipalPaid / comparisonMax) * 100
  const comparisonInterestWidth = (results.selectedInterestPaid / comparisonMax) * 100
  const comparisonOwnerExtrasWidth =
    includeOwnerExtras ? (selectedOwnerExtras / comparisonMax) * 100 : 0
  const comparisonMaintenanceWidth = (selectedMaintenancePaid / comparisonMax) * 100
  const comparisonHomeInsuranceWidth = (selectedHomeInsurancePaid / comparisonMax) * 100
  const comparisonClosingCostsWidth = (results.closingCosts / comparisonMax) * 100
  const comparisonDownPaymentWidth =
    includeDownPayment ? (results.downPayment / comparisonMax) * 100 : 0
  const comparisonRentWidth = (results.selectedRentPaid / comparisonMax) * 100
  const comparisonRentUtilitiesWidth =
    (results.selectedRentalUtilitiesPaid / comparisonMax) * 100
  const resetCalculator = () => {
    setInputs(initialInputs)
    setSelectedMonth(1)
    setIncludeOwnerExtras(true)
    setIncludeDownPayment(false)
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Home Decision Calculator">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span>Home Decision Calculator</span>
        </a>
        <button className="reset-button" onClick={resetCalculator} type="button">
          Reset
        </button>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">Buy or rent worksheet</p>
          <h1>Simple housing calculator.</h1>
          <p className="hero-copy">
            Use the Buying tab for the mortgage and ownership costs. Switch to Renting for a
            separate flat-rent projection, or compare mortgage payments, rent, and equity on the
            same 25-year timeline.
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
                <div className="formula-grid">
                  <div>
                    <span>Down payment amount</span>
                    <strong>{money(results.downPayment)}</strong>
                  </div>
                  <div>
                    <span>Mortgage amount</span>
                    <strong>{money(results.mortgageAmount)}</strong>
                  </div>
                </div>
                <p className="input-note">
                  Uses the Canadian convention of semi-annual compounding. Mortgage insurance is
                  not included.
                </p>
                <details className="advanced-panel">
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
                  <span>Mortgage payment</span>
                  <strong>{preciseMoney(results.selectedMonthMortgagePayment)}</strong>
                </div>
                <div className="monthly-card">
                  <span>Taxes / month</span>
                  <strong>{preciseMoney(results.monthlyTaxes)}</strong>
                </div>
                <div className="monthly-card">
                  <span>Utilities / month</span>
                  <strong>{preciseMoney(results.monthlyUtilities)}</strong>
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
                  note="Reduces what you owe"
                />
                <DetailRow
                  amount={preciseMoney(results.selectedMonthInterest)}
                  label="Interest this month"
                  note="Cost of borrowing"
                />
                <DetailRow amount={preciseMoney(results.monthlyTaxes)} label="Municipal taxes" />
                <DetailRow amount={preciseMoney(results.monthlyUtilities)} label="Utilities" />
                {results.monthlyMaintenance > 0 ? (
                  <DetailRow
                    amount={preciseMoney(results.monthlyMaintenance)}
                    label="Maintenance"
                  />
                ) : null}
                {results.monthlyHomeInsurance > 0 ? (
                  <DetailRow
                    amount={preciseMoney(results.monthlyHomeInsurance)}
                    label="Homeowner insurance"
                  />
                ) : null}
                <DetailRow
                  amount={preciseMoney(results.selectedMonthlyOwnerTotal)}
                  emphasis
                  label="Total monthly spending"
                />
              </div>
              <p className="monthly-explainer">
                <strong>Does the monthly cost change?</strong> In this estimate, the mortgage
                payment and all entered monthly costs stay level. What changes each month is the
                mortgage split: interest goes down while principal—the part that pays off your
                mortgage—goes up. Once the mortgage is paid off, the entered ownership costs
                remain.
              </p>

              <div className="graph-panel" id="mortgage-graph">
                <div className="graph-heading">
                  <div>
                    <p className="card-kicker">Mortgage graph</p>
                    <h3>Where your mortgage payments went</h3>
                  </div>
                  <span>Through month {results.selectedMonth}</span>
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
                  to a monthly cost. All entered recurring ownership costs accumulate through each
                  year; closing costs are counted once.
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
                    <th>Principal this year</th>
                    <th>Interest this year</th>
                    <th>Cumulative principal</th>
                    <th>Cumulative interest</th>
                    <th>Cumulative taxes</th>
                    <th>Cumulative utilities</th>
                    {results.monthlyMaintenance > 0 ? <th>Cumulative maintenance</th> : null}
                    {results.monthlyHomeInsurance > 0 ? <th>Cumulative insurance</th> : null}
                    {results.closingCosts > 0 ? <th>Closing costs</th> : null}
                    <th>Owner payments (excl. down payment)</th>
                    <th>Mortgage left</th>
                    <th>Mortgage repaid</th>
                  </tr>
                </thead>
                <tbody>
                  {results.years.map((row) => (
                    <tr key={row.year}>
                      <td><strong>{row.year}</strong></td>
                      <td>{money(row.principalPaid)}</td>
                      <td>{money(row.interestPaid)}</td>
                      <td>{money(row.totalPrincipalPaid)}</td>
                      <td>{money(row.totalInterestPaid)}</td>
                      <td>{money(results.monthlyTaxes * 12 * row.year)}</td>
                      <td>{money(results.monthlyUtilities * 12 * row.year)}</td>
                      {results.monthlyMaintenance > 0 ? (
                        <td>{money(results.monthlyMaintenance * 12 * row.year)}</td>
                      ) : null}
                      {results.monthlyHomeInsurance > 0 ? (
                        <td>{money(results.monthlyHomeInsurance * 12 * row.year)}</td>
                      ) : null}
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
                  <span>Flat-rent worksheet</span>
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
                </div>
                <p className="input-note">
                  Rent stays at the same monthly amount. No annual rent increase is applied.
                </p>
                <details className="advanced-panel">
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
                  <h2>Renting cost</h2>
                  <span>Separate from the mortgage worksheet</span>
                </div>
              </div>

              <div className="monthly-grid four-up rent-summary">
                <div className="monthly-card rent">
                  <span>Monthly rent</span>
                  <strong>{preciseMoney(results.monthlyRent)}</strong>
                </div>
                <div className="monthly-card">
                  <span>Rental utilities</span>
                  <strong>{preciseMoney(results.monthlyRentalUtilities)}</strong>
                </div>
                <div className="monthly-card total">
                  <span>Monthly renting total</span>
                  <strong>
                    {preciseMoney(results.monthlyRent + results.monthlyRentalUtilities)}
                  </strong>
                </div>
                <div className="monthly-card total">
                  <span>Cash paid through month {results.selectedMonth}</span>
                  <strong>{money(results.selectedRentCash)}</strong>
                </div>
              </div>

              <TimelineSlider selectedMonth={results.selectedMonth} onChange={setSelectedMonth} />

              <div className="selected-grid rent-milestones">
                {[1, 5, 10, 25].map((year) => (
                  <div key={year}>
                    <span>Renting cash after {year} {year === 1 ? "year" : "years"}</span>
                    <strong>
                      {money(
                        (results.monthlyRent + results.monthlyRentalUtilities) * 12 * year,
                      )}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="schedule-section">
            <div className="schedule-heading">
              <div>
                <p className="eyebrow">Rent schedule</p>
                <h2>Year 1 to year 25</h2>
                <p>
                  This projection keeps monthly rent and entered rental utilities level, with no
                  annual increase.
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
                      <td>{preciseMoney(results.monthlyRent)}</td>
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
                  <span>Buying payments and equity compared with rent and entered utilities</span>
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
                  <span>Interest rate</span>
                  <strong>{percent(inputs.interestRate)}</strong>
                </div>
                <div>
                  <span>Monthly rent</span>
                  <strong>{preciseMoney(results.monthlyRent)}</strong>
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

                <label className="comparison-option">
                  <input
                    checked={includeDownPayment}
                    onChange={(event) => setIncludeDownPayment(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Include down payment in home equity</strong>
                    <small>
                      Add it to mortgage equity while keeping the up-front cash amount separate.
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
                      <span>Cash paid</span>
                      <strong>{money(comparisonBuyingTotal)}</strong>
                      <small>{buyingTotalBreakdown}; down payment separate</small>
                    </div>
                    <div className="comparison-metric equity-metric">
                      <span>Mortgage equity built</span>
                      <strong>{money(comparisonHomeEquity)}</strong>
                      <small>
                        {includeDownPayment ? "Principal + down payment" : "Principal paid to date"}
                      </small>
                    </div>
                    <div className="comparison-metric cost-metric">
                      <span>Non-equity housing cost</span>
                      <strong>{money(comparisonBuyingCost)}</strong>
                      <small>{buyingCostBreakdown}</small>
                    </div>
                  </div>
                  {includeDownPayment ? (
                    <div className="comparison-upfront">
                      <span>
                        <strong>Down payment</strong>
                        <small>Up-front cash shown separately · included in equity</small>
                      </span>
                      <strong>{money(results.downPayment)}</strong>
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
                      <span>Cash paid</span>
                      <strong>{money(results.selectedRentCash)}</strong>
                      <small>
                        {results.monthlyRentalUtilities > 0
                          ? "Rent + rental utilities"
                          : "Flat rent paid to date"}
                      </small>
                    </div>
                    <div className="comparison-metric equity-metric">
                      <span>Home equity built</span>
                      <strong>$0</strong>
                      <small>Rent does not reduce a mortgage</small>
                    </div>
                    <div className="comparison-metric cost-metric">
                      <span>Non-equity housing cost</span>
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
                    <h3>Total paid and equity built</h3>
                  </div>
                  <span>Through month {results.selectedMonth}</span>
                </div>

                <div className="comparison-bar-group">
                  <div className="comparison-bar-label">
                    <div>
                      <strong>Buying · cash paid</strong>
                      <small>
                        Principal{includeDownPayment ? " and the down payment build" : " builds"}{" "}
                        equity.{" "}
                        {includeDownPayment
                          ? "The down payment is shown separately from this bar."
                          : "The down payment is excluded."}
                      </small>
                    </div>
                    <strong>{money(comparisonBuyingTotal)}</strong>
                  </div>
                  <div
                    aria-label={`${money(comparisonBuyingTotal)} in buying payments: ${money(results.selectedPrincipalPaid)} principal equity, ${money(results.selectedInterestPaid)} interest${includeOwnerExtras ? `, ${money(selectedOwnerExtras)} in taxes and utilities` : ""}${selectedMaintenancePaid > 0 ? `, ${money(selectedMaintenancePaid)} in maintenance` : ""}${selectedHomeInsurancePaid > 0 ? `, ${money(selectedHomeInsurancePaid)} in homeowner insurance` : ""}${results.closingCosts > 0 ? `, and ${money(results.closingCosts)} in closing costs` : ""}`}
                    className="comparison-track"
                    role="img"
                  >
                    <span
                      className="principal-fill"
                      style={{ width: `${comparisonPrincipalWidth}%` }}
                      title={`${money(results.selectedPrincipalPaid)} principal`}
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
                    <span><i className="legend principal" />Principal / equity {money(results.selectedPrincipalPaid)}</span>
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
                  </div>
                </div>

                {includeDownPayment ? (
                  <div className="comparison-bar-group">
                    <div className="comparison-bar-label">
                      <div>
                        <strong>Down payment · up-front equity</strong>
                        <small>Shown separately from ongoing buying payments.</small>
                      </div>
                      <strong>{money(results.downPayment)}</strong>
                    </div>
                    <div
                      aria-label={`${money(results.downPayment)} down payment included in homeowner equity`}
                      className="comparison-track"
                      role="img"
                    >
                      <span
                        className="down-payment-fill"
                        style={{ width: `${comparisonDownPaymentWidth}%` }}
                        title={`${money(results.downPayment)} down payment equity`}
                      />
                    </div>
                    <div className="comparison-legend">
                      <span>
                        <i className="legend down-payment" />
                        Down payment / equity {money(results.downPayment)}
                      </span>
                    </div>
                  </div>
                ) : null}

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
                Cash paid includes enabled payments and entered closing costs while keeping the
                down payment separate. Mortgage equity is principal paid
                {includeDownPayment ? " plus the down payment" : ""}. Buying&apos;s non-equity
                housing cost is interest
                {includeOwnerExtras ? " plus municipal taxes and utilities" : ""}
                {selectedMaintenancePaid > 0 ? " plus entered maintenance" : ""}
                {selectedHomeInsurancePaid > 0 ? " plus entered homeowner insurance" : ""}
                {results.closingCosts > 0 ? " plus entered closing costs" : ""};
                renting&apos;s cash paid includes rent
                {results.monthlyRentalUtilities > 0 ? " and entered rental utilities" : ""} and is
                also its included housing cost. Changes in home value and any costs left at $0
                are not included.
                {includeDownPayment
                  ? " The down payment is shown separately and included in mortgage equity."
                  : " The down payment is excluded from mortgage equity."}
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
                  separately because it reduces the mortgage and builds homeowner equity. Taxes
                  and utilities, the down payment, and home equity follow the checkboxes above.
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
                    <th>Buying cash paid</th>
                    <th>Mortgage equity built</th>
                    {includeDownPayment ? <th>Down payment</th> : null}
                    <th>Principal paid</th>
                    <th>Non-equity buying cost</th>
                    <th>Interest cost</th>
                    <th>Taxes + utilities</th>
                    {results.monthlyMaintenance > 0 ? <th>Maintenance</th> : null}
                    {results.monthlyHomeInsurance > 0 ? <th>Homeowner insurance</th> : null}
                    {results.closingCosts > 0 ? <th>Closing costs</th> : null}
                    <th>Rent cash paid</th>
                    {hasAdvancedRentingCosts ? <th>Rental utilities</th> : null}
                    <th>Rent home equity</th>
                  </tr>
                </thead>
                <tbody>
                  {results.years.map((row, index) => (
                    <tr key={row.year}>
                      <td><strong>{row.year}</strong></td>
                      <td>
                        {money(
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
                        {money(
                          row.totalPrincipalPaid +
                            (includeDownPayment ? results.downPayment : 0),
                        )}
                      </td>
                      {includeDownPayment ? <td>{money(results.downPayment)}</td> : null}
                      <td>{money(row.totalPrincipalPaid)}</td>
                      <td>
                        {money(
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
          Planning estimate only. Entered maintenance, insurance, closing costs, and rental
          utilities are included. Home-price changes, investment returns, mortgage insurance,
          renewal-rate changes, and tenant insurance are excluded.
        </p>
      </footer>
    </main>
  )
}
