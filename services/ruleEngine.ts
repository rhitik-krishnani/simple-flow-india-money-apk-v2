/**
 * Rule engine: deterministic replacements for what used to be LLM calls.
 * Pure functions, no network, no browser APIs. Same inputs always give the same output.
 *
 * Everything here is a generic reference model, not personalised financial advice.
 * Thresholds live in the CONFIG block so they can be reviewed and tuned in one place.
 */
import { Investment, BudgetCategory, Transaction, Loan, Insurance, TransactionType } from '../types';
import { calculatePortfolioReturn } from '../financeUtils';

type Lang = string | undefined;
const tr = (lang: Lang, en: string, hi: string) => (lang === 'hi' ? hi : en);
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const pct = (n: number) => Math.round(n);
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

// ---------------------------------------------------------------- CONFIG
export const CONFIG = {
    // Reference allocation of FINANCIAL assets (real estate is judged separately)
    targetAllocation: { Equity: 60, Debt: 30, Gold: 10 },
    maxCryptoPct: 5,
    maxSingleHoldingPct: 25,
    maxRealEstatePct: 50,
    idealSavingsRate: 20,
    target503020: { need: 50, want: 30, saving: 20 },
    highInterestLoanRate: 12,
    emergencyMonthsMin: 3,
    emergencyMonthsGood: 6,
    lakh: 100000,
    crore: 10000000,
};

// ---------------------------------------------------------------- TYPES
export interface PortfolioAudit {
    crucialInsight: string;
    summary: string;
    riskLevel: 'Low' | 'Medium' | 'High';
    healthScore: number;
    suggestedAllocation: { name: string; value: number }[];
    diversificationInsights: { category: string; status: 'good' | 'warning' | 'alert'; message: string }[];
    topActionItems: string[];
    marketComparison?: { competitor: string; yourEdge: string; competitorFeature: string };
}

export interface BudgetAudit {
    summary: string;
    leakageScore: number;
    savingsRate: number;
    idealSavingsRate: number;
    topLeaks: { category: string; amount: number; tip: string }[];
    rule503020Comparison: {
        current: { need: number; want: number; saving: number };
        target: { need: number; want: number; saving: number };
    };
}

export interface PriorityAction {
    title: string;
    description: string;
    type: 'danger' | 'warning' | 'success' | 'info';
}

export interface LevelUp {
    currentLevel: string;
    nextLevel: string;
    progress: number;
    requirements: string[];
    aiAdvice: string; // field name kept so existing UI keeps working
    badgeColor: string;
}

// ---------------------------------------------------------------- PORTFOLIO
type AssetClass = 'Equity' | 'Debt' | 'Gold' | 'Real Estate' | 'Crypto' | 'Other';

/** Returns the asset-class mix (weights sum to 1) of one holding. */
export const classifyHolding = (inv: Pick<Investment, 'type' | 'name'>): Partial<Record<AssetClass, number>> => {
    const name = (inv.name || '').toLowerCase();
    switch (inv.type) {
        case 'Stock': return { Equity: 1 };
        case 'FD': case 'Bond': case 'PPF': return { Debt: 1 };
        case 'Gold': return { Gold: 1 };
        case 'Real Estate': return { 'Real Estate': 1 };
        case 'Crypto': return { Crypto: 1 };
        case 'Mutual Fund':
            if (/gold|silver/.test(name)) return { Gold: 1 };
            if (/hybrid|balanced|arbitrage|multi.?asset|dynamic asset|equity savings/.test(name)) return { Equity: 0.5, Debt: 0.5 };
            if (/liquid|overnight|debt|gilt|bond|money market|short (term|duration)|ultra short|corporate|banking (&|and) psu|floater|income fund|fixed maturity|fmp/.test(name)) return { Debt: 1 };
            return { Equity: 1 };
        default: return { Other: 1 };
    }
};

const RISK_WEIGHT: Record<AssetClass, number> = { Equity: 0.65, Debt: 0.1, Gold: 0.3, 'Real Estate': 0.4, Crypto: 1, Other: 0.4 };

