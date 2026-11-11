import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
    Loader2, Bot, X, Check, Search, BarChart3, Activity, Sparkles, 
    MessageSquare, ShieldAlert, Landmark, ArrowRight, Calculator, Zap,
    ShieldCheck, FileText, Clock, TrendingUp, TrendingDown, Users, Lock
} from 'lucide-react';
import { 
    Investment, BudgetCategory, Transaction, Loan, Insurance, TransactionType, ViewState
} from '../types';
import { Language, translations } from '../translations';
import { 
    getInvestments, getBudgets, getTransactions, getLoans, getInsurance, 
    getGoals, addTransaction, getCurrentUser
} from '../services/dataService';
import { getMarketPulse, getPriorityAction, getLifeLevelUpAdvice } from '../services/geminiService';
import { triggerHaptic, handleIncomingSms } from '../services/nativeBridge';
import { Button, Card } from './ui';
import { BrandLogo } from './BrandLogo';
import { safeStorage } from '../services/storage';

interface DashboardPageProps {
    setView: (v: ViewState) => void;
    lang: Language;
    userLevel?: number;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ setView, lang, userLevel = 1 }) => {
    const t = translations[lang];
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [budgets, setBudgets] = useState<BudgetCategory[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [insurance, setInsurance] = useState<Insurance[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingSms, setPendingSms] = useState<Partial<Transaction>[]>([]);
    const [marketPulse, setMarketPulse] = useState<{nifty: number, niftyChange: number, sensex: number, sensexChange: number, prediction: string} | null>(null);
    const [priorityAction, setPriorityAction] = useState<{ title: string, description: string, type: 'danger' | 'warning' | 'success' | 'info' } | null>(null);
    const [levelAdvice, setLevelAdvice] = useState<{ 
        currentLevel: string, 
        nextLevel: string, 
        progress: number, 
        requirements: string[], 
        aiAdvice: string,
        badgeColor: string
    } | null>(null);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            // Load cached data first for instant UI response
            const cachedPriority = safeStorage.getItem('cache_priority_action');
            if (cachedPriority) setPriorityAction(JSON.parse(cachedPriority));

            const u = getCurrentUser();
            setUser(u);

            const [inv, bud, txs, ln, ins, avGoals] = await Promise.all([
                getInvestments(), 
                getBudgets(), 
                getTransactions(),
                getLoans(),
                getInsurance(),
                getGoals()
            ]);
            setInvestments(inv || []);
            setBudgets(bud || []);
            setTransactions(txs || []);
            setLoans(ln || []);
            setInsurance(ins || []);
            setLoading(false);

            // Fetch AI insights in the background
            const fetchMarketData = () => {
                getMarketPulse().then(mPulse => {
                    if (mPulse) {
                        setMarketPulse(mPulse);
                        safeStorage.setItem('cache_market_pulse', JSON.stringify(mPulse));
                    }
                });
            };

            fetchMarketData();
            // Refresh market data every 5 minutes to mitigate rate limits
            const marketInterval = setInterval(fetchMarketData, 5 * 60 * 1000);
            
            getPriorityAction({ investments: inv, budgets: bud, loans: ln, goals: avGoals }, lang)
                .then(pAction => {
                    if (pAction) {
                        setPriorityAction(pAction);
                        safeStorage.setItem('cache_priority_action', JSON.stringify(pAction));
                    }
                });

            // Calculate metrics for Level Up
            const totalWealthCalc = inv.reduce((sum: number, i: any) => sum + i.currentValue, 0);
            const totalDebtCalc = ln.reduce((sum: number, l: any) => sum + l.outstanding, 0);
            const netWorthCalc = totalWealthCalc - totalDebtCalc;
            
            const expenseTransactions = txs.filter((t: any) => t.type === 'expense');
            const uniqueMonths = new Set(expenseTransactions.map((t: any) => {
                const d = new Date(t.date);
                return `${d.getFullYear()}-${d.getMonth()}`;
            }));
            const totalExpense = expenseTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
            const avgMonthlyExpenseCalc = totalExpense / Math.max(1, uniqueMonths.size);
            
            const investableWealthCalc = inv
                .filter((i: any) => i.type !== 'Real Estate')
                .reduce((sum: number, i: any) => sum + i.currentValue, 0);
            const safetyNetMonthsCalc = investableWealthCalc / Math.max(1, avgMonthlyExpenseCalc);

            getLifeLevelUpAdvice({ 
                investments: inv, 
                budgets: bud, 
                loans: ln, 
                insurance: ins,
                netWorth: netWorthCalc,
                safetyNetMonths: safetyNetMonthsCalc
            }, lang).then(setLevelAdvice);
                
            return () => clearInterval(marketInterval);
        };
        const cleanup = load();

        // The global listener is now handled in App.tsx
        
        return () => {
            cleanup.then(cleanupFn => cleanupFn && cleanupFn());
        };
    }, [lang]);

    const approveSms = async (t: Partial<Transaction>, index: number) => {
        await triggerHaptic();
        const fullTransaction: Transaction = {
            id: Math.random().toString(36).substr(2, 9),
            amount: t.amount || 0,
            category: t.category || 'Other',
            description: t.merchant || t.description || 'SMS Import',
            date: new Date().toISOString().split('T')[0],
            type: (t.type as TransactionType) || TransactionType.EXPENSE,
            classification: t.classification || 'Want'
        };
        await addTransaction(fullTransaction);
        const txs = await getTransactions();
        setTransactions(txs);
        setPendingSms(prev => prev.filter((_, i) => i !== index));
    };

    const totalWealth = investments.reduce((sum, i) => sum + i.currentValue, 0);
    const totalDebt = loans.reduce((sum, l) => sum + l.outstanding, 0);
    const totalInvested = investments.reduce((sum, i) => sum + i.investedAmount, 0);
    const netWorth = totalWealth - totalDebt;

    const avgMonthlyExpense = useMemo(() => {
        const expenseTransactions = transactions.filter(t => t.type === 'expense');
        if (expenseTransactions.length === 0) return 0;
        
        const uniqueMonths = new Set(expenseTransactions.map(t => {
            const d = new Date(t.date);
            return `${d.getFullYear()}-${d.getMonth()}`;
        }));
        
        const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
        return totalExpense / Math.max(1, uniqueMonths.size);
    }, [transactions]);
    
    const investableWealth = investments
        .filter(i => i.type !== 'Real Estate')
        .reduce((sum, i) => sum + i.currentValue, 0);
        
    const safetyNetMonths = useMemo(() => {
        return investableWealth / Math.max(1, avgMonthlyExpense);
    }, [investableWealth, avgMonthlyExpense]);

    const healthScore = useMemo(() => {
        let score = 50; // Starting baseline
        if (safetyNetMonths >= 6) score += 20;
        else if (safetyNetMonths >= 3) score += 10;
        
        if (totalDebt === 0) score += 20;
        else if (totalDebt < netWorth * 0.2) score += 10;

        if (investments.length > 3) score += 10;
        return Math.min(100, score);
    }, [safetyNetMonths, totalDebt, netWorth, investments.length]);

    return (
        <div className="space-y-6 pb-20">
            {loading && (
                <div className="fixed top-20 right-8 z-[60] bg-surface/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 shadow-2xl">
                    <Loader2 size={14} className="animate-spin text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Syncing Intelligence...</span>
                </div>
            )}
            <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-display font-bold tracking-tight text-white">
                            {t.financialHealthHub}
                        </h2>
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-1">
                             <div className={`w-2 h-2 rounded-full ${healthScore > 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} /> Core Systems Nominal
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-gray-500 uppercase font-black">Health Score</p>
                        <p className={`text-xl font-black ${healthScore > 75 ? 'text-emerald-400' : 'text-amber-400'}`}>{healthScore}/100</p>
                    </div>
                </div>
            </div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-8 text-white shadow-2xl shadow-fuchsia-500/20 md:p-12"
            >
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="relative z-10 max-w-2xl space-y-6">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 backdrop-blur-md">
                        <Sparkles size={14} className="text-amber-300" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100">{t.secondaryTagline}</span>
                    </div>
                    <p className="text-lg font-bold text-white/90">Hey {(user?.displayName || '').split(' ')[0] || 'there'} 👋</p>
                    <h1 className="text-4xl font-display font-bold tracking-tight md:text-6xl">
                        {t.primaryTagline}
                    </h1>
                    <p className="max-w-lg text-lg font-medium leading-relaxed text-indigo-100/80">
                         Track your spends, grow your savings and see exactly where your money's going. No finance degree needed.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-4">
                        <Button size="lg" className="bg-pop px-8 font-black text-black hover:brightness-105 shadow-none" onClick={() => setView('budget')}>Log a spend 💸</Button>
                        <Button size="lg" variant="outline" className="border-white/30 bg-white/10 px-8 font-black text-white hover:bg-white/20" onClick={() => setView('portfolio')}>Add investments 📈</Button>
                    </div>
                </div>
            </motion.div>

            {levelAdvice && (
                <Card className="p-6 bg-gradient-to-br from-indigo-950/40 via-surface to-surface border-indigo-500/10 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
                    <div className="flex flex-col md:flex-row gap-8 items-center">
                        <div className="flex flex-col items-center text-center space-y-3 shrink-0">
                            <div className={`w-20 h-20 rounded-full border-4 border-white/5 shadow-2xl flex flex-col items-center justify-center p-2 relative
                                ${levelAdvice.badgeColor === 'gold' ? 'bg-amber-500/20 text-amber-400' : 
                                  levelAdvice.badgeColor === 'purple' ? 'bg-purple-500/20 text-purple-400' :
                                  levelAdvice.badgeColor === 'indigo' ? 'bg-indigo-500/20 text-indigo-400' :
                                  levelAdvice.badgeColor === 'blue' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                <Zap size={24} className="mb-0.5" />
                                <span className="text-[8px] font-black uppercase tracking-tighter leading-none">{levelAdvice.currentLevel}</span>
                                <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-[8px] font-black px-2 py-0.5 rounded-full border border-white/10">Lvl {levelAdvice.progress > 90 ? 'MAX' : levelAdvice.badgeColor === 'gray' ? '1' : levelAdvice.badgeColor === 'blue' ? '2' : levelAdvice.badgeColor === 'indigo' ? '3' : '4'}</div>
                            </div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Financial Rank</p>
                        </div>
                        
                        <div className="flex-1 space-y-4 w-full">
                            <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                                        Road to {levelAdvice.nextLevel}
                                        <ArrowRight size={16} className="text-indigo-400" />
                                    </h3>
                                    <p className="text-xs text-gray-400 font-medium italic">"{levelAdvice.aiAdvice}"</p>
                                </div>
                                <span className="text-xl font-black text-indigo-400">{levelAdvice.progress}%</span>
                            </div>
                            
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${levelAdvice.progress}%` }}
                                    className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {levelAdvice.requirements.map((req, i) => (
                                    <div key={i} className="flex flex-col gap-1 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Milestone {i+1}</span>
                                        </div>
                                        <span className="text-xs font-bold text-gray-300 leading-tight">{req}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button 
                    onClick={() => setView('insurance')} 
                    className="p-4 bg-surface/30 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-all active:scale-95 group"
                >
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                        <ShieldCheck size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">HLV Scan</span>
                </button>
                <button 
                    onClick={() => setView('loans')} 
                    className="p-4 bg-surface/30 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-all active:scale-95 group"
                >
                    <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                        <Zap size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Payoff Plan</span>
                </button>
                <button 
                    onClick={() => setView('reports')} 
                    className="p-4 bg-surface/30 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-indigo-500/50 transition-all active:scale-95 group"
                >
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                        <BarChart3 size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{t.reports}</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                <Card className="p-6 bg-surface/30 border-white/5 flex flex-col justify-center items-center text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Health Index</p>
                    <div className="relative w-16 h-16 flex items-center justify-center mb-1">
                         <svg className="w-16 h-16 -rotate-90">
                            <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                            <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray={176} strokeDashoffset={176 - (176 * healthScore) / 100} className={`${healthScore > 75 ? 'text-emerald-500' : healthScore > 40 ? 'text-amber-500' : 'text-red-500'}`} strokeLinecap="round" />
                         </svg>
                         <span className="absolute text-sm font-black">{healthScore}</span>
                    </div>
                    <p className="text-[10px] font-black italic uppercase tracking-tighter text-gray-400">
                        {healthScore > 75 ? 'Optimized' : 'Needs Repair'}
                    </p>
                </Card>

                 <Card className="p-6 bg-emerald-950/10 border-emerald-500/20 flex flex-col justify-between group cursor-pointer hover:border-emerald-500/40 transition-all font-bold" onClick={() => setView('portfolio')}>
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-emerald-400">
                                 <Activity size={14} />
                                 <span className="text-[10px] font-black uppercase tracking-widest">Wealth Pulse</span>
                            </div>
                            <h4 className="text-xl font-black italic">Portfolio Auditor</h4>
                        </div>
                        <BarChart3 size={20} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="flex items-center justify-end gap-1 text-emerald-400 text-[10px] uppercase font-black">
                        Run Audit <ArrowRight size={12} />
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card className="p-8 flex flex-col items-center justify-center text-center space-y-4 bg-gradient-to-b from-indigo-500/5 to-transparent border-indigo-500/10">
                     <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.2em]">{t.netWorth}</p>
                     <div className="space-y-1">
                        <p className="text-lg sm:text-2xl md:text-3xl font-black italic tracking-tighter text-white">₹{netWorth.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">{t.consolidatedBalance}</p>
                     </div>
                 </Card>
                 <Card className="p-8 flex flex-col items-center justify-center text-center space-y-4 bg-gradient-to-b from-emerald-500/5 to-transparent border-emerald-500/10">
                     <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.2em]">{t.safetyNet}</p>
                     <div className="space-y-1">
                        <p className="text-lg sm:text-2xl md:text-3xl font-black italic tracking-tighter text-emerald-400">{safetyNetMonths.toFixed(1)}m</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">{t.survivalRunway}</p>
                     </div>
                 </Card>
                 {marketPulse && (
                 <Card className="p-8 flex flex-col items-center justify-center text-center bg-gradient-to-b from-amber-500/5 to-transparent border-amber-500/10 relative overflow-hidden group">
                     <div className="absolute top-2 right-2">
                         <button onClick={async (e) => { 
                             e.stopPropagation();
                             setMarketPulse(null);
                             const m = await getMarketPulse();
                             if(m) setMarketPulse(m);
                         }} className="p-2 text-gray-500 hover:text-amber-400 transition-colors z-20">
                             <Clock size={12} className="group-hover:rotate-180 transition-transform duration-700" />
                         </button>
                     </div>
                     <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.2em] mb-4">{t.marketPulse}</p>
                     
                     <div className="grid grid-cols-2 gap-4 w-full">
                         <div className="space-y-1">
                            <p className="text-[8px] text-gray-500 font-black uppercase">Nifty 50</p>
                            <motion.div 
                                key={marketPulse?.nifty}
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="text-xl font-black tracking-tighter italic flex items-center justify-center gap-1 text-white"
                            >
                                {marketPulse?.nifty?.toLocaleString() || '---'}
                            </motion.div>
                            {marketPulse && (
                                <p className={`text-[9px] font-black flex items-center justify-center gap-0.5 ${marketPulse.niftyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {marketPulse.niftyChange >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                    {Math.abs(marketPulse.niftyChange)}%
                                </p>
                            )}
                         </div>
                         <div className="space-y-1 border-l border-white/5">
                            <p className="text-[8px] text-gray-500 font-black uppercase">Sensex</p>
                            <motion.div 
                                key={marketPulse?.sensex}
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="text-xl font-black tracking-tighter italic flex items-center justify-center gap-1 text-indigo-100"
                            >
                                {marketPulse?.sensex?.toLocaleString() || '---'}
                            </motion.div>
                            {marketPulse && (
                                <p className={`text-[9px] font-black flex items-center justify-center gap-0.5 ${marketPulse.sensexChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {marketPulse.sensexChange >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                    {Math.abs(marketPulse.sensexChange)}%
                                </p>
                            )}
                         </div>
                     </div>
                     <div className="mt-4 w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                 </Card>
                 )}
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                    <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em]">{t.financialPowerTools}</h3>
                    <div className="w-1/2 h-px bg-white/5" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button 
                        onClick={() => setView('calculators')}
                        className="p-4 rounded-2xl bg-surface/30 border border-white/5 hover:border-primary/40 transition-all text-left flex items-center gap-4 group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Calculator size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold">Calculators</p>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">SIP • Lumpsum • FD</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => setView('loans')}
                        className="p-4 rounded-2xl bg-surface/30 border border-white/5 hover:border-indigo-500/40 transition-all text-left flex items-center gap-4 group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Zap size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold">Debt Manager</p>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">EMI • Prepay • Strategy</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => setView('insurance')}
                        className="p-4 rounded-2xl bg-surface/30 border border-white/5 hover:border-rose-500/40 transition-all text-left flex items-center gap-4 group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ShieldAlert size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold">Insurance Hub</p>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">HLV • Policy Tracking</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
