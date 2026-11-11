import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { 
    Wallet, Plus, Loader2, Bot, Mic, X, TrendingUp, ArrowDownCircle, Clock, Calendar, 
    FileSearch, UploadCloud, Shield, Zap, Pencil, Trash2, PieChart as PieChartIcon, 
    BarChart3, Landmark
} from 'lucide-react';
import { 
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis
} from 'recharts';
import { 
    BudgetCategory, Transaction, TransactionType, Subscription, Loan 
} from '../types';
import { 
    getBudgets, saveBudget, deleteBudget, getTransactions, addTransaction, 
    getSubscriptions, saveSubscription, deleteSubscription, getLoans, trackAppEvent 
} from '../services/dataService';
import { analyzeBudget, extractStatementTransactions, parseVoiceTransaction, BudgetAudit } from '../services/geminiService';
import { extractTextFromFile, FileTextError } from '../services/fileText';
import { listenOnce, stopListening } from '../services/voice';
import { Button, Card, Input, Modal, Select, RichText } from './ui';
import { Language, translations } from '../translations';

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444'];

const BudgetPage: React.FC<{ lang: Language }> = ({ lang }) => {
    const t = translations[lang];
    const [budgets, setBudgets] = useState<BudgetCategory[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'budget' | 'income' | 'subs' | 'import'>('budget');
    const [analyzing, setAnalyzing] = useState(false);
    const [aiInsights, setAiInsights] = useState<BudgetAudit | string | null>(null);
    
    // Add Txn Form
    const [showAddModal, setShowAddModal] = useState(false);
    const [amount, setAmount] = useState('');
    const [desc, setDesc] = useState('');
    const [cat, setCat] = useState('');
    const [merchant, setMerchant] = useState('');
    const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
    const [txnClassification, setTxnClassification] = useState<'Need' | 'Want' | 'Saving'>('Need');
    
    // Add Cat Form
    const [showCatModal, setShowCatModal] = useState(false);
    const [catName, setCatName] = useState('');
    const [catAlloc, setCatAlloc] = useState('');
    const [catType, setCatType] = useState<'Need' | 'Want' | 'Saving'>('Need');
    const [editingCat, setEditingCat] = useState<BudgetCategory | null>(null);

    // Sub Form
    const [showSubModal, setShowSubModal] = useState(false);
    const [sName, setSName] = useState('');
    const [sAmount, setSAmount] = useState('');
    const [sCycle, setSCycle] = useState<'Monthly' | 'Yearly'>('Monthly');
    const [sDate, setSDate] = useState('');

    // Import State
    const [importLoading, setImportLoading] = useState(false);
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const [showImportReview, setShowImportReview] = useState(false);
    const [importFinished, setImportFinished] = useState(false);

    // Voice State
    const [isListening, setIsListening] = useState(false);
    const [voiceLoading, setVoiceLoading] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);

    const durationTimerRef = useRef<any>(null);

    useEffect(() => {
        reload();
        return () => {
            if (durationTimerRef.current) {
                clearInterval(durationTimerRef.current);
            }
            stopListening();
        };
    }, []);

    const reload = async () => {
        setLoading(true);
        try {
            const [b, t, s, l] = await Promise.all([getBudgets(), getTransactions(), getSubscriptions(), getLoans()]);
            setBudgets(b);
            setTransactions(t);
            setSubscriptions(s);
            setLoans(l);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleAddTransaction = async () => {
        if (!amount || !cat) return;
        await addTransaction({
            amount: parseFloat(amount),
            description: desc || cat,
            category: cat,
            merchant: merchant,
            type,
            classification: type === TransactionType.EXPENSE ? txnClassification : undefined,
            date: new Date().toISOString()
        } as Transaction);
        await reload();
        setShowAddModal(false);
        setAmount(''); setDesc(''); setCat(''); setMerchant('');
    };

    const handleSaveCategory = async () => {
        if (!catName || !catAlloc) return;
        await saveBudget({
            id: editingCat ? editingCat.id : '',
            name: catName,
            allocated: parseFloat(catAlloc),
            spent: editingCat ? editingCat.spent : 0,
            type: catType
        });
        await reload();
        setShowCatModal(false);
        setCatName(''); setCatAlloc(''); setEditingCat(null);
    };

    const handleSaveSub = async () => {
        if(!sName || !sAmount) return;
        await saveSubscription({
            name: sName,
            amount: parseFloat(sAmount),
            cycle: sCycle,
            nextDueDate: sDate,
            category: 'General'
        } as Subscription);
        await reload();
        setShowSubModal(false);
        setSName(''); setSAmount(''); setSDate('');
    };

    const handleStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportLoading(true);
        setImportFinished(false);
        try {
            let text: string;
            try {
                text = await extractTextFromFile(file);
            } catch (err: any) {
                if (err instanceof FileTextError && err.code === 'PASSWORD_REQUIRED') {
                    const pw = prompt("This PDF is password protected. Enter the password:") || '';
                    text = await extractTextFromFile(file, pw);
                } else throw err;
            }
            const txns = await extractStatementTransactions(text);
            setPendingTransactions(txns);
            setShowImportReview(true);
        } catch (err: any) {
            alert(err instanceof FileTextError ? err.message : "Failed to analyze statement.");
        } finally {
            setImportLoading(false);
            e.target.value = '';
        }
    };

    const confirmImportTransactions = async () => {
        setImportLoading(true);
        try {
            for (const t of pendingTransactions) await addTransaction(t);
            await reload();
            setPendingTransactions([]);
            setShowImportReview(false);
            setImportFinished(true);
            setTab('budget');
        } catch (e) { alert("Error importing"); }
        finally { setImportLoading(false); }
    };

    const triggerHapticWeb = () => {
        try {
            if ('vibrate' in navigator) {
                navigator.vibrate(100);
            }
        } catch (e) {}
    };

    const startRecording = async () => {
        setRecordingDuration(0);
        setIsListening(true);
        durationTimerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
        let transcript = '';
        try {
            transcript = await listenOnce(lang === 'hi' ? 'hi-IN' : 'en-IN');
        } catch (e: any) {
            console.error("Speech recognition failed", e);
            alert(e?.message || "Could not access your microphone.");
        } finally {
            stopRecording();
        }
        if (!transcript.trim()) return;

        setVoiceLoading(true);
        try {
            const parsed = await parseVoiceTransaction(transcript);
            if (parsed && parsed.amount) {
                setAmount(String(parsed.amount));
                setDesc(parsed.description || '');
                setMerchant(parsed.description || '');
                if (parsed.category) setCat(parsed.category);
                setType(TransactionType.EXPENSE);
                triggerHapticWeb();
            } else {
                alert(`Heard: "${transcript}". Could not detect an amount. Try e.g. 'Spent 500 rupees on dinner'.`);
            }
        } catch (err) {
            console.error("Error parsing voice:", err);
            alert("Error parsing voice transaction.");
        } finally {
            setVoiceLoading(false);
        }
    };

    const stopRecording = () => {
        stopListening();
        setIsListening(false);
        if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
        }
    };

    const handleVoiceLog = async () => {
        if (isListening) {
            stopRecording();
        } else {
            await startRecording();
        }
    };

    const runBudgetAnalysis = async () => {
        setAnalyzing(true);
        const insights = await analyzeBudget(budgets, transactions);
        setAiInsights(insights);
        setAnalyzing(false);
    };

    const get503020Stats = () => {
        const stats = { Need: 0, Want: 0, Saving: 0 };
        budgets.forEach(b => {
             if (b.type in stats) stats[b.type as keyof typeof stats] += b.allocated;
        });
        const total = budgets.reduce((s, b) => s + b.allocated, 0) || 1;
        return {
            needsP: (stats.Need / total) * 100,
            wantsP: (stats.Want / total) * 100,
            savingsP: (stats.Saving / total) * 100,
            ...stats
        };
    };

    const budgetStats = get503020Stats();
    const incomeTransactions = transactions.filter(t => t.type === TransactionType.INCOME).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
    const totalIncomeMonth = incomeTransactions.reduce((s,t)=>s+t.amount,0);
    const totalAllocated = budgets.reduce((s,b)=>s+b.allocated,0);
    const leftToAssign = totalIncomeMonth - totalAllocated;

    if(loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6 pb-20">
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div><h2 className="text-3xl font-black tracking-tight">Spend &amp; Save 💸</h2><p className="text-sm text-gray-400 mt-1">Where's your money going? Let's find out.</p></div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-full p-1 flex text-sm overflow-x-auto whitespace-nowrap scrollbar-hide">
                        <button onClick={() => setTab('budget')} className={`px-4 py-2 rounded-full transition-all ${tab === 'budget' ? 'bg-primary text-white font-bold shadow-lg shadow-violet-500/30' : 'text-gray-400 hover:text-white'}`}>🛍️ {t.expenses}</button>
                        <button onClick={() => setTab('income')} className={`px-4 py-2 rounded-full transition-all ${tab === 'income' ? 'bg-primary text-white font-bold shadow-lg shadow-violet-500/30' : 'text-gray-400 hover:text-white'}`}>💰 {t.income}</button>
                        <button onClick={() => setTab('subs')} className={`px-4 py-2 rounded-full transition-all ${tab === 'subs' ? 'bg-primary text-white font-bold shadow-lg shadow-violet-500/30' : 'text-gray-400 hover:text-white'}`}>🔁 {t.subscriptions}</button>
                        <button onClick={() => setTab('import')} className={`px-4 py-2 rounded-full transition-all ${tab === 'import' ? 'bg-primary text-white font-bold shadow-lg shadow-violet-500/30' : 'text-gray-400 hover:text-white'}`}>📥 {t.smartImport}</button>
                    </div>
                </div>
                <div className="flex overflow-x-auto whitespace-nowrap scrollbar-hide gap-2 pb-2">
                    <Button onClick={runBudgetAnalysis} variant="outline" size="sm" className="border-indigo-500/30 text-violet-300 text-xs py-1" disabled={analyzing}>
                        {analyzing ? <Loader2 className="animate-spin" size={14} /> : <Bot size={14} />}
                        {t.analyze}
                    </Button>
                    <Button onClick={() => { setType(tab === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE); setShowAddModal(true); }} size="sm" className="text-xs py-1"><Plus size={14} /> {t.addTxn}</Button>
                    {tab === 'budget' && (
                        <Button onClick={() => { setEditingCat(null); setCatName(''); setCatAlloc(''); setCatType('Need'); setShowCatModal(true); }} variant="outline" size="sm" className="text-xs py-1 border-emerald-500/30 text-emerald-400">
                             <Plus size={14} /> New category
                        </Button>
                    )}
                </div>
            </div>

            {aiInsights && (
                <Card className="bg-indigo-950/20 border-indigo-500/30 p-8 relative overflow-hidden mb-8">
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl opacity-50" />
                    
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-indigo-500/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <Bot size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Your Money Check-up ✨</h3>
                                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Quick read on how you're spending</p>
                            </div>
                        </div>
                        <button onClick={() => setAiInsights(null)} className="p-2 text-gray-500 hover:text-white transition-colors bg-white/5 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>

                    {typeof aiInsights === 'string' ? (
                        <div className="prose prose-invert prose-sm text-gray-300 italic whitespace-pre-line leading-relaxed border-l-2 border-indigo-500/30 pl-4 py-2">
                            {aiInsights}
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="p-6 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center">
                                    <div className="relative w-24 h-24 mb-3">
                                        <svg className="w-24 h-24 -rotate-90">
                                            <circle cx="48" cy="48" r="42" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                                            <motion.circle 
                                                initial={{ strokeDashoffset: 264 }}
                                                animate={{ strokeDashoffset: 264 - (264 * aiInsights.leakageScore) / 100 }}
                                                cx="48" cy="48" r="42" fill="transparent" stroke="currentColor" strokeWidth="8" 
                                                strokeDasharray={264} 
                                                className={aiInsights.leakageScore > 50 ? 'text-red-500' : aiInsights.leakageScore > 20 ? 'text-amber-500' : 'text-emerald-500'} 
                                                strokeLinecap="round" 
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-2xl font-black">{aiInsights.leakageScore}</span>
                                            <span className="text-[8px] font-black uppercase text-gray-500">Leakage</span>
                                        </div>
                                    </div>
                                    <p className="text-xs font-bold text-gray-400">Money leak score</p>
                                </div>

                                <Card className="bg-indigo-500/5 border-indigo-500/20 p-6 flex flex-col justify-center">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                                            <TrendingUp size={16} />
                                        </div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Savings Rate</h4>
                                    </div>
                                    <div className="flex items-end gap-2 mb-2">
                                        <span className="text-3xl font-black text-white">{aiInsights.savingsRate}%</span>
                                        <span className="text-xs text-gray-500 mb-1">current</span>
                                    </div>
                                    <div className="w-full bg-indigo-500/10 h-1.5 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${aiInsights.savingsRate}%` }}
                                            className="bg-indigo-500 h-full rounded-full" 
                                        />
                                    </div>
                                    <p className="text-[8px] font-bold text-indigo-400/60 mt-2 uppercase tracking-widest text-center">Goal: {aiInsights.idealSavingsRate}%+</p>
                                </Card>

                                <Card className="bg-white/5 border-white/5 p-6 flex flex-col justify-center relative overflow-hidden">
                                    <div className="absolute -right-4 -bottom-4 opacity-5">
                                        <Zap size={80} />
                                    </div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">50/30/20 check</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-[10px] mb-1 uppercase font-bold">
                                                <span className="text-gray-400">Needs</span>
                                                <span className={aiInsights.rule503020Comparison.current.need > 55 ? 'text-red-400' : 'text-emerald-400'}>{aiInsights.rule503020Comparison.current.need}%</span>
                                            </div>
                                            <div className="w-full bg-white/5 h-1 rounded-full"><div className="bg-primary h-full rounded-full" style={{ width: `${aiInsights.rule503020Comparison.current.need}%` }} /></div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[10px] mb-1 uppercase font-bold">
                                                <span className="text-gray-400">Wants</span>
                                                <span className={aiInsights.rule503020Comparison.current.want > 35 ? 'text-red-400' : 'text-emerald-400'}>{aiInsights.rule503020Comparison.current.want}%</span>
                                            </div>
                                            <div className="w-full bg-white/5 h-1 rounded-full"><div className="bg-accent h-full rounded-full" style={{ width: `${aiInsights.rule503020Comparison.current.want}%` }} /></div>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Where your money's leaking 💧</h4>
                                    <div className="space-y-3">
                                        {aiInsights.topLeaks.map((leak, idx) => (
                                            <div key={idx} className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex justify-between items-center group hover:bg-red-500/10 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
                                                        <ArrowDownCircle size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white uppercase tracking-tight">{leak.category}</p>
                                                        <p className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5">{leak.tip}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-red-400">₹{leak.amount.toLocaleString()}</p>
                                                    <p className="text-[8px] font-black uppercase text-red-500/50">per month</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">The tea ☕</h4>
                                    <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                                        <RichText text={aiInsights.summary} className="text-sm text-gray-300 leading-relaxed" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Button className="h-12 text-[10px] uppercase font-black tracking-widest" variant="outline">Cut back 🔒</Button>
                                        <Button className="h-12 text-[10px] uppercase font-black tracking-widest">Set a goal 🎯</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {tab === 'budget' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-6">
                         <Card>
                             <h3 className="text-gray-400 mb-4 text-sm font-medium">50/30/20 vibe check</h3>
                             <div className="space-y-4">
                                 <div>
                                     <div className="flex justify-between text-xs mb-1">
                                         <span className="text-gray-300">Needs (Target 50%)</span>
                                         <span className={budgetStats.needsP > 50 ? 'text-red-400' : 'text-green-400'}>{Math.round(budgetStats.needsP)}%</span>
                                     </div>
                                     <div className="w-full bg-gray-700 h-1.5 rounded-full"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(100, budgetStats.needsP)}%` }} /></div>
                                 </div>
                                 <div>
                                     <div className="flex justify-between text-xs mb-1">
                                         <span className="text-gray-300">Wants (Target 30%)</span>
                                         <span className={budgetStats.wantsP > 30 ? 'text-red-400' : 'text-green-400'}>{Math.round(budgetStats.wantsP)}%</span>
                                     </div>
                                     <div className="w-full bg-gray-700 h-1.5 rounded-full"><div className="bg-accent h-1.5 rounded-full" style={{ width: `${Math.min(100, budgetStats.wantsP)}%` }} /></div>
                                 </div>
                                 <div>
                                     <div className="flex justify-between text-xs mb-1">
                                         <span className="text-gray-300">Savings (Target 20%)</span>
                                         <span className={budgetStats.savingsP < 20 ? 'text-yellow-400' : 'text-green-400'}>{Math.round(budgetStats.savingsP)}%</span>
                                     </div>
                                     <div className="w-full bg-gray-700 h-1.5 rounded-full"><div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, budgetStats.savingsP)}%` }} /></div>
                                 </div>
                             </div>
                         </Card>
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                        <div className="space-y-4">
                            {budgets.map(b => (
                                <Card key={b.id} className="p-5">
                                    <div className="flex justify-between mb-2 items-center">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-lg block">{b.name}</span><span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-white/10 text-gray-300">{b.type === 'Need' ? '🏠 Need' : b.type === 'Want' ? '🎉 Want' : '🌱 Saving'}</span>
                                            <div className="flex gap-1">
                                                <button onClick={() => { setEditingCat(b); setCatName(b.name); setCatAlloc(b.allocated.toString()); setCatType(b.type); setShowCatModal(true); }} className="p-1.5 text-gray-400 hover:text-white"><Pencil size={14} /></button>
                                                <button onClick={async () => { if(confirm('Delete?')) { await deleteBudget(b.id); reload(); }}} className="p-1.5 text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                        <div className="text-right"><span className="text-sm text-gray-400">₹{b.spent.toLocaleString()} / ₹{b.allocated.toLocaleString()}</span></div>
                                    </div>
                                    <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden"><div className={`h-3 rounded-full transition-all duration-700 ${b.spent > b.allocated ? 'bg-red-500' : 'bg-gradient-to-r from-violet-500 to-pink-500'}`} style={{ width: `${Math.min(100, (b.spent / (b.allocated || 1)) * 100)}%` }} /></div>
                                <p className="text-xs mt-2 font-semibold text-gray-400">{b.type === 'Saving' ? (b.spent >= b.allocated ? 'Goal hit 🎉' : `₹${Math.max(0, b.allocated - b.spent).toLocaleString()} to go`) : b.spent > b.allocated ? `Over by ₹${(b.spent - b.allocated).toLocaleString()} 😬` : b.spent / (b.allocated || 1) > 0.8 ? `Careful, ₹${(b.allocated - b.spent).toLocaleString()} left ⚠️` : `₹${(b.allocated - b.spent).toLocaleString()} left, you're good ✅`}</p>
                                </Card>
                            ))}
                        </div>

                        {/* Recent Expenses List */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-1">Latest spends</h3>
                            <div className="space-y-2">
                                {transactions
                                    .filter(t => t.type === TransactionType.EXPENSE)
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .slice(0, 15)
                                    .map(t => (
                                        <Card key={t.id} className="flex justify-between items-center p-3 sm:p-4 hover:bg-white/5 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl bg-white/5 ${
                                                    t.classification === 'Need' ? 'text-primary' : 
                                                    t.classification === 'Want' ? 'text-accent' : 
                                                    'text-emerald-500'
                                                }`}>
                                                    <ArrowDownCircle size={16} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm sm:text-base leading-tight">{t.description || t.category}</p>
                                                    <div className="flex gap-2 items-center mt-0.5">
                                                        <span className="text-[9px] uppercase font-black text-gray-500 tracking-tighter">{t.category}</span>
                                                        <span className="text-[9px] text-gray-600 px-1.5 py-0.5 bg-white/5 rounded border border-white/5 font-bold">{t.classification || 'Other'}</span>
                                                        <span className="text-[9px] text-gray-600 font-bold">{new Date(t.date).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-sm sm:text-base font-black text-white group-hover:text-red-400 transition-colors">₹{t.amount.toLocaleString()}</p>
                                        </Card>
                                    ))
                                }
                                {transactions.filter(t => t.type === TransactionType.EXPENSE).length === 0 && (
                                    <div className="text-center py-12 bg-white/5 border border-dashed border-white/10 rounded-xl">
                                        <p className="text-gray-500 text-sm italic">Nothing logged yet. Your wallet's chilling 😌</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {tab === 'income' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-emerald-900/10 border-emerald-500/20 p-6">
                            <h3 className="text-gray-400 text-sm mb-1">Money in 💰</h3>
                            <p className="text-3xl font-bold text-green-400">₹{totalIncomeMonth.toLocaleString()}</p>
                        </Card>
                        <Card className={`p-6 border-dashed ${leftToAssign > 0 ? 'bg-amber-950/10 border-amber-500/40' : 'bg-surface/30 border-white/10'}`}>
                            <h3 className="text-gray-400 text-sm mb-1">Not assigned yet</h3>
                            <p className={`text-3xl font-bold ${leftToAssign > 0 ? 'text-amber-400' : 'text-gray-500'}`}>₹{Math.max(0, leftToAssign).toLocaleString()}</p>
                            {leftToAssign > 0 && <p className="text-[10px] text-amber-500/70 mt-1 uppercase font-black">Give every rupee a job 👀</p>}
                        </Card>
                    </div>
                    <div className="space-y-3">
                        {incomeTransactions.map(t => (
                            <Card key={t.id} className="flex justify-between items-center p-4">
                                <div><p className="font-bold">{t.category}</p><p className="text-xs text-gray-500">{new Date(t.date).toLocaleDateString()}</p></div>
                                <p className="text-lg font-bold text-green-500">+₹{t.amount.toLocaleString()}</p>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Log it ✍️">
                <div className="space-y-4">
                    {/* Just say it 🎙️ Card */}
                    <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl flex flex-col items-center justify-center text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 blur-xl rounded-full" />
                        
                        {voiceLoading ? (
                            <div className="py-4 flex flex-col items-center justify-center space-y-2">
                                <Loader2 className="animate-spin text-indigo-400" size={32} />
                                <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider animate-pulse">Decoding what you said…</p>
                            </div>
                        ) : isListening ? (
                            <div className="py-3 flex flex-col items-center justify-center space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                    <p className="font-mono text-sm text-red-400 font-bold">
                                        Recording: {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:{(recordingDuration % 60).toString().padStart(2, '0')}
                                    </p>
                                </div>
                                <p className="text-xs text-gray-400 italic">"Spent 350 rupees on dinner today"</p>
                                <Button 
                                    onClick={stopRecording} 
                                    variant="outline" 
                                    className="px-6 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs py-2 uppercase font-black tracking-wider animate-pulse"
                                >
                                    Stop & Parse
                                </Button>
                            </div>
                        ) : (
                            <div className="py-2 flex flex-col items-center justify-center space-y-2 w-full">
                                <div className="flex items-center gap-2 text-indigo-400">
                                    <Mic size={18} />
                                    <span className="text-xs font-black uppercase tracking-wider">Voice Intelligent Input</span>
                                </div>
                                <p className="text-[10px] text-gray-500 max-w-xs leading-normal">
                                    Tap the mic and say what you spent. We'll fill in the rest.
                                </p>
                                <Button 
                                    onClick={startRecording} 
                                    variant="outline" 
                                    className="w-full mt-2 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 text-xs py-2.5 uppercase font-black tracking-widest flex items-center justify-center gap-2"
                                >
                                    <Mic size={14} /> Tap to talk
                                </Button>
                            </div>
                        )}
                    </div>

                    <Input label="Amount (₹)" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
                    <Input label="Merchant" value={merchant} onChange={e => setMerchant(e.target.value)} />
                    <Select label="Category" value={cat} onChange={e => setCat(e.target.value)}>
                        <option value="">Pick one</option>
                        {type === TransactionType.INCOME ? [ 'Salary', 'Bonus', 'Dividend', 'Rental Income', 'Interest', 'Other Income' ].map(c => <option key={c} value={c}>{c}</option>) : (
                             budgets.length > 0 
                                ? budgets.map(b => <option key={b.id} value={b.name}>{b.name}</option>) 
                                : ['Needs (Essentials)', 'Wants (Lifestyle)', 'Savings & Investments', 'Healthcare', 'Transport', 'Food', 'Rent', 'Other'].map(c => <option key={c} value={c}>{c}</option>)
                        )}
                    </Select>
                    {type === TransactionType.EXPENSE && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Need, want or saving?</label>
                            <div className="flex gap-2">
                                {(['Need', 'Want', 'Saving'] as const).map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setTxnClassification(c)}
                                        className={`flex-1 py-3 rounded-lg border-2 text-[10px] uppercase font-black transition-all ${
                                            txnClassification === c 
                                                ? c === 'Need' ? 'border-primary bg-primary/20 text-white' 
                                                : c === 'Want' ? 'border-accent bg-accent/20 text-white' 
                                                : 'border-emerald-500 bg-emerald-500/20 text-white'
                                                : 'border-white/5 bg-white/5 text-gray-500 hover:border-white/10'
                                        }`}
                                    >
                                        {c}s
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-500 italic">Helps us track your 50/30/20 split.</p>
                        </div>
                    )}
                    <Button className="w-full" onClick={handleAddTransaction}>Save it ✅</Button>
                </div>
            </Modal>

            <Modal isOpen={showCatModal} onClose={() => setShowCatModal(false)} title="New category 🏷️">
                <div className="space-y-4">
                    <Input label="Category Name" value={catName} onChange={e => setCatName(e.target.value)} />
                    <Input label="Monthly cap (₹)" type="number" value={catAlloc} onChange={e => setCatAlloc(e.target.value)} />
                    <Select label="Type" value={catType} onChange={e => setCatType(e.target.value as any)}>
                        <option value="Need">🏠 Needs (rent, bills, groceries)</option>
                        <option value="Want">🎉 Wants (the fun stuff)</option>
                        <option value="Saving">🌱 Savings & investments</option>
                    </Select>
                    <Button className="w-full" onClick={handleSaveCategory}>Save it ✅</Button>
                </div>
            </Modal>
        </div>
    );
};

export default BudgetPage;
