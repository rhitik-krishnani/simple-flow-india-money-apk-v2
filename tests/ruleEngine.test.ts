import assert from 'node:assert/strict';
import {
    analyzePortfolioLocal, analyzeBudgetLocal, getPriorityActionLocal,
    getLifeLevelUpLocal, parseSmsLocal, PortfolioAudit, BudgetAudit,
} from '../services/ruleEngine';
import { TransactionType } from '../types';
import {
    simulatePrepayment, sipFutureValue, stepUpSipFutureValue, lumpsumFutureValue, requiredMonthlySip, inflationImpact, fdMaturity,
    fireCorpusNeeded, swpSimulate, taxNewRegime, taxOldRegime, buyVsRent, calculateAnnualizedReturn,
} from '../financeUtils';

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log('ok  -', name); };
const inv = (name: string, type: any, invested: number, current: number): any => ({ id: name, name, type, investedAmount: invested, currentValue: current, purchaseDate: '2023-01-01' });

// ---------- SMS
t('SMS: card spend (app sample)', () => {
    const r = parseSmsLocal('Spent ₹ 850.00 at STARBUCKS using ICICI Bank Card xx9012 on 23-Apr-26.')!;
    assert.equal(r.amount, 850); assert.equal(r.merchant, 'STARBUCKS');
    assert.equal(r.type, TransactionType.EXPENSE); assert.equal(r.category, 'Food'); assert.equal(r.date, '2026-04-23');
});
t('SMS: UPI debit with balance ignored', () => {
    const r = parseSmsLocal('Rs.1,250.00 debited from A/c XX1234 on 05-10-26 to VPA zomato@icici (ZOMATO). UPI Ref 123456. Avl Bal Rs 40,500.00')!;
    assert.equal(r.amount, 1250); assert.equal(r.merchant, 'ZOMATO');
});
t('SMS: salary credit', () => {
    const r = parseSmsLocal('INR 85,000.00 credited to your A/c XX4321 on 01-Oct-26 by ACME CORP SALARY. Avl bal INR 90,000')!;
    assert.equal(r.type, TransactionType.INCOME); assert.equal(r.amount, 85000);
});
t('SMS: OTP and promos rejected', () => {
    assert.equal(parseSmsLocal('123456 is your OTP for HDFC Bank txn of Rs 5,000. Do not share.'), null);
    assert.equal(parseSmsLocal('Exclusive offers for you! Get a loan up to Rs 5,00,000 today'), null);
    assert.equal(parseSmsLocal('Hi, lunch tomorrow?'), null);
});

// ---------- Portfolio
t('Portfolio: empty returns message', () => assert.equal(typeof analyzePortfolioLocal([]), 'string'));
t('Portfolio: all-in single stock scores low and flags concentration', () => {
    const r = analyzePortfolioLocal([inv('Reliance', 'Stock', 100000, 120000)]) as PortfolioAudit;
    assert.ok(r.healthScore < 50, `score ${r.healthScore}`);
    assert.ok(r.diversificationInsights.some(i => i.category === 'Concentration' && i.status === 'alert'));
    assert.equal(r.riskLevel, 'High');
});
t('Portfolio: balanced mix scores high', () => {
    const r = analyzePortfolioLocal([
        inv('Nifty 50 Index Fund', 'Mutual Fund', 1, 25), inv('Flexi Cap Fund', 'Mutual Fund', 1, 20), inv('HDFC Bank', 'Stock', 1, 15),
        inv('PPF', 'PPF', 1, 15), inv('Bank FD', 'FD', 1, 15), inv('Gold ETF', 'Gold', 1, 10),
    ]) as PortfolioAudit;
    assert.ok(r.healthScore >= 80, `score ${r.healthScore}`);
    assert.equal(r.riskLevel, 'Medium');
});
t('Portfolio: debt and gold mutual funds classified by name', () => {
    const r = analyzePortfolioLocal([inv('Liquid Fund', 'Mutual Fund', 1, 50), inv('Nippon Gold Savings Fund', 'Mutual Fund', 1, 50)]) as PortfolioAudit;
    assert.equal(r.riskLevel, 'Low');
});
t('Portfolio: Hindi output', () => {
    const r = analyzePortfolioLocal([inv('Coin', 'Crypto', 1, 100)], 'hi') as PortfolioAudit;
    assert.ok(/[\u0900-\u097F]/.test(r.crucialInsight)); assert.equal(r.riskLevel, 'High');
});
t('Portfolio: deterministic', () => {
    const a = JSON.stringify(analyzePortfolioLocal([inv('A', 'Stock', 1, 10), inv('B', 'FD', 1, 5)]));
    assert.equal(a, JSON.stringify(analyzePortfolioLocal([inv('A', 'Stock', 1, 10), inv('B', 'FD', 1, 5)])));
});

