"use client"

import { useMemo, useState } from "react"

type CalculatorInputs = {
  purchasePrice: number
  downPaymentPercent: number
  interestRate: number
  amortizationYears: number
  annualTaxes: number
  monthlyHydro: number
  monthlyRent: number
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
  monthlyHydro: 375,
  monthlyRent: 2700,
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
          onChange={(event) => onChange(Number(event.target.value))}
          step={step}
          type="number"
          value={value}
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
  const [showGraph, setShowGraph] = useState(true)

  const results = useMemo(() => {
    const purchasePrice = Math.max(0, inputs.purchasePrice)
    const downPaymentPercent = Math.min(100, Math.max(0, inputs.downPaymentPercent))
    const downPayment = purchasePrice * (downPaymentPercent / 100)
    const mortgageAmount = Math.max(0, purchasePrice - downPayment)
    const schedule = buildSchedule(mortgageAmount, inputs.interestRate, inputs.amortizationYears)
    const monthlyTaxes = Math.max(0, inputs.annualTaxes) / 12
    const monthlyHydro = Math.max(0, inputs.monthlyHydro)
    const safeSelectedMonth = Math.min(Math.max(1, selectedMonth), LONG_TERM_MONTHS)
    const selectedScheduleRow = schedule.months[safeSelectedMonth - 1] ?? schedule.months.at(-1)
    const selectedMonthPrincipal = selectedScheduleRow?.principalPaid ?? 0
    const selectedMonthInterest = selectedScheduleRow?.interestPaid ?? 0
    const selectedMonthMortgagePayment = selectedMonthPrincipal + selectedMonthInterest
    const selectedMonthlyOwnerTotal = selectedMonthMortgagePayment + monthlyTaxes + monthlyHydro
    const selectedPrincipalPaid = selectedScheduleRow?.totalPrincipalPaid ?? 0
    const selectedInterestPaid = selectedScheduleRow?.totalInterestPaid ?? 0
    const monthlyRent = Math.max(0, inputs.monthlyRent)
    const selectedRentCash = monthlyRent * safeSelectedMonth

    const rentYears = Array.from({ length: LONG_TERM_YEARS }, (_, index) => {
      const year = index + 1
      return {
        year,
        annualRent: monthlyRent * 12,
        totalRent: monthlyRent * 12 * year,
      }
    })

    return {
      ...schedule,
      purchasePrice,
      downPaymentPercent,
      downPayment,
      mortgageAmount,
      monthlyTaxes,
      monthlyHydro,
      monthlyRent,
      selectedMonth: safeSelectedMonth,
      selectedMonthPrincipal,
      selectedMonthInterest,
      selectedMonthMortgagePayment,
      selectedMonthlyOwnerTotal,
      selectedPrincipalPaid,
      selectedInterestPaid,
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
  const comparisonMax = Math.max(1, principalVsInterestTotal, results.selectedRentCash)
  const comparisonPrincipalWidth = (results.selectedPrincipalPaid / comparisonMax) * 100
  const comparisonInterestWidth = (results.selectedInterestPaid / comparisonMax) * 100
  const comparisonRentWidth = (results.selectedRentCash / comparisonMax) * 100
  const totalPaymentDifference = Math.abs(principalVsInterestTotal - results.selectedRentCash)
  const lowerPaymentOption =
    principalVsInterestTotal === results.selectedRentCash
      ? "The totals are equal"
      : principalVsInterestTotal < results.selectedRentCash
        ? "Buying mortgage payments are lower"
        : "Rent payments are lower"
  const resetCalculator = () => {
    setInputs(initialInputs)
    setSelectedMonth(1)
    setShowGraph(true)
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
                    id="monthly-hydro"
                    label="Hydro"
                    onChange={(value) => updateInput("monthlyHydro", value)}
                    prefix="$"
                    step={10}
                    suffix="/ month"
                    value={inputs.monthlyHydro}
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
              </div>
            </section>

            <section className="results-book" aria-live="polite">
              <div className="sheet-title results-title">
                <div>
                  <h2>Buying cost at month {results.selectedMonth}</h2>
                  <span>Updates with the timeline slider</span>
                </div>
                <button
                  aria-controls="mortgage-graph"
                  aria-expanded={showGraph}
                  className={showGraph ? "graph-toggle active" : "graph-toggle"}
                  onClick={() => setShowGraph((current) => !current)}
                  type="button"
                >
                  {showGraph ? "Hide graph" : "Show graph"}
                </button>
              </div>

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
                  <span>Hydro / month</span>
                  <strong>{preciseMoney(results.monthlyHydro)}</strong>
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
                <DetailRow amount={preciseMoney(results.monthlyHydro)} label="Hydro" />
                <DetailRow
                  amount={preciseMoney(results.selectedMonthlyOwnerTotal)}
                  emphasis
                  label="Total monthly cash out"
                />
              </div>
              <p className="monthly-explainer">
                <strong>Does the monthly cost change?</strong> In this estimate, the mortgage
                payment, taxes, and hydro stay level. What changes each month is the split:
                interest goes down while principal—the part that pays off your mortgage—goes up.
                Once the mortgage is paid off, only taxes and hydro remain.
              </p>

              <TimelineSlider selectedMonth={results.selectedMonth} onChange={setSelectedMonth} />

              <div className="selected-grid">
                <div>
                  <span>Total principal paid</span>
                  <strong>{money(results.selectedPrincipalPaid)}</strong>
                </div>
                <div>
                  <span>Total interest paid</span>
                  <strong>{money(results.selectedInterestPaid)}</strong>
                </div>
                <div>
                  <span>Mortgage left to pay</span>
                  <strong>{money(results.balanceAtSelectedMonth)}</strong>
                </div>
                <div>
                  <span>Mortgage repaid</span>
                  <strong>{percent(results.paidOffAtSelectedMonth)}</strong>
                </div>
              </div>

              {showGraph ? (
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
                    <small>Down payment, taxes, and hydro are not included here.</small>
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
                </div>
              ) : null}
            </section>
          </div>

          <section className="schedule-section">
            <div className="schedule-heading">
              <div>
                <p className="eyebrow">Mortgage schedule</p>
                <h2>Year 1 to year 25</h2>
                <p>
                  Principal is the part of each payment that reduces what you still owe. Interest
                  is the cost of borrowing.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Principal paid</th>
                    <th>Interest paid</th>
                    <th>Total principal</th>
                    <th>Total interest</th>
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
              </div>
            </section>

            <section className="results-book" aria-live="polite">
              <div className="sheet-title results-title">
                <div>
                  <h2>Renting cost</h2>
                  <span>Separate from the mortgage worksheet</span>
                </div>
              </div>

              <div className="monthly-grid rent-summary">
                <div className="monthly-card rent">
                  <span>Monthly rent</span>
                  <strong>{preciseMoney(results.monthlyRent)}</strong>
                </div>
                <div className="monthly-card">
                  <span>Annual rent</span>
                  <strong>{money(results.monthlyRent * 12)}</strong>
                </div>
                <div className="monthly-card total">
                  <span>Rent through month {results.selectedMonth}</span>
                  <strong>{money(results.selectedRentCash)}</strong>
                </div>
              </div>

              <TimelineSlider selectedMonth={results.selectedMonth} onChange={setSelectedMonth} />

              <div className="selected-grid rent-milestones">
                {[1, 5, 10, 25].map((year) => (
                  <div key={year}>
                    <span>Rent after {year} {year === 1 ? "year" : "years"}</span>
                    <strong>{money(results.monthlyRent * 12 * year)}</strong>
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
                  This projection uses the same monthly rent throughout, with no annual increase.
                </p>
              </div>
              <div className="schedule-stat rent-stat">
                <span>Total rent at selected month</span>
                <strong>{money(results.selectedRentCash)}</strong>
              </div>
            </div>

            <div className="table-wrap">
              <table className="rent-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Monthly rent</th>
                    <th>Rent paid this year</th>
                    <th>Total rent paid</th>
                  </tr>
                </thead>
                <tbody>
                  {results.rentYears.map((row) => (
                    <tr key={row.year}>
                      <td><strong>{row.year}</strong></td>
                      <td>{preciseMoney(results.monthlyRent)}</td>
                      <td>{money(row.annualRent)}</td>
                      <td>{money(row.totalRent)}</td>
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
                  <span>Mortgage principal + interest compared with flat rent</span>
                </div>
              </div>

              <TimelineSlider selectedMonth={results.selectedMonth} onChange={setSelectedMonth} />

              <div className="comparison-summary">
                <div className="comparison-card buy-total">
                  <span>Total mortgage payments</span>
                  <strong>{money(principalVsInterestTotal)}</strong>
                  <small>Principal + interest</small>
                </div>
                <div className="comparison-card rent-total">
                  <span>Total rent payments</span>
                  <strong>{money(results.selectedRentCash)}</strong>
                  <small>Flat monthly rent</small>
                </div>
                <div className="comparison-card equity-total">
                  <span>Home equity from principal</span>
                  <strong>{money(results.selectedPrincipalPaid)}</strong>
                  <small>Down payment not included</small>
                </div>
                <div className="comparison-card no-equity">
                  <span>Home equity from rent</span>
                  <strong>$0</strong>
                  <small>Rent does not reduce a mortgage</small>
                </div>
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
                      <strong>Buying · mortgage payments</strong>
                      <small>Principal builds equity; interest is the borrowing cost.</small>
                    </div>
                    <strong>{money(principalVsInterestTotal)}</strong>
                  </div>
                  <div
                    aria-label={`${money(principalVsInterestTotal)} in mortgage payments: ${money(results.selectedPrincipalPaid)} principal equity and ${money(results.selectedInterestPaid)} interest`}
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
                  </div>
                  <div className="comparison-legend">
                    <span><i className="legend principal" />Principal / equity {money(results.selectedPrincipalPaid)}</span>
                    <span><i className="legend interest" />Interest {money(results.selectedInterestPaid)}</span>
                  </div>
                </div>

                <div className="comparison-bar-group">
                  <div className="comparison-bar-label">
                    <div>
                      <strong>Renting · rent payments</strong>
                      <small>All rent is a housing cost; it does not build home equity.</small>
                    </div>
                    <strong>{money(results.selectedRentCash)}</strong>
                  </div>
                  <div
                    aria-label={`${money(results.selectedRentCash)} in rent payments and $0 in home equity`}
                    className="comparison-track"
                    role="img"
                  >
                    <span
                      className="rent-fill"
                      style={{ width: `${comparisonRentWidth}%` }}
                      title={`${money(results.selectedRentCash)} rent`}
                    />
                  </div>
                  <div className="comparison-legend">
                    <span><i className="legend rent-legend" />Rent cost {money(results.selectedRentCash)}</span>
                    <span><i className="legend empty-legend" />Home equity $0</span>
                  </div>
                </div>

                <div className="comparison-difference">
                  <span>{lowerPaymentOption}</span>
                  <strong>{money(totalPaymentDifference)} difference</strong>
                </div>
              </div>

              <p className="comparison-note">
                This comparison follows your requested scope: buying is mortgage principal plus
                interest, while renting is rent paid. It excludes the down payment, municipal
                taxes, hydro, maintenance, insurance, closing costs, and home-price changes.
              </p>
            </section>
          </div>

          <section className="schedule-section">
            <div className="schedule-heading">
              <div>
                <p className="eyebrow">Buy vs. rent schedule</p>
                <h2>Year 1 to year 25</h2>
                <p>
                  Compare cumulative mortgage payments with cumulative rent. Principal is shown
                  separately because it reduces the mortgage and builds homeowner equity.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Mortgage paid</th>
                    <th>Principal / equity</th>
                    <th>Interest cost</th>
                    <th>Rent paid</th>
                    <th>Renter home equity</th>
                  </tr>
                </thead>
                <tbody>
                  {results.years.map((row, index) => (
                    <tr key={row.year}>
                      <td><strong>{row.year}</strong></td>
                      <td>{money(row.totalPrincipalPaid + row.totalInterestPaid)}</td>
                      <td>{money(row.totalPrincipalPaid)}</td>
                      <td>{money(row.totalInterestPaid)}</td>
                      <td>{money(results.rentYears[index]?.totalRent ?? 0)}</td>
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
          Planning estimate only. Buying excludes closing costs, maintenance, insurance,
          appreciation, investment returns, mortgage insurance, and renewal-rate changes. Renting
          excludes utilities and tenant insurance.
        </p>
      </footer>
    </main>
  )
}
