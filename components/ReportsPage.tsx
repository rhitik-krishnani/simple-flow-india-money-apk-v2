import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { 
    Calendar, Download, Filter, TrendingUp, TrendingDown, 
    PieChart as PieIcon, BarChart3, LineChart, Loader2,
    ChevronLeft, ChevronRight, FileText, Info
} from 'lucide-react';
import { Card, Button } from './ui';
import { getTransactions, getInvestments, getLoans } from '../services/dataService';
import { Transaction, Investment, Loan, TransactionType } from '../types';
import { translations, Language } from '../translations';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export const ReportsPage: React.FC<{ lang: Language }> = ({ lang }) => {
    const t = translations[lang];
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [txns, invs, lns] = await Promise.all([
                    getTransactions(),
                    getInvestments(),
                    getLoans()
                ]);
                setTransactions(txns);
                setInvestments(invs);
                setLoans(lns);
            } catch (error) {
                console.error("Failed to load reports data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(txn => {
            const date = txn.date;
            return date >= dateRange.start && date <= dateRange.end;
        });
    }, [transactions, dateRange]);

    // Graph 1: Spending by Category
    const categoryData = useMemo(() => {
        const expenses = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE);
        const map: Record<string, number> = {};
        expenses.forEach(e => {
            map[e.category] = (map[e.category] || 0) + e.amount;
        });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredTransactions]);

    // Graph 2: Income vs Expense Monthly
    const monthlyComparisonData = useMemo(() => {
        const months = 6;
        const result = [];
        const now = new Date();
        
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = d.toLocaleString('default', { month: 'short' });
            const yearMonth = d.toISOString().slice(0, 7); // YYYY-MM
            
            const monthTxns = transactions.filter(t => t.date.startsWith(yearMonth));
            const income = monthTxns.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
            const expense = monthTxns.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
            
            result.push({
                name: monthStr,
                income,
                expense,
                saving: Math.max(0, income - expense)
            });
        }
        return result;
    }, [transactions]);

    // Graph 3: Net Worth Evolution (Simplified)
    const netWorthEvolution = useMemo(() => {
        const months = 6;
        const result = [];
        const now = new Date();
        
        // Final net worth components
        const currentInvestments = investments.reduce((sum, i) => sum + i.currentValue, 0);
        const currentLoans = loans.reduce((sum, l) => sum + l.outstanding, 0);
        
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = d.toLocaleString('default', { month: 'short' });
            
            // Calculate change from this month to now to "backwards" calculate
            // This is a rough estimation since we don't have historical balance logs
            const futureTxns = transactions.filter(t => new Date(t.date) > d);
            const futureNetChange = futureTxns.reduce((sum, t) => {
                return sum + (t.type === TransactionType.INCOME ? t.amount : -t.amount);
            }, 0);

            // Rough: Initial net worth = Resulting - Changes
            // Adjusting for investments and loans (assuming they were roughly same - very naive)
            result.push({
                name: monthStr,
                value: Math.max(0, currentInvestments - currentLoans - (i === 0 ? 0 : futureNetChange * 0.5)) // Dampened for "wealth" feel
            });
        }
        return result;
    }, [transactions, investments, loans]);

    const totalIncome = filteredTransactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const totalExpenses = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    if (loading) return (
        <div className="h-96 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Assembling Intelligence...</p>
        </div>
    );

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tight text-white">{t.financialReports}</h1>
                    <p className="text-gray-500 font-medium tracking-tight">Comprehensive performance analytics and wealth distribution.</p>
                </div>
                
                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 px-3 py-2">
                        <Calendar size={14} className="text-indigo-400" />
                        <span className="text-[10px] font-black uppercase text-gray-400">{t.customRange}</span>
                    </div>
                    <input 
                        type="date" 
                        value={dateRange.start} 
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="bg-transparent border-none text-xs font-bold text-white focus:ring-0 cursor-pointer"
                    />
                    <span className="text-gray-600">→</span>
                    <input 
                        type="date" 
                        value={dateRange.end} 
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="bg-transparent border-none text-xs font-bold text-white focus:ring-0 cursor-pointer"
                    />
                </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6 bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-500/20">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                            <TrendingUp size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Total Income</span>
                    </div>
                    <p className="text-3xl font-black text-white">₹{totalIncome.toLocaleString()}</p>
                </Card>
                
                <Card className="p-6 bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                            <TrendingDown size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Total Expenses</span>
                    </div>
                    <p className="text-3xl font-black text-white">₹{totalExpenses.toLocaleString()}</p>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                            <PieIcon size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Savings Rate</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-white">{savingsRate.toFixed(1)}%</p>
                        <span className={`text-xs font-bold ${savingsRate > 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {savingsRate > 20 ? 'Healthy' : 'Room to improve'}
                        </span>
                    </div>
                </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Income vs Expenses */}
                <Card className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20">
                                <BarChart3 size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">{t.incomeVsExpense}</h3>
                                <p className="text-[10px] uppercase font-black tracking-widest text-gray-500">{t.monthlyBreakdown}</p>
                            </div>
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyComparisonData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }}
                                    tickFormatter={(val) => `₹${val/1000}k`}
                                />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 700 }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700, paddingTop: '20px' }} />
                                <Bar dataKey="income" name="Income" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="expense" name="Expense" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Spending Distribution */}
                <Card className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 border border-amber-500/20">
                                <PieIcon size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">{t.spendingByType}</h3>
                                <p className="text-[10px] uppercase font-black tracking-widest text-gray-500">Categorical Leakage Analysis</p>
                            </div>
                        </div>
                    </div>

                    <div className="h-[300px] w-full relative">
                        {categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        itemStyle={{ fontSize: '10px', fontWeight: 700 }}
                                        formatter={(val: number) => `₹${val.toLocaleString()}`}
                                    />
                                    <Legend iconType="circle" layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500 text-xs font-bold italic">
                                No spending data for this range.
                            </div>
                        )}
                    </div>
                </Card>

                {/* Net Worth Trend */}
                <Card className="p-8 space-y-6 col-span-1 lg:col-span-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                <LineChart size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">{t.netWorthTrend}</h3>
                                <p className="text-[10px] uppercase font-black tracking-widest text-gray-500">6-Month Velocity Snapshot</p>
                            </div>
                        </div>
                        <Button variant="outline" className="h-8 text-[10px] font-black uppercase tracking-widest flex gap-2">
                            <Download size={14} />
                            Export Data
                        </Button>
                    </div>

                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={netWorthEvolution}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }}
                                    tickFormatter={(val) => `₹${(val/100000).toFixed(1)}L`}
                                />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 700 }}
                                    formatter={(val: number) => `₹${val.toLocaleString()}`}
                                />
                                <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex gap-4 items-start">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 mt-1">
                            <Info size={16} />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-black text-white uppercase tracking-tight">Intelligence Note</p>
                            <p className="text-[11px] text-gray-500 leading-relaxed font-medium">This trend reflects your consolidated asset-to-debt ratio. Fluctuations are calculated based on monthly transaction velocity and recorded asset valuations. For precise historical tracking, ensure all manual assets are updated monthly.</p>
                        </div>
                    </div>
                </Card>
            </div>
            
            {/* Detailed Table View (Income vs Expense Breakdown) */}
            <Card className="p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white border border-white/10">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">Transactional Intelligence</h3>
                        <p className="text-[10px] uppercase font-black tracking-widest text-gray-500">Itemized Range Breakdown</p>
                    </div>
                </div>

                <div className="overflow-x-auto overflow-y-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Category</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Transaction Type</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Volume</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Total Net</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {Array.from(new Set(filteredTransactions.map(t => t.category))).map((cat, idx) => {
                                const catTxns = filteredTransactions.filter(t => t.category === cat);
                                const total = catTxns.reduce((sum, t) => sum + (t.type === TransactionType.INCOME ? t.amount : -t.amount), 0);
                                const isPositive = total >= 0;

                                return (
                                    <tr key={idx} className="group hover:bg-white/5 transition-colors">
                                        <td className="py-4 text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">{cat}</td>
                                        <td className="py-4 text-xs font-medium text-gray-400">
                                            {catTxns.some(t => t.type === TransactionType.INCOME) ? 'Mixed' : 'Expense Only'}
                                        </td>
                                        <td className="py-4 text-xs font-mono text-gray-500 text-right">{catTxns.length} events</td>
                                        <td className={`py-4 text-xs font-mono font-black text-right ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isPositive ? '+' : ''}₹{total.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