export const analyzePortfolioLocal = (investments: Investment[], lang?: Lang): PortfolioAudit | string => {
    if (!investments || investments.length === 0) {
        return tr(lang, 'Your portfolio is empty. Add some assets first for an analysis.',
            'आपका पोर्टफोलियो खाली है। विश्लेषण के लिए पहले कुछ संपत्तियां जोड़ें।');
    }

    const total = investments.reduce((s, i) => s + Math.max(0, i.currentValue), 0);
    if (total <= 0) {
        return tr(lang, 'Your holdings have no current value yet. Update their values to run the analysis.',
            'आपकी संपत्तियों का मौजूदा मूल्य शून्य है। विश्लेषण के लिए मूल्य अपडेट करें।');
    }

    // Asset class values
    const classes: Record<AssetClass, number> = { Equity: 0, Debt: 0, Gold: 0, 'Real Estate': 0, Crypto: 0, Other: 0 };
    investments.forEach(i => {
        const mix = classifyHolding(i);
        (Object.keys(mix) as AssetClass[]).forEach(k => { classes[k] += Math.max(0, i.currentValue) * (mix[k] || 0); });
    });
    const share = (k: AssetClass) => (classes[k] / total) * 100;

    // Financial assets = everything except real estate (used for allocation fit)
    const financial = total - classes['Real Estate'];
    const fShare = (k: AssetClass) => (financial > 0 ? (classes[k] / financial) * 100 : 0);

    // Risk level
    const riskScore = (Object.keys(classes) as AssetClass[]).reduce((s, k) => s + (classes[k] / total) * RISK_WEIGHT[k], 0);
    const riskLevel: PortfolioAudit['riskLevel'] = riskScore < 0.3 ? 'Low' : riskScore < 0.55 ? 'Medium' : 'High';

    // Largest single holding
    const sorted = [...investments].sort((a, b) => b.currentValue - a.currentValue);
    const top = sorted[0];
    const topPct = (top.currentValue / total) * 100;

    // Allocation fit vs reference (financial assets only)
    const T = CONFIG.targetAllocation;
    const otherF = fShare('Crypto') + fShare('Other');
    const dist = Math.abs(fShare('Equity') - T.Equity) + Math.abs(fShare('Debt') - T.Debt) + Math.abs(fShare('Gold') - T.Gold) + otherF;

    // Health score: transparent 100-point checklist
    const classCount = (['Equity', 'Debt', 'Gold', 'Crypto', 'Other'] as AssetClass[]).filter(k => classes[k] / total > 0.02).length;
    const diversificationPts = [5, 5, 15, 25, 30, 30][Math.min(classCount, 5)];
    const concentrationPts = topPct <= 15 ? 25 : topPct <= 25 ? 18 : topPct <= 40 ? 10 : 3;
    const fitPts = financial > 0 ? 25 * (1 - Math.min(dist, 100) / 100) : 12;
    const cryptoPct = share('Crypto');
    const cryptoPts = cryptoPct <= CONFIG.maxCryptoPct ? 10 : cryptoPct <= 15 ? 5 : 0;
    const ret = calculatePortfolioReturn(investments);
    const returnPts = ret >= 0 ? 10 : ret > -10 ? 5 : 0;
    const healthScore = Math.round(clamp(diversificationPts + concentrationPts + fitPts + cryptoPts + returnPts));

    // Insights
    const insights: PortfolioAudit['diversificationInsights'] = [];
    const eq = fShare('Equity'), debt = fShare('Debt'), gold = fShare('Gold');

    if (financial > 0) {
        if (eq > T.Equity + 25) insights.push({ category: 'Equity', status: 'alert', message: tr(lang, `Equity is ${pct(eq)}% of your financial assets (reference ${T.Equity}%). A market fall would hit hard.`, `इक्विटी आपकी वित्तीय संपत्ति का ${pct(eq)}% है (संदर्भ ${T.Equity}%)। बाज़ार गिरने पर बड़ा असर होगा।`) });
        else if (eq > T.Equity + 15) insights.push({ category: 'Equity', status: 'warning', message: tr(lang, `Equity is ${pct(eq)}% vs a ${T.Equity}% reference. Consider rebalancing towards debt.`, `इक्विटी ${pct(eq)}% है, संदर्भ ${T.Equity}% है। डेट की ओर संतुलन पर विचार करें।`) });
        else if (eq < T.Equity - 25) insights.push({ category: 'Equity', status: 'warning', message: tr(lang, `Equity is only ${pct(eq)}%. Long-term growth may lag inflation.`, `इक्विटी केवल ${pct(eq)}% है। लंबी अवधि में वृद्धि महंगाई से पीछे रह सकती है।`) });
        else insights.push({ category: 'Equity', status: 'good', message: tr(lang, `Equity at ${pct(eq)}% is close to the ${T.Equity}% reference.`, `इक्विटी ${pct(eq)}% संदर्भ ${T.Equity}% के करीब है।`) });

        if (debt < 10) insights.push({ category: 'Debt', status: 'alert', message: tr(lang, `Only ${pct(debt)}% in debt/fixed income. You have little cushion in a downturn.`, `डेट/फिक्स्ड इनकम केवल ${pct(debt)}% है। गिरावट में सुरक्षा कम है।`) });
        else if (debt < 20) insights.push({ category: 'Debt', status: 'warning', message: tr(lang, `Debt is ${pct(debt)}%. A 20-35% share smooths volatility.`, `डेट ${pct(debt)}% है। 20-35% हिस्सा उतार-चढ़ाव कम करता है।`) });
        else insights.push({ category: 'Debt', status: 'good', message: tr(lang, `Debt at ${pct(debt)}% gives a healthy cushion.`, `डेट ${pct(debt)}% अच्छी सुरक्षा देता है।`) });

        if (gold === 0) insights.push({ category: 'Gold', status: 'warning', message: tr(lang, 'No gold exposure. 5-10% gold can hedge inflation and market shocks.', 'सोने में कोई निवेश नहीं। 5-10% सोना महंगाई और बाज़ार झटकों से बचाता है।') });
        else if (gold > 20) insights.push({ category: 'Gold', status: 'warning', message: tr(lang, `Gold is ${pct(gold)}%, above the usual 5-10%. It produces no income.`, `सोना ${pct(gold)}% है, सामान्य 5-10% से अधिक। इससे आय नहीं होती।`) });
    }

    if (cryptoPct > 15) insights.push({ category: 'Crypto', status: 'alert', message: tr(lang, `Crypto is ${pct(cryptoPct)}% of your portfolio, far above ${CONFIG.maxCryptoPct}%.`, `क्रिप्टो ${pct(cryptoPct)}% है, ${CONFIG.maxCryptoPct}% से बहुत अधिक।`) });
    else if (cryptoPct > CONFIG.maxCryptoPct) insights.push({ category: 'Crypto', status: 'warning', message: tr(lang, `Crypto is ${pct(cryptoPct)}%. Keep it under ${CONFIG.maxCryptoPct}% as it is very volatile.`, `क्रिप्टो ${pct(cryptoPct)}% है। यह बहुत अस्थिर है, इसे ${CONFIG.maxCryptoPct}% से कम रखें।`) });

    if (share('Real Estate') > CONFIG.maxRealEstatePct) insights.push({ category: 'Real Estate', status: 'warning', message: tr(lang, `Real estate is ${pct(share('Real Estate'))}% of your assets. It is illiquid and hard to sell quickly.`, `रियल एस्टेट आपकी संपत्ति का ${pct(share('Real Estate'))}% है। इसे जल्दी बेचना कठिन है।`) });

    if (topPct > 40) insights.push({ category: 'Concentration', status: 'alert', message: tr(lang, `"${top.name}" is ${pct(topPct)}% of your portfolio. One bad outcome could dominate your returns.`, `"${top.name}" पोर्टफोलियो का ${pct(topPct)}% है। एक खराब नतीजा रिटर्न पर हावी हो सकता है।`) });
    else if (topPct > CONFIG.maxSingleHoldingPct) insights.push({ category: 'Concentration', status: 'warning', message: tr(lang, `"${top.name}" is ${pct(topPct)}% of your portfolio. Aim for under ${CONFIG.maxSingleHoldingPct}%.`, `"${top.name}" पोर्टफोलियो का ${pct(topPct)}% है। ${CONFIG.maxSingleHoldingPct}% से कम रखने का लक्ष्य रखें।`) });
    else if (investments.length >= 3) insights.push({ category: 'Concentration', status: 'good', message: tr(lang, 'No single holding dominates your portfolio.', 'कोई एक संपत्ति पोर्टफोलियो पर हावी नहीं है।') });

    if (investments.length < 3) insights.push({ category: 'Diversification', status: 'warning', message: tr(lang, `Only ${investments.length} holding(s). Spread across more assets to reduce risk.`, `केवल ${investments.length} संपत्ति। जोखिम घटाने के लिए अधिक संपत्तियों में फैलाएँ।`) });

    // Suggested allocation (reference model)
    const suggestedAllocation = [
        { name: 'Equity', value: T.Equity },
        { name: 'Debt', value: T.Debt },
        { name: 'Gold', value: T.Gold },
    ];

    // Action items (max 3, biggest gaps first)
    const actions: { weight: number; text: string }[] = [];
    if (financial > 0) {
        if (eq > T.Equity + 15) {
            const move = ((eq - T.Equity) / 100) * financial;
            actions.push({ weight: eq - T.Equity, text: tr(lang, `Shift about ${inr(move)} from equity into debt or gold to get nearer ${T.Equity}% equity.`, `इक्विटी ${T.Equity}% के करीब लाने के लिए लगभग ${inr(move)} डेट या सोने में स्थानांतरित करें।`) });
        } else if (eq < T.Equity - 25) {
            const move = ((T.Equity - eq) / 100) * financial;
            actions.push({ weight: T.Equity - eq, text: tr(lang, `Add about ${inr(move)} to diversified equity (index funds via SIP) to build long-term growth.`, `दीर्घकालिक वृद्धि के लिए लगभग ${inr(move)} डाइवर्सिफाइड इक्विटी (इंडेक्स फंड SIP) में जोड़ें।`) });
        }
        if (debt < 20) actions.push({ weight: 20 - debt + 5, text: tr(lang, 'Build a debt allocation of 20-30% (PPF, bonds, debt funds or FDs).', 'डेट में 20-30% निवेश बनाएँ (PPF, बॉन्ड, डेट फंड या FD)।') });
        if (gold === 0) actions.push({ weight: 8, text: tr(lang, 'Add 5-10% gold through a gold ETF or sovereign-style gold fund.', 'गोल्ड ETF या गोल्ड फंड से 5-10% सोना जोड़ें।') });
    }
    if (topPct > CONFIG.maxSingleHoldingPct) actions.push({ weight: topPct - CONFIG.maxSingleHoldingPct + 10, text: tr(lang, `Reduce "${top.name}" below ${CONFIG.maxSingleHoldingPct}% of the portfolio.`, `"${top.name}" को पोर्टफोलियो के ${CONFIG.maxSingleHoldingPct}% से नीचे लाएँ।`) });
    if (cryptoPct > CONFIG.maxCryptoPct) actions.push({ weight: cryptoPct, text: tr(lang, `Trim crypto from ${pct(cryptoPct)}% to ${CONFIG.maxCryptoPct}% or less.`, `क्रिप्टो ${pct(cryptoPct)}% से घटाकर ${CONFIG.maxCryptoPct}% या कम करें।`) });
    if (investments.length < 3) actions.push({ weight: 12, text: tr(lang, 'Add at least 3-5 different holdings across asset classes.', 'विभिन्न एसेट क्लास में कम से कम 3-5 संपत्तियाँ जोड़ें।') });
    const topActionItems = actions.sort((a, b) => b.weight - a.weight).slice(0, 3).map(a => a.text);
    if (topActionItems.length === 0) {
        topActionItems.push(tr(lang, 'Your mix is balanced. Keep investing through SIPs and rebalance once a year.', 'आपका मिश्रण संतुलित है। SIP से निवेश जारी रखें और साल में एक बार रीबैलेंस करें।'));
    }

    // Crucial insight: the most severe finding
    const rank = { alert: 0, warning: 1, good: 2 } as const;
    const worst = [...insights].sort((a, b) => rank[a.status] - rank[b.status])[0];
    const crucialInsight = worst ? worst.message : tr(lang, 'Your portfolio looks balanced.', 'आपका पोर्टफोलियो संतुलित दिखता है।');

    const summary = tr(lang,
        `**${inr(total)}** across **${investments.length}** holdings. Risk level: **${riskLevel}**. Overall return: **${ret >= 0 ? '+' : ''}${ret}%**. Health score **${healthScore}/100**.\n\n*Rule-based review against a generic ${T.Equity}/${T.Debt}/${T.Gold} reference. Not personalised financial advice.*`,
        `कुल **${inr(total)}**, **${investments.length}** संपत्तियाँ। जोखिम: **${riskLevel === 'Low' ? 'कम' : riskLevel === 'Medium' ? 'मध्यम' : 'उच्च'}**। कुल रिटर्न: **${ret >= 0 ? '+' : ''}${ret}%**। हेल्थ स्कोर **${healthScore}/100**।\n\n*सामान्य ${T.Equity}/${T.Debt}/${T.Gold} संदर्भ पर आधारित नियम-आधारित समीक्षा। यह व्यक्तिगत वित्तीय सलाह नहीं है।*`);

    return { crucialInsight, summary, riskLevel, healthScore, suggestedAllocation, diversificationInsights: insights, topActionItems };
};