// ---------- Budget
const b = (name: string, type: any, allocated: number, spent: number): any => ({ id: name, name, type, allocated, spent });
t('Budget: empty returns message', () => assert.equal(typeof analyzeBudgetLocal([], []), 'string'));
t('Budget: overspend and savings rate', () => {
    const r = analyzeBudgetLocal(
        [b('Rent', 'Need', 30000, 30000), b('Dining', 'Want', 5000, 9000), b('SIP', 'Saving', 10000, 10000)],
        [{ id: 'i', amount: 60000, category: 'Salary', description: '', date: new Date().toISOString(), type: TransactionType.INCOME }]
    ) as BudgetAudit;
    assert.equal(r.topLeaks[0].category, 'Dining'); assert.equal(r.topLeaks[0].amount, 4000);
    assert.equal(r.savingsRate, Math.round(((10000 + (60000 - 49000)) / 60000) * 100));
    assert.ok(r.leakageScore > 0 && r.leakageScore <= 100);
    const c = r.rule503020Comparison.current; assert.ok(Math.abs(c.need + c.want + c.saving - 100) <= 2);
});
t('Budget: zero allocation does not divide by zero', () => {
    const r = analyzeBudgetLocal([b('X', 'Want', 0, 100)], []) as BudgetAudit;
    assert.ok(Number.isFinite(r.leakageScore)); assert.ok(Number.isFinite(r.savingsRate));
});

// ---------- Priority
t('Priority: overspent budget is danger and first', () => {
    const r = getPriorityActionLocal({ investments: [], budgets: [b('Dining', 'Want', 5000, 6000)], loans: [{ interestRate: 18, outstanding: 1, name: 'CC' } as any], goals: [] });
    assert.equal(r.type, 'danger');
});
t('Priority: high-interest loan is warning', () => {
    const r = getPriorityActionLocal({ investments: [inv('A', 'Stock', 1, 10)], budgets: [], loans: [{ interestRate: 18, outstanding: 100, name: 'CC' } as any], goals: [] });
    assert.equal(r.type, 'warning'); assert.ok(r.title.includes('CC'));
});
t('Priority: fixed rent at 100% is not flagged', () => {
    const r = getPriorityActionLocal({ investments: [inv('A', 'Stock', 1, 1000000)], budgets: [b('Rent', 'Need', 30000, 30000)], loans: [], goals: [] });
    assert.ok(!r.title.includes('Rent'), r.title);
});
t('Priority: Want budget at 90% is a warning', () => {
    const r = getPriorityActionLocal({ investments: [], budgets: [b('Dining', 'Want', 5000, 4500)], loans: [], goals: [] });
    assert.equal(r.type, 'warning'); assert.ok(r.title.includes('Dining'));
});
t('Priority: past-due goal is danger', () => {
    const r = getPriorityActionLocal({ investments: [], budgets: [], loans: [], goals: [{ name: 'Car', targetAmount: 1000, currentAmount: 100, targetDate: '2020-01-01' }] });
    assert.equal(r.type, 'danger');
});
t('Priority: healthy profile is success', () => {
    const r = getPriorityActionLocal({
        investments: [inv('Nifty Index Fund', 'Mutual Fund', 1, 25), inv('Flexi', 'Mutual Fund', 1, 20), inv('Stock', 'Stock', 1, 15), inv('PPF', 'PPF', 1, 15), inv('FD', 'FD', 1, 15), inv('Gold', 'Gold', 1, 10)].map(x => ({ ...x, currentValue: x.currentValue * 100000 })),
        budgets: [b('Rent', 'Need', 30000, 20000)], loans: [], goals: [],
    });
    assert.equal(r.type, 'success');
});

