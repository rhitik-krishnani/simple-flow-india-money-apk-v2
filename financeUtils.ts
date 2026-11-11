
/**
 * Calculates Absolute Return (%)
 * 
 * @param invested Cash outflow
 * @param current Cash inflow / current valuation
 */
export const BENCHMARK_DATA = {
    'Nifty 50': { '1y': 15.2, '3y': 18.5, '5y': 14.8, '10y': 13.5 },
    'Nifty Next 50': { '1y': 22.4, '3y': 20.1, '5y': 16.2, '10y': 14.8 },
    'Nifty Midcap 100': { '1y': 35.6, '3y': 22.4, '5y': 18.2, '10y': 16.5 },
    'Nifty Smallcap 250': { '1y': 48.2, '3y': 26.5, '5y': 20.1, '10y': 17.8 },
    'Gold (MCX)': { '1y': 12.4, '3y': 10.2, '5y': 11.5, '10y': 8.2 },
    'Fixed Deposit': { '1y': 7.1, '3y': 7.5, '5y': 7.5, '10y': 7.2 },
};

export const calculateAbsoluteReturn = (invested: number, current: number): number => {
    if (invested <= 0) return 0;
    const result = ((current - invested) / invested) * 100;
    if (isNaN(result) || !isFinite(result)) return 0;
    return parseFloat(result.toFixed(2));
};

export const getDefaultBenchmark = (type: string): { name: string, return: number } => {
    switch (type) {
        case 'Stock': return { name: 'Nifty 50', return: 14.2 };
        case 'Mutual Fund': return { name: 'Nifty 50 TRI', return: 15.1 };
        case 'Gold': return { name: 'Gold (MCX)', return: 9.2 };
        case 'FD': return { name: '1Y FD Rate', return: 7.1 };
        case 'Crypto': return { name: 'Bitcoin (BTC)', return: 65.4 };
        case 'Real Estate': return { name: 'NHB Residex', return: 7.5 };
        case 'PPF': return { name: 'PPF Rate', return: 7.1 };
        default: return { name: 'Inflation (CPI)', return: 6.0 };
    }
};

export const calculatePortfolioReturn = (investments: { investedAmount: number, currentValue: number }[]): number => {
    const validInvestments = investments.filter(i => i.investedAmount > 0);
    if (validInvestments.length === 0) return 0;
    
    const totalInvested = validInvestments.reduce((sum, i) => sum + i.investedAmount, 0);
    const totalCurrentValue = validInvestments.reduce((sum, i) => sum + i.currentValue, 0);
    
    if (totalInvested <= 0) return 0;

    return calculateAbsoluteReturn(totalInvested, totalCurrentValue);
};

export const calculatePortfolioAnnualizedReturn = (investments: { investedAmount: number, currentValue: number, purchaseDate: string | Date }[]): number => {
    const totalInvested = investments.reduce((sum, i) => sum + i.investedAmount, 0);
    if (totalInvested <= 0) return 0;
    
    let weightedAnnReturn = 0;
    investments.forEach(inv => {
        const annReturn = calculateAnnualizedReturn(inv.investedAmount, inv.currentValue, inv.purchaseDate);
        weightedAnnReturn += annReturn * (inv.investedAmount / totalInvested);
    });
    
    return parseFloat(weightedAnnReturn.toFixed(2));
};

export const calculateAnnualizedReturn = (invested: number, current: number, start: string | Date, end: string | Date = new Date()): number => {
    if (invested <= 0 || current < 0) return 0;

    const diffTime = new Date(end).getTime() - new Date(start).getTime();
    // Unknown/invalid dates, or a holding period under one year: show the plain absolute return.
    // Annualising a short gain (e.g. +5% in a month) would claim an absurd yearly figure.
    if (!isFinite(diffTime) || diffTime < 365 * 86400000) return calculateAbsoluteReturn(invested, current);

    const diffDays = Math.ceil(diffTime / 86400000);
    const result = (Math.pow(current / invested, 365 / diffDays) - 1) * 100;
    if (isNaN(result) || !isFinite(result)) return 0;
    return parseFloat(result.toFixed(2));
};

/**
 * Loan prepayment simulator.
 * Keeps the EMI fixed (computed from the current balance over the remaining tenure), applies the lump sum
 * to the balance today, and adds any extra monthly payment. The loan therefore ends sooner and costs less interest.
 * Assumes no prepayment penalty (usually nil on floating-rate loans to individuals; fixed-rate loans may charge 2-5%).
 */
