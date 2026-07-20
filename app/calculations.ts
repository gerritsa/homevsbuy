export type MonthlyRow = {
  month: number
  annualRate: number
  mortgagePayment: number
  principalPaid: number
  interestPaid: number
  totalPrincipalPaid: number
  totalInterestPaid: number
  endingBalance: number
  paidOffPercent: number
}

export type YearRow = {
  year: number
  annualRate: number
  monthlyPayment: number
  principalPaid: number
  interestPaid: number
  totalPrincipalPaid: number
  totalInterestPaid: number
  endingBalance: number
  paidOffPercent: number
}

export type RentMonthlyRow = {
  month: number
  monthlyRent: number
  rentPaid: number
  totalRent: number
  monthlyRentalUtilities: number
  totalRentalUtilities: number
  totalRentalCash: number
}

export type RentYearRow = {
  year: number
  monthlyRent: number
  annualRent: number
  totalRent: number
  annualRentalUtilities: number
  totalRentalUtilities: number
  totalRentalCash: number
}

export type MortgageAmounts = {
  purchasePrice: number
  downPaymentPercent: number
  downPayment: number
  minimumDownPayment: number
  baseMortgageAmount: number
  cmhcPremiumRate: number
  cmhcPremium: number
  mortgageAmount: number
  cmhcWarning: string | null
}

export const LONG_TERM_YEARS = 25
export const LONG_TERM_MONTHS = LONG_TERM_YEARS * 12

export function minimumDownPaymentFor(purchasePrice: number) {
  const price = Math.max(0, purchasePrice)

  if (price >= 1_500_000) {
    return price * 0.2
  }

  if (price > 500_000) {
    return 25_000 + (price - 500_000) * 0.1
  }

  return price * 0.05
}

function cmhcBasePremiumRate(loanToValuePercent: number) {
  if (loanToValuePercent <= 80) return 0
  if (loanToValuePercent <= 85) return 2.8
  if (loanToValuePercent <= 90) return 3.1
  if (loanToValuePercent <= 95) return 4
  return 0
}

export function calculateMortgageAmounts(
  rawPurchasePrice: number,
  rawDownPaymentPercent: number,
  amortizationYears: number,
): MortgageAmounts {
  const purchasePrice = Math.max(0, rawPurchasePrice)
  const downPaymentPercent = Math.min(100, Math.max(0, rawDownPaymentPercent))
  const downPayment = purchasePrice * (downPaymentPercent / 100)
  const minimumDownPayment = minimumDownPaymentFor(purchasePrice)
  const baseMortgageAmount = Math.max(0, purchasePrice - downPayment)
  const loanToValuePercent =
    purchasePrice === 0 ? 0 : (baseMortgageAmount / purchasePrice) * 100

  let cmhcWarning: string | null = null
  let cmhcPremiumRate = 0

  if (purchasePrice > 0 && downPaymentPercent < 20) {
    if (purchasePrice >= 1_500_000) {
      cmhcWarning =
        "Homes priced at $1.5 million or more are not eligible for mortgage loan insurance and require at least 20% down."
    } else if (downPayment + 0.005 < minimumDownPayment) {
      cmhcWarning = `The entered down payment is below the minimum required amount of ${minimumDownPayment.toLocaleString(
        "en-CA",
        {
          style: "currency",
          currency: "CAD",
          maximumFractionDigits: 0,
        },
      )}. The CMHC premium cannot be estimated for this scenario.`
    } else {
      cmhcPremiumRate =
        Math.round(
          (cmhcBasePremiumRate(loanToValuePercent) + (amortizationYears > 25 ? 0.2 : 0)) * 10,
        ) / 10
    }
  }

  const cmhcPremium = baseMortgageAmount * (cmhcPremiumRate / 100)
  const mortgageAmount = baseMortgageAmount + cmhcPremium

  return {
    purchasePrice,
    downPaymentPercent,
    downPayment,
    minimumDownPayment,
    baseMortgageAmount,
    cmhcPremiumRate,
    cmhcPremium,
    mortgageAmount,
    cmhcWarning,
  }
}