// ---------- Level up
const lvl = (nw: number, months: number, extra: any = {}) => getLifeLevelUpLocal({ investments: [], budgets: [], loans: [], insurance: [], netWorth: nw, safetyNetMonths: months, ...extra });
t('Level: low net worth is ROOKIE with progress', () => {
    const r = lvl(250000, 1, { investments: [inv('A', 'Stock', 1, 1)] });
    assert.equal(r.currentLevel, 'ROOKIE'); assert.equal(r.nextLevel, 'BUILDER'); assert.ok(r.progress > 0 && r.progress < 100);
    assert.ok(r.requirements.length >= 1 && r.requirements.length <= 3);
});
t('Level: builder', () => assert.equal(lvl(1000000, 4, { investments: [inv('A', 'Stock', 1, 1)] }).currentLevel, 'BUILDER'));
t('Level: big net worth but no emergency fund stays ROOKIE', () => assert.equal(lvl(90000000, 1, { investments: [inv('A', 'Stock', 1, 1)] }).currentLevel, 'ROOKIE'));
t('Level: zenith', () => {
    const r = lvl(80000000, 400, {
        investments: [inv('A', 'Stock', 1, 1), inv('H', 'Real Estate', 1, 1), inv('G', 'Gold', 1, 1)],
        insurance: [{ type: 'Life', sumInsured: 20000000 }],
    });
    assert.equal(r.currentLevel, 'ZENITH'); assert.equal(r.progress, 100); assert.equal(r.badgeColor, 'gold');
});

// ---------- Prepayment
t('Prepay: no prepayment means nothing saved and loan ends at tenure', () => {
    const r = simulatePrepayment(2000000, 9, 20, 0, 0);
    assert.equal(r.monthsSaved, 0); assert.ok(Math.abs(r.original.months - 240) <= 1);
    assert.ok(Math.abs(r.emi - 17995) < 5, String(r.emi));
});
t('Prepay: lump sum alone shortens the loan (EMI unchanged)', () => {
    const r = simulatePrepayment(2000000, 9, 20, 500000, 0);
    assert.ok(r.monthsSaved > 100 && r.monthsSaved < 115, String(r.monthsSaved));
    assert.ok(Math.abs(r.interestSaved - 1455360) < 2000, String(r.interestSaved));
});
t('Prepay: lump + extra monthly beats either alone', () => {
    const both = simulatePrepayment(2000000, 9, 20, 500000, 5000), a = simulatePrepayment(2000000, 9, 20, 500000, 0), b = simulatePrepayment(2000000, 9, 20, 0, 5000);
    assert.ok(both.monthsSaved > a.monthsSaved && both.monthsSaved > b.monthsSaved);
    assert.ok(Math.abs(both.interestSaved - 1751055) < 3000, String(both.interestSaved));
});
t('Prepay: lump larger than balance is clamped, zero rate works', () => {
    const r = simulatePrepayment(100000, 9, 5, 999999, 0);
    assert.equal(r.withPrepay.months, 0); assert.ok(Number.isFinite(r.interestSaved));
    const z = simulatePrepayment(120000, 0, 1, 0, 0); assert.equal(z.original.months, 12); assert.equal(z.interestSaved, 0);
});