// ---------------------------------------------------------------- BUDGET
export const analyzeBudgetLocal = (budgets: BudgetCategory[], transactions: Transaction[], lang?: Lang): BudgetAudit | string => {
    if (!budgets || budgets.length === 0) {
        return tr(lang, 'Add some budget categories first so there is something to analyse.',
            'विश्लेषण के लिए पहले कुछ बजट श्रेणियाँ जोड़ें।');
    }

    const totalAllocated = budgets.reduce((s, b) => s + b.allocated, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
    const spentByType = { Need: 0, Want: 0, Saving: 0 };
    const allocByType = { Need: 0, Want: 0, Saving: 0 };
    budgets.forEach(b => { spentByType[b.type] += b.spent; allocByType[b.type] += b.allocated; });

    // Income = income transactions in the most recent month that has any
    const incomeTx = (transactions || []).filter(t => t.type === TransactionType.INCOME && !isNaN(new Date(t.date).getTime()));
    let income = 0;
    if (incomeTx.length) {
        const key = (d: Date) => d.getFullYear() * 12 + d.getMonth();
        const latest = Math.max(...incomeTx.map(t => key(new Date(t.date))));
        income = incomeTx.filter(t => key(new Date(t.date)) === latest).reduce((s, t) => s + t.amount, 0);
    }
    const base = income > 0 ? income : totalAllocated;

    // Savings rate: money put to savings + whatever is left unspent
    const unspent = Math.max(0, base - totalSpent);
    const savingsRate = base > 0 ? Math.round(clamp(((spentByType.Saving + unspent) / base) * 100)) : 0;

    // Current split: from actual spend, or from allocation when nothing is spent yet
    const useSpent = totalSpent > 0;
    const splitBase = useSpent ? totalSpent : totalAllocated || 1;
    const src = useSpent ? spentByType : allocByType;
    const current = {
        need: Math.round((src.Need / splitBase) * 100),
        want: Math.round((src.Want / splitBase) * 100),
        saving: Math.round((src.Saving / splitBase) * 100),
    };

    // Overspend
    const over = budgets.filter(b => b.spent > b.allocated).map(b => ({ b, excess: b.spent - b.allocated }));
    const overspendRatio = totalAllocated > 0 ? over.reduce((s, o) => s + o.excess, 0) / totalAllocated : 0;

    // Leakage score (0-100, high is bad): three capped components
    const overspendPts = Math.min(40, overspendRatio * 100 * 2);
    const wantPts = Math.min(30, Math.max(0, current.want - CONFIG.target503020.want));
    const savePts = Math.min(30, Math.max(0, CONFIG.idealSavingsRate - savingsRate) * 1.5);
    const leakageScore = Math.round(clamp(overspendPts + wantPts + savePts));

    // Top leaks
    const leaks: BudgetAudit['topLeaks'] = over
        .sort((a, b) => b.excess - a.excess)
        .slice(0, 3)
        .map(({ b, excess }) => ({
            category: b.name,
            amount: Math.round(excess),
            tip: tr(lang,
                `Over budget by ${inr(excess)} (${Math.round((excess / (b.allocated || 1)) * 100)}% above plan). Cut back to ${inr(b.allocated)} or raise the limit on purpose.`,
                `बजट से ${inr(excess)} अधिक (${Math.round((excess / (b.allocated || 1)) * 100)}% ज़्यादा)। ${inr(b.allocated)} तक घटाएँ या सीमा जानबूझकर बढ़ाएँ।`),
        }));
    if (leaks.length < 3) {
        budgets
            .filter(b => b.type === 'Want' && !over.some(o => o.b.id === b.id) && b.spent > 0)
            .sort((a, b) => b.spent - a.spent)
            .slice(0, 3 - leaks.length)
            .forEach(b => leaks.push({
                category: b.name,
                amount: Math.round(b.spent),
                tip: tr(lang,
                    `A "Want" category using ${Math.round((b.spent / (b.allocated || 1)) * 100)}% of its limit. Review what is optional here.`,
                    `"Want" श्रेणी अपनी सीमा का ${Math.round((b.spent / (b.allocated || 1)) * 100)}% उपयोग कर रही है। देखें क्या ज़रूरी नहीं है।`),
            }));
    }

    const status = leakageScore > 50 ? tr(lang, 'high', 'अधिक') : leakageScore > 20 ? tr(lang, 'moderate', 'मध्यम') : tr(lang, 'low', 'कम');
    const summary = tr(lang,
        `Savings rate is **${savingsRate}%** against a **${CONFIG.idealSavingsRate}%** goal. Spending split is **${current.need}/${current.want}/${current.saving}** (needs/wants/savings) vs 50/30/20. Leakage is **${status}** (${leakageScore}/100).${over.length ? ` ${over.length} categor${over.length > 1 ? 'ies are' : 'y is'} over budget.` : ''}${income <= 0 ? '\n\n*No income recorded, so your total budget was used as the base. Add income for a more accurate savings rate.*' : ''}`,
        `बचत दर **${savingsRate}%** है, लक्ष्य **${CONFIG.idealSavingsRate}%**। खर्च का बँटवारा **${current.need}/${current.want}/${current.saving}** (ज़रूरत/चाहत/बचत) बनाम 50/30/20। लीकेज **${status}** (${leakageScore}/100)।${over.length ? ` ${over.length} श्रेणी बजट से अधिक है।` : ''}${income <= 0 ? '\n\n*आय दर्ज नहीं है, इसलिए कुल बजट आधार माना गया। सटीक बचत दर के लिए आय जोड़ें।*' : ''}`);

    return {
        summary,
        leakageScore,
        savingsRate,
        idealSavingsRate: CONFIG.idealSavingsRate,
        topLeaks: leaks,
        rule503020Comparison: { current, target: { ...CONFIG.target503020 } },
    };
};

// ---------------------------------------------------------------- PRIORITY ACTION
export const getPriorityActionLocal = (
    ctx: { investments: Investment[]; budgets: BudgetCategory[]; loans: Loan[]; goals: any[] },
    lang?: Lang
): PriorityAction => {
    const { investments = [], budgets = [], loans = [], goals = [] } = ctx;

    // 1. Overspent budgets
    const over = budgets.filter(b => b.spent > b.allocated).sort((a, b) => (b.spent - b.allocated) - (a.spent - a.allocated));
    if (over.length) {
        const w = over[0];
        return {
            type: 'danger',
            title: tr(lang, `${w.name} is over budget`, `${w.name} बजट से ऊपर है`),
            description: tr(lang, `You are ${inr(w.spent - w.allocated)} over your ${inr(w.allocated)} limit. Pause spending here this month.`, `आप ${inr(w.allocated)} की सीमा से ${inr(w.spent - w.allocated)} ऊपर हैं। इस महीने यहाँ खर्च रोकें।`),
        };
    }

    // 2. Goals due soon and far behind (or overdue)
    const now = Date.now();
    const atRisk = goals
        .map(g => ({ g, months: (new Date(g.targetDate).getTime() - now) / (30.44 * 86400000), progress: g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 100 }))
        .filter(x => !isNaN(x.months) && x.progress < 100 && ((x.months <= 12 && x.progress < 50) || x.months < 0))
        .sort((a, b) => a.months - b.months);
    if (atRisk.length) {
        const { g, months, progress } = atRisk[0];
        const gap = Math.max(0, g.targetAmount - g.currentAmount);
        return {
            type: 'danger',
            title: tr(lang, `Goal at risk: ${g.name}`, `लक्ष्य खतरे में: ${g.name}`),
            description: months < 0
                ? tr(lang, `Target date has passed and you are at ${pct(progress)}%. Reset the date or add ${inr(gap)}.`, `लक्ष्य की तारीख बीत चुकी है और आप ${pct(progress)}% पर हैं। तारीख बदलें या ${inr(gap)} जोड़ें।`)
                : tr(lang, `Only ${pct(progress)}% done with ${Math.max(1, Math.round(months))} month(s) left. About ${inr(gap / Math.max(1, Math.round(months)))} per month is needed.`, `${Math.max(1, Math.round(months))} महीने बचे हैं और केवल ${pct(progress)}% पूरा। हर महीने लगभग ${inr(gap / Math.max(1, Math.round(months)))} चाहिए।`),
        };
    }

    // 3. Budgets close to the limit
    // Only discretionary categories: a fixed Need like rent sitting at 100% is by design, not a warning
    const near = budgets.filter(b => b.allocated > 0 && b.spent / b.allocated > 0.8 && b.type === 'Want').sort((a, b) => b.spent / b.allocated - a.spent / a.allocated);
    if (near.length) {
        const w = near[0];
        return {
            type: 'warning',
            title: tr(lang, `${w.name} budget almost used`, `${w.name} बजट लगभग खत्म`),
            description: tr(lang, `${pct((w.spent / w.allocated) * 100)}% used, ${inr(w.allocated - w.spent)} left. Slow down for the rest of the month.`, `${pct((w.spent / w.allocated) * 100)}% उपयोग हो चुका, ${inr(w.allocated - w.spent)} बचा है। बाकी महीने खर्च धीमा करें।`),
        };
    }

    // 4. High-interest loans
    const hi = loans.filter(l => l.interestRate > CONFIG.highInterestLoanRate && l.outstanding > 0).sort((a, b) => b.interestRate - a.interestRate);
    if (hi.length) {
        const l = hi[0];
        return {
            type: 'warning',
            title: tr(lang, `Prepay ${l.name}`, `${l.name} जल्दी चुकाएँ`),
            description: tr(lang, `At ${l.interestRate}% interest this is costing more than most investments earn. Prepay it or refinance.`, `${l.interestRate}% ब्याज पर यह ज़्यादातर निवेश की कमाई से महँगा है। जल्दी चुकाएँ या रीफाइनेंस करें।`),
        };
    }

    // 5. Emergency fund (approximate: non-real-estate, non-PPF assets vs monthly budgeted spend)
    const monthlySpend = budgets.reduce((s, b) => s + (b.type === 'Saving' ? 0 : Math.max(b.spent, 0)), 0);
    const liquid = investments.filter(i => i.type !== 'Real Estate' && i.type !== 'PPF').reduce((s, i) => s + i.currentValue, 0);
    if (monthlySpend > 0) {
        const months = liquid / monthlySpend;
        if (months < CONFIG.emergencyMonthsMin) {
            return {
                type: 'warning',
                title: tr(lang, 'Build your emergency fund', 'आपातकालीन फंड बनाएँ'),
                description: tr(lang, `Your liquid assets cover about ${months.toFixed(1)} months of spending. Aim for at least ${CONFIG.emergencyMonthsGood}.`, `आपकी तरल संपत्ति लगभग ${months.toFixed(1)} महीने का खर्च कवर करती है। कम से कम ${CONFIG.emergencyMonthsGood} का लक्ष्य रखें।`),
            };
        }
    }

    // 6. Nothing invested
    if (investments.length === 0) {
        return {
            type: 'info',
            title: tr(lang, 'Start investing', 'निवेश शुरू करें'),
            description: tr(lang, 'You have no investments recorded. Start a small monthly SIP in an index fund.', 'कोई निवेश दर्ज नहीं है। इंडेक्स फंड में छोटा मासिक SIP शुरू करें।'),
        };
    }

    // 7. Allocation drift
    const audit = analyzePortfolioLocal(investments, lang);
    if (typeof audit !== 'string') {
        const bad = audit.diversificationInsights.find(i => i.status === 'alert');
        if (bad) return { type: 'info', title: tr(lang, 'Rebalance your portfolio', 'पोर्टफोलियो रीबैलेंस करें'), description: bad.message };
    }

    return {
        type: 'success',
        title: tr(lang, 'You are on track', 'आप सही राह पर हैं'),
        description: tr(lang, 'Budgets, loans and goals look healthy. Keep your SIPs running and review your allocation once a year.', 'बजट, लोन और लक्ष्य ठीक दिख रहे हैं। SIP जारी रखें और साल में एक बार एलोकेशन देखें।'),
    };
};

// ---------------------------------------------------------------- LEVEL UP
const LEVELS = ['ROOKIE', 'BUILDER', 'OPTIMIZED', 'VANGUARD', 'ZENITH'] as const;
const COLORS = ['gray', 'blue', 'indigo', 'purple', 'gold'];

export const getLifeLevelUpLocal = (
    ctx: { investments: Investment[]; budgets: BudgetCategory[]; loans: Loan[]; insurance: Insurance[]; netWorth: number; safetyNetMonths: number },
    lang?: Lang
): LevelUp => {
    const { investments = [], loans = [], insurance = [] } = ctx;
    const nw = Math.max(0, ctx.netWorth || 0);
    const months = Math.max(0, ctx.safetyNetMonths || 0);
    const lifeCover = insurance.filter(i => i.type === 'Life').reduce((s, i) => s + i.sumInsured, 0);
    const hasHighInterestDebt = loans.some(l => l.interestRate > CONFIG.highInterestLoanRate && l.outstanding > 0);
    const classSet = new Set<string>();
    investments.forEach(i => Object.keys(classifyHolding(i)).forEach(k => classSet.add(k)));
    const L = CONFIG.lakh, C = CONFIG.crore;

    type Req = { frac: number; met: boolean; text: string };
    const reqsFor = (level: number): Req[] => {
        switch (level) {
            case 1: return [
                { frac: nw / (5 * L), met: nw >= 5 * L, text: tr(lang, `Reach a net worth of ${inr(5 * L)} (${inr(Math.max(0, 5 * L - nw))} to go)`, `${inr(5 * L)} की नेट वर्थ तक पहुँचें (${inr(Math.max(0, 5 * L - nw))} बाकी)`) },
                { frac: months / 3, met: months >= 3, text: tr(lang, `Build an emergency fund of 3+ months (now ${months.toFixed(1)})`, `3+ महीने का आपातकालीन फंड बनाएँ (अभी ${months.toFixed(1)})`) },
                { frac: investments.length > 0 ? 1 : 0, met: investments.length > 0, text: tr(lang, 'Start at least one investment or SIP', 'कम से कम एक निवेश या SIP शुरू करें') },
            ];
            case 2: return [
                { frac: nw / (25 * L), met: nw >= 25 * L, text: tr(lang, `Reach a net worth of ${inr(25 * L)} (${inr(Math.max(0, 25 * L - nw))} to go)`, `${inr(25 * L)} की नेट वर्थ तक पहुँचें (${inr(Math.max(0, 25 * L - nw))} बाकी)`) },
                { frac: months / 6, met: months > 6, text: tr(lang, `Grow your emergency fund above 6 months (now ${months.toFixed(1)})`, `आपातकालीन फंड 6 महीने से ऊपर करें (अभी ${months.toFixed(1)})`) },
                { frac: lifeCover / C, met: lifeCover >= C, text: tr(lang, `Get ${inr(C)}+ term life cover (now ${inr(lifeCover)})`, `${inr(C)}+ का टर्म लाइफ कवर लें (अभी ${inr(lifeCover)})`) },
                { frac: hasHighInterestDebt ? 0 : 1, met: !hasHighInterestDebt, text: tr(lang, `Clear loans above ${CONFIG.highInterestLoanRate}% interest`, `${CONFIG.highInterestLoanRate}% से अधिक ब्याज वाले लोन चुकाएँ`) },
            ];
            case 3: return [
                { frac: nw / C, met: nw >= C, text: tr(lang, `Reach a net worth of ${inr(C)} (${inr(Math.max(0, C - nw))} to go)`, `${inr(C)} की नेट वर्थ तक पहुँचें (${inr(Math.max(0, C - nw))} बाकी)`) },
                { frac: ['Equity', 'Real Estate', 'Gold'].filter(k => classSet.has(k)).length / 3, met: ['Equity', 'Real Estate', 'Gold'].every(k => classSet.has(k)), text: tr(lang, 'Hold equity, real estate and gold together', 'इक्विटी, रियल एस्टेट और सोना तीनों रखें') },
            ];
            case 4: return [
                { frac: nw / (5 * C), met: nw >= 5 * C, text: tr(lang, `Reach a net worth of ${inr(5 * C)}`, `${inr(5 * C)} की नेट वर्थ तक पहुँचें`) },
                { frac: months / 300, met: months >= 300, text: tr(lang, 'Build assets worth 25x your yearly spending (4% rule)', 'सालाना खर्च का 25 गुना संपत्ति बनाएँ (4% नियम)') },
            ];
            default: return [];
        }
    };

    // Current level = highest level whose requirements (and every level below) are met
    let current = 0;
    while (current < 4 && reqsFor(current + 1).every(r => r.met)) current++;
    const next = Math.min(4, current + 1);
    const atMax = current === 4;

    const nextReqs = atMax ? [] : reqsFor(next);
    const progress = atMax ? 100 : Math.round(clamp((nextReqs.reduce((s, r) => s + clamp(r.frac, 0, 1), 0) / (nextReqs.length || 1)) * 100));
    const unmet = nextReqs.filter(r => !r.met).sort((a, b) => a.frac - b.frac);
    const requirements = atMax
        ? [tr(lang, 'You have reached the top level. Keep your assets diversified.', 'आप शीर्ष स्तर पर हैं। संपत्तियों को विविध रखें।')]
        : unmet.slice(0, 3).map(r => r.text);

    const aiAdvice = atMax
        ? tr(lang, 'You are at the top level. Review your allocation yearly and plan how to pass wealth on.', 'आप शीर्ष स्तर पर हैं। हर साल एलोकेशन देखें और संपत्ति हस्तांतरण की योजना बनाएँ।')
        : tr(lang, `Biggest gap right now: ${unmet[0]?.text.split(' (')[0].toLowerCase()}.`, `अभी सबसे बड़ी कमी: ${unmet[0]?.text.split(' (')[0]}।`);

    return { currentLevel: LEVELS[current], nextLevel: LEVELS[next], progress, requirements, aiAdvice, badgeColor: COLORS[current] };
};

// ---------------------------------------------------------------- SMS PARSER (on-device)
const OTP_RE = /\botp\b|one[\s-]?time (password|pin)|verification code|do not share|never share|\bcvv\b|\bpin\b/i;
const DEBIT_RE = /\b(debited|spent|paid|withdrawn|purchase|purchased|sent|payment of|txn of|transferred to)\b/i;
const CREDIT_RE = /\b(credited|received|deposited|refund(?:ed)?|salary|cashback)\b/i;
const AMOUNT_RE = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi;

const CATEGORY_RULES: { re: RegExp; category: string; cls: 'Need' | 'Want' | 'Saving' }[] = [
    { re: /zomato|swiggy|starbucks|domino|mcdonald|kfc|haldiram|burger|pizza|cafe|restaurant|dine/i, category: 'Food', cls: 'Want' },
    { re: /bigbasket|blinkit|zepto|dmart|instamart|grocer|supermarket|jiomart/i, category: 'Groceries', cls: 'Need' },
    { re: /uber|ola\b|rapido|petrol|fuel|metro|irctc|redbus|fastag|indian oil|hpcl|bpcl/i, category: 'Transport', cls: 'Need' },
    { re: /electricity|bescom|msedcl|bill|recharge|airtel|jio\b|vodafone|\bvi\b|broadband|gas|rent|water/i, category: 'Bills', cls: 'Need' },
    { re: /insurance|lic\b|premium|hdfc ergo|star health/i, category: 'Insurance', cls: 'Need' },
    { re: /hospital|pharmacy|apollo|medplus|1mg|clinic|diagnostic/i, category: 'Health', cls: 'Need' },
    { re: /mutual fund|zerodha|groww|\bsip\b|ppf|nps|upstox|kuvera|coin\b/i, category: 'Investment', cls: 'Saving' },
    { re: /netflix|hotstar|prime video|spotify|bookmyshow|pvr|inox|gaming/i, category: 'Entertainment', cls: 'Want' },
    { re: /amazon|flipkart|myntra|ajio|nykaa|meesho/i, category: 'Shopping', cls: 'Want' },
];

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

const parseSmsDate = (text: string): string => {
    let m = text.match(/\b(\d{1,2})[-\/ ]([A-Za-z]{3})[a-z]*[-\/ ,]*(\d{2,4})\b/);
    if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
        const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
        return new Date(Date.UTC(y, MONTHS[m[2].toLowerCase()], +m[1])).toISOString().split('T')[0];
    }
    m = text.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})\b/);
    if (m) {
        const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
        if (+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return new Date(Date.UTC(y, +m[2] - 1, +m[1])).toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
};

const parseAmount = (text: string): number | null => {
    AMOUNT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = AMOUNT_RE.exec(text))) {
        // skip balances and limits
        const before = text.slice(Math.max(0, m.index - 28), m.index).toLowerCase();
        if (/(avl|avail|available|bal|balance|limit|outstanding|min(?:imum)? due)\W*(?:bal|amt|amount)?\W*$/.test(before)) continue;
        const v = parseFloat(m[1].replace(/,/g, ''));
        if (isFinite(v) && v > 0) return v;
    }
    return null;
};