export const simulatePrepayment = (
    balance: number, annualRate: number, remainingYears: number, lumpSum: number, extraMonthly: number
): { emi: number; original: { months: number; interest: number }; withPrepay: { months: number; interest: number }; monthsSaved: number; interestSaved: number } => {
    const months = Math.max(1, Math.round(remainingYears * 12));
    const bal0 = Math.max(0, balance || 0);
    const lump = Math.min(Math.max(0, lumpSum || 0), bal0);
    const extra = Math.max(0, extraMonthly || 0);
    const mr = (annualRate || 0) / 1200;
    const emi = bal0 <= 0 ? 0 : mr === 0 ? bal0 / months : (bal0 * mr * Math.pow(1 + mr, months)) / (Math.pow(1 + mr, months) - 1);

    const run = (start: number, extraM: number) => {
        let b = start, interest = 0, n = 0;
        while (b > 0.5 && n < 1200) {
            const i = b * mr;
            interest += i; n++;
            b -= Math.min(b, Math.max(0, emi + extraM - i));
        }
        return { months: n, interest };
    };

    const original = run(bal0, 0);
    const withPrepay = run(bal0 - lump, extra);
    return {
        emi, original, withPrepay,
        monthsSaved: Math.max(0, original.months - withPrepay.months),
        interestSaved: Math.max(0, original.interest - withPrepay.interest),
    };
};

// ====================================================================================
// Calculator maths (pure functions, covered by tests/ruleEngine.test.ts)
// Conventions: monthly rate = annual / 12 (as Indian MF/bank calculators do); SIP instalments paid at
// the start of each month; lumpsum compounds annually; FD compounds quarterly.
// ====================================================================================
const monthlyRate = (annualPct: number) => (annualPct || 0) / 1200;

export const sipFutureValue = (monthly: number, annualRate: number, years: number): number => {
    const n = (years || 0) * 12;
    const i = monthlyRate(annualRate);
    if (n <= 0 || monthly <= 0) return 0;
    if (i === 0) return monthly * n;
    return monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
};

export const stepUpSipFutureValue = (monthly: number, annualRate: number, years: number, stepUpPct: number): { maturity: number; invested: number } => {
    const i = monthlyRate(annualRate);
    let value = 0, sip = monthly, invested = 0;
    for (let y = 0; y < (years || 0); y++) {
        for (let m = 0; m < 12; m++) value = (value + sip) * (1 + i);
        invested += sip * 12;
        sip *= 1 + (stepUpPct || 0) / 100;
    }
    return { maturity: value, invested };
};

export const lumpsumFutureValue = (amount: number, annualRate: number, years: number): number =>
    amount * Math.pow(1 + (annualRate || 0) / 100, years || 0);

export const requiredMonthlySip = (target: number, annualRate: number, years: number): number => {
    const factor = sipFutureValue(1, annualRate, years);
    return factor > 0 ? target / factor : 0;
};

export const inflationImpact = (amount: number, inflationPct: number, years: number) => ({
    futureCost: amount * Math.pow(1 + inflationPct / 100, years),
    purchasingPower: amount / Math.pow(1 + inflationPct / 100, years),
});

export const fdMaturity = (principal: number, annualRate: number, years: number): number =>
    principal * Math.pow(1 + (annualRate || 0) / 400, 4 * (years || 0));

/**
 * Corpus needed at retirement so that inflation-adjusted yearly withdrawals last the whole retirement.
 * Withdrawals are taken at the START of each year (conservative; monthly spending is closer to this than to year-end).
 */
export const fireCorpusNeeded = (o: { monthlyExpenseToday: number; yearsToRetire: number; yearsInRetirement: number; inflationPct: number; postRetireReturnPct: number }) => {
    const expAtRetirement = o.monthlyExpenseToday * Math.pow(1 + o.inflationPct / 100, o.yearsToRetire);
    const n = Math.max(0, o.yearsInRetirement);
    const annual = expAtRetirement * 12;
    const r = o.postRetireReturnPct / 100, g = o.inflationPct / 100;
    let corpus = 0;
    if (n > 0) {
        corpus = Math.abs(r - g) < 1e-9
            ? annual * n
            : annual * ((1 - Math.pow((1 + g) / (1 + r), n)) / (r - g)) * (1 + r);
    }
    return { expAtRetirement, corpus };
};

export const swpSimulate = (principal: number, monthlyWithdrawal: number, annualRate: number, years: number) => {
    let balance = principal, totalWithdrawn = 0;
    const i = monthlyRate(annualRate);
    const totalMonths = Math.round((years || 0) * 12);
    const series: { year: number; balance: number }[] = [];
    let depletedInMonths: number | null = null;
    for (let m = 1; m <= totalMonths; m++) {
        balance += balance * i;
        const w = Math.min(balance, monthlyWithdrawal);
        balance -= w; totalWithdrawn += w;
        if (balance <= 0.005) { balance = 0; depletedInMonths = m; series.push({ year: Math.ceil(m / 12), balance: 0 }); break; }
        if (m % 12 === 0) series.push({ year: m / 12, balance: Math.round(balance) });
    }
    return { totalWithdrawn, finalBalance: Math.max(0, balance), series, depletedInMonths };
};