// ---------- Calculators
const near = (a: number, b: number, tol = 1, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b}, got ${a}`);
t('Calc SIP: 10k/mo, 12%, 10y = 23,23,391; zero rate safe', () => {
    near(sipFutureValue(10000, 12, 10), 2323391, 2); assert.equal(sipFutureValue(10000, 0, 10), 1200000);
});
t('Calc Step-up: 0% step equals plain SIP; 10% step invested amount', () => {
    near(stepUpSipFutureValue(10000, 12, 10, 0).maturity, sipFutureValue(10000, 12, 10), 2);
    near(stepUpSipFutureValue(10000, 12, 10, 10).invested, 120000 * (Math.pow(1.1, 10) - 1) / 0.1, 1);
    assert.ok(stepUpSipFutureValue(10000, 12, 10, 10).maturity > sipFutureValue(10000, 12, 10));
});
t('Calc Lumpsum: 1L, 12%, 10y = 3,10,585', () => near(lumpsumFutureValue(100000, 12, 10), 310585, 1));
t('Calc Goal SIP: required SIP grows back to the target', () => {
    const s = requiredMonthlySip(5000000, 12, 15); near(s, 9909, 2); near(sipFutureValue(s, 12, 15), 5000000, 1);
});
t('Calc Inflation: 50k, 6%, 10y', () => {
    const r = inflationImpact(50000, 6, 10); near(r.futureCost, 89542, 1); near(r.purchasingPower, 27920, 1);
});
t('Calc FD: 1L, 8%, 5y quarterly = 1,48,595', () => near(fdMaturity(100000, 8, 5), 148595, 1));
t('Calc FIRE: matches brute-force present value (withdrawals at start of year)', () => {
    const r = fireCorpusNeeded({ monthlyExpenseToday: 50000, yearsToRetire: 20, yearsInRetirement: 40, inflationPct: 6, postRetireReturnPct: 8 });
    let pv = 0; for (let k = 0; k < 40; k++) pv += r.expAtRetirement * 12 * Math.pow(1.06, k) / Math.pow(1.08, k);
    near(r.corpus, pv, 1); near(r.expAtRetirement, 50000 * Math.pow(1.06, 20), 1);
    const eq = fireCorpusNeeded({ monthlyExpenseToday: 1000, yearsToRetire: 0, yearsInRetirement: 10, inflationPct: 6, postRetireReturnPct: 6 });
    near(eq.corpus, 120000, 1); // r == g: 10 years of expenses
});
t('Calc SWP: matches closed form; depletion handled', () => {
    const r = swpSimulate(1000000, 10000, 8, 10), i = 0.08 / 12, n = 120;
    near(r.finalBalance, 1000000 * Math.pow(1 + i, n) - 10000 * (Math.pow(1 + i, n) - 1) / i, 1); assert.equal(r.depletedInMonths, null);
    const d = swpSimulate(100000, 50000, 0, 5); assert.equal(d.totalWithdrawn, 100000); assert.equal(d.finalBalance, 0); assert.equal(d.depletedInMonths, 2);
});
t('Calc Tax (FY 2026-27): new regime, rebate up to 12L taxable and marginal relief', () => {
    assert.equal(taxNewRegime(1275000).total, 0);               // 12.75L gross -> 12L taxable -> nil
    near(taxNewRegime(1300000).total, 26000, 1);                 // 12.25L taxable: tax capped at 25,000 + 4% cess
    near(taxNewRegime(2500000).total, 319800, 1);                // 24.25L taxable
    near(taxNewRegime(6000000).total, 1552980, 2);               // includes 10% surcharge
});
t('Calc Tax (FY 2026-27): old regime', () => {
    assert.equal(taxOldRegime(700000, 150000).total, 0);        // 5L taxable -> rebate
    near(taxOldRegime(800000, 150000).total, 33800, 1);          // 6L taxable: 12,500 + 20,000 + cess
    near(taxOldRegime(1200000, 325000).total, 80600, 1);         // 8.25L taxable
});
t('Calc Buy vs Rent: sanity and invariants', () => {
    const base = { propertyValue: 10000000, monthlyRent: 30000, appreciationPct: 5, rentEscalationPct: 5, loanRatePct: 9, years: 10 };
    const r = buyVsRent(base); near(r.emi, 71978, 5);
    assert.ok(Number.isFinite(r.buyNetWorth) && Number.isFinite(r.rentNetWorth) && r.loanOutstanding > 0);
    // all-cash, no growth, no costs, no returns: both end with exactly the property's value
    const flat = buyVsRent({ ...base, appreciationPct: 0, monthlyRent: 0, downPaymentPct: 100, maintenancePct: 0, investReturnPct: 0 });
    near(flat.buyNetWorth, 10000000, 1); near(flat.rentNetWorth, 10000000, 1);
    assert.ok(buyVsRent({ ...base, appreciationPct: 12 }).advantage > r.advantage); // faster appreciation favours buying
    assert.equal(buyVsRent({ ...base, years: 0 }).loanOutstanding, 8000000);
});

// ---------- Investment returns
t('Returns: under 1 year is NOT annualised; over 1 year is CAGR; bad date falls back safely', () => {
    const d = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
    assert.equal(calculateAnnualizedReturn(100000, 105000, d(30)), 5);                       // was ~80% p.a.
    near(calculateAnnualizedReturn(100000, 144000, d(730)), 20, 0.1);                       // 44% over 2 years = 20% p.a.
    assert.equal(calculateAnnualizedReturn(100000, 110000, undefined as any), 10);           // missing date
    assert.equal(calculateAnnualizedReturn(0, 10, d(500)), 0);
});

console.log(`\n${passed} tests passed`);