const parseMerchant = (text: string, credit: boolean): string => {
    const upi = text.match(/(?:vpa|upi)[\s:\/-]+([A-Za-z0-9._\-]+@[A-Za-z0-9]+)(?:\s*\(([^)]+)\))?/i);
    if (upi) return (upi[2] || upi[1]).trim();
    const re = credit
        ? /\b(?:from|by)\s+([A-Za-z0-9][A-Za-z0-9 &.'\-]{1,40}?)(?=\s+(?:on|using|via|ref|upi|txn|avl|bal|to|dated|is)\b|[.,;]|$)/i
        : /\b(?:at|to|towards)\s+([A-Za-z0-9][A-Za-z0-9 &.'\-]{1,40}?)(?=\s+(?:on|using|via|from|ref|upi|txn|avl|bal|credit|debit|dated|is)\b|[.,;]|$)/i;
    const m = text.match(re);
    const raw = m ? m[1].trim() : '';
    // "a/c", "your account" and similar are not merchants
    if (!raw || /^(a\/c|acct|account|your|my|card|bank)/i.test(raw)) return '';
    return raw;
};

/** Parses one bank/UPI SMS locally. Returns null for OTPs, promos and anything that is not a transaction. */
export const parseSmsLocal = (text: string): Partial<Transaction> | null => {
    if (!text || OTP_RE.test(text)) return null;
    const amount = parseAmount(text);
    if (!amount) return null;

    const d = text.search(DEBIT_RE);
    const c = text.search(CREDIT_RE);
    if (d < 0 && c < 0) return null;
    const isCredit = d < 0 || (c >= 0 && c < d);

    const merchant = parseMerchant(text, isCredit);
    const haystack = `${merchant} ${text}`;
    const rule = isCredit ? undefined : CATEGORY_RULES.find(r => r.re.test(haystack));

    return {
        amount,
        merchant: merchant || undefined,
        description: merchant || (isCredit ? 'Money received' : 'Payment'),
        type: isCredit ? TransactionType.INCOME : TransactionType.EXPENSE,
        category: isCredit ? 'Income' : rule?.category || 'Other',
        classification: isCredit ? undefined : rule?.cls || 'Want',
        date: parseSmsDate(text),
    };
};

/** Cheap check used before anything else touches an SMS. */
export const looksLikeTransactionSms = (text: string): boolean => parseSmsLocal(text) !== null;
