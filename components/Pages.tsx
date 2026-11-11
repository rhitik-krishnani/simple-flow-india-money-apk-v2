import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Trash2, Plus, Loader2, Landmark, Zap, Wallet, Calculator, Clock, Activity, TrendingUp, CheckCircle, 
    ShieldAlert, ShieldCheck, Heart, HeartPulse, Hospital, AlertCircle, FileText, Bot, Download, ArrowRight,
    Users, Briefcase, FileSearch, Sparkles, PieChart as PieChartIcon
} from 'lucide-react';
import { 
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Button, Card, Input, Modal, Select } from './ui';
import { 
    getLoans, deleteLoan, saveLoan, getTransactions, 
    getInsurance, saveInsurance, deleteInsurance, 
    getInvestments, getGlobalAnalytics, trackAppEvent 
} from '../services/dataService';
import {
    simulatePrepayment, sipFutureValue, stepUpSipFutureValue, lumpsumFutureValue, requiredMonthlySip, inflationImpact, fdMaturity,
    fireCorpusNeeded, swpSimulate, taxNewRegime, taxOldRegime, buyVsRent,
} from '../financeUtils';
import { Loan, Transaction, TransactionType, Insurance, Investment } from '../types';

// --- Loans Page ---
export const LoansPage: React.FC = () => {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [tab, setTab] = useState<'my-loans' | 'emi-calc' | 'prepayment' | 'strategy' | 'add-loan'>('my-loans');
    const [loading, setLoading] = useState(true);
    const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

    // Form states
    const [lName, setLName] = useState('');
    const [lPrin, setLPrin] = useState('');
    const [lRate, setLRate] = useState('');
    const [lTenure, setLTenure] = useState('');
    const [lMonthlyPP, setLMonthlyPP] = useState('');

    // EMI Calculator State
    const [calcPrincipal, setCalcPrincipal] = useState(1000000);
    const [calcRate, setCalcRate] = useState(9);
    const [calcTenure, setCalcTenure] = useState(5);

    // Prepayment Simulator State
    const [ppPrincipal, setPpPrincipal] = useState(2000000);
    const [ppRate, setPpRate] = useState(9);
    const [ppTenure, setPpTenure] = useState(20);
    const [ppAmount, setPpAmount] = useState(500000);
    const [ppMonthly, setPpMonthly] = useState(5000);
    const [ppCustomEMI, setPpCustomEMI] = useState<number | string>('');

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            setLoading(true);
            const [l, t] = await Promise.all([getLoans(), getTransactions()]);
            setLoans(l);
            setTransactions(t);
            if (l.length > 0 && !selectedLoanId) setSelectedLoanId(l[0].id);
        } catch (error) {
            console.error("Error loading loan data:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateEMI = (p: number, r: number, months: number) => {
        if (r === 0) return p / months;
        const monthlyRate = r / 12 / 100;
        return (p * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    };

    const getAmortizationSchedule = (p: number, r: number, months: number, extraMonthly: number = 0) => {
        const schedule = [];
        let balance = p;
        const monthlyRate = r / 12 / 100;
        const emi = calculateEMI(p, r, months);

        for (let i = 1; i <= months; i++) {
            const interest = r === 0 ? 0 : balance * monthlyRate;
            let principal = emi - interest;
            principal += extraMonthly;
            
            if (balance < principal) {
                principal = balance;
                balance = 0;
                schedule.push({ month: i, principal, interest, balance });
                break;
            }

            balance -= principal;
            schedule.push({ month: i, principal, interest, balance });
            if (balance <= 0) break;
        }
        return schedule;
    };

    const handleSave = async () => {
        const principal = parseFloat(lPrin);
        const rate = parseFloat(lRate) || 0;
        const tenure = parseInt(lTenure) || 12;
        const extra = parseFloat(lMonthlyPP) || 0;

        if (!lName || isNaN(principal)) return;

        setLoading(true);
        await saveLoan({
            name: lName, principal, outstanding: principal, interestRate: rate,
            tenureMonths: tenure, startDate: new Date().toISOString(), monthlyPrepayment: extra
        });
        await load();
        setShowModal(false);
        setLName(''); setLPrin(''); setLRate(''); setLTenure(''); setLMonthlyPP('');
        setTab('my-loans');
    };

    const sim = simulatePrepayment(ppPrincipal, ppRate, ppTenure, ppAmount, ppMonthly);
    const totalOutstanding = loans.reduce((sum, l) => sum + l.outstanding, 0);
    const selectedLoan = loans.find(l => l.id === selectedLoanId);
    const selectedAmortization = selectedLoan ? getAmortizationSchedule(selectedLoan.principal, selectedLoan.interestRate, selectedLoan.tenureMonths, selectedLoan.monthlyPrepayment) : [];

    if(loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center overflow-x-auto pb-2 gap-2 scrollbar-hide">
                <h2 className="text-2xl font-bold whitespace-nowrap mr-4">Debt Manager</h2>
                <div className="flex gap-2">
                    <Button onClick={() => setTab('my-loans')} variant={tab === 'my-loans' ? 'default' : 'outline'} className="whitespace-nowrap">My Loans</Button>
                    <Button onClick={() => setTab('emi-calc')} variant={tab === 'emi-calc' ? 'default' : 'outline'} className="whitespace-nowrap">EMI Calc</Button>
                    <Button onClick={() => setTab('prepayment')} variant={tab === 'prepayment' ? 'default' : 'outline'} className="whitespace-nowrap">Prepayment</Button>
                    <Button onClick={() => setTab('strategy')} variant={tab === 'strategy' ? 'default' : 'outline'} className="whitespace-nowrap">Strategy</Button>
                    <Button onClick={() => setTab('add-loan')} variant={tab === 'add-loan' ? 'default' : 'outline'} className="whitespace-nowrap">Add</Button>
                </div>
            </div>

            {tab === 'my-loans' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        {loans.map(l => (
                            <Card key={l.id} className={`p-6 cursor-pointer ${selectedLoanId === l.id ? 'border-primary' : ''}`} onClick={() => setSelectedLoanId(l.id)}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-bold">{l.name}</h3>
                                        <p className="text-sm text-gray-400">₹{l.principal.toLocaleString()} @ {l.interestRate}%</p>
                                    </div>
                                    <Button variant="ghost" onClick={() => deleteLoan(l.id).then(load)}><Trash2 size={16} /></Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                    <Card className="p-4">
                        <h3 className="font-bold mb-4">Amortization</h3>
                        <div className="max-h-96 overflow-y-auto text-xs">
                            {selectedAmortization.slice(0, 24).map(row => (
                                <div key={row.month} className="flex justify-between py-1 border-b border-white/5">
                                    <span>Month {row.month}</span>
                                    <span>₹{Math.round(row.balance).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            )}

            {tab === 'emi-calc' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-6 space-y-4">
                        <h3 className="text-xl font-bold">EMI Details</h3>
                        <Input label="Loan Amount (₹)" type="number" value={calcPrincipal} onChange={e => setCalcPrincipal(Number(e.target.value))} />
                        <Input label="Interest Rate (%)" type="number" value={calcRate} onChange={e => setCalcRate(Number(e.target.value))} />
                        <Input label="Tenure (Years)" type="number" value={calcTenure} onChange={e => setCalcTenure(Number(e.target.value))} />
                        <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-center">
                            <p className="text-gray-400 text-xs uppercase font-black">Monthly EMI</p>
                            <p className="text-3xl font-black text-white">₹{Math.round(calculateEMI(calcPrincipal, calcRate, calcTenure * 12)).toLocaleString()}</p>
                            <p className="text-[10px] text-indigo-400 mt-2 font-bold uppercase">Total Interest: ₹{Math.round((calculateEMI(calcPrincipal, calcRate, calcTenure * 12) * calcTenure * 12) - calcPrincipal).toLocaleString()}</p>
                        </div>
                    </Card>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Principal', value: calcPrincipal },
                                        { name: 'Interest', value: (calculateEMI(calcPrincipal, calcRate, calcTenure * 12) * calcTenure * 12) - calcPrincipal }
                                    ]}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="#6366f1" />
                                    <Cell fill="#f43f5e" />
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {tab === 'prepayment' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-6 space-y-4">
                        <h3 className="text-xl font-bold">Prepayment Simulator</h3>
                        <Input label="Current Balance (₹)" type="number" value={ppPrincipal} onChange={e => setPpPrincipal(Number(e.target.value))} />
                        <Input label="Interest Rate (%)" type="number" value={ppRate} onChange={e => setPpRate(Number(e.target.value))} />
                        <Input label="Remaining Tenure (years)" type="number" value={ppTenure} onChange={e => setPpTenure(Number(e.target.value))} />
                        <Input label="One-time Prepayment (₹)" type="number" value={ppAmount} onChange={e => setPpAmount(Number(e.target.value))} />
                        <Input label="Extra Monthly (₹)" type="number" value={ppMonthly} onChange={e => setPpMonthly(Number(e.target.value))} />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                                <p className="text-[10px] text-gray-500 uppercase font-black">Months Saved</p>
                                <p className="text-lg font-black text-emerald-400">
                                    {sim.monthsSaved} <span className="text-xs font-bold text-gray-400">({(sim.monthsSaved / 12).toFixed(1)} yrs)</span>
                                </p>
                            </div>
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                                <p className="text-[10px] text-gray-500 uppercase font-black">Interest Saved</p>
                                <p className="text-lg font-black text-indigo-400">
                                    ₹{Math.round(sim.interestSaved).toLocaleString('en-IN')}
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">Your EMI stays ₹{Math.round(sim.emi).toLocaleString('en-IN')}. The lump sum is paid today and the loan ends sooner. Assumes no prepayment penalty (usually none on floating-rate loans; fixed-rate loans may charge 2-5%).</p>
                    </Card>
                    <Card className="p-6">
                        <h3 className="font-bold mb-4">Payoff Comparison</h3>
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { name: 'Original', months: sim.original.months },
                                    { name: 'With Prepay', months: sim.withPrepay.months }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                                    <YAxis stroke="#94a3b8" fontSize={10} />
                                    <Tooltip />
                                    <Bar dataKey="months" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            )}

            {tab === 'strategy' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-6 bg-gradient-to-br from-indigo-900/20 to-transparent border-indigo-500/20">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-indigo-400">
                                <Zap size={20} /> Debt Avalanche
                            </h3>
                            <p className="text-sm text-gray-400 mb-4">Focus on the loan with the highest interest rate first. This mathematically saves the most money in the long run.</p>
                            <div className="space-y-2">
                                {loans.sort((a, b) => b.interestRate - a.interestRate).map((l, i) => (
                                    <div key={l.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">{i+1}</span>
                                            <span className="font-bold">{l.name}</span>
                                        </div>
                                        <span className="text-xs text-indigo-400 font-black">{l.interestRate}%</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                        <Card className="p-6 bg-gradient-to-br from-emerald-900/20 to-transparent border-emerald-500/20">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-400">
                                <Sparkles size={20} /> Debt Snowball
                            </h3>
                            <p className="text-sm text-gray-400 mb-4">Focus on the smallest balance first. This creates psychological momentum through quick wins.</p>
                            <div className="space-y-2">
                                {loans.sort((a, b) => a.outstanding - b.outstanding).map((l, i) => (
                                    <div key={l.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">{i+1}</span>
                                            <span className="font-bold">{l.name}</span>
                                        </div>
                                        <span className="text-xs text-emerald-400 font-black">₹{l.outstanding.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {tab === 'add-loan' && (
                <Card className="max-w-md mx-auto p-6 space-y-4">
                    <h3 className="text-xl font-bold">New Loan</h3>
                    <Input label="Name" value={lName} onChange={e => setLName(e.target.value)} />
                    <Input label="Principal" type="number" value={lPrin} onChange={e => setLPrin(e.target.value)} />
                    <Input label="Rate %" type="number" value={lRate} onChange={e => setLRate(e.target.value)} />
                    <Input label="Tenure (Months)" type="number" value={lTenure} onChange={e => setLTenure(e.target.value)} />
                    <Button className="w-full" onClick={handleSave}>Add Loan</Button>
                </Card>
            )}
        </div>
    );
};

// --- Insurance Page ---
export const InsurancePage: React.FC = () => {
    const [insurance, setInsurance] = useState<Insurance[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [tab, setTab] = useState<'my-policies' | 'hlv-calc'>('my-policies');

    // HLV State with Needs-Based parameters
    const [currentAge, setCurrentAge] = useState(30);
    const [annualIncome, setAnnualIncome] = useState(1200000);
    const [personalExpense, setPersonalExpense] = useState(300000);
    const [liquidSavings, setLiquidSavings] = useState(1000000);
    const [childMilestoneToday, setChildMilestoneToday] = useState(1500000);
    const [yearsToMilestone, setYearsToMilestone] = useState(12);
    const [spouseAge, setSpouseAge] = useState(28);
    const [retirementFactor, setRetirementFactor] = useState(25); // post-60 retirement factor (20x - 25x)
    const [nominalReturn, setNominalReturn] = useState(8); // 8% per annum nominal return
    const [expenseInflation, setExpenseInflation] = useState(6); // 6% per annum household inflation
    const [eduInflation, setEduInflation] = useState(10); // 10% per annum education inflation

    // Derived HLV values
    const workingYears = Math.max(0, 60 - currentAge);
    const familySupportExpenseToday = Math.max(0, annualIncome - personalExpense);
    const inflatedFamilySupportExpenseAt60 = familySupportExpenseToday * Math.pow(1 + expenseInflation / 100, workingYears);
    
    // Net discount rate based on Fisher equation: (1 + nominal) / (1 + inflation) - 1
    const r_real = useMemo(() => {
        const i = expenseInflation / 100;
        const n = nominalReturn / 100;
        return (1 + n) / (1 + i) - 1;
    }, [nominalReturn, expenseInflation]);

    // Phase 1: Active Income Replacement
    const phase1 = useMemo(() => {
        if (workingYears <= 0) return 0;
        // r_real can be zero or negative (inflation >= return). The annuity formula still holds for r < 0; r == 0 is the plain sum.
        if (Math.abs(r_real) < 1e-9) return familySupportExpenseToday * workingYears;
        return familySupportExpenseToday * (1 - Math.pow(1 + r_real, -workingYears)) / r_real;
    }, [familySupportExpenseToday, workingYears, r_real]);

    // Phase 2: Spouse FIRE Corpus (Post-60 Lifetime Provision)
    const phase2 = useMemo(() => {
        if (workingYears < 0) return 0;
        const spouseNestEggAt60 = inflatedFamilySupportExpenseAt60 * retirementFactor;
        return spouseNestEggAt60 / Math.pow(1 + nominalReturn / 100, workingYears);
    }, [inflatedFamilySupportExpenseAt60, workingYears, retirementFactor, nominalReturn]);

    // Phase 3: Milestones (Child Education)
    const phase3 = useMemo(() => {
        if (yearsToMilestone <= 0) return 0;
        const inflatedCost = childMilestoneToday * Math.pow(1 + eduInflation / 100, yearsToMilestone);
        return inflatedCost / Math.pow(1 + nominalReturn / 100, yearsToMilestone);
    }, [childMilestoneToday, yearsToMilestone, eduInflation, nominalReturn]);

    const totalCoverNeeded = phase1 + phase2 + phase3;
    const recommendedCover = Math.max(0, totalCoverNeeded - liquidSavings);

    useEffect(() => { load(); }, []);
    const load = async () => {
        try {
            setLoading(true);
            const data = await getInsurance();
            setInsurance(data);
        } finally {
            setLoading(false);
        }
    };

    if(loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center overflow-x-auto pb-2 gap-2 scrollbar-hide">
                <h2 className="text-2xl font-bold whitespace-nowrap mr-4">Insurance</h2>
                <div className="flex gap-2">
                    <Button onClick={() => setTab('my-policies')} variant={tab === 'my-policies' ? 'default' : 'outline'} className="whitespace-nowrap">My Policies</Button>
                    <Button onClick={() => setTab('hlv-calc')} variant={tab === 'hlv-calc' ? 'default' : 'outline'} className="whitespace-nowrap">HLV Calc</Button>
                    <Button onClick={() => setShowModal(true)} variant="outline" className="whitespace-nowrap"><Plus size={16} /> Add Policy</Button>
                </div>
            </div>

            {tab === 'my-policies' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {insurance.map(policy => (
                        <Card key={policy.id} className="p-6">
                            <h3 className="text-lg font-bold">{policy.name}</h3>
                            <p className="text-sm text-gray-400">{policy.type}</p>
                            <div className="mt-4 flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Sum Insured</p>
                                    <p className="text-xl font-bold">₹{(policy.sumInsured ?? 0).toLocaleString()}</p>
                                </div>
                                <Button variant="ghost" className="text-red-400" onClick={() => deleteInsurance(policy.id).then(load)}><Trash2 size={16} /></Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {tab === 'hlv-calc' && (
                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Input Panel */}
                    <div className="lg:col-span-5 space-y-6">
                        <Card className="p-6 space-y-5 border-white/5 bg-surface/40 backdrop-blur">
                            <div>
                                <h3 className="text-base font-black uppercase tracking-wider text-white">Needs-Based HLV Profiler</h3>
                                <p className="text-[10px] text-gray-400 mt-1">Provide your details to calculate your True Human Life Value (HLV) insurance cover using Indian common man baselines.</p>
                            </div>

                            <hr className="border-white/5" />

                            {/* Current Age */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Your Current Age</label>
                                    <span className="text-xs font-black text-indigo-400">{currentAge} Years Old</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="range" 
                                        min={18} 
                                        max={59} 
                                        value={currentAge} 
                                        onChange={e => {
                                            const val = Number(e.target.value);
                                            setCurrentAge(val);
                                        }}
                                        className="w-full accent-indigo-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <input 
                                        type="number" 
                                        value={currentAge} 
                                        onChange={e => setCurrentAge(Math.min(59, Math.max(18, Number(e.target.value))))}
                                        className="w-20 text-right bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                                    />
                                </div>
                                <p className="text-[9px] text-gray-500">Calculates an active income phase up to retirement age 60.</p>
                            </div>

                            {/* Spouse Age */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Spouse Age</label>
                                    <span className="text-xs font-black text-indigo-400">{spouseAge} Years Old</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="range" 
                                        min={18} 
                                        max={60} 
                                        value={spouseAge} 
                                        onChange={e => setSpouseAge(Number(e.target.value))}
                                        className="w-full accent-indigo-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <input 
                                        type="number" 
                                        value={spouseAge} 
                                        onChange={e => setSpouseAge(Math.min(60, Math.max(18, Number(e.target.value))))}
                                        className="w-20 text-right bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                                    />
                                </div>
                            </div>

                            {/* Annual Income */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Gross Annual Income</label>
                                    <span className="text-xs font-black text-indigo-400">₹{(annualIncome / 100000).toFixed(1)} Lakhs</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="range" 
                                        min={100000} 
                                        max={10000000} 
                                        step={50000}
                                        value={annualIncome} 
                                        onChange={e => setAnnualIncome(Number(e.target.value))}
                                        className="w-full accent-indigo-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <input 
                                        type="number" 
                                        value={annualIncome} 
                                        onChange={e => setAnnualIncome(Math.max(0, Number(e.target.value)))}
                                        className="w-24 text-right bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                                    />
                                </div>
                            </div>

                            {/* Personal Expenses */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">User's Personal Expenses (Annual)</label>
                                    <span className="text-xs font-black text-indigo-400">₹{(personalExpense / 100000).toFixed(1)} Lakhs</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="range" 
                                        min={50000} 
                                        max={Math.min(annualIncome, 5000000)} 
                                        step={10000}
                                        value={personalExpense} 
                                        onChange={e => setPersonalExpense(Number(e.target.value))}
                                        className="w-full accent-indigo-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <input 
                                        type="number" 
                                        value={personalExpense} 
                                        onChange={e => setPersonalExpense(Math.max(0, Number(e.target.value)))}
                                        className="w-24 text-right bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                                    />
                                </div>
                                <p className="text-[9px] text-gray-500">Calculates net family support: ₹{((annualIncome - personalExpense) / 100000).toFixed(2)} Lakhs/year.</p>
                            </div>

                            {/* Liquid Savings */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Current Liquid Savings / Investments</label>
                                    <span className="text-xs font-black text-emerald-400">₹{(liquidSavings / 100000).toFixed(1)} Lakhs</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="range" 
                                        min={0} 
                                        max={30000000} 
                                        step={50000}
                                        value={liquidSavings} 
                                        onChange={e => setLiquidSavings(Number(e.target.value))}
                                        className="w-full accent-emerald-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <input 
                                        type="number" 
                                        value={liquidSavings} 
                                        onChange={e => setLiquidSavings(Math.max(0, Number(e.target.value)))}
                                        className="w-24 text-right bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                                    />
                                </div>
                                <p className="text-[9px] text-gray-500">Subtracts existing assets to avoid over-insuring.</p>
                            </div>

                            <hr className="border-white/5" />

                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">Phase 3: Milestones (Higher Education)</h4>
                            </div>

                            {/* Milestone amount */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Education Cost Today (₹)</label>
                                    <span className="text-xs font-black text-indigo-400">₹{(childMilestoneToday / 100000).toFixed(1)} Lakhs</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="range" 
                                        min={0} 
                                        max={10000000} 
                                        step={50000}
                                        value={childMilestoneToday} 
                                        onChange={e => setChildMilestoneToday(Number(e.target.value))}
                                        className="w-full accent-indigo-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <input 
                                        type="number" 
                                        value={childMilestoneToday} 
                                        onChange={e => setChildMilestoneToday(Math.max(0, Number(e.target.value)))}
                                        className="w-24 text-right bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                                    />
                                </div>
                            </div>

                            {/* Years to milestone */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Years to Higher Education</label>
                                    <span className="text-xs font-black text-indigo-400">{yearsToMilestone} Years</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="range" 
                                        min={1} 
                                        max={25} 
                                        value={yearsToMilestone} 
                                        onChange={e => setYearsToMilestone(Number(e.target.value))}
                                        className="w-full accent-indigo-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <input 
                                        type="number" 
                                        value={yearsToMilestone} 
                                        onChange={e => setYearsToMilestone(Math.min(25, Math.max(1, Number(e.target.value))))}
                                        className="w-16 text-center bg-black/40 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                                    />
                                </div>
                                <p className="text-[9px] text-gray-500">Compounded at 10% educational inflation baseline.</p>
                            </div>
                        </Card>

                        {/* Advanced Assumptions Panel */}
                        <Card className="p-4 border-white/5 bg-surface/20 space-y-3">
                            <details className="group">
                                <summary className="flex justify-between items-center cursor-pointer list-none">
                                    <span className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5 hover:text-white transition-colors">
                                        <Bot size={14} className="text-indigo-400" /> Advanced Assumptions
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase transition-transform group-open:rotate-180">▼</span>
                                </summary>
                                <div className="mt-4 space-y-4 pt-2 border-t border-white/5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 font-bold uppercase">Household Inflation</label>
                                            <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
                                                <input 
                                                    type="number" 
                                                    step={0.5}
                                                    value={expenseInflation} 
                                                    onChange={e => setExpenseInflation(Number(e.target.value))}
                                                    className="w-full bg-transparent text-xs text-white font-black text-right outline-none"
                                                />
                                                <span className="text-[9px] text-gray-500">%</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 font-bold uppercase">Education Inflation</label>
                                            <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
                                                <input 
                                                    type="number" 
                                                    step={0.5}
                                                    value={eduInflation} 
                                                    onChange={e => setEduInflation(Number(e.target.value))}
                                                    className="w-full bg-transparent text-xs text-white font-black text-right outline-none"
                                                />
                                                <span className="text-[9px] text-gray-500">%</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 font-bold uppercase">Safe Payout Return</label>
                                            <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
                                                <input 
                                                    type="number" 
                                                    step={0.5}
                                                    value={nominalReturn} 
                                                    onChange={e => setNominalReturn(Number(e.target.value))}
                                                    className="w-full bg-transparent text-xs text-white font-black text-right outline-none"
                                                />
                                                <span className="text-[9px] text-gray-500">%</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 font-bold uppercase">Retirement Factor</label>
                                            <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
                                                <input 
                                                    type="number" 
                                                    value={retirementFactor} 
                                                    onChange={e => setRetirementFactor(Number(e.target.value))}
                                                    className="w-full bg-transparent text-xs text-white font-black text-right outline-none"
                                                />
                                                <span className="text-[9px] text-gray-500">x</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-black/20 p-2.5 rounded-lg border border-white/5">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-gray-400">Net Fisher Discount Rate (Real Return):</span>
                                            <span className="font-black text-indigo-400">{(r_real * 100).toFixed(3)}%</span>
                                        </div>
                                        <p className="text-[9px] text-gray-500 mt-1 leading-normal">
                                            Derived as ((1 + nominal {nominalReturn}%) / (1 + household inflation {expenseInflation}%)) - 1. This handles the inflating annuity math transparently.
                                        </p>
                                    </div>
                                </div>
                            </details>
                        </Card>
                    </div>

                    {/* Right Column: Breakdown & Recommendation Panel */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* Summary Recommendation Cover */}
                        <Card className="p-6 relative overflow-hidden border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                        <HeartPulse size={16} /> True HLV Recommendation
                                    </div>
                                    <h2 className="text-3xl font-black text-white">{recommendedCover >= 10000000 ? `${(recommendedCover/10000000).toFixed(2)} Crore` : `${Math.round(recommendedCover/100000).toLocaleString()} Lakhs`}</h2>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Exact value: ₹{Math.round(recommendedCover).toLocaleString()}</p>
                                </div>
                                <div className="bg-indigo-500/20 px-4 py-2 rounded-xl border border-indigo-500/30 text-center">
                                    <p className="text-[9px] text-indigo-300 font-bold uppercase tracking-wider">Total Needs-Based Pool</p>
                                    <p className="text-lg font-black text-indigo-100">{totalCoverNeeded >= 10000000 ? `${(totalCoverNeeded/10000000).toFixed(2)} Cr` : `${Math.round(totalCoverNeeded/100000)} Lakh`}</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-300 mt-4 leading-relaxed">
                                This needs-based calculation bypasses traditional "15x income" rules. It represents the exact Term Cover needed to fully fund your active years, secure your spouse's lifelong retirement, and bulletproof child milestones.
                            </p>
                        </Card>

                        {/* Detailed 3-Phase Breakdown */}
                        <Card className="p-6 space-y-6 border-white/5 bg-surface/30">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Comprehensive Needs Breakdown</h4>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Where every rupee of coverage is budgeted</p>
                            </div>

                            <div className="space-y-4">
                                {/* Phase 1 Section */}
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-indigo-500/20">
                                    <div className="space-y-1 max-w-sm">
                                        <div className="flex items-center gap-2 text-[11px] font-black uppercase text-indigo-400 tracking-wider">
                                            <Activity size={14} /> Phase 1: Active Family Support
                                        </div>
                                        <p className="text-xs text-gray-300">
                                            Replaces the net annual family support amount (₹{((annualIncome - personalExpense)/100000).toFixed(2)} Lakhs) for the next {workingYears} working years, adjusted for inflation at {(r_real*100).toFixed(2)}% real rate.
                                        </p>
                                    </div>
                                    <div className="text-right whitespace-nowrap">
                                        <p className="text-base font-black text-white">{phase1 >= 10000000 ? `${(phase1/10000000).toFixed(2)} Cr` : `${Math.round(phase1/100000).toLocaleString()} Lakhs`}</p>
                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Present Value</span>
                                    </div>
                                </div>

                                {/* Phase 2 Section */}
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-indigo-500/20">
                                    <div className="space-y-1 max-w-sm">
                                        <div className="flex items-center gap-2 text-[11px] font-black uppercase text-purple-400 tracking-wider">
                                            <Sparkles size={14} /> Phase 2: Spouse FIRE Corpus
                                        </div>
                                        <p className="text-xs text-gray-300">
                                            Guarantees a lifelong retirement corpus for your spouse post age 60. Family support is inflated at {expenseInflation}% to age 60 (to ₹{(inflatedFamilySupportExpenseAt60/100000).toFixed(2)} Lakhs/year) and capitalized at {retirementFactor}x, then discounted to today's value.
                                        </p>
                                    </div>
                                    <div className="text-right whitespace-nowrap">
                                        <p className="text-base font-black text-white">{phase2 >= 10000000 ? `${(phase2/10000000).toFixed(2)} Cr` : `${Math.round(phase2/100000).toLocaleString()} Lakhs`}</p>
                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Present Value</span>
                                    </div>
                                </div>

                                {/* Phase 3 Section */}
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-indigo-500/20">
                                    <div className="space-y-1 max-w-sm">
                                        <div className="flex items-center gap-2 text-[11px] font-black uppercase text-amber-400 tracking-wider">
                                            <Users size={14} /> Phase 3: Children Milestones
                                        </div>
                                        <p className="text-xs text-gray-300">
                                            Higher education goal today (₹{(childMilestoneToday/100000).toFixed(2)} Lakhs) projected over {yearsToMilestone} years at {eduInflation}% education inflation, then discounted to today's value at {nominalReturn}% return.
                                        </p>
                                    </div>
                                    <div className="text-right whitespace-nowrap">
                                        <p className="text-base font-black text-white">{phase3 >= 10000000 ? `${(phase3/10000000).toFixed(2)} Cr` : `${Math.round(phase3/100000).toLocaleString()} Lakhs`}</p>
                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Present Value</span>
                                    </div>
                                </div>

                                {/* Deduction Section */}
                                <div className="p-4 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="space-y-1 max-w-sm">
                                        <div className="flex items-center gap-2 text-[11px] font-black uppercase text-emerald-400 tracking-wider">
                                            <CheckCircle size={14} /> Savings & Investment Deductions
                                        </div>
                                        <p className="text-xs text-gray-300">
                                            Your existing net liquid assets, mutual funds, FDs, and savings. These act as self-insurance, reducing the total term cover you need to buy.
                                        </p>
                                    </div>
                                    <div className="text-right whitespace-nowrap">
                                        <p className="text-base font-black text-emerald-400">- {liquidSavings >= 10000000 ? `${(liquidSavings/10000000).toFixed(2)} Cr` : `${Math.round(liquidSavings/100000).toLocaleString()} Lakhs`}</p>
                                        <span className="text-[10px] text-emerald-500 font-bold uppercase">Deduction</span>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Traditional Rule Contrast & Decreasing Responsibility */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="p-5 border-white/5 bg-rose-500/[0.01]">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-rose-400 flex items-center gap-1.5 mb-2">
                                    ⚠️ Why Rule-Of-Thumb Fails
                                </h5>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Standard calculators simply multiply your income by 15x. For you, that is ₹{((annualIncome * 15)/10000000).toFixed(2)} Cr. This fails because it assumes you die immediately and doesn't account for compounding spouse expenses or skyrocketing child milestones. True HLV calculates real needs.
                                </p>
                            </Card>

                            <Card className="p-5 border-white/5 bg-emerald-500/[0.01]">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 mb-2">
                                    🛡️ Decreasing Responsibility
                                </h5>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Term insurance is a safety net, not a wealth creator. As your personal investments, equity portfolios, and liquid assets grow over the years, your insurance need will naturally decrease. By age 55 or 60, you will be fully self-insured!
                                </p>
                            </Card>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Calculators Page ---
const RATE_PRESETS = [
    { name: '💰 FD (7.1%)', rate: 7.1 },
    { name: '🏦 PPF/Debt (8.5%)', rate: 8.5 },
    { name: '📈 Index (12%)', rate: 12.0 },
    { name: '🚀 Midcap (15%)', rate: 15.0 },
];

const TENURE_PRESETS = [
    { name: '⏳ Short (3y)', years: 3 },
    { name: '⏳ Mid (7y)', years: 7 },
    { name: '⏳ Long (15y)', years: 15 },
    { name: '⏳ Wealth (25y)', years: 25 },
];

const getRateGauge = (r: number) => {
    if (r <= 7.5) {
        return { text: 'Low Risk: Ideal for FDs, Liquid & Debt Funds', color: 'text-green-400 bg-green-500/10 border-green-500/20' };
    } else if (r <= 11) {
        return { text: 'Moderate Risk: Fits Gold & hybrid instruments', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' };
    } else if (r <= 14.5) {
        return { text: 'Optimal Growth: Recommended Largecap & Index Funds', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
    } else {
        return { text: 'Aggressive Capital: Suited for Midcap, Smallcap or Direct Equity', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
    }
};

interface InteractiveSliderInputProps {
    label: string;
    value: number;
    onChange: (val: number) => void;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
}

const InteractiveSliderInput: React.FC<InteractiveSliderInputProps> = ({
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    suffix = ''
}) => {
    const displayVal = isNaN(value) ? min : value;
    return (
        <div className="space-y-2 p-3.5 bg-white/[0.02] border border-white/5 rounded-xl transition-all duration-300 hover:border-indigo-500/20">
            <div className="flex justify-between items-center">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{label}</label>
                <div className="flex items-center gap-1 bg-black/40 border border-border rounded-lg px-2 py-1 max-w-[150px] transition-all focus-within:border-indigo-500/50">
                    <input 
                        type="number" 
                        value={isNaN(value) ? '' : value} 
                        onChange={e => onChange(Number(e.target.value))}
                        min={min}
                        max={max}
                        step={step}
                        className="w-full text-right bg-transparent text-sm font-black text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {suffix && <span className="text-[10px] text-gray-500 font-black uppercase">{suffix}</span>}
                </div>
            </div>
            <div className="flex items-center gap-4 relative pt-1">
                <input 
                    type="range" 
                    min={min} 
                    max={max} 
                    step={step} 
                    value={displayVal} 
                    onChange={e => onChange(Number(e.target.value))}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 focus:outline-none focus:ring-0"
                    style={{
                        background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${Math.min(100, Math.max(0, ((displayVal - min) / (max - min)) * 100)) || 0}%, #1f2937 ${Math.min(100, Math.max(0, ((displayVal - min) / (max - min)) * 100)) || 0}%, #1f2937 100%)`
                    }}
                />
            </div>
            <div className="flex justify-between text-[8px] text-gray-500 font-black uppercase tracking-wider">
                <span>{min.toLocaleString()}{suffix}</span>
                <span>{max.toLocaleString()}{suffix}</span>
            </div>
        </div>
    );
};

const MoneyRatioBar: React.FC<{ invested: number; gains: number }> = ({ invested, gains }) => {
    const total = invested + gains;
    const investedPercent = total > 0 ? (invested / total) * 100 : 50;
    const gainsPercent = total > 0 ? (gains / total) * 100 : 50;
    
    return (
        <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-[9px] uppercase font-black text-gray-500 tracking-wider">
                <span>Total Invested ({investedPercent.toFixed(0)}%)</span>
                <span>Wealth Gained ({gainsPercent.toFixed(0)}%)</span>
            </div>
            <div className="w-full h-2 bg-gray-800/80 rounded-full overflow-hidden flex border border-white/5 relative p-0">
                <div 
                    className="h-full bg-gradient-to-r from-indigo-600 to-indigo-500 transition-all duration-500" 
                    style={{ width: `${investedPercent}%` }}
                />
                <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" 
                    style={{ width: `${gainsPercent}%` }}
                />
            </div>
            <div className="flex justify-between text-[11px] font-black uppercase tracking-wider">
                <span className="text-indigo-400">₹{Math.round(invested).toLocaleString()}</span>
                <span className="text-emerald-400">₹{Math.round(gains).toLocaleString()}</span>
            </div>
        </div>
    );
};

export const CalculatorsPage: React.FC = () => {
    const [tab, setTab] = useState<'sip' | 'lumpsum' | 'hybrid' | 'inflation' | 'fire' | 'retirement' | 'luxury' | 'swp' | 'fd' | 'goal' | 'home' | 'stepup' | 'tax'>('sip');
    
    useEffect(() => {
        trackAppEvent(`view_calculator_${tab}`);
    }, [tab]);

    const [amount, setAmount] = useState(10000);
    const [rate, setRate] = useState(12);
    const [years, setYears] = useState(10);
    const [stepUp, setStepUp] = useState(10);

    // Personal Indian Tax state (FY 2026-27 / AY 2027-28; slabs unchanged since Budget 2025)
    const [taxGrossSalary, setTaxGrossSalary] = useState(1200000); // ₹12L default
    const [tax80C, setTax80C] = useState(150000);   // Max 1.5L
    const [tax80D, setTax80D] = useState(25000);    // Max 25k 
    const [tax80CCD, setTax80CCD] = useState(0);    // NPS Extra 50k
    const [taxHraHomeLoan, setTaxHraHomeLoan] = useState(150000); // HRA & Home loan Combined

    const calcNewRegimeTax = (gross: number) => taxNewRegime(gross);
    const calcOldRegimeTax = (gross: number, deductionsCombined: number) => taxOldRegime(gross, deductionsCombined);

    const deductionsSum = Math.min(150000, tax80C) + Math.min(25000, tax80D) + Math.min(50000, tax80CCD) + taxHraHomeLoan;
    const newTaxDetails = calcNewRegimeTax(taxGrossSalary);
    const oldTaxDetails = calcOldRegimeTax(taxGrossSalary, deductionsSum);
    
    // SIP
    const sipMaturity = sipFutureValue(amount, rate, years);
    
    // Step-up SIP
    const stepUpResult = stepUpSipFutureValue(amount, rate, years, stepUp);
    const stepUpMaturity = stepUpResult.maturity;

    // Lumpsum
    const lumpsumMaturity = lumpsumFutureValue(amount, rate, years);

    // Hybrid (SIP + Lumpsum)
    const [hSip, setHSip] = useState(10000);
    const [hLumpsum, setHLumpsum] = useState(100000);
    const [hRate, setHRate] = useState(12);
    const [hYears, setHYears] = useState(10);
    const hybridMaturity = lumpsumFutureValue(hLumpsum, hRate, hYears) + sipFutureValue(hSip, hRate, hYears);

    // Goal-Based SIP
    const [targetGoal, setTargetGoal] = useState(5000000);
    const [goalYears, setGoalYears] = useState(15);
    const [goalRate, setGoalRate] = useState(12);
    const requiredSIP = requiredMonthlySip(targetGoal, goalRate, goalYears);

    // Buy vs Rent
    const [propertyValue, setPropertyValue] = useState(10000000);
    const [monthlyRent, setMonthlyRent] = useState(30000);
    const [appreciation, setAppreciation] = useState(5);
    const [rentEscalation, setRentEscalation] = useState(5);
    const [loanRate, setLoanRate] = useState(9);
    const [comparisonYears, setComparisonYears] = useState(10);

    const [investReturn, setInvestReturn] = useState(10);
    const bvrInput = { propertyValue, monthlyRent, appreciationPct: appreciation, rentEscalationPct: rentEscalation, loanRatePct: loanRate, investReturnPct: investReturn };
    const bvr = buyVsRent({ ...bvrInput, years: comparisonYears });

    // Inflation
    const [infAmount, setInfAmount] = useState(50000);
    const [infRate, setInfRate] = useState(6);
    const [infYears, setInfYears] = useState(10);
    const { purchasingPower, futureCost } = inflationImpact(infAmount, infRate, infYears);

    // FIRE (Financial Independence, Retire Early)
    const [monthlyExp, setMonthlyExp] = useState(50000);
    const [currentAge, setCurrentAge] = useState(25);
    const [retireAge, setRetireAge] = useState(45);
    const [lifeExp, setLifeExp] = useState(85);
    const [fireInflation, setFireInflation] = useState(6);
    const [fireReturns, setFireReturns] = useState(10);
    const [postRetireReturns, setPostRetireReturns] = useState(8);
    const [fireType, setFireType] = useState<'lean' | 'normal' | 'chubby' | 'fat'>('normal');

    const getAdjustedExp = (type: string, exp: number) => {
        if (type === 'lean') return exp * 0.7;
        if (type === 'chubby') return exp * 1.5;
        if (type === 'fat') return exp * 3.0;
        return exp;
    };

    const currentMonthlyExpLine = getAdjustedExp(fireType, monthlyExp);
    const yearsToRetire = retireAge - currentAge;
    const yearsInRetirement = lifeExp - retireAge;
    const { expAtRetirement, corpus: fireCorpus } = fireCorpusNeeded({ monthlyExpenseToday: currentMonthlyExpLine, yearsToRetire, yearsInRetirement, inflationPct: fireInflation, postRetireReturnPct: postRetireReturns });

    // Luxury Delay Calculator
    const [luxuryCost, setLuxuryCost] = useState(100000);
    const [delayMonths, setDelayMonths] = useState(12);
    const luxuryGain = luxuryCost * Math.pow(1 + 12/100, delayMonths/12);

    // SWP
    const [swpPrincipal, setSwpPrincipal] = useState(1000000);
    const [swpWithdrawal, setSwpWithdrawal] = useState(10000);
    const [swpRate, setSwpRate] = useState(8);
    const [swpYears, setSwpYears] = useState(10);

    const swpSummary = useMemo(() => swpSimulate(swpPrincipal, swpWithdrawal, swpRate, swpYears), [swpPrincipal, swpWithdrawal, swpRate, swpYears]);

    // Chart data per tab. Each tab uses ITS OWN tenure (several tabs previously used the SIP tenure by mistake).
    const getChartData = (): any[] => {
        if (tab === 'swp') return swpSummary.series;
        if (tab === 'luxury') {
            return Array.from({ length: 12 }).map((_, i) => {
                const m = Math.max(1, Math.round(delayMonths * (i + 1) / 12));
                return { year: m, value: Math.round(luxuryCost * Math.pow(1 + 12 / 100, m / 12)) };
            });
        }
        const n = tab === 'fire' || tab === 'retirement' ? yearsToRetire : tab === 'goal' ? goalYears : tab === 'hybrid' ? hYears : tab === 'inflation' ? infYears : tab === 'home' ? comparisonYears : years;
        return Array.from({ length: Math.max(1, Math.round(n || 12)) }).map((_, year0) => {
            const year = year0 + 1;
            let value = 0;
            if (tab === 'sip') value = sipFutureValue(amount, rate, year);
            else if (tab === 'stepup') value = stepUpSipFutureValue(amount, rate, year, stepUp).maturity;
            else if (tab === 'lumpsum') value = lumpsumFutureValue(amount, rate, year);
            else if (tab === 'hybrid') value = lumpsumFutureValue(hLumpsum, hRate, year) + sipFutureValue(hSip, hRate, year);
            else if (tab === 'goal') value = sipFutureValue(requiredSIP, goalRate, year);
            else if (tab === 'inflation') value = infAmount * Math.pow(1 + infRate / 100, year);
            else if (tab === 'home') value = buyVsRent({ ...bvrInput, years: year }).advantage;
            else if (tab === 'fd') value = fdMaturity(amount, rate, year);
            else if (tab === 'fire' || tab === 'retirement') value = currentMonthlyExpLine * Math.pow(1 + fireInflation / 100, year);
            return { year, value: Math.round(value) };
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center overflow-x-auto pb-2 gap-2 scrollbar-hide">
                <h2 className="text-2xl font-bold whitespace-nowrap mr-4">Calculators</h2>
                <div className="flex gap-2">
                    <Button onClick={() => setTab('sip')} variant={tab === 'sip' ? 'default' : 'outline'} className="whitespace-nowrap">SIP</Button>
                    <Button onClick={() => setTab('stepup')} variant={tab === 'stepup' ? 'default' : 'outline'} className="whitespace-nowrap">Step-up</Button>
                    <Button onClick={() => setTab('lumpsum')} variant={tab === 'lumpsum' ? 'default' : 'outline'} className="whitespace-nowrap">Lumpsum</Button>
                    <Button onClick={() => setTab('hybrid')} variant={tab === 'hybrid' ? 'default' : 'outline'} className="whitespace-nowrap">Hybrid</Button>
                    <Button onClick={() => setTab('goal')} variant={tab === 'goal' ? 'default' : 'outline'} className="whitespace-nowrap">Goal SIP</Button>
                    <Button onClick={() => setTab('fire')} variant={tab === 'fire' ? 'default' : 'outline'} className="whitespace-nowrap">FIRE</Button>
                    <Button onClick={() => setTab('swp')} variant={tab === 'swp' ? 'default' : 'outline'} className="whitespace-nowrap">SWP</Button>
                    <Button onClick={() => setTab('inflation')} variant={tab === 'inflation' ? 'default' : 'outline'} className="whitespace-nowrap">Inflation</Button>
                    <Button onClick={() => setTab('home')} variant={tab === 'home' ? 'default' : 'outline'} className="whitespace-nowrap">Buy vs Rent</Button>
                    <Button onClick={() => setTab('luxury')} variant={tab === 'luxury' ? 'default' : 'outline'} className="whitespace-nowrap">Luxury Delay</Button>
                    <Button onClick={() => setTab('fd')} variant={tab === 'fd' ? 'default' : 'outline'} className="whitespace-nowrap">FD</Button>
                    <Button onClick={() => setTab('tax')} variant={tab === 'tax' ? 'default' : 'outline'} className="whitespace-nowrap">Old vs New Tax</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 space-y-4">
                    {tab === 'sip' && (
                        <>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="text-indigo-400" size={20} />
                                <h3 className="text-xl font-bold">SIP Calculator</h3>
                            </div>
                            <InteractiveSliderInput label="Monthly SIP" value={amount} onChange={setAmount} min={500} max={100000} step={500} suffix="₹" />
                            
                            <div className="space-y-1.5">
                                <InteractiveSliderInput label="Expected Return" value={rate} onChange={setRate} min={1} max={30} step={0.1} suffix="%" />
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {RATE_PRESETS.map(p => (
                                        <button
                                            key={p.name}
                                            onClick={() => setRate(p.rate)}
                                            className="text-[9px] font-black uppercase px-2.5 py-1 bg-white/5 border border-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-gray-400 hover:text-white rounded transition-colors cursor-pointer"
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                                <div className={`text-[10px] p-2.5 rounded-lg border leading-tight ${getRateGauge(rate).color} font-medium`}>
                                    {getRateGauge(rate).text}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <InteractiveSliderInput label="Period" value={years} onChange={setYears} min={1} max={40} step={1} suffix="Yrs" />
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {TENURE_PRESETS.map(p => (
                                        <button
                                            key={p.name}
                                            onClick={() => setYears(p.years)}
                                            className="text-[9px] font-black uppercase px-2.5 py-1 bg-white/5 border border-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-gray-400 hover:text-white rounded transition-colors cursor-pointer"
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-4">
                                <div className="text-center">
                                    <p className="text-gray-400 text-xs uppercase font-black tracking-widest mb-1">Maturity Value</p>
                                    <p className="text-4xl font-extrabold text-white tracking-tight">₹{Math.round(sipMaturity).toLocaleString('en-IN')}</p>
                                </div>
                                <MoneyRatioBar invested={amount * years * 12} gains={Math.max(0, sipMaturity - (amount * years * 12))} />
                            </div>
                        </>
                    )}

                    {tab === 'stepup' && (
                        <>
                            <div className="flex items-center gap-2">
                                <Zap className="text-amber-400 animate-bounce" size={20} />
                                <h3 className="text-xl font-bold">Step-up SIP Calculator</h3>
                            </div>
                            <InteractiveSliderInput label="Initial Monthly SIP" value={amount} onChange={setAmount} min={500} max={100000} step={500} suffix="₹" />
                            <InteractiveSliderInput label="Annual Step-up" value={stepUp} onChange={setStepUp} min={1} max={50} step={1} suffix="%" />
                            
                            <div className="space-y-1.5">
                                <InteractiveSliderInput label="Expected Return" value={rate} onChange={setRate} min={1} max={30} step={0.1} suffix="%" />
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {RATE_PRESETS.map(p => (
                                        <button
                                            key={p.name}
                                            onClick={() => setRate(p.rate)}
                                            className="text-[9px] font-black uppercase px-2.5 py-1 bg-white/5 border border-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-gray-400 hover:text-white rounded transition-colors cursor-pointer"
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <InteractiveSliderInput label="Period" value={years} onChange={setYears} min={1} max={40} step={1} suffix="Yrs" />
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {TENURE_PRESETS.map(p => (
                                        <button
                                            key={p.name}
                                            onClick={() => setYears(p.years)}
                                            className="text-[9px] font-black uppercase px-2.5 py-1 bg-white/5 border border-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-gray-400 hover:text-white rounded transition-colors cursor-pointer"
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-4">
                                <div className="text-center">
                                    <p className="text-gray-400 text-xs uppercase font-black tracking-widest mb-1">Step-up Maturity Value</p>
                                    <p className="text-4xl font-extrabold text-white tracking-tight">₹{Math.round(stepUpMaturity).toLocaleString('en-IN')}</p>
                                </div>
                                <MoneyRatioBar 
                                    invested={stepUpResult.invested}
                                gains={Math.max(0, stepUpMaturity - stepUpResult.invested)}
                                />
                            </div>
                        </>
                    )}

                    {tab === 'lumpsum' && (
                        <>
                            <div className="flex items-center gap-2">
                                <Wallet className="text-indigo-400" size={20} />
                                <h3 className="text-xl font-bold">Lumpsum Calculator</h3>
                            </div>
                            <InteractiveSliderInput label="One-time Investment" value={amount} onChange={setAmount} min={5000} max={10000000} step={5000} suffix="₹" />
                            
                            <div className="space-y-1.5">
                                <InteractiveSliderInput label="Expected Return" value={rate} onChange={setRate} min={1} max={30} step={0.1} suffix="%" />
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {RATE_PRESETS.map(p => (
                                        <button
                                            key={p.name}
                                            onClick={() => setRate(p.rate)}
                                            className="text-[9px] font-black uppercase px-2.5 py-1 bg-white/5 border border-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-gray-400 hover:text-white rounded transition-colors cursor-pointer"
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <InteractiveSliderInput label="Period" value={years} onChange={setYears} min={1} max={40} step={1} suffix="Yrs" />
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {TENURE_PRESETS.map(p => (
                                        <button
                                            key={p.name}
                                            onClick={() => setYears(p.years)}
                                            className="text-[9px] font-black uppercase px-2.5 py-1 bg-white/5 border border-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-gray-400 hover:text-white rounded transition-colors cursor-pointer"
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-4">
                                <div className="text-center">
                                    <p className="text-gray-400 text-xs uppercase font-black tracking-widest mb-1">Estimated Wealth</p>
                                    <p className="text-4xl font-extrabold text-white tracking-tight">₹{Math.round(lumpsumMaturity).toLocaleString('en-IN')}</p>
                                </div>
                                <MoneyRatioBar invested={amount} gains={Math.max(0, lumpsumMaturity - amount)} />
                            </div>
                        </>
                    )}

                    {tab === 'hybrid' && (
                        <>
                            <div className="flex items-center gap-2">
                                <Users className="text-indigo-400" size={20} />
                                <h3 className="text-xl font-bold">SIP + Lumpsum Calculator</h3>
                            </div>
                            <InteractiveSliderInput label="One-time Investment (Lumpsum)" value={hLumpsum} onChange={setHLumpsum} min={1000} max={5000000} step={5000} suffix="₹" />
                            <InteractiveSliderInput label="Monthly SIP Contribution" value={hSip} onChange={setHSip} min={500} max={250000} step={500} suffix="₹" />
                            <InteractiveSliderInput label="Expected Return" value={hRate} onChange={setHRate} min={1} max={30} step={0.1} suffix="%" />
                            <InteractiveSliderInput label="Period" value={hYears} onChange={setHYears} min={1} max={45} step={1} suffix="Yrs" />
                            
                            <div className="p-6 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-4">
                                <div className="text-center">
                                    <p className="text-gray-400 text-xs uppercase font-black tracking-widest mb-1">Total Maturity Value</p>
                                    <p className="text-4xl font-extrabold text-white tracking-tight">₹{Math.round(hybridMaturity).toLocaleString('en-IN')}</p>
                                </div>
                                <MoneyRatioBar 
                                    invested={hLumpsum + (hSip * hYears * 12)} 
                                    gains={Math.max(0, hybridMaturity - (hLumpsum + (hSip * hYears * 12)))} 
                                />
                            </div>
                        </>
                    )}

                    {tab === 'goal' && (
                        <>
                            <div className="flex items-center gap-2">
                                <Activity className="text-emerald-400" size={20} />
                                <h3 className="text-xl font-bold">Target Goal Planner</h3>
                            </div>
                            <InteractiveSliderInput label="Target Goal Amount" value={targetGoal} onChange={setTargetGoal} min={100000} max={100000000} step={50000} suffix="₹" />
                            <InteractiveSliderInput label="Years to reach goal" value={goalYears} onChange={setGoalYears} min={1} max={40} step={1} suffix="Yrs" />
                            <InteractiveSliderInput label="Expected Return" value={goalRate} onChange={setGoalRate} min={1} max={30} step={0.1} suffix="%" />
                            
                            <div className="p-6 bg-indigo-500/5 rounded-xl border border-indigo-500/10 text-center space-y-2">
                                <p className="text-gray-400 text-xs uppercase font-black tracking-widest mb-1">Monthly SIP Required</p>
                                <p className="text-4xl font-extrabold text-emerald-400 tracking-tight">
                                    {requiredSIP > 0 && isFinite(requiredSIP) ? `₹${Math.round(requiredSIP).toLocaleString('en-IN')}` : '₹0'}
                                </p>
                                <p className="text-[10px] text-gray-500">
                                    Investing this amount monthly at {goalRate}% return will hit your target in {goalYears} years.
                                </p>
                            </div>
                        </>
                    )}

                    {tab === 'inflation' && (
                        <>
                            <div className="flex items-center gap-2">
                                <Clock className="text-rose-400 animate-pulse" size={20} />
                                <h3 className="text-xl font-bold">Inflation Impact Calculator</h3>
                            </div>
                            <InteractiveSliderInput label="Amount Today" value={infAmount} onChange={setInfAmount} min={1000} max={10000000} step={5000} suffix="₹" />
                            <InteractiveSliderInput label="Average Inflation Rate" value={infRate} onChange={setInfRate} min={1} max={20} step={0.1} suffix="%" />
                            <InteractiveSliderInput label="Time Period" value={infYears} onChange={setInfYears} min={1} max={50} step={1} suffix="Yrs" />
                            
                            <div className="p-6 bg-red-500/5 rounded-xl border border-red-500/10 space-y-4">
                                <div className="text-center">
                                    <p className="text-rose-400 text-xs uppercase font-black tracking-widest mb-1">Purchasing Power</p>
                                    <p className="text-3xl font-extrabold text-rose-400 tracking-tight">₹{Math.round(purchasingPower).toLocaleString('en-IN')}</p>
                                    <p className="text-[9px] text-gray-400 mt-1">Value of today's money in {infYears} years after {infRate}% average inflation</p>
                                </div>
                                <div className="h-[2px] bg-white/5" />
                                <div className="text-center">
                                    <p className="text-indigo-400 text-xs uppercase font-black tracking-widest mb-1">Nominal Future Cost</p>
                                    <p className="text-3xl font-extrabold text-indigo-400 tracking-tight">₹{Math.round(futureCost).toLocaleString('en-IN')}</p>
                                    <p className="text-[9px] text-gray-400 mt-1">What ₹{infAmount.toLocaleString('en-IN')} buys today will cost in {infYears} years</p>
                                </div>
                            </div>
                        </>
                    )}

                    {(tab === 'fire' || tab === 'retirement') && (
                        <>
                            <div className="flex items-center gap-2">
                                <Sparkles className="text-rose-400 animate-pulse" size={20} />
                                <h3 className="text-xl font-bold">{tab === 'fire' ? 'FIRE Calculator' : 'Retirement Planner'}</h3>
                            </div>
                            
                            {tab === 'fire' && (
                                <div className="space-y-4">
                                    <div className="flex gap-2 p-1 bg-white/5 rounded-lg border border-white/5 overflow-x-auto scrollbar-hide">
                                        {(['lean', 'normal', 'chubby', 'fat'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setFireType(type)}
                                                className={`flex-1 py-3 px-4 rounded-md text-[10px] font-black uppercase tracking-tighter transition-all whitespace-nowrap cursor-pointer ${
                                                    fireType === type 
                                                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                                                    : 'text-gray-500 hover:text-gray-300'
                                                }`}
                                            >
                                                {type} FIRE
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10 text-[10px] text-indigo-300 italic leading-snug">
                                        {fireType === 'lean' && "Lean FIRE: Minimalist living covering basic survival and essentials (70% of current exp)."}
                                        {fireType === 'normal' && "Normal FIRE: Maintains your current lifestyle with some buffer (100% of current exp)."}
                                        {fireType === 'chubby' && "Chubby FIRE: Comfortable lifestyle with travel, hobbies, and healthcare buffer (140% of current exp)."}
                                        {fireType === 'fat' && "Fat FIRE: Total financial freedom with high-end luxury and zero budget constraints (200% of current exp)."}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <InteractiveSliderInput label="Current Monthly Expense" value={monthlyExp} onChange={setMonthlyExp} min={5000} max={1000000} step={2000} suffix="₹" />
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <InteractiveSliderInput label="Current Age" value={currentAge} onChange={setCurrentAge} min={18} max={80} step={1} suffix="Yrs" />
                                    <InteractiveSliderInput label="Retirement Age" value={retireAge} onChange={setRetireAge} min={Math.max(25, currentAge + 1)} max={85} step={1} suffix="Yrs" />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <InteractiveSliderInput label="Life Expectancy" value={lifeExp} onChange={setLifeExp} min={Math.max(60, retireAge + 1)} max={100} step={1} suffix="Yrs" />
                                    <InteractiveSliderInput label="Inflation Rate" value={fireInflation} onChange={setFireInflation} min={2} max={15} step={0.5} suffix="%" />
                                </div>
                                <InteractiveSliderInput label="Expected Returns Post-Retirement" value={postRetireReturns} onChange={setPostRetireReturns} min={4} max={20} step={0.5} suffix="%" />
                            </div>

                            <div className="p-6 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-center relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Sparkles size={40} />
                                </div>
                                <p className="text-gray-400 text-xs uppercase font-black tracking-widest mb-1">Target Corpus Needed</p>
                                <p className="text-3xl font-black text-rose-400">₹{(fireCorpus / 10000000).toFixed(2)} Cr</p>
                                <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                                    <div className="flex justify-between text-[10px] text-gray-500 uppercase font-black tracking-widest">
                                        <span>Current Monthly Expenses</span>
                                        <span className="text-white font-bold">₹{Math.round(monthlyExp).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-500 uppercase font-black tracking-widest">
                                        <span>Inflation Adjusted at {retireAge}</span>
                                        <span className="text-indigo-400 font-bold">₹{Math.round(expAtRetirement).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="h-px bg-white/5" />
                                    <p className="text-[9px] text-indigo-400/60 leading-relaxed font-bold italic text-left">
                                        Calculated based on real inflation-adjusted safe withdrawal rate across {yearsInRetirement} post-retirement years.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    {tab === 'home' && (
                        <>
                            <div className="flex items-center gap-2">
                                <Landmark className="text-indigo-400" size={20} />
                                <h3 className="text-xl font-bold">Buy vs Rent Comparison</h3>
                            </div>
                            <div className="space-y-4">
                                <InteractiveSliderInput label="Property Market Value" value={propertyValue} onChange={setPropertyValue} min={1000000} max={100000000} step={500000} suffix="₹" />
                                <InteractiveSliderInput label="Monthly Rental Cost" value={monthlyRent} onChange={setMonthlyRent} min={2000} max={250000} step={1000} suffix="₹" />
                                <div className="grid grid-cols-2 gap-4">
                                    <InteractiveSliderInput label="Prop Appreciation" value={appreciation} onChange={setAppreciation} min={1} max={20} step={0.5} suffix="%" />
                                    <InteractiveSliderInput label="Rent Annual Escalation" value={rentEscalation} onChange={setRentEscalation} min={1} max={15} step={0.5} suffix="%" />
                                </div>
                                <InteractiveSliderInput label="Comparison Window" value={comparisonYears} onChange={setComparisonYears} min={1} max={30} step={1} suffix="Yrs" />
                            <div className="grid grid-cols-2 gap-4">
                                <InteractiveSliderInput label="Home Loan Rate" value={loanRate} onChange={setLoanRate} min={5} max={15} step={0.1} suffix="%" />
                                <InteractiveSliderInput label="Investment Return" value={investReturn} onChange={setInvestReturn} min={4} max={16} step={0.5} suffix="%" />
                            </div>
                            </div>
                            <div className="p-6 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400 text-xs uppercase font-black tracking-wider">Net worth if you BUY</span>
                                <span className="font-extrabold text-white text-base">₹{Math.round(bvr.buyNetWorth).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="h-px bg-white/5" />
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400 text-xs uppercase font-black tracking-wider">Net worth if you RENT &amp; INVEST</span>
                                <span className="font-extrabold text-emerald-400 text-base">₹{Math.round(bvr.rentNetWorth).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="h-px bg-white/5" />
                            <p className="text-sm font-bold">{bvr.advantage >= 0 ? 'Buying' : 'Renting'} comes out ahead by ₹{Math.abs(Math.round(bvr.advantage)).toLocaleString('en-IN')} after {comparisonYears} years.</p>
                            <p className="text-[11px] text-gray-500 leading-relaxed">EMI ₹{Math.round(bvr.emi).toLocaleString('en-IN')}/month on a 20-year loan with 20% down, plus 1% yearly maintenance. The renter invests the down payment and any monthly savings at {investReturn}%. Ignores stamp duty, brokerage and taxes. Chart shows buying minus renting.</p>
                            </div>
                        </>
                    )}

                    {tab === 'luxury' && (
                        <>
                            <div className="flex items-center gap-2">
                                <Zap className="text-amber-400 animate-pulse" size={20} />
                                <h3 className="text-xl font-bold">Luxury Delay (Wealth Forgone)</h3>
                            </div>
                            <div className="space-y-4">
                                <InteractiveSliderInput label="Luxury Cost" value={luxuryCost} onChange={setLuxuryCost} min={5000} max={2500000} step={5000} suffix="₹" />
                                <InteractiveSliderInput label="Alternative Delay Window" value={delayMonths} onChange={setDelayMonths} min={1} max={60} step={1} suffix="Mths" />
                            </div>
                            <div className="p-6 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-center space-y-4">
                                <div>
                                    <p className="text-gray-400 text-xs uppercase font-black mb-1">Future Opportunity Value</p>
                                    <p className="text-3xl font-black text-emerald-400">₹{Math.round(luxuryGain).toLocaleString('en-IN')}</p>
                                    <p className="text-[10px] font-bold text-gray-500 italic mt-1 leading-normal">
                                        Opportunity value if you delay this purchase and invest ₹{luxuryCost.toLocaleString('en-IN')} for {delayMonths} months at 12% returns
                                    </p>
                                </div>
                                <div className="h-px bg-white/5" />
                                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mb-1.5">Real Cost of Delayed Joy</p>
                                    <p className="text-xs font-bold text-indigo-300">
                                        Investing instead of instant spending yields <span className="text-emerald-400 font-black text-sm">₹{Math.round(luxuryGain - luxuryCost).toLocaleString('en-IN')}</span> in pure potential wealth gains.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    {tab === 'swp' && (
                        <>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="text-emerald-400" size={20} />
                                <h3 className="text-xl font-bold">SWP (Systematic Withdrawal Plan)</h3>
                            </div>
                            <div className="space-y-4">
                                <InteractiveSliderInput label="Total Mutual Fund Principal" value={swpPrincipal} onChange={setSwpPrincipal} min={100000} max={25000000} step={50000} suffix="₹" />
                                <InteractiveSliderInput label="Planned Monthly Withdrawal" value={swpWithdrawal} onChange={setSwpWithdrawal} min={1000} max={250000} step={1000} suffix="₹" />
                                <div className="grid grid-cols-2 gap-4">
                                    <InteractiveSliderInput label="Expected MF Return" value={swpRate} onChange={setSwpRate} min={1} max={25} step={0.5} suffix="%" />
                                    <InteractiveSliderInput label="Total SWP tenure" value={swpYears} onChange={setSwpYears} min={1} max={40} step={1} suffix="Yrs" />
                                </div>
                            </div>
                            
                            <div className="p-6 bg-emerald-500/5 rounded-xl border border-emerald-500/10 space-y-4">
                                <div className="text-center">
                                    <p className="text-gray-400 text-xs uppercase font-black tracking-widest mb-1">Final Remaining Fund Value</p>
                                    <p className="text-3xl font-extrabold text-emerald-400">₹{Math.round(swpSummary.finalBalance).toLocaleString('en-IN')}</p>
                                    <p className="text-[9px] text-gray-500 mt-1 uppercase font-bold text-emerald-500/60 font-black">Capital remaining after {swpYears} years</p>
                                </div>
                                <div className="h-px bg-white/5" />
                                <div className="text-center">
                                    <p className="text-gray-400 text-xs uppercase font-black tracking-widest mb-1">Total Payout Received</p>
                                    <p className="text-2xl font-black text-white">₹{Math.round(swpSummary.totalWithdrawn).toLocaleString('en-IN')}</p>
                                    <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold">Total supplementary pension income withdrawn</p>
                                </div>
                            </div>
                        </>
                    )}

                    {tab === 'fd' && (
                        <>
                            <div className="flex items-center gap-2">
                                <Landmark className="text-indigo-400" size={20} />
                                <h3 className="text-xl font-bold">Fixed Deposit (FD) / RD</h3>
                            </div>
                            <div className="space-y-4">
                                <InteractiveSliderInput label="Deposit Principal" value={amount} onChange={setAmount} min={10000} max={10000000} step={10000} suffix="₹" />
                                <InteractiveSliderInput label="FD Interest Rate" value={rate} onChange={setRate} min={1} max={15} step={0.1} suffix="%" />
                                <InteractiveSliderInput label="FD Tenure" value={years} onChange={setYears} min={1} max={25} step={1} suffix="Yrs" />
                            </div>
                            
                            <div className="p-6 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-4 text-center">
                                <div>
                                    <p className="text-gray-400 text-xs uppercase font-black tracking-widest mb-1">Maturity Value (Quarterly compounding)</p>
                                    <p className="text-4xl font-extrabold text-white tracking-tight">₹{Math.round(fdMaturity(amount, rate, years)).toLocaleString('en-IN')}</p>
                                </div>
                                <MoneyRatioBar invested={amount} gains={Math.max(0, fdMaturity(amount, rate, years) - amount)} />
                            </div>
                        </>
                    )}

                    {tab === 'tax' && (
                        <>
                            <div className="flex items-center gap-2 mb-2">
                                <Landmark className="text-indigo-400" size={20} />
                                <h3 className="text-xl font-bold">FY 2024-25 Tax Planner</h3>
                            </div>
                            <p className="text-xs text-gray-400">Compare the Old vs New Tax Regime with latest Union Budget standard deductions & slabs.</p>
                            
                            <div className="space-y-3 pt-2 border-t border-white/5">
                                <Input label="Gross Annual Salary (₹)" type="number" value={taxGrossSalary} onChange={e => setTaxGrossSalary(Number(e.target.value))} />
                                
                                <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-3">
                                    <p className="text-[9px] uppercase font-black tracking-wider text-indigo-400 leading-none">Old Regime Deductions (Section 80)</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input label="Section 80C (PPF/ELSS - Max 1.5L)" type="number" value={tax80C} onChange={e => setTax80C(Number(e.target.value))} />
                                        <Input label="Section 80D (Health - Max 25k)" type="number" value={tax80D} onChange={e => setTax80D(Number(e.target.value))} />
                                        <Input label="NPS 80CCD(1B) (Max 50k)" type="number" value={tax80CCD} onChange={e => setTax80CCD(Number(e.target.value))} />
                                        <Input label="HRA / Loan Interest (₹)" type="number" value={taxHraHomeLoan} onChange={e => setTaxHraHomeLoan(Number(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </Card>

                <div className="space-y-6">
                    {tab === 'tax' ? (
                        <>
                            <Card className="p-6 space-y-6">
                                <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-500">Tax Comparison Visualizer</h4>
                                <div className="h-[210px] w-full mt-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={[
                                                { name: 'Old Regime', 'Net Tax': Math.round(oldTaxDetails.total), 'Eligible Deductions': deductionsSum },
                                                { name: 'New Regime', 'Net Tax': Math.round(newTaxDetails.total), 'Eligible Deductions': 75000 }
                                            ]}
                                            margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                            <YAxis stroke="#94a3b8" fontSize={9} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
                                                formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`]}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                                            <Bar dataKey="Net Tax" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="Eligible Deductions" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-white/5">
                                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                        <div>
                                            <p className="text-[9px] uppercase font-black text-gray-500">Best Regime</p>
                                            <p className="text-sm font-black text-white">
                                                {oldTaxDetails.total === newTaxDetails.total ? 'Both are identical' :
                                                 oldTaxDetails.total < newTaxDetails.total ? 'Old Regime' : 'New Regime'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] uppercase font-black text-emerald-400">Net Annual Savings</p>
                                            <p className="text-lg font-black text-emerald-400">
                                                ₹{Math.abs(Math.round(oldTaxDetails.total - newTaxDetails.total)).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Breakdown Details */}
                                    <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
                                        <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10 space-y-1">
                                            <p className="text-[8px] font-black uppercase text-red-400">Old Regime</p>
                                            <p className="text-gray-400">Taxable: <span className="text-white font-bold">₹{Math.round(oldTaxDetails.taxable).toLocaleString('en-IN')}</span></p>
                                            <p className="text-gray-400">Base Tax: <span className="text-white font-bold">₹{Math.round(oldTaxDetails.tax).toLocaleString('en-IN')}</span></p>
                                            <p className="text-gray-400">Cess (4%): <span className="text-white font-bold">₹{Math.round(oldTaxDetails.cess).toLocaleString('en-IN')}</span></p>
                                            {oldTaxDetails.rebate && <p className="text-[9px] font-black uppercase text-emerald-400">87A Rebate Applied</p>}
                                            <p className="text-white font-black mt-1">Total: ₹{Math.round(oldTaxDetails.total).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 space-y-1">
                                            <p className="text-[8px] font-black uppercase text-emerald-400">New Regime</p>
                                            <p className="text-gray-400">Taxable: <span className="text-white font-bold">₹{Math.round(newTaxDetails.taxable).toLocaleString('en-IN')}</span></p>
                                            <p className="text-gray-400">Base Tax: <span className="text-white font-bold">₹{Math.round(newTaxDetails.tax).toLocaleString('en-IN')}</span></p>
                                            <p className="text-gray-400">Cess (4%): <span className="text-white font-bold">₹{Math.round(newTaxDetails.cess).toLocaleString('en-IN')}</span></p>
                                            {newTaxDetails.rebate && <p className="text-[9px] font-black uppercase text-emerald-400">87A Rebate Applied</p>}
                                            <p className="text-white font-black mt-1">Total: ₹{Math.round(newTaxDetails.total).toLocaleString('en-IN')}</p>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-5 bg-gradient-to-br from-indigo-950/20 to-transparent border-white/5">
                                <h4 className="text-[10px] uppercase font-black tracking-widest text-indigo-400 mb-2">Indian Tax Optimizer Tip</h4>
                                <p className="text-[11px] text-gray-400 leading-relaxed italic">
                                    {oldTaxDetails.total < newTaxDetails.total ? 
                                        "Old Regime saves you money because your Section 80 and Home Loan / HRA deductions are high. Remember to submit investment proofs to your HR/employer on time." :
                                        "New Regime is more favorable here. It has a ₹75,000 standard deduction, lower slabs and no tax up to ₹12L of taxable income (FY 2026-27), so deductions like 80C often do not make up the difference."}
                                </p>
                            </Card>
                        </>
                    ) : (
                        <>
                            <Card className="p-6">
                                <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-6">Visual Insight</h4>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={
                                            getChartData()
                                        }>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                            <XAxis dataKey="year" stroke="#94a3b8" fontSize={10} />
                                            <YAxis stroke="#94a3b8" fontSize={10} hide />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
                                                formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`, 'Value']}
                                            />
                                            <Bar dataKey={tab === 'swp' ? 'balance' : 'value'} fill="#6366f1" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            <Card className="p-6 bg-gradient-to-br from-indigo-900/20 to-transparent border-white/5">
                                <h4 className="text-[10px] uppercase font-black tracking-widest text-indigo-400 mb-2">Money Rule</h4>
                                <p className="text-xs text-gray-400 leading-relaxed italic">
                                    {tab === 'sip' && "Consistency > Intensity. Starting early is more important than starting big."}
                                    {tab === 'stepup' && "Salary hikes should go into investments, not lifestyle inflation. A 10% step-up can double your final corpus."}
                                    {tab === 'inflation' && "The silent thief. Cash is not an investment; it's a decaying asset due to inflation."}
                                    {tab === 'fire' && "Financial Independence isn't about not working; it's about only doing work you love."}
                                    {tab === 'home' && "A house is a home first, an investment second. Factor in maintenance and opportunity cost."}
                                    {tab === 'swp' && "The perfect way to create a 'Pension' from your mutual fund corpus post-retirement."}
                                </p>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