export function buildSchedule(
  mortgageAmount: number,
  annualRateOrRates: number | number[],
  amortizationYears: number,
) {
  const safeMortgage = Math.max(0, mortgageAmount)
  const safeYears = Math.max(1, Math.round(amortizationYears))
  const numberOfPayments = safeYears * 12
  const annualRates = (
    Array.isArray(annualRateOrRates) ? annualRateOrRates : [annualRateOrRates]
  ).map((rate) => Math.max(0, rate))

  if (annualRates.length === 0) {
    annualRates.push(0)
  }

  const months: MonthlyRow[] = []
  let balance = safeMortgage
  let totalPrincipalPaid = 0
  let totalInterestPaid = 0
  let currentAnnualRate = annualRates[0]
  let currentMonthlyRate = 0
  let currentMonthlyPayment = 0

  const monthlyRateFor = (annualRate: number) => {
    const nominalAnnualRate = annualRate / 100
    // Canadian fixed mortgage rates are quoted with semi-annual compounding.
    return nominalAnnualRate === 0 ? 0 : (1 + nominalAnnualRate / 2) ** (1 / 6) - 1
  }

  const paymentFor = (principal: number, monthlyRate: number, paymentCount: number) => {
    if (principal === 0 || paymentCount <= 0) return 0
    if (monthlyRate === 0) return principal / paymentCount

    return (
      (principal * monthlyRate * (1 + monthlyRate) ** paymentCount) /
      ((1 + monthlyRate) ** paymentCount - 1)
    )
  }

  for (let month = 1; month <= Math.max(numberOfPayments, LONG_TERM_MONTHS); month += 1) {
    if (month <= numberOfPayments && (month === 1 || (month - 1) % 60 === 0)) {
      const termIndex = Math.min(Math.floor((month - 1) / 60), annualRates.length - 1)
      currentAnnualRate = annualRates[termIndex]
      currentMonthlyRate = monthlyRateFor(currentAnnualRate)
      currentMonthlyPayment = paymentFor(
        balance,
        currentMonthlyRate,
        numberOfPayments - month + 1,
      )
    }

    const interestPaid = balance > 0.005 ? balance * currentMonthlyRate : 0
    const principalPaid =
      balance > 0.005
        ? Math.min(Math.max(0, currentMonthlyPayment - interestPaid), balance)
        : 0
    const mortgagePayment = principalPaid + interestPaid

    totalPrincipalPaid += principalPaid
    totalInterestPaid += interestPaid
    balance = Math.max(0, balance - principalPaid)

    months.push({
      month,
      annualRate: currentAnnualRate,
      mortgagePayment,
      principalPaid,
      interestPaid,
      totalPrincipalPaid,
      totalInterestPaid,
      endingBalance: balance,
      paidOffPercent:
        safeMortgage === 0 ? 100 : Math.min(100, (totalPrincipalPaid / safeMortgage) * 100),
    })
  }

  const years: YearRow[] = Array.from({ length: LONG_TERM_YEARS }, (_, index) => {
    const year = index + 1
    const yearMonths = months.slice(index * 12, year * 12)
    const lastMonth = yearMonths.at(-1) ?? months.at(-1)

    return {
      year,
      annualRate: yearMonths[0]?.annualRate ?? annualRates.at(-1) ?? 0,
      monthlyPayment: yearMonths[0]?.mortgagePayment ?? 0,
      principalPaid: yearMonths.reduce((sum, row) => sum + row.principalPaid, 0),
      interestPaid: yearMonths.reduce((sum, row) => sum + row.interestPaid, 0),
      totalPrincipalPaid: lastMonth?.totalPrincipalPaid ?? 0,
      totalInterestPaid: lastMonth?.totalInterestPaid ?? 0,
      endingBalance: lastMonth?.endingBalance ?? 0,
      paidOffPercent: lastMonth?.paidOffPercent ?? 100,
    }
  })

  return {
    monthlyPayment: months[0]?.mortgagePayment ?? 0,
    monthlyRate: monthlyRateFor(annualRates[0]),
    months,
    years,
  }
}

export function buildRentSchedule(
  rawMonthlyRent: number,
  rawMonthlyRentalUtilities: number,
  rawAnnualRentIncrease: number,
) {
  const baseMonthlyRent = Math.max(0, rawMonthlyRent)
  const monthlyRentalUtilities = Math.max(0, rawMonthlyRentalUtilities)
  const annualRentIncrease = Math.max(0, rawAnnualRentIncrease) / 100
  const months: RentMonthlyRow[] = []
  let totalRent = 0
  let totalRentalUtilities = 0

  for (let month = 1; month <= LONG_TERM_MONTHS; month += 1) {
    const completedYears = Math.floor((month - 1) / 12)
    const monthlyRent = baseMonthlyRent * (1 + annualRentIncrease) ** completedYears
    const rentPaid = monthlyRent

    totalRent += rentPaid
    totalRentalUtilities += monthlyRentalUtilities

    months.push({
      month,
      monthlyRent,
      rentPaid,
      totalRent,
      monthlyRentalUtilities,
      totalRentalUtilities,
      totalRentalCash: totalRent + totalRentalUtilities,
    })
  }

  const years: RentYearRow[] = Array.from({ length: LONG_TERM_YEARS }, (_, index) => {
    const year = index + 1
    const yearMonths = months.slice(index * 12, year * 12)
    const lastMonth = yearMonths.at(-1)

    return {
      year,
      monthlyRent: yearMonths[0]?.monthlyRent ?? 0,
      annualRent: yearMonths.reduce((sum, row) => sum + row.rentPaid, 0),
      totalRent: lastMonth?.totalRent ?? 0,
      annualRentalUtilities: monthlyRentalUtilities * 12,
      totalRentalUtilities: lastMonth?.totalRentalUtilities ?? 0,
      totalRentalCash: lastMonth?.totalRentalCash ?? 0,
    }
  })

  return { months, years }
}
