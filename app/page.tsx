"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import {
  buildRentSchedule,
  buildSchedule,
  calculateExitScenario,
  calculateMortgageAmounts,
  LONG_TERM_MONTHS,
  type MortgagePaymentFrequency,
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

type ExitInputs = {
  salePrice: number
  sellingCostPercent: number
  fixedSellingCosts: number
  mortgagePenalty: number
}

type OptionalInputKey =
  | "annualRentIncrease"
  | "monthlyMaintenance"
  | "monthlyHomeInsurance"
  | "closingCosts"
  | "monthlyRentalUtilities"

type OptionalExitInputKey = "sellingCostPercent" | "fixedSellingCosts" | "mortgagePenalty"

type ActiveTab = "buy" | "rent" | "compare" | "exit"
type SavedConfigStorageMode = "loading" | "shared" | "local"

type CalculatorConfigExport = {
  app: "home-cash-flow-calculator"
  version: 1
  exportedAt: string
  inputs: CalculatorInputs
  exitInputs: ExitInputs
  confirmedInputZeros: Record<OptionalInputKey, boolean>
  confirmedExitZeros: Record<OptionalExitInputKey, boolean>
  activeTab: ActiveTab
  selectedMonth: number
  includeOwnerExtras: boolean
  renewalRates: number[]
  mortgagePaymentFrequency: MortgagePaymentFrequency
}

type SavedCalculatorConfig = {
  id: string
  name: string
  updatedAt: string
  config: CalculatorConfigExport
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

const initialExitInputs: ExitInputs = {
  salePrice: 650000,
  sellingCostPercent: 0,
  fixedSellingCosts: 0,
  mortgagePenalty: 0,
}

const CONFIG_APP_ID = "home-cash-flow-calculator"
const CONFIG_VERSION = 1
const CONFIG_FILE_EXTENSION = "homebuy.json"
const SAVED_CONFIGS_STORAGE_KEY = `${CONFIG_APP_ID}.saved-configs.v${CONFIG_VERSION}`

const optionalInputKeys: OptionalInputKey[] = [
  "annualRentIncrease",
  "monthlyMaintenance",
  "monthlyHomeInsurance",
  "closingCosts",
  "monthlyRentalUtilities",
]

const optionalExitInputKeys: OptionalExitInputKey[] = [
  "sellingCostPercent",
  "fixedSellingCosts",
  "mortgagePenalty",
]

const initialConfirmedInputZeros: Record<OptionalInputKey, boolean> = {
  annualRentIncrease: false,
  monthlyMaintenance: false,
  monthlyHomeInsurance: false,
  closingCosts: false,
  monthlyRentalUtilities: false,
}

const initialConfirmedExitZeros: Record<OptionalExitInputKey, boolean> = {
  sellingCostPercent: false,
  fixedSellingCosts: false,
  mortgagePenalty: false,
}

const mortgagePaymentFrequencyOptions: {
  value: MortgagePaymentFrequency
  label: string
  description: string
}[] = [
  {
    value: "monthly",
    label: "Monthly",
    description: "12 monthly payments per year.",
  },
  {
    value: "accelerated-biweekly",
    label: "Accelerated bi-weekly",
    description: "Half the monthly payment every two weeks, for 26 payments per year.",
  },
  {
    value: "accelerated-weekly",
    label: "Accelerated weekly",
    description: "One quarter of the monthly payment every week, for 52 payments per year.",
  },
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function finiteNumberFrom(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function numberRecordFrom<T extends Record<string, number>>(
  value: unknown,
  defaults: T,
): T {
  const source = isPlainObject(value) ? value : {}

  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      finiteNumberFrom(source[key], fallback),
    ]),
  ) as T
}

function booleanRecordFrom<T extends Record<string, boolean>>(
  value: unknown,
  defaults: T,
): T {
  const source = isPlainObject(value) ? value : {}

  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      typeof source[key] === "boolean" ? source[key] : fallback,
    ]),
  ) as T
}

function isMortgagePaymentFrequency(value: unknown): value is MortgagePaymentFrequency {
  return mortgagePaymentFrequencyOptions.some((option) => option.value === value)
}

function isActiveTab(value: unknown): value is ActiveTab {
  return value === "buy" || value === "rent" || value === "compare" || value === "exit"
}

function selectedMonthFrom(value: unknown) {
  const month = Math.round(finiteNumberFrom(value, 1))

  return Math.min(LONG_TERM_MONTHS, Math.max(1, month))
}

function renewalRatesFrom(value: unknown, defaults: number[]) {
  const source = Array.isArray(value) ? value : []

  return defaults.map((fallback, index) => finiteNumberFrom(source[index], fallback))
}

function parseConfigExport(value: unknown): CalculatorConfigExport {
  if (!isPlainObject(value)) {
    throw new Error("The selected file is not a calculator config.")
  }

  if (value.app !== CONFIG_APP_ID || value.version !== CONFIG_VERSION) {
    throw new Error("This config file is not compatible with this calculator.")
  }

  return {
    app: CONFIG_APP_ID,
    version: CONFIG_VERSION,
    exportedAt:
      typeof value.exportedAt === "string" && value.exportedAt
        ? value.exportedAt
        : new Date().toISOString(),
    inputs: numberRecordFrom(value.inputs, initialInputs),
    exitInputs: numberRecordFrom(value.exitInputs, initialExitInputs),
    confirmedInputZeros: booleanRecordFrom(
      value.confirmedInputZeros,
      initialConfirmedInputZeros,
    ),
    confirmedExitZeros: booleanRecordFrom(
      value.confirmedExitZeros,
      initialConfirmedExitZeros,
    ),
    activeTab: isActiveTab(value.activeTab) ? value.activeTab : "buy",
    selectedMonth: selectedMonthFrom(value.selectedMonth),
    includeOwnerExtras:
      typeof value.includeOwnerExtras === "boolean" ? value.includeOwnerExtras : true,
    renewalRates: renewalRatesFrom(value.renewalRates, [4.3, 4.3, 4.3, 4.3, 4.3]),
    mortgagePaymentFrequency: isMortgagePaymentFrequency(value.mortgagePaymentFrequency)
      ? value.mortgagePaymentFrequency
      : "monthly",
  }
}

function parseSavedConfigs(value: unknown): SavedCalculatorConfig[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!isPlainObject(item) || !isPlainObject(item.config)) {
      return []
    }

    const name = typeof item.name === "string" ? item.name.trim() : ""
    const id = typeof item.id === "string" && item.id ? item.id : crypto.randomUUID()
    const updatedAt =
      typeof item.updatedAt === "string" && item.updatedAt
        ? item.updatedAt
        : new Date().toISOString()

    if (!name) {
      return []
    }

    try {
      return [
        {
          id,
          name,
          updatedAt,
          config: parseConfigExport(item.config),
        },
      ]
    } catch {
      return []
    }
  })
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
  const safeValue = Number.isFinite(value) && !Object.is(value, -0) ? value : 0
  return currency.format(safeValue)
}

function preciseMoney(value: number) {
  const safeValue = Number.isFinite(value) && !Object.is(value, -0) ? value : 0
  return preciseCurrency.format(safeValue)
}

function deductionMoney(value: number) {
  return value === 0 ? money(0) : `−${money(Math.abs(value))}`
}

function signedMoney(value: number) {
  if (value === 0) {
    return money(0)
  }

  return `${value > 0 ? "+" : "-"}${money(Math.abs(value))}`
}

function durationPhrase(totalMonths: number) {
  const safeMonths = Math.max(1, Math.round(totalMonths))
  const years = Math.floor(safeMonths / 12)
  const months = safeMonths % 12
  const parts = []

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? "year" : "years"}`)
  }

  if (months > 0) {
    parts.push(`${months} ${months === 1 ? "month" : "months"}`)
  }

  return parts.join(" and ")
}

function percent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`
}

function isOptionalInputKey(key: keyof CalculatorInputs): key is OptionalInputKey {
  return optionalInputKeys.includes(key as OptionalInputKey)
}

function isOptionalExitInputKey(key: keyof ExitInputs): key is OptionalExitInputKey {
  return optionalExitInputKeys.includes(key as OptionalExitInputKey)
}