// ---- Income tax (resident individual below 60, salaried). FY 2026-27 / AY 2027-28: slabs unchanged from FY 2025-26.
const slabTax = (taxable: number, slabs: [number, number][]): number => {
    let remaining = taxable, tax = 0;
    for (const [width, rate] of slabs) {
        const part = Math.min(remaining, width);
        if (part <= 0) break;
        tax += part * rate; remaining -= part;
    }
    return tax;
};
const surchargeRate = (income: number, regime: 'new' | 'old'): number => {
    if (income > 50000000 && regime === 'old') return 0.37;
    if (income > 20000000) return 0.25;
    if (income > 10000000) return 0.15;
    if (income > 5000000) return 0.10;
    return 0;
};
const finishTax = (taxable: number, baseTax: number, rebate: boolean, regime: 'new' | 'old') => {
    const surcharge = baseTax * surchargeRate(taxable, regime); // marginal relief on surcharge is not modelled
    const tax = baseTax + surcharge;
    const cess = tax * 0.04;
    return { taxable, tax, surcharge, rebate, cess, total: tax + cess };
};

export const taxNewRegime = (gross: number, standardDeduction = 75000) => {
    const taxable = Math.max(0, (gross || 0) - standardDeduction);
    const full = slabTax(taxable, [[400000, 0], [400000, 0.05], [400000, 0.10], [400000, 0.15], [400000, 0.20], [400000, 0.25], [Infinity, 0.30]]);
    // Section 87A: no tax up to ₹12L taxable; above that, tax is capped at the income above ₹12L (marginal relief)
    if (taxable <= 1200000) return finishTax(taxable, 0, true, 'new');
    return finishTax(taxable, Math.min(full, taxable - 1200000), false, 'new');
};

export const taxOldRegime = (gross: number, deductions: number, standardDeduction = 50000) => {
    const taxable = Math.max(0, (gross || 0) - standardDeduction - Math.max(0, deductions || 0));
    if (taxable <= 500000) return finishTax(taxable, 0, true, 'old'); // Section 87A rebate (up to ₹12,500)
    return finishTax(taxable, slabTax(taxable, [[250000, 0], [250000, 0.05], [500000, 0.20], [Infinity, 0.30]]), false, 'old');
};

/**
 * Buy vs rent: compares NET WORTH after N years.
 * Buyer: down payment + EMI (loan) + maintenance. Renter: pays rent and invests the down payment.
 * Whoever spends less each month invests the difference at the same return. Ignores stamp duty, brokerage and taxes.
 */
export const buyVsRent = (o: {
    propertyValue: number; monthlyRent: number; appreciationPct: number; rentEscalationPct: number; loanRatePct: number; years: number;
    downPaymentPct?: number; loanTenureYears?: number; maintenancePct?: number; investReturnPct?: number;
}) => {
    const dpPct = o.downPaymentPct ?? 20, tenure = o.loanTenureYears ?? 20, maint = o.maintenancePct ?? 1, inv = o.investReturnPct ?? 10;
    const months = Math.max(0, Math.round((o.years || 0) * 12));
    const down = o.propertyValue * dpPct / 100;
    let loan = o.propertyValue - down;
    const lr = monthlyRate(o.loanRatePct), n = tenure * 12;
    const emi = loan <= 0 ? 0 : lr === 0 ? loan / n : (loan * lr * Math.pow(1 + lr, n)) / (Math.pow(1 + lr, n) - 1);
    const ir = monthlyRate(inv);
    let renterPot = down, buyerPot = 0, rent = o.monthlyRent, propVal = o.propertyValue, totalRent = 0, totalBuyCost = down;
    for (let m = 1; m <= months; m++) {
        if (m > 1 && (m - 1) % 12 === 0) { rent *= 1 + o.rentEscalationPct / 100; propVal *= 1 + o.appreciationPct / 100; }
        let emiPaid = 0;
        if (loan > 0.5 && m <= n) {
            const interest = loan * lr;
            loan -= Math.min(loan, emi - interest);
            emiPaid = emi;
        }
        const buyOut = emiPaid + propVal * maint / 100 / 12;
        renterPot *= 1 + ir; buyerPot *= 1 + ir;
        const diff = buyOut - rent;
        if (diff > 0) renterPot += diff; else buyerPot += -diff;
        totalRent += rent; totalBuyCost += buyOut;
    }
    const finalPropertyValue = o.propertyValue * Math.pow(1 + o.appreciationPct / 100, months / 12);
    const loanOutstanding = Math.max(0, loan);
    const buyNetWorth = finalPropertyValue - loanOutstanding + buyerPot;
    return { emi, finalPropertyValue, loanOutstanding, totalRentPaid: totalRent, totalBuyCost, buyNetWorth, rentNetWorth: renterPot, advantage: buyNetWorth - renterPot };
};