function InfoButton({ label }: { label: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const tooltipId = useId()

  return (
    <span className="info-wrapper">
      <button
        aria-controls={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label={label}
        className="info-dot"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setIsOpen((current) => !current)
        }}
        title={label}
        type="button"
      >
        i
      </button>
      {isOpen ? (
        <span className="info-popover" id={tooltipId} role="tooltip">
          {label}
        </span>
      ) : null}
    </span>
  )
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
    <div className="field">
      <div className="field-label-row">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {hint ? <InfoButton label={hint} /> : null}
      </div>
      <span className="input-shell">
        <span
          aria-hidden={!prefix}
          className={prefix ? "input-affix" : "input-affix input-affix-spacer"}
        >
          {prefix}
        </span>
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
    </div>
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
  mode = "timeline",
}: {
  selectedMonth: number
  onChange: (month: number) => void
  mode?: "timeline" | "sell"
}) {
  const selectedYear = Math.ceil(selectedMonth / 12)
  const selectedMonthInYear = ((selectedMonth - 1) % 12) + 1
  const isSellMode = mode === "sell"
  const presets = [
    { label: "After 1 year", month: 12 },
    { label: "After 2 years", month: 24 },
    { label: "After 3 years", month: 36 },
    { label: "After 5 years", month: 60 },
    { label: "After 10 years", month: 120 },
  ]
  const selectedPreset = presets.some((preset) => preset.month === selectedMonth)
    ? String(selectedMonth)
    : ""

  return (
    <article className="slider-card">
      <div className="slider-heading">
        <div>
          <p className="card-kicker">{isSellMode ? "Sell after" : "Timeline slider"}</p>
          <h3>
            {isSellMode
              ? `Year ${selectedYear}, month ${selectedMonthInYear}`
              : `Month ${selectedMonth}`}{" "}
            <span>
              {isSellMode
                ? `${selectedMonth} ${selectedMonth === 1 ? "month" : "months"} of ownership`
                : `Year ${selectedYear}, month ${selectedMonthInYear}`}
            </span>
          </h3>
        </div>
        <label className="slider-preset">
          <span>Jump to</span>
          <select
            aria-label="Jump to timeline preset"
            onChange={(event) => {
              const nextMonth = Number(event.target.value)
              if (Number.isFinite(nextMonth) && nextMonth > 0) {
                onChange(nextMonth)
              }
            }}
            value={selectedPreset}
          >
            <option value="">Select preset</option>
            {presets.map((preset) => (
              <option key={preset.month} value={preset.month}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
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
  const [exitInputs, setExitInputs] = useState(initialExitInputs)
  const [confirmedInputZeros, setConfirmedInputZeros] = useState(initialConfirmedInputZeros)
  const [confirmedExitZeros, setConfirmedExitZeros] = useState(initialConfirmedExitZeros)
  const [activeTab, setActiveTab] = useState<ActiveTab>("buy")
  const [selectedMonth, setSelectedMonth] = useState(1)
  const [includeOwnerExtras, setIncludeOwnerExtras] = useState(true)
  const [renewalRates, setRenewalRates] = useState([4.3, 4.3, 4.3, 4.3, 4.3])
  const [mortgagePaymentFrequency, setMortgagePaymentFrequency] =
    useState<MortgagePaymentFrequency>("monthly")
  const importInputRef = useRef<HTMLInputElement>(null)
  const [configStatus, setConfigStatus] = useState("")
  const [savedConfigs, setSavedConfigs] = useState<SavedCalculatorConfig[]>([])
  const [configName, setConfigName] = useState("")
  const [selectedSavedConfigId, setSelectedSavedConfigId] = useState("")
  const [savedConfigStorageMode, setSavedConfigStorageMode] =
    useState<SavedConfigStorageMode>("loading")
  const [isConfigRequestPending, setIsConfigRequestPending] = useState(false)

  useEffect(() => {
    const loadSavedConfigs = async () => {
      try {
        const response = await fetch("/api/saved-configs", { cache: "no-store" })
        const data = await response.json()

        if (response.ok && data.storage === "shared") {
          setSavedConfigs(parseSavedConfigs(data.configs))
          setSavedConfigStorageMode("shared")
          return
        }
      } catch {
        // Fall through to local browser storage when the shared store is unavailable.
      }

      try {
        setSavedConfigs(
          parseSavedConfigs(JSON.parse(localStorage.getItem(SAVED_CONFIGS_STORAGE_KEY) ?? "[]")),
        )
      } catch {
        setSavedConfigs([])
      }
      setSavedConfigStorageMode("local")
    }

    void loadSavedConfigs()
  }, [])

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
      mortgagePaymentFrequency,
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
    const payoffMonth =
      schedule.months.find((row) => row.endingBalance <= 0.005)?.month ??
      schedule.months.at(-1)?.month ??
      safeSelectedMonth

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
      payoffMonth,
      rentYears: rentSchedule.years,
    }
  }, [inputs, mortgagePaymentFrequency, renewalRates, selectedMonth])

  const updateInput = (key: keyof CalculatorInputs, value: number) => {
    if (isOptionalInputKey(key)) {
      setConfirmedInputZeros((current) => ({
        ...current,
        [key]: true,
      }))
    }

    setInputs((current) => ({
      ...current,
      [key]: Number.isFinite(value) ? value : 0,
    }))
  }

  const updateExitInput = (key: keyof ExitInputs, value: number) => {
    if (isOptionalExitInputKey(key)) {
      setConfirmedExitZeros((current) => ({
        ...current,
        [key]: true,
      }))
    }

    setExitInputs((current) => ({
      ...current,
      [key]: Number.isFinite(value) ? value : 0,
    }))
  }

  const isInputAssumptionComplete = (key: OptionalInputKey) =>
    inputs[key] !== 0 || confirmedInputZeros[key]
  const isExitAssumptionComplete = (key: OptionalExitInputKey) =>
    exitInputs[key] !== 0 || confirmedExitZeros[key]
  const formatOptionalMoney = (value: number, isComplete: boolean) =>
    value === 0 && !isComplete ? "Not entered" : money(value)
  const formatOptionalPreciseMoney = (value: number, isComplete: boolean) =>
    value === 0 && !isComplete ? "Not entered" : preciseMoney(value)
  const formatOptionalPercent = (value: number, isComplete: boolean) =>
    value === 0 && !isComplete ? "Not entered" : percent(value)
  const formatOptionalDeductionMoney = (value: number, isComplete: boolean) =>
    value === 0 && !isComplete ? "Not entered" : deductionMoney(value)

  const principalVsInterestTotal = results.selectedPrincipalPaid + results.selectedInterestPaid
  const selectedInterestPercent =
    principalVsInterestTotal === 0 ? 0 : (results.selectedInterestPaid / principalVsInterestTotal) * 100
  const selectedPrincipalPercent =
    principalVsInterestTotal === 0 ? 0 : (results.selectedPrincipalPaid / principalVsInterestTotal) * 100
  const selectedDurationPhrase = durationPhrase(results.selectedMonth)
  const payoffDurationPhrase =
    results.mortgageAmount <= 0 ? "Already paid off" : durationPhrase(results.payoffMonth)
  const payoffMonthsSaved = Math.max(
    0,
    Math.round(inputs.amortizationYears) * 12 - results.payoffMonth,
  )
  const payoffSavingsPhrase =
    results.mortgageAmount <= 0
      ? "No mortgage"
      : payoffMonthsSaved > 0
      ? `${durationPhrase(payoffMonthsSaved)} faster`
      : "Matches amortization"
  const selectedYear = Math.ceil(results.selectedMonth / 12)
  const selectedMonthInYear = ((results.selectedMonth - 1) % 12) + 1
  const monthlyOwnershipCosts = results.monthlyUtilities + results.monthlyOwnerAdvanced
  const selectedOwnerExtras =
    (results.monthlyTaxes + results.monthlyUtilities) * results.selectedMonth
  const selectedMaintenancePaid = results.monthlyMaintenance * results.selectedMonth
  const selectedHomeInsurancePaid = results.monthlyHomeInsurance * results.selectedMonth
  const selectedAdvancedBuyingCosts =
    selectedMaintenancePaid + selectedHomeInsurancePaid + results.closingCosts
  const upfrontBuyingCosts = results.downPayment + results.closingCosts
  const comparisonBuyingAfterPurchase =
    principalVsInterestTotal +
    (includeOwnerExtras ? selectedOwnerExtras : 0) +
    selectedMaintenancePaid +
    selectedHomeInsurancePaid
  const comparisonBuyingGraphTotal = comparisonBuyingAfterPurchase
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
  const isMaintenanceComplete = isInputAssumptionComplete("monthlyMaintenance")
  const isHomeInsuranceComplete = isInputAssumptionComplete("monthlyHomeInsurance")
  const isClosingCostsComplete = isInputAssumptionComplete("closingCosts")
  const isRentIncreaseComplete = isInputAssumptionComplete("annualRentIncrease")
  const isRentalUtilitiesComplete = isInputAssumptionComplete("monthlyRentalUtilities")
  const isSellingCostPercentComplete = isExitAssumptionComplete("sellingCostPercent")
  const isFixedSellingCostsComplete = isExitAssumptionComplete("fixedSellingCosts")
  const isMortgagePenaltyComplete = isExitAssumptionComplete("mortgagePenalty")
  const buyingAssumptionsComplete =
    isMaintenanceComplete && isHomeInsuranceComplete && isClosingCostsComplete
  const rentingAssumptionsComplete = isRentIncreaseComplete && isRentalUtilitiesComplete
  const comparisonAssumptionsComplete = buyingAssumptionsComplete && rentingAssumptionsComplete
  const cashNeededUpfrontLabel = isClosingCostsComplete
    ? money(upfrontBuyingCosts)
    : `At least ${money(results.downPayment)}`
  const optionalClosingCostsLabel = formatOptionalMoney(results.closingCosts, isClosingCostsComplete)
  const optionalRentalUtilitiesLabel = formatOptionalPreciseMoney(
    results.monthlyRentalUtilities,
    isRentalUtilitiesComplete,
  )
  const optionalRentIncreaseLabel = formatOptionalPercent(
    results.annualRentIncrease,
    isRentIncreaseComplete,
  )
  const selectedPaymentFrequencyOption =
    mortgagePaymentFrequencyOptions.find((option) => option.value === mortgagePaymentFrequency) ??
    mortgagePaymentFrequencyOptions[0]
  const showCmhcDetails = results.downPaymentPercent < 20
  const comparisonBuyingTableColumnCount =
    7 +
    (results.cmhcPremium > 0 ? 1 : 0) +
    (results.closingCosts > 0 || !isClosingCostsComplete ? 1 : 0)
  const buyingTotalBreakdown = [
    "principal",
    "mortgage interest",
    ...(includeOwnerExtras ? ["taxes", "utilities"] : []),
    ...(results.monthlyMaintenance > 0 ? ["maintenance"] : []),
    ...(results.monthlyHomeInsurance > 0 ? ["insurance"] : []),
  ].join(" + ")
  const buyingCostBreakdown = [
    ...(results.cmhcPremium > 0 ? ["CMHC premium"] : []),
    "Mortgage interest",
    ...(includeOwnerExtras ? ["taxes", "utilities"] : []),
    ...(results.monthlyMaintenance > 0 ? ["maintenance"] : []),
    ...(results.monthlyHomeInsurance > 0 ? ["insurance"] : []),
    ...(results.closingCosts > 0 ? ["closing costs"] : []),
  ].join(" + ")
  const comparisonMax = Math.max(
    1,
    comparisonBuyingGraphTotal,
    upfrontBuyingCosts,
    results.selectedRentCash,
  )
  const comparisonPrincipalWidth = (results.selectedPrincipalPaid / comparisonMax) * 100
  const comparisonInterestWidth = (results.selectedInterestPaid / comparisonMax) * 100
  const comparisonOwnerExtrasWidth =
    includeOwnerExtras ? (selectedOwnerExtras / comparisonMax) * 100 : 0
  const comparisonMaintenanceWidth = (selectedMaintenancePaid / comparisonMax) * 100
  const comparisonHomeInsuranceWidth = (selectedHomeInsurancePaid / comparisonMax) * 100
  const comparisonClosingCostsWidth = (results.closingCosts / comparisonMax) * 100
  const comparisonSeparateDownPaymentWidth = (results.downPayment / comparisonMax) * 100
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
  const recurringOwnershipCostsThroughExit =
    (results.monthlyTaxes +
      results.monthlyUtilities +
      results.monthlyMaintenance +
      results.monthlyHomeInsurance) *
    results.selectedMonth
  const exitScenarioFor = (salePrice: number) =>
    calculateExitScenario({
      purchasePrice: results.purchasePrice,
      salePrice,
      sellingCostPercent: exitInputs.sellingCostPercent,
      fixedSellingCosts: exitInputs.fixedSellingCosts,
      mortgagePenalty: exitInputs.mortgagePenalty,
      mortgageBalance: results.balanceAtSelectedMonth,
      downPayment: results.downPayment,
      principalPaid: results.selectedPrincipalPaid,
      interestPaid: results.selectedInterestPaid,
      recurringOwnershipCosts: recurringOwnershipCostsThroughExit,
      buyingClosingCosts: results.closingCosts,
      monthsOwned: results.selectedMonth,
      rentCash: results.selectedRentCash,
    })
  const expectedExitScenario = exitScenarioFor(exitInputs.salePrice)
  const effectiveMonthlyLabel =
    expectedExitScenario.netOwnershipResult >= 0 ? "Cash gain per month" : "Effective cost per month"
  const effectiveMonthlyValue = Math.abs(expectedExitScenario.netCostPerMonth)
  const housingCashFlowDifference = expectedExitScenario.buyingAdvantageVsRent
  const exitComparisonWinner =
    housingCashFlowDifference === 0
      ? "Buying and renting are tied"
      : housingCashFlowDifference > 0
      ? "Buying is ahead"
      : "Renting is ahead"
  const percentageSellingCostsLabel = formatOptionalDeductionMoney(
    expectedExitScenario.percentageSellingCosts,
    isSellingCostPercentComplete,
  )
  const fixedSellingCostsLabel = formatOptionalDeductionMoney(
    exitInputs.fixedSellingCosts,
    isFixedSellingCostsComplete,
  )
  const mortgagePenaltyLabel = formatOptionalDeductionMoney(
    exitInputs.mortgagePenalty,
    isMortgagePenaltyComplete,
  )
  const mortgagePenaltySpendLabel = formatOptionalMoney(
    exitInputs.mortgagePenalty,
    isMortgagePenaltyComplete,
  )
  const sellingCostsLabel = formatOptionalDeductionMoney(
    expectedExitScenario.totalSellingCosts,
    isSellingCostPercentComplete && isFixedSellingCostsComplete,
  )
  const sellingCostsSpendLabel = formatOptionalMoney(
    expectedExitScenario.totalSellingCosts,
    isSellingCostPercentComplete && isFixedSellingCostsComplete,
  )
  const closingCostsDeductionLabel = formatOptionalDeductionMoney(
    results.closingCosts,
    isClosingCostsComplete,
  )
  const maintenanceAndInsuranceThroughExit =
    (results.monthlyMaintenance + results.monthlyHomeInsurance) * results.selectedMonth
  const maintenanceAndInsuranceExitLabel = formatOptionalDeductionMoney(
    maintenanceAndInsuranceThroughExit,
    isMaintenanceComplete && isHomeInsuranceComplete,
  )
  const maintenanceAndInsuranceSpendLabel = formatOptionalMoney(
    maintenanceAndInsuranceThroughExit,
    isMaintenanceComplete && isHomeInsuranceComplete,
  )
  const totalMortgagePaymentsThroughExit =
    results.selectedPrincipalPaid + results.selectedInterestPaid
  const taxesThroughExit = results.monthlyTaxes * results.selectedMonth
  const utilitiesThroughExit = results.monthlyUtilities * results.selectedMonth
  const cashPaidBeforeSale =
    results.downPayment +
    totalMortgagePaymentsThroughExit +
    recurringOwnershipCostsThroughExit +
    results.closingCosts
  const nonEquityCostsThroughExit =
    results.cmhcPremium +
    results.selectedInterestPaid +
    taxesThroughExit +
    utilitiesThroughExit +
    maintenanceAndInsuranceThroughExit +
    results.closingCosts +
    expectedExitScenario.totalSellingCosts +
    exitInputs.mortgagePenalty
  const resetCalculator = () => {
    setInputs(initialInputs)
    setExitInputs(initialExitInputs)
    setConfirmedInputZeros(initialConfirmedInputZeros)
    setConfirmedExitZeros(initialConfirmedExitZeros)
    setActiveTab("buy")
    setSelectedMonth(1)
    setIncludeOwnerExtras(true)
    setRenewalRates([4.3, 4.3, 4.3, 4.3, 4.3])
    setMortgagePaymentFrequency("monthly")
    setConfigStatus("")
    setSelectedSavedConfigId("")
  }

  const buildCurrentConfig = (): CalculatorConfigExport => ({
    app: CONFIG_APP_ID,
    version: CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    inputs,
    exitInputs,
    confirmedInputZeros,
    confirmedExitZeros,
    activeTab,
    selectedMonth: results.selectedMonth,
    includeOwnerExtras,
    renewalRates,
    mortgagePaymentFrequency,
  })

  const applyConfig = (config: CalculatorConfigExport) => {
    setInputs(config.inputs)
    setExitInputs(config.exitInputs)
    setConfirmedInputZeros(config.confirmedInputZeros)
    setConfirmedExitZeros(config.confirmedExitZeros)
    setActiveTab(config.activeTab)
    setSelectedMonth(config.selectedMonth)
    setIncludeOwnerExtras(config.includeOwnerExtras)
    setRenewalRates(config.renewalRates)
    setMortgagePaymentFrequency(config.mortgagePaymentFrequency)
  }

  const persistLocalSavedConfigs = (configs: SavedCalculatorConfig[]) => {
    const sortedConfigs = [...configs].sort((first, second) =>
      second.updatedAt.localeCompare(first.updatedAt),
    )

    localStorage.setItem(SAVED_CONFIGS_STORAGE_KEY, JSON.stringify(sortedConfigs))
    setSavedConfigs(sortedConfigs)
  }

  const saveCurrentConfig = async () => {
    const trimmedName = configName.trim()

    if (!trimmedName) {
      setConfigStatus("Enter a name before saving this config.")
      return
    }

    if (savedConfigStorageMode === "shared") {
      setIsConfigRequestPending(true)

      try {
        const response = await fetch("/api/saved-configs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: selectedSavedConfigId || undefined,
            name: trimmedName,
            config: buildCurrentConfig(),
          }),
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            typeof data.message === "string" ? data.message : "Shared config save failed.",
          )
        }

        const nextSavedConfigs = parseSavedConfigs(data.configs)
        const savedConfig = nextSavedConfigs.find(
          (current) => current.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
        )

        setSavedConfigs(nextSavedConfigs)
        setSelectedSavedConfigId(savedConfig?.id ?? "")
        setConfigStatus(`Saved global config "${trimmedName}".`)
      } catch (error) {
        setConfigStatus(error instanceof Error ? error.message : "Shared config save failed.")
      } finally {
        setIsConfigRequestPending(false)
      }

      return
    }

    const now = new Date().toISOString()
    const existingConfig = savedConfigs.find(
      (savedConfig) =>
        savedConfig.id === selectedSavedConfigId ||
        savedConfig.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
    )
    const savedConfig = {
      id: existingConfig?.id ?? crypto.randomUUID(),
      name: trimmedName,
      updatedAt: now,
      config: buildCurrentConfig(),
    }
    const nextSavedConfigs = [
      savedConfig,
      ...savedConfigs.filter((current) => current.id !== savedConfig.id),
    ]

    persistLocalSavedConfigs(nextSavedConfigs)
    setSelectedSavedConfigId(savedConfig.id)
    setConfigStatus(`Saved browser-only config "${trimmedName}".`)
  }

  const loadSavedConfig = (id: string) => {
    const savedConfig = savedConfigs.find((current) => current.id === id)

    if (!savedConfig) {
      setConfigStatus("Select a saved config to load.")
      return
    }

    applyConfig(savedConfig.config)
    setSelectedSavedConfigId(savedConfig.id)
    setConfigName(savedConfig.name)
    setConfigStatus(`Loaded config "${savedConfig.name}".`)
  }

  const deleteSavedConfig = async () => {
    const savedConfig = savedConfigs.find((current) => current.id === selectedSavedConfigId)

    if (!savedConfig) {
      setConfigStatus("Select a saved config to delete.")
      return
    }

    if (!window.confirm(`Delete saved config "${savedConfig.name}"?`)) {
      return
    }

    if (savedConfigStorageMode === "shared") {
      setIsConfigRequestPending(true)

      try {
        const response = await fetch(`/api/saved-configs/${encodeURIComponent(savedConfig.id)}`, {
          method: "DELETE",
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            typeof data.message === "string" ? data.message : "Shared config delete failed.",
          )
        }

        setSavedConfigs(parseSavedConfigs(data.configs))
        setConfigStatus(`Deleted global config "${savedConfig.name}".`)
      } catch (error) {
        setConfigStatus(error instanceof Error ? error.message : "Shared config delete failed.")
      } finally {
        setIsConfigRequestPending(false)
      }
    } else {
      persistLocalSavedConfigs(savedConfigs.filter((current) => current.id !== savedConfig.id))
      setConfigStatus(`Deleted browser-only config "${savedConfig.name}".`)
    }

    setSelectedSavedConfigId("")
    setConfigName("")
  }

  const exportConfig = () => {
    const currentConfig = buildCurrentConfig()
    const serializedConfig = JSON.stringify(currentConfig, null, 2)
    const blob = new Blob([serializedConfig], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const dateStamp = new Date().toISOString().slice(0, 10)

    link.href = url
    link.download = `home-cash-flow-${dateStamp}.${CONFIG_FILE_EXTENSION}`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setConfigStatus("Config exported.")
  }

  const importConfig = async (file: File) => {
    try {
      const importedConfig = parseConfigExport(JSON.parse(await file.text()))

      applyConfig(importedConfig)
      setSelectedSavedConfigId("")
      setConfigStatus("Config imported.")
    } catch (error) {
      setConfigStatus(error instanceof Error ? error.message : "Config import failed.")
    }
  }

  const exportPrintablePages = () => {
    setConfigStatus("Preparing printable pages.")
    window.setTimeout(() => window.print(), 0)
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Home Cash-Flow Calculator">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span>Home Cash-Flow Calculator</span>
        </a>
        <div className="header-actions" aria-label="Calculator actions">
          <div className="saved-config-actions" aria-label="Saved configs">
            <span className="saved-config-mode">
              {savedConfigStorageMode === "shared"
                ? "Global"
                : savedConfigStorageMode === "local"
                ? "This browser"
                : "Loading"}
            </span>
            <label className="visually-hidden" htmlFor="config-name">
              Config name
            </label>
            <input
              className="config-name-input"
              id="config-name"
              onChange={(event) => {
                setConfigName(event.target.value)
                setSelectedSavedConfigId("")
              }}
              placeholder="Address or config name"
              type="text"
              value={configName}
            />
            <button
              className="reset-button"
              disabled={isConfigRequestPending}
              onClick={() => void saveCurrentConfig()}
              type="button"
            >
              Save
            </button>
            <label className="visually-hidden" htmlFor="saved-configs">
              Saved configs
            </label>
            <select
              className="saved-config-select"
              id="saved-configs"
              onChange={(event) => {
                const nextId = event.target.value
                setSelectedSavedConfigId(nextId)
                const savedConfig = savedConfigs.find((current) => current.id === nextId)
                setConfigName(savedConfig?.name ?? "")
              }}
              value={selectedSavedConfigId}
            >
              <option value="">Saved configs</option>
              {savedConfigs.map((savedConfig) => (
                <option key={savedConfig.id} value={savedConfig.id}>
                  {savedConfig.name}
                </option>
              ))}
            </select>
            <button
              className="reset-button"
              disabled={isConfigRequestPending}
              onClick={() => loadSavedConfig(selectedSavedConfigId)}
              type="button"
            >
              Load
            </button>
            <button
              className="reset-button"
              disabled={isConfigRequestPending}
              onClick={() => void deleteSavedConfig()}
              type="button"
            >
              Delete
            </button>
          </div>
          <button className="reset-button" onClick={exportPrintablePages} type="button">
            Print
          </button>
          <button className="reset-button" onClick={exportConfig} type="button">
            Export config
          </button>
          <button
            className="reset-button"
            onClick={() => importInputRef.current?.click()}
            type="button"
          >
            Import config
          </button>
          <button className="reset-button" onClick={resetCalculator} type="button">
            Reset
          </button>
          <input
            accept=".json,.homebuy.json,application/json"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]

              if (file) {
                void importConfig(file)
              }

              event.target.value = ""
            }}
            ref={importInputRef}
            type="file"
          />
        </div>
      </header>
      {configStatus ? (
        <p className="config-status" role="status">
          {configStatus}
        </p>
      ) : null}

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">Buy or rent worksheet</p>
          <h1>Housing cash-flow calculator.</h1>
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
        <button
          aria-controls="exit-panel"
          aria-selected={activeTab === "exit"}
          className={activeTab === "exit" ? "tab active" : "tab"}
          id="exit-tab"
          onClick={() => setActiveTab("exit")}
          role="tab"
          type="button"
        >
          Selling · Exit
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
                    label="Home price"
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
                    label="Interest rate for first 5-year term"
                    onChange={(value) => updateInput("interestRate", value)}
                    step={0.05}
                    suffix="%"
                    value={inputs.interestRate}
                  />
                  <label className="field" htmlFor="amortization">
                    <span className="field-label">Repayment period (amortization)</span>
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
                  <label className="field" htmlFor="payment-frequency">
                    <span className="field-label">Payment frequency</span>
                    <span className="input-shell select-shell">
                      <select
                        id="payment-frequency"
                        onChange={(event) =>
                          setMortgagePaymentFrequency(
                            event.target.value as MortgagePaymentFrequency,
                          )
                        }
                        value={mortgagePaymentFrequency}
                      >
                        {mortgagePaymentFrequencyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <NumberField
                    id="annual-taxes"
                    label="Property taxes"
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
                {showCmhcDetails && results.cmhcWarning ? (
                  <p className="input-warning" role="alert">
                    {results.cmhcWarning}
                  </p>
                ) : null}
                <p className="input-note">
                  Uses Canadian semi-annual compounding. {selectedPaymentFrequencyOption.description}
                  {showCmhcDetails
                    ? " Because the entered down payment is below 20%, an eligible estimated CMHC premium is added to the mortgage. A 0.20 percentage-point premium surcharge is included for a 30-year insured amortization. Provincial tax on the premium is not included. A 30-year insured mortgage assumes the buyer is eligible as a first-time buyer or purchaser of a new build."
                    : ""}
                </p>
                <details className="advanced-panel" open>
                  <summary>Advanced buying costs (optional)</summary>
                  <div className="advanced-content">
                    <div className="field-grid advanced-cost-grid">
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
                      count as cash needed upfront and a non-equity cost.
                    </p>
                    <div className="renewal-section">
                      <div>
                        <h3>Mortgage renewal rates</h3>
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
                  <span className="label-with-info">
                    Mortgage payment
                    <InfoButton label={`Shows mortgage payments that fall in the selected month. ${selectedPaymentFrequencyOption.description}`} />
                  </span>
                  <strong>{preciseMoney(results.selectedMonthMortgagePayment)}</strong>
                </div>
                <div className="monthly-card">
                  <span>Property taxes/month</span>
                  <strong>{preciseMoney(results.monthlyTaxes)}</strong>
                </div>
                <div className="monthly-card">
                  <span className="label-with-info">
                    Home operating costs/month
                    <InfoButton label="Monthly costs include utilities, maintenance, and homeowner insurance when entered." />
                  </span>
                  <strong>{preciseMoney(monthlyOwnershipCosts)}</strong>
                </div>
                <div className="monthly-card total">
                  <span>Monthly total</span>
                  <strong>{preciseMoney(results.selectedMonthlyOwnerTotal)}</strong>
                </div>
              </div>

              <section className="monthly-costs" aria-label="Monthly buying costs">
                <h3>Monthly costs</h3>
                <div className="detail-sheet monthly-detail-sheet">
                  <DetailRow
                    amount={preciseMoney(results.selectedMonthPrincipal)}
                    label="Principal this month"
                    note="Reduces what you owe"
                  />
                  <DetailRow
                    amount={preciseMoney(results.selectedMonthInterest)}
                    label="Mortgage interest this month"
                    note="Cost of mortgage borrowing"
                  />
                  <DetailRow amount={preciseMoney(results.monthlyTaxes)} label="Property taxes" />
                  <DetailRow
                    amount={preciseMoney(monthlyOwnershipCosts)}
                    label="Home operating costs"
                    note="Utilities + maintenance + homeowner insurance"
                  />
                  <DetailRow
                    amount={preciseMoney(results.selectedMonthlyOwnerTotal)}
                    emphasis
                    label="Total monthly spending"
                    note={`Mortgage uses ${selectedPaymentFrequencyOption.label.toLowerCase()} payments`}
                  />
                </div>
              </section>

              <section className="upfront-costs" aria-label="Upfront buying costs">
                <h3>Upfront costs</h3>
                <div className="detail-sheet upfront-detail-sheet">
                  <DetailRow
                    amount={money(results.downPayment)}
                    label="Down payment"
                    note="Paid at purchase"
                  />
                  <DetailRow
                    amount={optionalClosingCostsLabel}
                    label="Closing costs"
                  />
                  <DetailRow
                    amount={cashNeededUpfrontLabel}
                    emphasis
                    label="Cash needed upfront"
                    note={!isClosingCostsComplete ? "Closing costs not entered" : undefined}
                  />
                </div>
              </section>
              <p className="monthly-explainer">
                <strong>Does the monthly cost change?</strong> In this estimate, the mortgage
                payment stays level within each five-year term. Renewal payments are based on the
                regular scheduled amortization, while accelerated weekly and accelerated bi-weekly
                payments reduce the actual balance faster and shorten the payoff timeline. Months
                with an extra payment show higher mortgage cash flow. Within each term, mortgage
                interest generally goes down while principal—the part that pays off your mortgage—goes
                up. Once the mortgage is paid off, the entered ownership costs remain.
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
                  aria-label={`${money(principalVsInterestTotal)} in total mortgage payments: ${money(results.selectedPrincipalPaid)} principal and ${money(results.selectedInterestPaid)} mortgage interest`}
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
                    title={`${percent(selectedInterestPercent)} mortgage interest`}
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
                      <span>Mortgage interest paid</span>
                    </div>
                    <strong>{money(results.selectedInterestPaid)}</strong>
                    <small>
                      {percent(selectedInterestPercent)} of payments. This was the mortgage
                      borrowing cost and did not reduce your balance.
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
                  <div>
                    <span>Estimated payoff</span>
                    <strong>{payoffDurationPhrase}</strong>
                  </div>
                  <div>
                    <span>Time saved</span>
                    <strong>{payoffSavingsPhrase}</strong>
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
                  Principal is the part of each payment that reduces what you still owe. Mortgage
                  interest is the cost of borrowing. Municipal taxes are converted from the annual
                  amount to a monthly cost. Renewal payments use the entered rate and regular
                  scheduled amortization. Accelerated payments are applied at the selected weekly
                  or bi-weekly cadence to reduce the actual balance faster. All entered recurring
                  ownership costs accumulate through each year; closing costs are counted once.
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
                    <th><span className="stacked-heading"><span>Avg monthly</span><span>mortgage</span></span></th>
                    <th><span className="stacked-heading"><span>Principal</span><span>this year</span></span></th>
                    <th><span className="stacked-heading"><span>Mortgage interest</span><span>this year</span></span></th>
                    <th><span className="stacked-heading"><span>Cumulative</span><span>principal</span></span></th>
                    <th><span className="stacked-heading"><span>Cumulative</span><span>mortgage interest</span></span></th>
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
                  <strong>{optionalRentalUtilitiesLabel}</strong>
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
                  <span>Cumulative cost month {results.selectedMonth}</span>
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
      ) : activeTab === "compare" ? (
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
                  <span>Simplified cash paid after purchase and estimated home equity on the same timeline</span>
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
                  <span>Mortgage payment frequency</span>
                  <strong>{selectedPaymentFrequencyOption.label}</strong>
                </div>
                <div>
                  <span>Annual rent increase</span>
                  <strong>{optionalRentIncreaseLabel}</strong>
                </div>
                <div>
                  <span>Rent + utilities in month {results.selectedMonth}</span>
                  <strong>
                    {isRentalUtilitiesComplete
                      ? preciseMoney(results.selectedMonthlyRent + results.monthlyRentalUtilities)
                      : "Not entered"}
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
                    <strong>Include taxes and utilities in cash paid after purchase</strong>
                    <small>
                      Turn off to exclude these two ownership costs. Maintenance, homeowner
                      insurance, closing costs, and rental utilities remain included when entered.
                    </small>
                  </span>
                </label>

              </div>

              <section className="plain-language-summary" aria-label="Plain-language comparison">
                <p className="card-kicker">Plain-language read</p>
                <h3>
                  If you bought at {money(results.purchasePrice)} and stopped after{" "}
                  {selectedDurationPhrase}, with the home still worth{" "}
                  {money(results.purchasePrice)}.
                </h3>
                <p>
                  You would have paid {money(comparisonBuyingAfterPurchase)} after purchase, and
                  about {money(comparisonHomeEquity)} would be estimated home equity because your
                  mortgage balance is lower. The part that looks like housing cost, because it is
                  not recovered as equity, is {money(comparisonBuyingCost)}. Renting for the same
                  period would have cost {money(results.selectedRentCash)} and would build $0 home
                  equity.
                </p>
                <strong>
                  For a sale-price comparison with selling costs, use the Selling · Exit tab.
                </strong>
              </section>

              <div className="comparison-overview">
                <section className="comparison-side buying-side">
                  <div className="comparison-side-heading">
                    <strong>Buying</strong>
                    <span>Through month {results.selectedMonth}</span>
                  </div>
                  <div className="comparison-metrics">
                    <div className="comparison-metric cash-metric">
                      <span>Cash paid after purchase</span>
                      <strong>{money(comparisonBuyingAfterPurchase)}</strong>
                      <small>{buyingTotalBreakdown}</small>
                    </div>
                    <div className="comparison-metric equity-metric">
                      <span>Equity if the home is still worth {money(results.purchasePrice)}</span>
                      <strong>{money(comparisonHomeEquity)}</strong>
                      <small>Home price minus mortgage balance</small>
                    </div>
                    <div className="comparison-metric cost-metric">
                      <span>Costs not recovered as equity</span>
                      <strong>{money(comparisonBuyingCost)}</strong>
                      <small>
                        {buyingCostBreakdown}. These are payments that do not reduce the mortgage
                        balance or become home equity.
                      </small>
                    </div>
                  </div>
                  <div className="comparison-upfront">
                    <span>
                      <strong>Down payment</strong>
                      <small>Up-front cash · contributes to equity</small>
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
                  {results.closingCosts > 0 || !isClosingCostsComplete ? (
                    <div className="comparison-upfront closing-upfront">
                      <span>
                        <strong>Closing costs</strong>
                        <small>One-time cash · included in non-equity cost</small>
                      </span>
                      <strong>{optionalClosingCostsLabel}</strong>
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
                      <span>Renting cash paid</span>
                      <strong>{money(results.selectedRentCash)}</strong>
                      <small>
                        {!isRentalUtilitiesComplete
                          ? "Rental utilities not entered"
                          : results.monthlyRentalUtilities > 0
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
                      <span>Costs not recovered as equity</span>
                      <strong>{money(results.selectedRentCash)}</strong>
                      <small>All entered renting cash is a housing cost and does not build home equity</small>
                    </div>
                  </div>
                </section>
              </div>

              <div className="graph-panel comparison-graph">
                <div className="graph-heading">
                  <div>
                    <p className="card-kicker">Same-timescale comparison</p>
                    <h3>Cash paid after purchase and estimated equity</h3>
                  </div>
                  <span>
                    Through month {results.selectedMonth} - Year {selectedYear}, month{" "}
                    {selectedMonthInYear}
                  </span>
                </div>

                <div className="comparison-bar-group">
                  <div className="comparison-bar-label">
                    <div>
                      <strong>Buying · upfront at purchase</strong>
                      <small>
                        Down payment contributes to equity. Closing costs are upfront non-equity
                        costs.
                      </small>
                    </div>
                    <strong>{cashNeededUpfrontLabel}</strong>
                  </div>
                  <div
                    aria-label={`${cashNeededUpfrontLabel} in buying upfront cash at purchase`}
                    className="comparison-track"
                    role="img"
                  >
                    <span
                      className="down-payment-fill"
                      style={{ width: `${comparisonSeparateDownPaymentWidth}%` }}
                      title={`${money(results.downPayment)} separate down payment`}
                    />
                    {results.closingCosts > 0 ? (
                      <span
                        className="closing-costs-fill"
                        style={{ width: `${comparisonClosingCostsWidth}%` }}
                        title={`${money(results.closingCosts)} closing costs`}
                      />
                    ) : null}
                  </div>
                  <div className="comparison-legend">
                    <span>
                      <i className="legend down-payment" />
                      Down payment {money(results.downPayment)}
                    </span>
                    <span>
                      <i className="legend closing-costs" />
                      Closing costs {optionalClosingCostsLabel}
                    </span>
                  </div>
                </div>

                <div className="comparison-bar-group">
                  <div className="comparison-bar-label">
                    <div>
                      <strong>Buying · cash paid after purchase</strong>
                      <small>
                        Principal repayment reduces what you owe.
                      </small>
                    </div>
                    <strong>{money(comparisonBuyingGraphTotal)}</strong>
                  </div>
                  <div
                    aria-label={`${money(comparisonBuyingGraphTotal)} in buying cash paid after purchase: ${money(results.selectedPrincipalPaid)} mortgage principal, ${money(results.selectedInterestPaid)} mortgage interest${includeOwnerExtras ? `, ${money(selectedOwnerExtras)} in taxes and utilities` : ""}${selectedMaintenancePaid > 0 ? `, ${money(selectedMaintenancePaid)} in maintenance` : ""}${selectedHomeInsurancePaid > 0 ? `, ${money(selectedHomeInsurancePaid)} in homeowner insurance` : ""}`}
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
                      title={`${money(results.selectedInterestPaid)} mortgage interest`}
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
                  </div>
                  <div className="comparison-legend">
                    <span><i className="legend principal" />Mortgage principal {money(results.selectedPrincipalPaid)}</span>
                    <span><i className="legend interest" />Mortgage interest {money(results.selectedInterestPaid)}</span>
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
                    {!hasAdvancedBuyingCosts ? (
                      <span>
                        <i className="legend empty-legend" />
                        Other costs appear here when entered
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
                Buying cash paid after purchase includes mortgage payments and enabled ownership
                costs. Cash needed upfront includes the down payment and entered closing costs.
                Mortgage payments use {selectedPaymentFrequencyOption.label.toLowerCase()} cash
                flow, so months with an extra weekly or bi-weekly payment show higher mortgage
                cash paid.
                The down payment contributes to estimated home equity.{" "}
                Equity if the home is still worth {money(results.purchasePrice)} is the entered home price
                minus the remaining mortgage balance
                {results.cmhcPremium > 0
                  ? ", so the financed CMHC premium reduces equity."
                  : "."}
                Buying costs not recovered as equity are
                {results.cmhcPremium > 0 ? " the estimated CMHC premium plus" : ""} mortgage interest
                {includeOwnerExtras ? " plus municipal taxes and utilities" : ""}
                {selectedMaintenancePaid > 0 ? " plus entered maintenance" : ""}
                {selectedHomeInsurancePaid > 0 ? " plus entered homeowner insurance" : ""}
                {results.closingCosts > 0 ? " plus entered closing costs" : ""};
                renting&apos;s cash paid includes rent
                {results.monthlyRentalUtilities > 0 ? " and entered rental utilities" : ""} and is
                also its included housing cost.
                {!comparisonAssumptionsComplete ? " Some optional assumptions have not been entered or confirmed as zero." : ""}
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
                  separately because it reduces the mortgage. The down payment is shown as a
                  separate up-front flow and contributes to equity. Rent cash paid includes rental
                  utilities when entered. The Taxes + utilities column adds maintenance and
                  homeowner insurance only when entered; taxes and utilities can still be excluded
                  with the checkbox above.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table
                className={
                  hasAdvancedBuyingCosts
                    ? "comparison-table with-advanced-costs"
                    : "comparison-table"
                }
              >
                <thead>
                  <tr className="comparison-table-groups">
                    <th aria-hidden="true" className="table-group-spacer" />
                    <th className="table-group-buying" colSpan={comparisonBuyingTableColumnCount}>
                      Buying
                    </th>
                    <th className="table-group-renting" colSpan={2}>
                      Renting
                    </th>
                  </tr>
                  <tr>
                    <th>Year</th>
                    <th className="table-down-payment"><span className="stacked-heading"><span>Down</span><span>payment</span></span></th>
                    <th className="table-buying-cash"><span className="stacked-heading"><span>Cash paid</span><span>after purchase</span></span></th>
                    <th className="table-equity"><span className="stacked-heading"><span>Estimated</span><span>home equity</span></span></th>
                    {results.cmhcPremium > 0 ? (
                      <th className="table-cmhc"><span className="stacked-heading"><span>CMHC</span><span>premium</span></span></th>
                    ) : null}
                    <th className="table-principal"><span className="stacked-heading"><span>Principal</span><span>paid</span></span></th>
                    <th className="table-non-equity">
                      <span className="stacked-heading">
                        <span>Costs not</span>
                        <span>building equity</span>
                      </span>
                    </th>
                    <th className="table-interest"><span className="stacked-heading"><span>Mortgage</span><span>interest</span></span></th>
                    <th className="table-owner-extras">
                      <span className="stacked-heading">
                        <span>Taxes + utilities</span>
                        {results.monthlyMaintenance > 0 ? <span>+ maintenance</span> : null}
                        {results.monthlyHomeInsurance > 0 ? <span>+ insurance</span> : null}
                      </span>
                    </th>
                    {results.closingCosts > 0 || !isClosingCostsComplete ? (
                      <th className="table-closing"><span className="stacked-heading"><span>Closing</span><span>costs</span></span></th>
                    ) : null}
                    <th className="table-rent"><span className="stacked-heading"><span>Rent</span><span>cash paid</span></span></th>
                    <th className="table-rent-equity"><span className="stacked-heading"><span>Rent home</span><span>equity</span></span></th>
                  </tr>
                </thead>
                <tbody>
                  {results.years.map((row, index) => {
                    const yearlyTaxesUtilities =
                      (results.monthlyTaxes + results.monthlyUtilities) * 12 * row.year
                    const yearlyMaintenanceInsurance =
                      (results.monthlyMaintenance + results.monthlyHomeInsurance) *
                      12 *
                      row.year
                    const yearlyOwnershipCosts =
                      (includeOwnerExtras ? yearlyTaxesUtilities : 0) +
                      yearlyMaintenanceInsurance

                    return (
                      <tr key={row.year}>
                      <td><strong>{row.year}</strong></td>
                      <td className="table-down-payment">{money(results.downPayment)}</td>
                      <td className="table-buying-cash">
                        {money(
                          row.totalPrincipalPaid +
                            row.totalInterestPaid +
                            yearlyOwnershipCosts,
                        )}
                      </td>
                      <td className="table-equity">
                        {money(Math.max(0, results.purchasePrice - row.endingBalance))}
                      </td>
                      {results.cmhcPremium > 0 ? (
                        <td className="table-cmhc">{money(results.cmhcPremium)}</td>
                      ) : null}
                      <td className="table-principal">{money(row.totalPrincipalPaid)}</td>
                      <td className="table-non-equity">
                        {money(
                          results.cmhcPremium +
                            row.totalInterestPaid +
                            yearlyOwnershipCosts +
                            (isClosingCostsComplete ? results.closingCosts : 0),
                        )}
                      </td>
                      <td className="table-interest">{money(row.totalInterestPaid)}</td>
                      <td
                        className={
                          includeOwnerExtras || yearlyMaintenanceInsurance > 0
                            ? "table-owner-extras"
                            : "table-owner-extras excluded-cell"
                        }
                      >
                        {yearlyOwnershipCosts > 0 ? money(yearlyOwnershipCosts) : "Excluded"}
                      </td>
                      {results.closingCosts > 0 || !isClosingCostsComplete ? (
                        <td className="table-closing">{optionalClosingCostsLabel}</td>
                      ) : null}
                      <td className="table-rent">
                        {money(results.rentYears[index]?.totalRentalCash ?? 0)}
                      </td>
                      <td className="table-rent-equity">$0</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div
          aria-labelledby="exit-tab"
          className="workbook exit-workbook"
          id="exit-panel"
          role="tabpanel"
        >
          <section className="input-book" aria-label="Selling and exit inputs">
            <div className="tab-panel">
              <div className="sheet-title">
                <h2>Exit assumptions</h2>
                <span>Expected sale</span>
              </div>

              <div className="field-grid single exit-fields">
                <NumberField
                  id="exit-sale-price"
                  label="Expected sale price"
                  onChange={(value) => updateExitInput("salePrice", value)}
                  prefix="$"
                  step={1000}
                  value={exitInputs.salePrice}
                />
                <NumberField
                  id="exit-selling-cost-percent"
                  label="Agent and percentage-based selling costs"
                  hint="Enter the combined percentage you expect to pay. Fees vary, so this calculator does not assume a default rate."
                  max={100}
                  onChange={(value) => updateExitInput("sellingCostPercent", value)}
                  step={0.1}
                  suffix="% of sale price"
                  value={exitInputs.sellingCostPercent}
                />
                <NumberField
                  id="exit-fixed-selling-costs"
                  label="Legal, discharge and other selling costs"
                  hint="Use this for fixed selling expenses such as legal work, mortgage discharge, staging, cleaning, repairs, or moving costs."
                  onChange={(value) => updateExitInput("fixedSellingCosts", value)}
                  prefix="$"
                  step={250}
                  value={exitInputs.fixedSellingCosts}
                />
                <NumberField
                  id="exit-mortgage-penalty"
                  label="Mortgage prepayment penalty"
                  hint="A lender may charge a penalty when a mortgage is paid out before the end of its term. Enter your lender's estimate when applicable."
                  onChange={(value) => updateExitInput("mortgagePenalty", value)}
                  prefix="$"
                  step={250}
                  value={exitInputs.mortgagePenalty}
                />
              </div>

              <p className="input-note">
                Selling costs and mortgage penalties are not assumed until entered or confirmed as
                zero. Income tax is not estimated.
              </p>
            </div>
          </section>

          <section className="results-book exit-results" aria-live="polite">
            <TimelineSlider
              mode="sell"
              selectedMonth={results.selectedMonth}
              onChange={setSelectedMonth}
            />

            <div className="sheet-title results-title">
              <div>
                <h2>Exit result after {results.selectedMonth} months</h2>
                <span>Expected sale price and all entered ownership costs</span>
              </div>
            </div>

            <div className="monthly-grid four-up exit-summary-grid">
              <div className="monthly-card exit-cash-card">
                <span className="label-with-info">
                  Cash after sale
                  <InfoButton label="Sale price minus selling costs, the mortgage balance, and any entered mortgage penalty." />
                </span>
                <strong>{money(expectedExitScenario.cashAfterSale)}</strong>
              </div>
              <div
                className={
                  expectedExitScenario.homeValueChange >= 0
                    ? "monthly-card exit-positive-card"
                    : "monthly-card exit-negative-card"
                }
              >
                <span>Home value change</span>
                <strong>{money(expectedExitScenario.homeValueChange)}</strong>
              </div>
              <div
                className={
                  expectedExitScenario.netOwnershipResult >= 0
                    ? "monthly-card exit-positive-card"
                    : "monthly-card exit-negative-card"
                }
              >
                <span className="label-with-info">
                  Buying result after sale
                  <InfoButton label="Cash after sale minus the down payment and every entered ownership payment made to date. Positive means you got back more than you paid in; negative means the remaining total buying cost after sale." />
                </span>
                <strong>{money(expectedExitScenario.netOwnershipResult)}</strong>
              </div>
              <div className="monthly-card total">
                <span>{effectiveMonthlyLabel}</span>
                <strong>{money(effectiveMonthlyValue)}</strong>
              </div>
            </div>

            <div
              className={
                housingCashFlowDifference >= 0
                  ? "exit-rent-comparison buying-lower-cash-flow"
                  : "exit-rent-comparison renting-lower-cash-flow"
              }
            >
              <div>
                <span>Same-period comparison</span>
                <strong>Estimated housing cash-flow difference:</strong>
                <small>
                  {expectedExitScenario.netOwnershipCost >= 0
                    ? `Buying total cost after sale ${money(expectedExitScenario.netOwnershipCost)}`
                    : `Buying cash gain after sale ${money(Math.abs(expectedExitScenario.netOwnershipCost))}`} ·
                  Renting cash paid {money(results.selectedRentCash)}
                </small>
              </div>
              <strong>{signedMoney(housingCashFlowDifference)}</strong>
            </div>

            <section className="exit-section exit-story-section" aria-label="At the time of selling">
              <div className="exit-section-heading">
                <div>
                  <p className="card-kicker">At the time of selling</p>
                  <h3>The buying story in plain numbers</h3>
                </div>
                <span>Principal is separated from cost because it lowers the mortgage balance and becomes equity</span>
              </div>
              <div className="exit-story-panel">
                <div className="exit-story-summary">
                  <span>
                    <small>Bought for</small>
                    <strong>{money(results.purchasePrice)}</strong>
                  </span>
                  <span>
                    <small>Sold after</small>
                    <strong>{selectedDurationPhrase}</strong>
                  </span>
                  <span>
                    <small>Mortgage frequency</small>
                    <strong>{selectedPaymentFrequencyOption.label}</strong>
                  </span>
                  <span>
                    <small>Sold for</small>
                    <strong>{money(exitInputs.salePrice)}</strong>
                  </span>
                </div>

                <div className="exit-story-stack">
                  <article className="exit-story-block">
                    <header>
                      <span>1</span>
                      <div>
                        <h4>Mortgage payments split in two</h4>
                        <p>
                          You paid {money(totalMortgagePaymentsThroughExit)} to the lender.{" "}
                          {money(results.selectedPrincipalPaid)} reduced the mortgage balance, and{" "}
                          {money(results.selectedInterestPaid)} was interest cost.
                        </p>
                      </div>
                    </header>
                    <div className="exit-metric-strip">
                      <div>
                        <span>Total mortgage payments</span>
                        <strong>{money(totalMortgagePaymentsThroughExit)}</strong>
                      </div>
                      <div className="equity">
                        <span>Principal that became equity</span>
                        <strong>{money(results.selectedPrincipalPaid)}</strong>
                      </div>
                      <div className="cost">
                        <span>Interest paid</span>
                        <strong>{money(results.selectedInterestPaid)}</strong>
                      </div>
                    </div>
                  </article>

                  <article className="exit-story-block">
                    <header>
                      <span>2</span>
                      <div>
                        <h4>Equity you would own before sale deductions</h4>
                        <p>
                          Your down payment, principal repaid, and price change create gross equity.
                        </p>
                      </div>
                    </header>
                    <div className="exit-line-items">
                      <div><span>Down payment</span><strong>{money(results.downPayment)}</strong></div>
                      <div><span>Principal repaid</span><strong>{money(results.selectedPrincipalPaid)}</strong></div>
                      <div><span>Home value change</span><strong>{money(expectedExitScenario.homeValueChange)}</strong></div>
                      {results.cmhcPremium > 0 ? (
                        <div><span>Financed CMHC premium</span><strong>{deductionMoney(results.cmhcPremium)}</strong></div>
                      ) : null}
                      <div className="total"><span>Gross equity at sale</span><strong>{money(expectedExitScenario.grossHomeEquity)}</strong></div>
                    </div>
                  </article>

                  <article className="exit-story-block">
                    <header>
                      <span>3</span>
                      <div>
                        <h4>Cash costs that did not become equity</h4>
                        <p>
                          These are the ownership and transaction costs that lower the buying result.
                        </p>
                      </div>
                    </header>
                    <div className="exit-line-items cost-list">
                      {results.cmhcPremium > 0 ? (
                        <div><span>Estimated CMHC premium</span><strong>{money(results.cmhcPremium)}</strong></div>
                      ) : null}
                      <div><span>Mortgage interest</span><strong>{money(results.selectedInterestPaid)}</strong></div>
                      <div><span>Municipal taxes</span><strong>{money(taxesThroughExit)}</strong></div>
                      <div><span>Utilities</span><strong>{money(utilitiesThroughExit)}</strong></div>
                      <div><span>Maintenance and homeowner insurance</span><strong>{maintenanceAndInsuranceSpendLabel}</strong></div>
                      <div><span>Buying closing costs</span><strong>{optionalClosingCostsLabel}</strong></div>
                      <div><span>Selling costs</span><strong>{sellingCostsSpendLabel}</strong></div>
                      <div><span>Mortgage prepayment penalty</span><strong>{mortgagePenaltySpendLabel}</strong></div>
                      <div className="total"><span>Total entered non-equity costs</span><strong>{money(nonEquityCostsThroughExit)}</strong></div>
                    </div>
                  </article>

                  <article className="exit-story-block result-block">
                    <header>
                      <span>4</span>
                      <div>
                        <h4>What comes back after selling</h4>
                        <p>
                          The sale pays off the remaining mortgage first. What is left is compared
                          with all buying cash paid and with the rent you would have paid.
                        </p>
                      </div>
                    </header>
                    <div className="exit-line-items sale-math">
                      <div><span>Expected sale price</span><strong>{money(exitInputs.salePrice)}</strong></div>
                      <div><span>Mortgage balance repaid</span><strong>{deductionMoney(results.balanceAtSelectedMonth)}</strong></div>
                      <div><span>Selling costs</span><strong>{sellingCostsLabel}</strong></div>
                      <div><span>Mortgage prepayment penalty</span><strong>{mortgagePenaltyLabel}</strong></div>
                      <div className="total"><span>Cash after sale</span><strong>{money(expectedExitScenario.cashAfterSale)}</strong></div>
                    </div>
                    <div className="exit-final-comparison">
                      <div>
                        <span>Cash paid before selling</span>
                        <strong>{money(cashPaidBeforeSale)}</strong>
                      </div>
                      <div>
                        <span>Buying result</span>
                        <strong>{money(expectedExitScenario.netOwnershipResult)}</strong>
                      </div>
                      <div>
                        <span>Renting cash paid</span>
                        <strong>{money(results.selectedRentCash)}</strong>
                      </div>
                      <div className={housingCashFlowDifference >= 0 ? "winner buying" : "winner renting"}>
                        <span>{exitComparisonWinner}</span>
                        <strong>
                          {housingCashFlowDifference === 0
                            ? money(0)
                            : money(Math.abs(housingCashFlowDifference))}
                        </strong>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            <section className="exit-section" aria-label="Equity at sale">
              <div className="exit-section-heading">
                <div>
                  <p className="card-kicker">Equity at sale</p>
                  <h3>How your equity was built</h3>
                </div>
                <span>Before selling costs and any mortgage prepayment penalty</span>
              </div>
              <div className="detail-sheet exit-detail-sheet">
                <DetailRow
                  amount={money(results.downPayment)}
                  label="Original down payment"
                  note="Cash invested at purchase"
                />
                <DetailRow
                  amount={money(results.selectedPrincipalPaid)}
                  label="Mortgage principal repaid"
                  note="Added to your equity over time"
                />
                <DetailRow
                  amount={money(expectedExitScenario.homeValueChange)}
                  label="Home value change"
                  note="Sale price minus purchase price"
                />
                {results.cmhcPremium > 0 ? (
                  <DetailRow
                    amount={deductionMoney(results.cmhcPremium)}
                    label="Financed CMHC premium"
                    note="Reduced starting equity"
                  />
                ) : null}
                <DetailRow
                  amount={money(expectedExitScenario.grossHomeEquity)}
                  emphasis
                  label="Gross home equity at sale"
                  note="Sale price minus mortgage balance"
                />
              </div>
            </section>

            <section className="exit-section" aria-label="Cash received at sale">
              <div className="exit-section-heading">
                <div>
                  <p className="card-kicker">Cash at closing</p>
                  <h3>What you receive when the home is sold</h3>
                </div>
              </div>
              <div className="detail-sheet exit-detail-sheet">
                <DetailRow amount={money(exitInputs.salePrice)} label="Expected sale price" />
                <DetailRow
                  amount={percentageSellingCostsLabel}
                  label="Percentage-based selling costs"
                  note={`${formatOptionalPercent(exitInputs.sellingCostPercent, isSellingCostPercentComplete)} of sale price`}
                />
                <DetailRow
                  amount={fixedSellingCostsLabel}
                  label="Fixed selling costs"
                />
                <DetailRow
                  amount={deductionMoney(results.balanceAtSelectedMonth)}
                  label="Mortgage balance repaid"
                />
                <DetailRow
                  amount={money(expectedExitScenario.grossHomeEquity)}
                  label="Gross home equity"
                  note="Includes your original down payment"
                />
                <DetailRow
                  amount={mortgagePenaltyLabel}
                  label="Mortgage prepayment penalty"
                />
                <DetailRow
                  amount={money(expectedExitScenario.cashAfterSale)}
                  emphasis
                  label="Cash after sale"
                />
              </div>
            </section>

            <section className="exit-section" aria-label="Buying result after sale breakdown">
              <div className="exit-section-heading">
                <div>
                  <p className="card-kicker">Buying result</p>
                  <h3>What changed your result</h3>
                </div>
                <span>Down payment and principal are recovered through equity, not counted as costs</span>
              </div>
              <div className="exit-waterfall">
                {[
                  {
                    label: "Home value change",
                    value: expectedExitScenario.homeValueChange,
                    kind: expectedExitScenario.homeValueChange >= 0 ? "gain" : "cost",
                  },
                  ...(results.cmhcPremium > 0
                    ? [{ label: "Estimated CMHC premium", value: -results.cmhcPremium, kind: "cost" }]
                    : []),
                  { label: "Mortgage interest", value: -results.selectedInterestPaid, kind: "cost" },
                  {
                    label: "Municipal taxes",
                    value: -results.monthlyTaxes * results.selectedMonth,
                    kind: "cost",
                  },
                  {
                    label: "Utilities",
                    value: -results.monthlyUtilities * results.selectedMonth,
                    kind: "cost",
                  },
                  {
                    label: "Maintenance and homeowner insurance",
                    value: -maintenanceAndInsuranceThroughExit,
                    kind: "cost",
                    amount: maintenanceAndInsuranceExitLabel,
                  },
                  {
                    label: "Buying closing costs",
                    value: -results.closingCosts,
                    kind: "cost",
                    amount: closingCostsDeductionLabel,
                  },
                  {
                    label: "Selling costs",
                    value: -expectedExitScenario.totalSellingCosts,
                    kind: "cost",
                    amount: sellingCostsLabel,
                  },
                  {
                    label: "Mortgage prepayment penalty",
                    value: -exitInputs.mortgagePenalty,
                    kind: "cost",
                    amount: mortgagePenaltyLabel,
                  },
                ].map((item) => {
                  const maxExitFactor = Math.max(
                    1,
                    Math.abs(expectedExitScenario.homeValueChange),
                    results.cmhcPremium,
                    results.selectedInterestPaid,
                    results.monthlyTaxes * results.selectedMonth,
                    results.monthlyUtilities * results.selectedMonth,
                    (results.monthlyMaintenance + results.monthlyHomeInsurance) *
                      results.selectedMonth,
                    results.closingCosts,
                    expectedExitScenario.totalSellingCosts,
                    exitInputs.mortgagePenalty,
                  )
                  const width = (Math.abs(item.value) / maxExitFactor) * 100

                  return (
                    <div className="exit-waterfall-row" key={item.label}>
                      <span>{item.label}</span>
                      <div className="exit-waterfall-track" aria-hidden="true">
                        <i className={item.kind} style={{ width: `${width}%` }} />
                      </div>
                      <strong>{"amount" in item ? item.amount : money(item.value)}</strong>
                    </div>
                  )
                })}
                <div className="exit-waterfall-total">
                  <span>Buying result after sale</span>
                  <strong>{money(expectedExitScenario.netOwnershipResult)}</strong>
                </div>
              </div>
            </section>

            <p className="comparison-note exit-note">
              This is a simplified cash-flow scenario, not tax or investment advice. It excludes
              income tax, opportunity cost, investment returns, inflation, and any cost not entered
              or confirmed as zero. A principal-residence sale may still have reporting
              requirements.
            </p>
          </section>
        </div>
      )}

      <section className="print-report" aria-label="Printable calculator export">
        <article className="print-page">
          <header className="print-page-heading">
            <div>
              <p className="card-kicker">Buying · Mortgage</p>
              <h2>Buying overview</h2>
            </div>
            <span>Page 1 of Buying</span>
          </header>

          <div className="workbook print-workbook">
            <section className="input-book" aria-label="Printed buying inputs">
              <div className="tab-panel">
                <div className="sheet-title">
                  <h2>Buying inputs</h2>
                  <span>Mortgage worksheet</span>
                </div>
                <div className="detail-sheet print-detail-sheet">
                  <DetailRow amount={money(results.purchasePrice)} label="Home price" />
                  <DetailRow amount={percent(results.downPaymentPercent)} label="Down payment" />
                  <DetailRow amount={percent(inputs.interestRate)} label="Interest rate for first 5-year term" />
                  <DetailRow amount={`${inputs.amortizationYears} years`} label="Repayment period" />
                  <DetailRow amount={selectedPaymentFrequencyOption.label} label="Payment frequency" />
                  <DetailRow amount={money(inputs.annualTaxes)} label="Property taxes/year" />
                  <DetailRow amount={preciseMoney(inputs.monthlyUtilities)} label="Utilities/month" />
                  <DetailRow amount={optionalClosingCostsLabel} label="Closing costs" />
                </div>
              </div>
            </section>

            <section className="results-book" aria-label="Printed buying results">
              <div className="sheet-title results-title">
                <div>
                  <h2>Monthly spending in month {results.selectedMonth}</h2>
                  <span>Year {selectedYear}, month {selectedMonthInYear}</span>
                </div>
              </div>

              <div className="monthly-grid four-up">
                <div className="monthly-card owner">
                  <span>Mortgage payment</span>
                  <strong>{preciseMoney(results.selectedMonthMortgagePayment)}</strong>
                </div>
                <div className="monthly-card">
                  <span>Property taxes/month</span>
                  <strong>{preciseMoney(results.monthlyTaxes)}</strong>
                </div>
                <div className="monthly-card">
                  <span>Home operating costs/month</span>
                  <strong>{preciseMoney(monthlyOwnershipCosts)}</strong>
                </div>
                <div className="monthly-card total">
                  <span>Monthly total</span>
                  <strong>{preciseMoney(results.selectedMonthlyOwnerTotal)}</strong>
                </div>
              </div>

              <div className="graph-panel print-graph-panel">
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
                  <small>Down payment, taxes, utilities, and advanced costs are not included here.</small>
                </div>
                <div className="payment-split-bar" role="img">
                  <span className="principal" style={{ width: `${selectedPrincipalPercent}%` }} />
                  <span className="interest" style={{ width: `${selectedInterestPercent}%` }} />
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
                  <div>
                    <span>Estimated payoff</span>
                    <strong>{payoffDurationPhrase}</strong>
                  </div>
                  <div>
                    <span>Time saved</span>
                    <strong>{payoffSavingsPhrase}</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </article>

        <article className="print-page">
          <header className="print-page-heading">
            <div>
              <p className="card-kicker">Buying · Mortgage</p>
              <h2>Mortgage schedule</h2>
            </div>
            <span>Page 2 of Buying</span>
          </header>

          <table className="print-table buying-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Rate</th>
                <th>Avg monthly mortgage</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Mortgage left</th>
                <th>Repaid</th>
              </tr>
            </thead>
            <tbody>
              {results.years.map((row) => (
                <tr key={`print-buy-${row.year}`}>
                  <td>{row.year}</td>
                  <td>{percent(row.annualRate)}</td>
                  <td>{preciseMoney(row.monthlyPayment)}</td>
                  <td>{money(row.totalPrincipalPaid)}</td>
                  <td>{money(row.totalInterestPaid)}</td>
                  <td>{money(row.endingBalance)}</td>
                  <td>{percent(row.paidOffPercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="print-page">
          <header className="print-page-heading">
            <div>
              <p className="card-kicker">Renting</p>
              <h2>Renting overview</h2>
            </div>
            <span>Page 1 of Renting</span>
          </header>

          <div className="workbook rent-workbook print-workbook">
            <section className="input-book" aria-label="Printed renting inputs">
              <div className="tab-panel">
                <div className="sheet-title">
                  <h2>Renting inputs</h2>
                  <span>Rent-growth worksheet</span>
                </div>
                <div className="detail-sheet print-detail-sheet">
                  <DetailRow amount={preciseMoney(inputs.monthlyRent)} label="Monthly rent" />
                  <DetailRow amount={optionalRentIncreaseLabel} label="Annual rent increase" />
                  <DetailRow amount={optionalRentalUtilitiesLabel} label="Rental utilities/month" />
                </div>
              </div>
            </section>

            <section className="results-book" aria-label="Printed renting results">
              <div className="sheet-title results-title">
                <div>
                  <h2>Monthly spending in month {results.selectedMonth}</h2>
                  <span>Year {selectedYear}, month {selectedMonthInYear}</span>
                </div>
              </div>
              <div className="monthly-grid four-up rent-summary">
                <div className="monthly-card rent">
                  <span>Monthly rent in month {results.selectedMonth}</span>
                  <strong>{preciseMoney(results.selectedMonthlyRent)}</strong>
                </div>
                <div className="monthly-card">
                  <span>Rental utilities</span>
                  <strong>{optionalRentalUtilitiesLabel}</strong>
                </div>
                <div className="monthly-card total">
                  <span>Monthly renting total</span>
                  <strong>{preciseMoney(results.selectedMonthlyRent + results.monthlyRentalUtilities)}</strong>
                </div>
                <div className="monthly-card total">
                  <span>Cumulative cost month {results.selectedMonth}</span>
                  <strong>{money(results.selectedRentCash)}</strong>
                </div>
              </div>
            </section>
          </div>
        </article>

        <article className="print-page">
          <header className="print-page-heading">
            <div>
              <p className="card-kicker">Renting</p>
              <h2>Rent schedule</h2>
            </div>
            <span>Page 2 of Renting</span>
          </header>

          <table className="print-table rent-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Monthly rent</th>
                <th>Annual rent</th>
                <th>Total rent</th>
                <th>Total utilities</th>
                <th>Total renting cash</th>
              </tr>
            </thead>
            <tbody>
              {results.rentYears.map((row) => (
                <tr key={`print-rent-${row.year}`}>
                  <td>{row.year}</td>
                  <td>{preciseMoney(row.monthlyRent)}</td>
                  <td>{money(row.annualRent)}</td>
                  <td>{money(row.totalRent)}</td>
                  <td>{money(row.totalRentalUtilities)}</td>
                  <td>{money(row.totalRentalCash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="print-page">
          <header className="print-page-heading">
            <div>
              <p className="card-kicker">Buy vs. Rent</p>
              <h2>Comparison overview</h2>
            </div>
            <span>Page 1 of Buy vs. Rent</span>
          </header>

          <section className="results-book comparison-panel print-panel" aria-label="Printed buy versus rent">
            <div className="sheet-title results-title">
              <div>
                <h2>Buy vs. rent through month {results.selectedMonth}</h2>
                <span>Simplified cash paid after purchase and estimated home equity on the same timeline</span>
              </div>
            </div>

            <div className="comparison-assumptions">
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
                <span>Mortgage frequency</span>
                <strong>{selectedPaymentFrequencyOption.label}</strong>
              </div>
              <div>
                <span>Annual rent increase</span>
                <strong>{optionalRentIncreaseLabel}</strong>
              </div>
              <div>
                <span>Taxes and utilities</span>
                <strong>{includeOwnerExtras ? "Included" : "Excluded"}</strong>
              </div>
            </div>

            <div className="comparison-overview">
              <section className="comparison-side buying-side">
                <div className="comparison-side-heading">
                  <strong>Buying</strong>
                  <span>Through month {results.selectedMonth}</span>
                </div>
                <div className="comparison-metrics">
                  <div className="comparison-metric cash-metric">
                    <span>Cash paid after purchase</span>
                    <strong>{money(comparisonBuyingAfterPurchase)}</strong>
                    <small>{buyingTotalBreakdown}</small>
                  </div>
                  <div className="comparison-metric equity-metric">
                    <span>Equity if the home is still worth {money(results.purchasePrice)}</span>
                    <strong>{money(comparisonHomeEquity)}</strong>
                    <small>Home price minus mortgage balance</small>
                  </div>
                  <div className="comparison-metric cost-metric">
                    <span>Costs not recovered as equity</span>
                    <strong>{money(comparisonBuyingCost)}</strong>
                    <small>{buyingCostBreakdown}</small>
                  </div>
                </div>
                <div className="comparison-upfront">
                  <span>
                    <strong>Down payment</strong>
                    <small>Up-front cash · contributes to equity</small>
                  </span>
                  <strong>{money(results.downPayment)}</strong>
                </div>
              </section>

              <section className="comparison-side renting-side">
                <div className="comparison-side-heading">
                  <strong>Renting</strong>
                  <span>Through month {results.selectedMonth}</span>
                </div>
                <div className="comparison-metrics">
                  <div className="comparison-metric cash-metric">
                    <span>Renting cash paid</span>
                    <strong>{money(results.selectedRentCash)}</strong>
                    <small>{hasAdvancedRentingCosts ? "Rent + rental utilities" : "Flat rent paid to date"}</small>
                  </div>
                  <div className="comparison-metric equity-metric">
                    <span>Estimated home equity</span>
                    <strong>$0</strong>
                    <small>Rent does not reduce a mortgage</small>
                  </div>
                  <div className="comparison-metric cost-metric">
                    <span>Costs not recovered as equity</span>
                    <strong>{money(results.selectedRentCash)}</strong>
                    <small>All entered renting cash is a housing cost</small>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </article>

        <article className="print-page">
          <header className="print-page-heading">
            <div>
              <p className="card-kicker">Buy vs. Rent</p>
              <h2>Comparison schedule</h2>
            </div>
            <span>Page 2 of Buy vs. Rent</span>
          </header>

          <table className="print-table comparison-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Down payment</th>
                <th>Buying cash after purchase</th>
                <th>Estimated home equity</th>
                <th>Costs not building equity</th>
                <th>Rent cash paid</th>
              </tr>
            </thead>
            <tbody>
              {results.years.map((row, index) => {
                const yearlyTaxesUtilities =
                  (results.monthlyTaxes + results.monthlyUtilities) * 12 * row.year
                const yearlyMaintenanceInsurance =
                  (results.monthlyMaintenance + results.monthlyHomeInsurance) * 12 * row.year
                const yearlyOwnershipCosts =
                  (includeOwnerExtras ? yearlyTaxesUtilities : 0) + yearlyMaintenanceInsurance

                return (
                  <tr key={`print-compare-${row.year}`}>
                    <td>{row.year}</td>
                    <td>{money(results.downPayment)}</td>
                    <td>{money(row.totalPrincipalPaid + row.totalInterestPaid + yearlyOwnershipCosts)}</td>
                    <td>{money(Math.max(0, results.purchasePrice - row.endingBalance))}</td>
                    <td>
                      {money(
                        results.cmhcPremium +
                          row.totalInterestPaid +
                          yearlyOwnershipCosts +
                          (isClosingCostsComplete ? results.closingCosts : 0),
                      )}
                    </td>
                    <td>{money(results.rentYears[index]?.totalRentalCash ?? 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </article>

        <article className="print-page">
          <header className="print-page-heading">
            <div>
              <p className="card-kicker">Selling · Exit</p>
              <h2>Exit overview</h2>
            </div>
            <span>Page 1 of Selling · Exit</span>
          </header>

          <div className="workbook exit-workbook print-workbook">
            <section className="input-book" aria-label="Printed exit assumptions">
              <div className="tab-panel">
                <div className="sheet-title">
                  <h2>Exit assumptions</h2>
                  <span>Expected sale</span>
                </div>
                <div className="detail-sheet print-detail-sheet">
                  <DetailRow amount={money(exitInputs.salePrice)} label="Expected sale price" />
                  <DetailRow amount={formatOptionalPercent(exitInputs.sellingCostPercent, isSellingCostPercentComplete)} label="Agent and percentage-based selling costs" />
                  <DetailRow amount={formatOptionalMoney(exitInputs.fixedSellingCosts, isFixedSellingCostsComplete)} label="Legal, discharge and other selling costs" />
                  <DetailRow amount={mortgagePenaltySpendLabel} label="Mortgage prepayment penalty" />
                </div>
              </div>
            </section>

            <section className="results-book exit-results" aria-label="Printed exit results">
              <div className="sheet-title results-title">
                <div>
                  <h2>Exit result after {results.selectedMonth} months</h2>
                  <span>Expected sale price and all entered ownership costs</span>
                </div>
              </div>
              <div className="monthly-grid four-up exit-summary-grid">
                <div className="monthly-card exit-cash-card">
                  <span>Cash after sale</span>
                  <strong>{money(expectedExitScenario.cashAfterSale)}</strong>
                </div>
                <div className={expectedExitScenario.homeValueChange >= 0 ? "monthly-card exit-positive-card" : "monthly-card exit-negative-card"}>
                  <span>Home value change</span>
                  <strong>{money(expectedExitScenario.homeValueChange)}</strong>
                </div>
                <div className={expectedExitScenario.netOwnershipResult >= 0 ? "monthly-card exit-positive-card" : "monthly-card exit-negative-card"}>
                  <span>Buying result after sale</span>
                  <strong>{money(expectedExitScenario.netOwnershipResult)}</strong>
                </div>
                <div className="monthly-card total">
                  <span>{effectiveMonthlyLabel}</span>
                  <strong>{money(effectiveMonthlyValue)}</strong>
                </div>
              </div>

              <div className={housingCashFlowDifference >= 0 ? "exit-rent-comparison buying-lower-cash-flow" : "exit-rent-comparison renting-lower-cash-flow"}>
                <div>
                  <span>Same-period comparison</span>
                  <strong>Estimated housing cash-flow difference:</strong>
                  <small>Renting cash paid {money(results.selectedRentCash)}</small>
                </div>
                <strong>{signedMoney(housingCashFlowDifference)}</strong>
              </div>
            </section>
          </div>
        </article>

        <article className="print-page">
          <header className="print-page-heading">
            <div>
              <p className="card-kicker">Selling · Exit</p>
              <h2>Exit details</h2>
            </div>
            <span>Page 2 of Selling · Exit</span>
          </header>

          <div className="print-two-column">
            <section className="exit-section">
              <div className="exit-section-heading">
                <div>
                  <p className="card-kicker">Equity at sale</p>
                  <h3>How your equity was built</h3>
                </div>
              </div>
              <div className="detail-sheet exit-detail-sheet">
                <DetailRow amount={money(results.downPayment)} label="Original down payment" />
                <DetailRow amount={money(results.selectedPrincipalPaid)} label="Mortgage principal repaid" />
                <DetailRow amount={money(expectedExitScenario.homeValueChange)} label="Home value change" />
                <DetailRow amount={money(expectedExitScenario.grossHomeEquity)} emphasis label="Gross home equity at sale" />
              </div>
            </section>

            <section className="exit-section">
              <div className="exit-section-heading">
                <div>
                  <p className="card-kicker">Cash at closing</p>
                  <h3>What you receive when the home is sold</h3>
                </div>
              </div>
              <div className="detail-sheet exit-detail-sheet">
                <DetailRow amount={money(exitInputs.salePrice)} label="Expected sale price" />
                <DetailRow amount={sellingCostsLabel} label="Selling costs" />
                <DetailRow amount={deductionMoney(results.balanceAtSelectedMonth)} label="Mortgage balance repaid" />
                <DetailRow amount={mortgagePenaltyLabel} label="Mortgage prepayment penalty" />
                <DetailRow amount={money(expectedExitScenario.cashAfterSale)} emphasis label="Cash after sale" />
              </div>
            </section>
          </div>

          <table className="print-table">
            <tbody>
              <tr>
                <th>Cash paid before selling</th>
                <td>{money(cashPaidBeforeSale)}</td>
                <th>Renting cash paid</th>
                <td>{money(results.selectedRentCash)}</td>
              </tr>
              <tr>
                <th>Mortgage balance repaid</th>
                <td>{deductionMoney(results.balanceAtSelectedMonth)}</td>
                <th>{exitComparisonWinner}</th>
                <td>{housingCashFlowDifference === 0 ? money(0) : money(Math.abs(housingCashFlowDifference))}</td>
              </tr>
            </tbody>
          </table>
        </article>
      </section>

      <footer>
        <p>
          Simplified cash-flow estimate only. Entered maintenance, homeowner insurance, closing
          costs, rental utilities, entered five-year renewal rates, annual rent increases
          {showCmhcDetails ? ", an eligible estimated CMHC premium" : ""}, and selected mortgage
          payment frequency are included. These
          rates are scenarios, not forecasts.
          Home-price changes and selling costs are included only in Selling · Exit using the
          entered assumptions. Investment returns and tenant insurance are excluded.
        </p>
      </footer>
    </main>
  )
}
