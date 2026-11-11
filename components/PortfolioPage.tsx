import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { extractTextFromPdf as extractPdfText, extractTextFromFile, FileTextError, isPdfFile } from '../services/fileText';
import { motion } from 'motion/react';
import { 
    Activity, Zap, ShieldCheck, Lock, RefreshCw, Bot, Plus, Loader2, Sparkles, ChevronRight, 
    Scale, TrendingUp, Briefcase, 
    Trash2, Pencil, Target, BarChart3, FileSearch, UploadCloud, FileUp, ShieldAlert, 
    CheckCircle, X, Download, Landmark, Check, AlertTriangle, FileText, FileSearch as FileSearchIcon,
    PieChart as PieChartIcon, Globe
} from 'lucide-react';
import { 
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    AreaChart, Area, XAxis, YAxis, CartesianGrid, LineChart, Line, BarChart, Bar, Legend
} from 'recharts';
import { 
    Investment, Goal, GoalCategory, ViewState 
} from '../types';
import { Language, translations } from '../translations';
import { 
    getInvestments, saveInvestment, deleteInvestment, getGoals, saveGoal, 
    syncInvestmentPrices, trackAppEvent 
} from '../services/dataService';
import { analyzePortfolioLocal } from '../services/ruleEngine';
import { analyzePortfolio, extractMutualFundInvestments, parsePdfStatement, PortfolioAudit } from '../services/geminiService';
import { Button, Card, Input, Modal, Select, RichText } from './ui';
import { BrandLogo } from './BrandLogo';
import { calculateAbsoluteReturn, calculatePortfolioReturn, getDefaultBenchmark, calculatePortfolioAnnualizedReturn, calculateAnnualizedReturn, BENCHMARK_DATA } from '../financeUtils';

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444'];
const SUGGESTED_COLORS = ['#312e81', '#581c87', '#701a75', '#0f766e', '#92400e', '#991b1b'];


interface PortfolioPageProps {
    lang: Language;
}

const PortfolioPage: React.FC<PortfolioPageProps> = ({ lang }) => {
    const t = translations[lang];
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [availableGoals, setAvailableGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiAnalysis, setAiAnalysis] = useState<PortfolioAudit | string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
    const [benchmarkPeriod, setBenchmarkPeriod] = useState<'1y' | '3y' | '5y' | '10y'>('1y');

    // Form
    const [iName, setIName] = useState('');
    const [iType, setIType] = useState('Stock');
    const [iAmt, setIAmt] = useState('');
    const [iVal, setIVal] = useState('');
    const [iUnits, setIUnits] = useState('');
    const [iSip, setISip] = useState('');
    const [iDate, setIDate] = useState('');
    const [selectedGoalId, setSelectedGoalId] = useState('');

    // Import CSV State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [importData, setImportData] = useState<Omit<Investment, 'id'>[]>([]);
    const [importSuccessCount, setImportSuccessCount] = useState(0);
    const [importGoalId, setImportGoalId] = useState('');

    // MF Smart Import
    const [importMFLoading, setImportMFLoading] = useState(false);
    const [pendingInvestments, setPendingInvestments] = useState<Investment[]>([]);
    const [showMFReview, setShowMFReview] = useState(false);
    const [mfImportFinished, setMFImportFinished] = useState(false);

    // PDF Password Flow
    const [showPdfPasswordModal, setShowPdfPasswordModal] = useState(false);
    const [pdfPassword, setPdfPassword] = useState('');
    const [pdfParsing, setPdfParsing] = useState(false);
    const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
    const [pdfSource, setPdfSource] = useState<'mf' | 'broker'>('mf');

    const [activeTab, setActiveTab] = useState<'holdings' | 'sync'>('holdings');
    const [typeFilter, setTypeFilter] = useState('All');
    const [sortBy, setSortBy] = useState<'value' | 'return' | 'name'>('value');
    const [syncMsg, setSyncMsg] = useState('');

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [inv, goals] = await Promise.all([getInvestments(), getGoals()]);
            setInvestments(inv);
            setAvailableGoals(goals);
        } catch (e) {
            console.error("Load failed", e);
        } finally {
            setLoading(false);
        }
    };

    const extractTextFromPdf = async (file: File, password?: string): Promise<string> => {
        try {
            return await extractPdfText(file, password);
        } catch (err: any) {
            if (err instanceof FileTextError && err.code === 'PASSWORD_REQUIRED') throw new Error('PASSWORD_REQUIRED');
            throw err;
        }
    };

    const handlePdfPasswordSubmit = async () => {
        if (!pendingPdfFile) return;
        setPdfParsing(true);
        try {
            const text = await extractTextFromPdf(pendingPdfFile, pdfPassword);
            setShowPdfPasswordModal(false);
            setPdfPassword('');
            
            setImportMFLoading(true);
            const items = await parsePdfStatement(text);
            
            if (items.length === 0) {
                alert("No investments could be extracted from this PDF. Please ensure it is a valid CAS (CAMS/KFintech) statement or try a different format.");
                setPdfParsing(false);
                setImportMFLoading(false);
                return;
            }
            
            if (pdfSource === 'mf') {
                setPendingInvestments(items as any);
                setShowMFReview(true);
            } else {
                setImportData(items as any);
                setShowImportModal(true);
            }
            trackAppEvent('portfolio_pdf_unlocked', { source: pdfSource });
        } catch (err: any) {
            if (err.message === 'PASSWORD_REQUIRED') {
                alert("Incorrect password or this file requires one. Hint: For CAS, it's usually your PAN (ALL CAPS) or registered Email.");
            } else {
                console.error("PDF Extraction failed", err);
                alert("Failed to read PDF. It might be corrupted or in an unsupported format.");
                setShowPdfPasswordModal(false);
            }
        } finally {
            setPdfParsing(false);
            setImportMFLoading(false);
        }
    };

    const handleSyncPrices = async () => {
        setSyncing(true);
        setSyncMsg('');
        try {
            const r = await syncInvestmentPrices();
            await load();
            setSyncMsg(r.updated > 0
                ? `Updated ${r.updated} mutual fund${r.updated > 1 ? 's' : ''} with the latest NAV. Stocks, gold, crypto and FDs can't be refreshed automatically, so edit their current value yourself.`
                : "Nothing to refresh automatically. Only mutual funds with a scheme code update by themselves. Edit the current value of your other holdings yourself.");
        } catch (e) {
            console.error("Price sync failed", e);
            setSyncMsg("Couldn't refresh prices. Check your connection and try again.");
        } finally {
            setSyncing(false);
        }
    };

    const handleSave = async () => {
        if (!iName.trim() || !iAmt) {
            alert("Please provide at least the Asset Name and the Invested Amount.");
            return;
        }
        if (Number(iAmt) <= 0 || (iVal !== '' && Number(iVal) < 0) || (iUnits !== '' && Number(iUnits) < 0) || (iSip !== '' && Number(iSip) < 0)) {
            alert("Amounts must be positive numbers.");
            return;
        }
        if (iDate && new Date(iDate).getTime() > Date.now()) {
            alert("The purchase date can't be in the future.");
            return;
        }

        const targetGoalId = selectedGoalId || 'new-misc';
        const finalGoalId = await ensureMiscGoal(targetGoalId);

        const investmentData: any = {
            name: iName,
            type: iType as any,
            investedAmount: Number(iAmt) || 0,
            currentValue: Number(iVal || iAmt) || 0,
            units: iUnits ? Number(iUnits) : undefined,
            purchaseDate: iDate || new Date().toISOString(),
            sipAmount: iSip ? Number(iSip) : undefined,
            goalId: finalGoalId
        };

        if (editingInvestment) {
            investmentData.id = editingInvestment.id;
        }

        await saveInvestment(investmentData);
        await load();
        setShowModal(false);
        setEditingInvestment(null);
        resetForm();
    };

    const handleEdit = (inv: Investment) => {
        setEditingInvestment(inv);
        setIName(inv.name);
        setIType(inv.type);
        setIAmt(inv.investedAmount.toString());
        setIVal(inv.currentValue.toString());
        setIUnits(inv.units?.toString() || '');
        setISip(inv.sipAmount?.toString() || '');
        setIDate((inv.purchaseDate || new Date().toISOString()).split('T')[0]);
        setSelectedGoalId(inv.goalId || '');
        setShowModal(true);
    };

    const resetForm = () => {
        setIName(''); setIAmt(''); setIVal(''); setIUnits(''); setSelectedGoalId(''); setISip(''); setIDate('');
        setEditingInvestment(null);
    };

    const ensureMiscGoal = async (goalId: string): Promise<string> => {
        if (goalId === 'new-misc') {
            const existingMisc = availableGoals.find(g => g.name === 'Miscellaneous');
            if (existingMisc) return existingMisc.id;
            
            const currentGoals = await getGoals();
            const dbMisc = currentGoals.find(g => g.name === 'Miscellaneous');
            if (dbMisc) return dbMisc.id;

            const newId = `misc-${Date.now()}`;
            await saveGoal({
                name: 'Miscellaneous',
                category: 'Other',
                targetAmount: 0,
                targetDate: new Date().toISOString(),
                currentAmount: 0
            });
            const refreshed = await getGoals();
            setAvailableGoals(refreshed);
            const added = refreshed.find(g => g.name === 'Miscellaneous');
            return added?.id || newId;
        }
        return goalId;
    };

    const handleMFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (isPdfFile(file)) {
            setPdfSource('mf');
            setPendingPdfFile(file);
            setShowPdfPasswordModal(true);
            return;
        }

        setImportMFLoading(true);
        setMFImportFinished(false);
        try {
            const text = await extractTextFromFile(file);
            const items = await extractMutualFundInvestments(text);
            setPendingInvestments(items);
            setShowMFReview(true);
            trackAppEvent('portfolio_mf_statement_analyzed', { count: items.length });
        } catch (err) {
            alert(err instanceof FileTextError ? err.message : "Failed to analyze Mutual Fund statement. Please upload the PDF, CSV or Excel statement.");
        } finally {
            setImportMFLoading(false);
            e.target.value = '';
        }
    };

    const confirmMFImport = async () => {
        setImportMFLoading(true);
        try {
            const targetId = importGoalId || 'new-misc';
            const finalGoalId = await ensureMiscGoal(targetId);
            
            for (const item of pendingInvestments) {
                await saveInvestment({ ...item, goalId: finalGoalId });
            }
            await load();
            setPendingInvestments([]);
            setShowMFReview(false);
            setMFImportFinished(true);
            trackAppEvent('portfolio_mf_bulk_import_done', { count: pendingInvestments.length });
        } catch (e) {
            alert("Error importing investments");
        } finally {
            setImportMFLoading(false);
        }
    };

    const analysisRef = React.useRef<HTMLDivElement>(null);

    const runAIAnalysis = async () => {
        setAnalyzing(true);
        try {
            const result = await analyzePortfolio(investments, lang);
            setAiAnalysis(result);
            // Scroll to results after a short delay to allow re-render
            setTimeout(() => {
                analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } catch (e) {
            console.error("Analysis failed", e);
            alert("Something went wrong with the portfolio check. Please try again.");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            setPdfSource('broker');
            setPendingPdfFile(file);
            setShowPdfPasswordModal(true);
            return;
        }

        setImportErrors([]);
        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        
        const processDataString = (csvContent: string) => {
            const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const headerKeywords = ['scheme', 'symbol', 'isin', 'name', 'units', 'qty', 'holdings', 'invested', 'current'];
            
            let headerIndex = -1;
            for (let i = 0; i < Math.min(lines.length, 30); i++) {
                const lowerLine = lines[i].toLowerCase();
                const matchCount = headerKeywords.filter(k => lowerLine.includes(k)).length;
                if (matchCount >= 2) {
                    headerIndex = i;
                    break;
                }
            }

            const cleanedCSV = headerIndex >= 0 ? lines.slice(headerIndex).join('\n') : csvContent;

            Papa.parse(cleanedCSV, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                complete: (results) => {
                    const { data, errors: parseErrors } = results;
                    if (parseErrors.length > 0 && data.length === 0) {
                        setImportErrors(parseErrors.map(e => `Parse Error: ${e.message}`));
                        return;
                    }
                    const errors: string[] = [];
                    const validData: Omit<Investment, 'id'>[] = [];
                    const fieldMap = {
                        name: ['schemename', 'scheme', 'securityname', 'security', 'symbol', 'description', 'particulars', 'scrip', 'company', 'name'],
                        invested: ['investedamount', 'invested', 'cost', 'avgprice', 'averageprice', 'buyprice', 'costbasis', 'buyavg', 'amount', 'principal'],
                        current: ['currentvalue', 'current', 'marketvalue', 'valuation', 'ltp', 'lastprice', 'curval', 'marketprice'],
                        units: ['units', 'qty', 'quantity', 'balance', 'balanceunits', 'availableqty', 'holdings'],
                        sip: ['sipamount', 'sip', 'monthly', 'installment'],
                        date: ['purchasedate', 'date', 'investmentdate', 'acquiredon', 'entrydate']
                    };

                    (data as any[]).forEach((row, index) => {
                        const rowKeys = Object.keys(row).reduce((acc: any, k) => {
                            acc[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = k;
                            return acc;
                        }, {});

                        const getVal = (fields: string[]) => {
                            for (const f of fields) if (rowKeys[f] !== undefined) return row[rowKeys[f]];
                            const allCleanedKeys = Object.keys(rowKeys);
                            for (const f of fields) {
                                const found = allCleanedKeys.find(k => k.includes(f) || f.includes(k));
                                if (found) return row[rowKeys[found]];
                            }
                            return undefined;
                        };

                        let name = getVal(fieldMap.name);
                        let investedAmt = getVal(fieldMap.invested);
                        let currentVal = getVal(fieldMap.current);
                        let units = getVal(fieldMap.units);
                        let sip = getVal(fieldMap.sip);
                        let date = getVal(fieldMap.date);

                        if ((investedAmt === undefined || investedAmt === null) && units !== undefined) {
                            const avgPrice = getVal(['avgprice', 'averageprice', 'buyprice', 'buyavg', 'rate']);
                            if (avgPrice !== undefined && !isNaN(Number(String(avgPrice).replace(/[^0-9.]/g, '')))) {
                                investedAmt = Number(String(avgPrice).replace(/[^0-9.]/g, '')) * Number(String(units).replace(/[^0-9.]/g, ''));
                            }
                        }

                        const finalName = String(name || '').trim();
                        const rawInvested = String(investedAmt || '').replace(/[^0-9.-]/g, '');
                        const finalInvested = rawInvested && rawInvested !== '-' ? Number(rawInvested) : NaN;
                        const rawCurrent = String(currentVal || investedAmt || '').replace(/[^0-9.-]/g, '');
                        const finalCurrent = rawCurrent && rawCurrent !== '-' ? Number(rawCurrent) : finalInvested;
                        const finalUnits = units ? Number(String(units).replace(/[^0-9.]/g, '')) : undefined;
                        const finalSip = sip ? Number(String(sip).replace(/[^0-9.]/g, '')) : undefined;
                        
                        let finalDate = new Date().toISOString();
                        if (date) {
                            const parsedDate = new Date(date);
                            if (!isNaN(parsedDate.getTime())) finalDate = parsedDate.toISOString();
                        }

                        if (!finalName || isNaN(finalInvested)) {
                            const lowerN = finalName.toLowerCase();
                            if (!finalName || lowerN.includes('total') || lowerN.includes('generated') || lowerN.includes('statement') || lowerN.includes('report')) return;
                            errors.push(`Row ${index + 1}: Incomplete data.`);
                            return;
                        }

                        let type: any = 'Other';
                        const lowerName = finalName.toLowerCase();
                        if (lowerName.includes('fund') || lowerName.includes('growth') || lowerName.includes('direct') || lowerName.includes('equity') || lowerName.includes('nifty')) type = 'Mutual Fund';
                        if (lowerName.includes('beees') || lowerName.includes(' etf') || rowKeys['isin'] || rowKeys['scripcode'] || rowKeys['symbol']) type = 'Stock';

                        validData.push({
                            name: finalName,
                            type: type,
                            investedAmount: finalInvested,
                            currentValue: finalCurrent,
                            units: finalUnits,
                            sipAmount: finalSip,
                            purchaseDate: finalDate,
                        });
                    });

                    if (validData.length === 0 && errors.length === 0) {
                        setImportErrors(["No valid investment rows detected."]);
                    } else {
                        setImportErrors(errors);
                        setImportData(validData);
                        setImportSuccessCount(validData.length);
                    }
                }
            });
        };

        const reader = new FileReader();
        if (isExcel) {
            reader.onload = (event) => {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const csv = XLSX.utils.sheet_to_csv(worksheet);
                processDataString(csv);
            };
            reader.readAsArrayBuffer(file);
        } else {
            reader.onload = (event) => {
                processDataString(event.target?.result as string);
            };
            reader.readAsText(file);
        }
    };

    const downloadTemplate = () => {
        const headers = ["Name", "Type", "InvestedAmount", "CurrentValue", "Units", "SIPAmount", "PurchaseDate"];
        const example = ["HDFC Bank", "Stock", "50000", "55000", "50", "0", "2024-01-01"];
        const csv = Papa.unparse([headers, example]);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "money_code_portfolio_template.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const confirmImport = async () => {
        if (importData.length === 0) return;
        setImportMFLoading(true);
        try {
            let miscGoalId: string | null = null;
            const needsMisc = importData.some(item => !(item as any).goalId || (item as any).goalId === 'new-misc');
            if (needsMisc) miscGoalId = await ensureMiscGoal('new-misc');
            const savePromises = importData.map(item => {
                const itemGoalId = (item as any).goalId;
                const targetId = (!itemGoalId || itemGoalId === 'new-misc') ? miscGoalId : itemGoalId;
                return saveInvestment({ ...item, goalId: targetId });
            });
            await Promise.all(savePromises);
            await load();
            setImportData([]);
            setImportSuccessCount(0);
            setShowImportModal(false);
            alert("Success! All assets have been added to your vault.");
        } catch (e) {
            console.error("Bulk import failed", e);
        } finally {
            setImportMFLoading(false);
        }
    };

    const totalInvested = investments.reduce((sum, inv) => sum + inv.investedAmount, 0);
    const currentTotalValue = investments.reduce((sum, inv) => sum + inv.currentValue, 0);
    const totalPL = currentTotalValue - totalInvested;
    const totalPLP = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
    const portfolioReturn = calculatePortfolioReturn(investments);
    const portfolioAnnReturn = calculatePortfolioAnnualizedReturn(investments);

    const indexComparison = useMemo(() => {
        const benchmarks = [
            { name: 'Portfolio', return: portfolioAnnReturn, color: '#6366f1' },
            { name: 'Nifty 50', return: BENCHMARK_DATA['Nifty 50'][benchmarkPeriod], color: '#10b981' },
            { name: 'Nifty Midcap', return: BENCHMARK_DATA['Nifty Midcap 100'][benchmarkPeriod], color: '#a855f7' },
            { name: 'Nifty Smallcap', return: BENCHMARK_DATA['Nifty Smallcap 250'][benchmarkPeriod], color: '#ec4899' },
            { name: 'Gold (MCX)', return: BENCHMARK_DATA['Gold (MCX)'][benchmarkPeriod], color: '#f59e0b' },
            { name: 'Fixed Deposit', return: BENCHMARK_DATA['Fixed Deposit'][benchmarkPeriod], color: '#94a3b8' }
        ];
        return benchmarks.sort((a, b) => b.return - a.return);
    }, [portfolioAnnReturn, benchmarkPeriod]);

    const allocationData = useMemo(() => Object.values(investments.reduce((acc: any, inv) => {
        if (!acc[inv.type]) acc[inv.type] = { name: inv.type, value: 0 };
        acc[inv.type].value += inv.currentValue;
        return acc;
    }, {})), [investments]);

    // Same score as the "Deep analysis" report, so the ring and the report never disagree
    const diversificationScore = useMemo(() => {
        const audit = analyzePortfolioLocal(investments, lang);
        return typeof audit === 'string' ? 0 : audit.healthScore;
    }, [investments, lang]);

    const visibleInvestments = useMemo(() => {
        const list = typeFilter === 'All' ? [...investments] : investments.filter(i => i.type === typeFilter);
        const ret = (i: Investment) => (i.investedAmount > 0 ? (i.currentValue - i.investedAmount) / i.investedAmount : 0);
        if (sortBy === 'value') list.sort((x, y) => y.currentValue - x.currentValue);
        else if (sortBy === 'return') list.sort((x, y) => ret(y) - ret(x));
        else list.sort((x, y) => x.name.localeCompare(y.name));
        return list;
    }, [investments, typeFilter, sortBy]);


    if(loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">
                            {t.portfolio}
                        </h2>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-1">
                            <ShieldCheck size={12} className="text-emerald-500"/> Your holdings • values update when you sync or edit
                        </p>
                    </div>
                </div>
                <div className="bg-surface/50 border border-border backdrop-blur-md rounded-xl p-1.5 flex text-[10px] font-black uppercase tracking-tighter">
                    <button 
                        onClick={() => setActiveTab('holdings')} 
                        className={`px-5 py-2 rounded-lg transition-all ${activeTab === 'holdings' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
                    >
                        {t.allHoldings}
                    </button>
                    <button 
                        onClick={() => setActiveTab('sync')} 
                        className={`px-5 py-2 rounded-lg transition-all flex items-center gap-2 ${activeTab === 'sync' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-500 hover:text-white'}`}
                    >
                        <Sparkles size={12} /> {t.smartSync}
                    </button>
                </div>
            </div>

            {activeTab === 'holdings' ? (
                <>
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                        <Card className="p-1 px-4 bg-gradient-to-r from-indigo-500/10 via-transparent to-transparent border-indigo-500/20 flex items-center justify-between">
                            <div className="flex items-center gap-4 py-2">
                                <div className="relative w-12 h-12 flex items-center justify-center">
                                    <svg className="w-12 h-12 -rotate-90">
                                        <circle cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                                        <circle cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray={126} strokeDashoffset={126 - (126 * diversificationScore) / 100} className={diversificationScore > 70 ? 'text-emerald-500' : diversificationScore > 40 ? 'text-amber-500' : 'text-red-500'} strokeLinecap="round" />
                                    </svg>
                                    <span className="absolute text-[10px] font-black">{diversificationScore}</span>
                                </div>
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-300">{t.healthScore}</h4>
                                    <p className="text-[10px] text-gray-500 italic">
                                        {diversificationScore > 75 ? t.optimallyDiversified : diversificationScore > 50 ? t.moderateConcentration : t.highlyConcentrated}
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={runAIAnalysis} className="text-xs font-bold text-indigo-400 italic group">
                                {t.deepAnalysis} <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Card>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <Card className="flex flex-col justify-center items-center py-12 bg-gradient-to-br from-indigo-500/10 via-indigo-600/5 to-transparent border-indigo-500/20 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Activity size={120} />
                            </div>
                            <div className="relative text-center space-y-2 z-10">
                                <p className="text-gray-500 text-[10px] uppercase font-black tracking-[0.3em] mb-4">{t.consolidatedValue}</p>
                                <p className="text-lg sm:text-2xl md:text-4xl font-black text-white tracking-tighter italic">₹{currentTotalValue.toLocaleString()}</p>
                                <div className="flex flex-col items-center gap-2 pt-4">
                                    <div className={`flex items-center gap-2 px-6 py-2 rounded-2xl text-sm font-black ${totalPL >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                        {totalPL >= 0 ? <TrendingUp size={16}/> : <TrendingUp size={16} className="rotate-180"/>}
                                        {totalPL >= 0 ? '+' : ''}{totalPLP.toFixed(2)}% {t.absoluteReturn}
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                        {t.totalPL}: <span className={totalPL >= 0 ? 'text-emerald-500' : 'text-red-500'}>{totalPL < 0 ? '-' : '+'}₹{Math.abs(totalPL).toLocaleString()}</span>
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-5 bg-surface/30 border-white/5">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                    <Scale size={14} /> {t.benchmarkAnalytics}
                                </h4>
                                <div className="flex bg-white/5 p-0.5 rounded-lg">
                                    {(['1y', '3y', '5y', '10y'] as const).map(p => (
                                        <button 
                                            key={p} 
                                            onClick={() => setBenchmarkPeriod(p)}
                                            className={`px-2 py-0.5 text-[8px] font-black uppercase rounded transition-all ${benchmarkPeriod === p ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                {indexComparison.map(idx => (
                                    <div key={idx.name} className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-black uppercase">
                                            <span className={idx.name === 'Portfolio' ? 'text-indigo-400' : 'text-gray-400'}>{idx.name}</span>
                                            <span className="text-gray-300">{idx.return}%</span>
                                        </div>
                                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.max(5, (idx.return / (Math.max(...indexComparison.map(x => x.return)) || 1)) * 100)}%` }}
                                                className="h-full rounded-full"
                                                style={{ backgroundColor: idx.color }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 text-[8px] text-gray-600 uppercase font-bold text-center italic">Index figures are fixed reference values, not live. Your figure is annualised since purchase.</p>
                        </Card>

                        <Card className="md:col-span-2 flex flex-col md:flex-row items-center gap-8 py-6 bg-surface/30 border-white/5">
                            <div className="w-48 h-48 relative">
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-[10px] font-black text-gray-500 uppercase">Diversified</span>
                                    <span className="text-xl font-black">{allocationData.length} Types</span>
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={allocationData} innerRadius={65} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                                            {allocationData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-4 w-full pr-4">
                                {allocationData.map((d: any, i: number) => (
                                    <div key={d.name} className="flex items-center justify-between group cursor-default">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                            <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors">{d.name}</span>
                                        </div>
                                        <span className="text-[10px] font-black text-gray-500 bg-white/5 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                            {((d.value / (currentTotalValue || 1)) * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20"><Briefcase size={16}/></div>
                            <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">Tactical Asset List</h3>
                        </div>
                        <div className="flex items-center gap-2">
                             <Button variant="secondary" size="sm" onClick={handleSyncPrices} disabled={syncing} className="h-9 px-4 text-[10px] font-black uppercase tracking-widest">
                                {syncing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} className="mr-2" />}
                                Sync Prices
                            </Button>
                            <Button variant="outline" size="sm" onClick={runAIAnalysis} disabled={analyzing} className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-indigo-500/30 text-indigo-400">
                                {analyzing ? <Loader2 className="animate-spin" size={14} /> : <Bot size={14} className="mr-2" />}
                                Portfolio Audit
                            </Button>
                            <Button size="sm" onClick={() => setShowModal(true)} className="h-9 px-4 text-[10px] font-black uppercase tracking-widest"><Plus size={14} className="mr-2"/> New Entry</Button>
                        </div>
                    </div>

                    <div ref={analysisRef}>
                        {aiAnalysis && (
                            <Card className="bg-indigo-950/20 border-indigo-500/30 p-8 relative overflow-hidden mb-8">
                                <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl opacity-50" />
                                
                                <div className="flex justify-between items-center mb-8 pb-4 border-b border-indigo-500/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                            <Sparkles size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Portfolio Check-up</h3>
                                            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Rule-based review of your mix</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setAiAnalysis(null)} className="p-2 text-gray-500 hover:text-white transition-colors bg-white/5 rounded-lg">
                                        <X size={20} />
                                    </button>
                                </div>

                                {typeof aiAnalysis === 'string' ? (
                                    <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed italic border-l-2 border-indigo-500/30 pl-4 py-2">
                                        {aiAnalysis}
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {/* Crucial Insight drill-down - Top & Blinking - Max 2 lines */}
                                        <motion.div 
                                            initial={{ opacity: 0.8, y: -20 }}
                                            animate={{ 
                                                opacity: [0.8, 1, 0.8],
                                                backgroundColor: ['rgba(99, 102, 241, 0.1)', 'rgba(99, 102, 241, 0.25)', 'rgba(99, 102, 241, 0.1)']
                                            }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                            className="p-5 border-2 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)] rounded-2xl relative"
                                        >
                                            <div className="absolute -top-3 left-4 bg-indigo-500 text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest text-white shadow-lg">
                                                Priority Intelligence
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-inner">
                                                    <ShieldAlert size={28} className="animate-pulse" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-base font-black text-white leading-tight uppercase tracking-tight line-clamp-2">
                                                        {aiAnalysis.crucialInsight}
                                                    </p>
                                                    <p className="text-[9px] text-indigo-300 font-bold uppercase mt-1 tracking-widest">Crucial Portfolio Drill-Down Finding</p>
                                                </div>
                                            </div>
                                        </motion.div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="flex items-center gap-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                                                <div className="relative w-20 h-20 shrink-0">
                                                    <svg className="w-20 h-20 -rotate-90">
                                                        <circle cx="40" cy="40" r="35" fill="transparent" stroke="currentColor" strokeWidth="6" className="text-white/5" />
                                                        <motion.circle 
                                                            initial={{ strokeDashoffset: 220 }}
                                                            animate={{ strokeDashoffset: 220 - (220 * aiAnalysis.healthScore) / 100 }}
                                                            cx="40" cy="40" r="35" fill="transparent" stroke="currentColor" strokeWidth="6" 
                                                            strokeDasharray={220} 
                                                            className={aiAnalysis.healthScore > 70 ? 'text-emerald-500' : aiAnalysis.healthScore > 40 ? 'text-amber-500' : 'text-red-500'} 
                                                            strokeLinecap="round" 
                                                        />
                                                    </svg>
                                                    <span className="absolute inset-0 flex items-center justify-center text-xl font-black">{aiAnalysis.healthScore}</span>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Audit Score</p>
                                                    <p className="text-sm font-bold text-white">{aiAnalysis.healthScore > 80 ? 'Exceptional' : aiAnalysis.healthScore > 60 ? 'Healthy' : 'Needs Tuning'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400">
                                                    <AlertTriangle size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Risk Profile</p>
                                                    <p className={`text-sm font-bold uppercase ${aiAnalysis.riskLevel === 'High' ? 'text-red-400' : aiAnalysis.riskLevel === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`}>{aiAnalysis.riskLevel}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                                                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                    <Zap size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Action Required</p>
                                                    <p className="text-sm font-bold text-white">{aiAnalysis.topActionItems.length} Milestones</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                                    <PieChartIcon size={14} /> Allocation Strategy
                                                </h4>
                                                <div className="h-64 bg-white/5 rounded-3xl p-4 border border-white/5">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={aiAnalysis.suggestedAllocation} layout="vertical">
                                                            <XAxis type="number" hide />
                                                            <YAxis dataKey="name" type="category" hide />
                                                            <Tooltip 
                                                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                                            />
                                                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                                                {aiAnalysis.suggestedAllocation.map((_, index) => (
                                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                ))}
                                                            </Bar>
                                                            <Legend verticalAlign="top" iconType="circle" />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <p className="text-[10px] text-gray-500 italic text-center">Generic reference mix (60/30/10). Not personalised advice.</p>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                                    <TrendingUp size={14} /> Diversification Pulse
                                                </h4>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {aiAnalysis.diversificationInsights.map((insight, idx) => (
                                                        <div key={idx} className="flex gap-4 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors group">
                                                            <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${
                                                                insight.status === 'alert' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                                insight.status === 'warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                            }`}>
                                                                {insight.status === 'alert' ? <AlertTriangle size={14}/> : insight.status === 'warning' ? <ShieldAlert size={14}/> : <ShieldCheck size={14}/>}
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">{insight.category}</p>
                                                                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-tight">{insight.message}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Strategic Recommendation Roadmap */}
                                        <Card className="p-8 bg-gradient-to-br from-indigo-950/40 via-surface to-surface border-indigo-500/20">
                                             <div className="flex justify-between items-center mb-8">
                                                 <div className="space-y-1">
                                                     <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                                                         Strategic Wealth Roadmap
                                                         <Bot size={18} className="text-indigo-400" />
                                                     </h3>
                                                     <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Optimized Execution Path</p>
                                                 </div>
                                                 <div className="px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">
                                                     Proprietary AI Strategy
                                                 </div>
                                             </div>

                                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                 <div className="space-y-6">
                                                     <div className="p-4 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden group">
                                                         <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/5 rounded-full blur-xl group-hover:scale-150 transition-transform" />
                                                         <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                             Primary Objective
                                                         </p>
                                                         <RichText text={aiAnalysis.summary} className="text-sm text-gray-200 leading-relaxed border-l-2 border-indigo-500/30 pl-3" />
                                                     </div>

                                                     {aiAnalysis.marketComparison && (
                                                         <div className="mt-8 pt-6 border-t border-indigo-500/10">
                                                             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400/60 mb-4 flex items-center gap-2">
                                                                 <Globe size={14} /> Competitive Pulse: Indian Money Code vs {aiAnalysis.marketComparison.competitor}
                                                             </h4>
                                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                 <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                                                     <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1">Our Advantage</p>
                                                                     <p className="text-xs text-indigo-100/80 leading-snug">{aiAnalysis.marketComparison.yourEdge}</p>
                                                                 </div>
                                                                 <div className="p-3 bg-white/5 rounded-xl border border-white/5 opacity-60">
                                                                     <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Standard Industry Feature</p>
                                                                     <p className="text-xs text-gray-500 leading-snug">{aiAnalysis.marketComparison.competitorFeature}</p>
                                                                 </div>
                                                             </div>
                                                         </div>
                                                     )}
                                                 </div>

                                                 <div className="space-y-4">

                                                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">What to do next</p>
                                                     <div className="space-y-3">
                                                         {aiAnalysis.topActionItems.map((action, i) => (
                                                             <motion.div 
                                                                key={i}
                                                                initial={{ opacity: 0, x: 20 }}
                                                                whileInView={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: i * 0.1 }}
                                                                className="flex gap-4 p-4 bg-surface/80 border border-white/5 rounded-xl hover:bg-surface transition-all group"
                                                             >
                                                                 <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-sm group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-inner shrink-0">
                                                                     {i + 1}
                                                                 </div>
                                                                 <p className="text-xs font-bold text-gray-200 leading-tight">
                                                                     {action}
                                                                 </p>
                                                             </motion.div>
                                                         ))}
                                                     </div>
                                                     <Button className="w-full h-12 text-[10px] bg-indigo-600 hover:bg-indigo-500 font-black uppercase mt-4 shadow-xl shadow-indigo-600/20" onClick={() => setAiAnalysis(null)}>Got it</Button>
                                                 </div>
                                             </div>
                                        </Card>
                                    </div>
                                )}
                            </Card>
                        )}
                    </div>

                    {syncMsg && <p className="text-xs text-gray-400 bg-white/5 border border-white/10 rounded-xl px-4 py-3">{syncMsg}</p>}
                {investments.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                        {['All', ...Array.from(new Set(investments.map(i => i.type)))].map(ty => (
                            <button key={ty} onClick={() => setTypeFilter(ty)} className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${typeFilter === ty ? 'bg-primary text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>{ty}</button>
                        ))}
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="ml-auto bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs font-bold text-gray-300">
                            <option value="value">Sort: Largest</option>
                            <option value="return">Sort: Best return</option>
                            <option value="name">Sort: A to Z</option>
                        </select>
                    </div>
                )}
                    <div className="grid grid-cols-1 gap-4">
                        {investments.length === 0 ? (
                            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-20">
                                <Briefcase size={64} className="mx-auto mb-4" />
                                <p className="font-black italic">No assets detected. Forge your portfolio manually or use Smart Sync.</p>
                            </div>
                        ) : (
                            visibleInvestments.map(inv => {
                                const gain = inv.currentValue - inv.investedAmount;
                                const gainP = inv.investedAmount > 0 ? (gain / inv.investedAmount) * 100 : 0;
                                const linkedGoalName = availableGoals.find(g => g.id === inv.goalId)?.name || 'Miscellaneous';
                                
                                // Enhanced Benchmark Return Display
                                const annRet = calculateAnnualizedReturn(inv.investedAmount, inv.currentValue, inv.purchaseDate);
                            const comparable = !!inv.purchaseDate && (Date.now() - new Date(inv.purchaseDate).getTime()) >= 365 * 86400000;
                            const displayBenchmark = inv.benchmarkReturn !== undefined 
                                    ? { name: inv.benchmarkName || 'Index', return: inv.benchmarkReturn }
                                    : getDefaultBenchmark(inv.type);

                                 return (
                                    <Card key={inv.id} className="group p-6 bg-surface/40 border-white/5 hover:border-primary/40 transition-all shadow-xl shadow-black/20">
                                        <div className="flex flex-col lg:flex-row justify-between gap-8">
                                            <div className="flex-1 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-2xl bg-white/5 border border-white/5 group-hover:border-primary/20 transition-colors`}>
                                                            {inv.type === 'Stock' ? <TrendingUp size={20} className="text-primary"/> : inv.type === 'Mutual Fund' ? <Landmark size={20} className="text-emerald-400"/> : <Briefcase size={20} className="text-amber-400"/>}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-2xl text-white italic group-hover:text-primary transition-colors tracking-tight">{inv.name}</h4>
                                                            <div className="flex gap-2 mt-1">
                                                                <span className="text-[9px] font-black bg-white/5 text-gray-500 px-2 py-0.5 rounded uppercase tracking-[0.1em] border border-white/5">{inv.type}</span>
                                                                <span className="text-[9px] font-black bg-white/5 text-indigo-400 px-2 py-0.5 rounded uppercase tracking-[0.1em] border border-indigo-500/10">Goal: {linkedGoalName}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                {inv.sipAmount && (
                                                    <div className="inline-flex items-center gap-2 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                                                        <Zap size={14}/> ACTIVE SIP: ₹{inv.sipAmount.toLocaleString()} / mo
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 sm:gap-x-4 md:gap-x-8 lg:gap-x-12 gap-y-4 items-center">
                                                <div className="space-y-1">
                                                    <p className="text-[8px] sm:text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-tight">{t.units}</p>
                                                    <p className="font-black text-white text-xs sm:text-base tracking-tight truncate">{inv.units?.toLocaleString() || '--'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-tight">{t.investedAmount}</p>
                                                    <p className="font-black text-gray-400 text-sm sm:text-lg tracking-tight truncate">₹{inv.investedAmount.toLocaleString()}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[8px] sm:text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-tight">{t.currentVal}</p>
                                                    <p className="font-black text-white text-sm sm:text-lg tracking-tighter truncate">₹{inv.currentValue.toLocaleString()}</p>
                                                </div>
                                                <div className="flex flex-col lg:items-end justify-center pt-2 lg:pt-0 border-t border-white/5 lg:border-none px-1">
                                                    <p className="text-[8px] sm:text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5 leading-tight lg:text-right">Return</p>
                                                    <div className="flex items-baseline gap-2 lg:flex-col lg:items-end lg:gap-0">
                                                        <p className={`font-black text-sm sm:text-lg leading-none ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {calculateAbsoluteReturn(inv.investedAmount, inv.currentValue)}%
                                                            </p>
                                                        <p className="text-[8px] text-gray-600 font-bold uppercase truncate">
                                                            {gain < 0 ? '-' : '+'}₹{Math.abs(gain).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                    
                                                    {/* Benchmark UI - Hidden for Mutual Funds as requested */}
                                                    {inv.type !== 'Mutual Fund' && comparable ? (
                                                        <div className="text-right border-l border-white/10 pl-6 hidden sm:block">
                                                            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest flex items-center justify-end gap-1">
                                                                <BarChart3 size={10} /> vs Index
                                                            </p>
                                                            <div className="flex items-baseline justify-end gap-2">
                                                                <div className="text-right">
                                                                    <p className="text-[8px] text-gray-500 uppercase font-bold">You (p.a.)</p>
                                                                    <p className={`font-black text-xs ${annRet > displayBenchmark.return ? 'text-emerald-400' : 'text-white'}`}>
                                                                        {annRet}%
                                                                    </p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[8px] text-gray-500 uppercase font-bold">{displayBenchmark.name}</p>
                                                                    <p className="font-black text-xs text-gray-400">
                                                                        {displayBenchmark.return}%
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1 mt-4 lg:mt-0">
                                                                <Button variant="ghost" className="h-10 w-10 p-0 hover:bg-white/5" onClick={() => handleEdit(inv)}>
                                                                    <Pencil size={18} />
                                                                </Button>
                                                                <Button variant="ghost" className="h-10 w-10 p-0 hover:bg-red-500/10 hover:text-red-500" onClick={async () => { if(confirm(`Erase ${inv.name} from vault?`)) { await deleteInvestment(inv.id); load(); }}}>
                                                                    <Trash2 size={18} />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" className="h-10 w-10 p-0 hover:bg-white/5" onClick={() => handleEdit(inv)}>
                                                                <Pencil size={18} />
                                                            </Button>
                                                            <Button variant="ghost" className="h-10 w-10 p-0 hover:bg-red-500/10 hover:text-red-500" onClick={async () => { if(confirm(`Erase ${inv.name} from vault?`)) { await deleteInvestment(inv.id); load(); }}}>
                                                                <Trash2 size={18} />
                                                            </Button>
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Card className="p-6 bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30 transition-all cursor-default relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <FileSearch size={100} />
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
                                    <Sparkles size={24}/>
                                </div>
                                <h4 className="text-lg font-black italic text-white flex items-center gap-2">{t.aiStatementParser}</h4>
                                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                                    Upload **PDF Consolidated Account Statements (CAS)** from CAMS/KFintech or direct portal downloads. Our AI logic extracts every scheme, unit, and cost basis automatically.
                                </p>
                                <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-500 font-bold flex gap-3 items-center italic">
                                    <ShieldAlert size={16} className="shrink-0" />
                                    <span>Your statement is sent to an AI service (DeepSeek) to pick out your holdings. We don't keep the file and nothing is added until you review it. Remove account numbers if you can.</span>
                                </div>
                                <div className="mt-6 relative">
                                    <input type="file" accept=".pdf,.csv,.xlsx,.xls" className="absolute inset-0 opacity-0 cursor-pointer w-full" onChange={handleMFUpload} disabled={importMFLoading} />
                                    <Button className="w-full bg-emerald-500 hover:bg-emerald-600 font-black uppercase text-xs tracking-widest h-12" disabled={importMFLoading}>
                                        {importMFLoading ? <Loader2 className="animate-spin" /> : "Upload CAS PDF/Images"}
                                    </Button>
                                </div>
                            </Card>

                            <Card className="p-6 bg-blue-500/5 border-blue-500/10 hover:border-blue-500/30 transition-all cursor-default relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                     <UploadCloud size={100} />
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4 border border-blue-500/20">
                                    <FileUp size={24}/>
                                </div>
                                <h4 className="text-lg font-black italic text-white flex items-center gap-2">Broker CSV Importer</h4>
                                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                                    Import holdings from **Zerodha (Coin), Groww, or Upstox**. Download their Excel/CSV export and drop it here for native mapping.
                                </p>
                                <div className="mt-6 flex gap-2">
                                    <Button variant="outline" className="flex-1 text-[10px] font-black uppercase tracking-widest border-white/10" onClick={downloadTemplate}>Template</Button>
                                    <Button className="flex-1 bg-blue-500 hover:bg-blue-600 font-black uppercase text-[10px] tracking-widest h-12" onClick={() => setShowImportModal(true)}>
                                        Drop CSV File
                                    </Button>
                                </div>
                            </Card>
                        </div>
                        <Card className="p-8 space-y-6 bg-surface/30 border-white/5">
                            <h3 className="font-black text-xs uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                <ShieldCheck size={16} className="text-emerald-500"/> Privacy & Precision Manifesto
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <p className="text-white font-black text-xs italic">AI Extraction</p>
                                    <p className="text-[10px] text-gray-500 leading-relaxed">Statements are sent to an AI service (DeepSeek) to be read. We don't keep the file.</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-white font-black text-xs italic">Platform Native</p>
                                    <p className="text-[10px] text-gray-500 leading-relaxed">Specific parsing engines for Zerodha, Groww, and CAMS ensure units are captured to 4 decimal places.</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-white font-black text-xs italic">Audit Control</p>
                                    <p className="text-[10px] text-gray-500 leading-relaxed">Every extracted asset goes through a Review Modal. You commit only what you verify.</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="p-6 space-y-4 bg-indigo-500/5 border-indigo-500/10">
                            <div className="flex items-center gap-2 text-indigo-400">
                                <TrendingUp size={18} />
                                <h4 className="font-black text-xs uppercase tracking-widest">Why Sync?</h4>
                            </div>
                            <ul className="space-y-4">
                                <li className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5"><Check size={10} strokeWidth={4}/></div>
                                    <p className="text-[11px] text-gray-400 leading-tight">Identify **Undertracked Funds** hiding in old folios.</p>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5"><Check size={10} strokeWidth={4}/></div>
                                    <p className="text-[11px] text-gray-400 leading-tight">Verify actual **Purchase Cost** against current NAV for tax harvesting.</p>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5"><Check size={10} strokeWidth={4}/></div>
                                    <p className="text-[11px] text-gray-400 leading-tight">Automate **Asset Rebalancing** across all brokerage accounts.</p>
                                </li>
                            </ul>
                        </Card>
                    </div>
                </div>
            )}

            <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingInvestment(null); }} title={editingInvestment ? `Forge ${editingInvestment.name}` : "Forge New Asset"}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Asset Name</label>
                            <Input placeholder="e.g. Nifty 50 Index Fund" value={iName} onChange={e => setIName(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Asset Type</label>
                            <Select value={iType} onChange={e => setIType(e.target.value)}>
                                <option value="Stock">Stock / Equity</option>
                                <option value="Mutual Fund">Mutual Fund</option>
                                <option value="Crypto">Crypto Asset</option>
                                <option value="Gold">Gold / SGB</option>
                                <option value="FD">Fixed Deposit</option>
                                <option value="PPF">PPF / EPF</option>
                                <option value="Bond">Bond / Debt</option>
                                <option value="Other">Other Asset</option>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Wealth Goal</label>
                            <Select value={selectedGoalId} onChange={e => setSelectedGoalId(e.target.value)}>
                                <option value="">Miscellaneous</option>
                                {availableGoals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                <option value="new-misc">+ New Misc Goal</option>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Principal Invested</label>
                            <Input type="number" placeholder="₹" value={iAmt} onChange={e => setIAmt(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Current Value</label>
                            <Input type="number" placeholder="₹" value={iVal} onChange={e => setIVal(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Units / Qty</label>
                            <Input type="number" placeholder="Optional" value={iUnits} onChange={e => setIUnits(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Purchase Date</label>
                            <Input type="date" value={iDate} onChange={e => setIDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="pt-2">
                        <Button className="w-full h-12 font-black uppercase tracking-widest" onClick={handleSave}>
                            {editingInvestment ? "Seal Changes" : "Forge Entry"}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showMFReview} onClose={() => setShowMFReview(false)} title="MF Statement Review">
                <div className="space-y-4">
                    <div className="bg-black/20 p-3 rounded-lg flex items-center gap-3 border border-white/5">
                        <Bot size={24} className="text-primary animate-pulse shrink-0" />
                        <p className="text-xs text-gray-400 leading-relaxed italic">
                            AI is analyzing your holdings. We support statements from **CAS (CAMS/KFin)**.
                        </p>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto pr-2 space-y-3 thin-scrollbar">
                        {pendingInvestments.map((inv, idx) => (
                            <div key={idx} className="bg-surface p-3 rounded-lg border border-border flex justify-between items-center group">
                                <div className="flex-1 min-w-0 pr-4">
                                    <h5 className="font-bold text-sm truncate">{inv.name}</h5>
                                    <div className="flex gap-2 mt-1 flex-wrap">
                                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase text-[8px]">{inv.type}</span>
                                        <span className="text-[10px] text-gray-500 font-bold">{inv.units} Units</span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-black text-sm text-white">₹{inv.currentValue?.toLocaleString() || inv.investedAmount.toLocaleString()}</p>
                                    <button onClick={() => setPendingInvestments(prev => prev.filter((_, i) => i !== idx))} className="text-[10px] text-red-400/60 hover:text-red-400 font-bold uppercase transition-all opacity-0 group-hover:opacity-100 underline decoration-red-400/30 block w-full text-right">Drop</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setShowMFReview(false)}>Cancel</Button>
                        <Button className="flex-1" onClick={confirmMFImport} disabled={importMFLoading}>
                            {importMFLoading ? <Loader2 className="animate-spin" /> : `Commit All (${pendingInvestments.length})`}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showImportModal} onClose={() => { setShowImportModal(false); setImportData([]); setImportSuccessCount(0); }} title="Smart Asset Importer">
                <div className="space-y-6">
                    {!importData.length ? (
                        <div className="space-y-6">
                            <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 transition-all hover:border-primary/40 group relative overflow-hidden bg-white/5">
                                <input type="file" accept=".csv,.xlsx,.xls,.pdf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                <div className="text-center space-y-4">
                                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary group-hover:scale-110 transition-transform shadow-xl shadow-primary/5">
                                        <UploadCloud size={32} />
                                    </div>
                                    <div>
                                        <p className="font-black text-white italic">Drop your Broker Stats here</p>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">Accepts CSV, XLSX, XLS</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 thin-scrollbar">
                                {importData.map((item, idx) => (
                                    <div key={idx} className="bg-surface/50 p-4 rounded-xl border border-border group hover:border-primary/20 transition-all">
                                        <div className="flex justify-between items-start gap-4 mb-3">
                                            <div className="min-w-0 flex-1">
                                                <h5 className="font-black text-white italic truncate">{item.name}</h5>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-[9px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border border-white/5">{item.type}</span>
                                                    <span className="text-[9px] text-primary font-bold uppercase tracking-tighter">₹{item.investedAmount.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => { const newData = [...importData]; newData.splice(idx, 1); setImportData(newData); setImportSuccessCount(newData.length); }} className="text-gray-600 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-white/5">
                                <Button variant="outline" className="flex-1 font-black uppercase text-[10px] tracking-widest" onClick={() => setShowImportModal(false)}>Discard</Button>
                                <Button className="flex-1 font-black uppercase text-[10px] tracking-widest bg-emerald-500 hover:bg-emerald-600 text-black" onClick={confirmImport} disabled={importMFLoading}>
                                    {importMFLoading ? <Loader2 size={14} className="animate-spin" /> : `Add All to Vault`}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            <Modal isOpen={showPdfPasswordModal} onClose={() => { setShowPdfPasswordModal(false); setPdfPassword(''); setPendingPdfFile(null); }} title="Unlock Protected Statement">
                <div className="space-y-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 border border-amber-500/20">
                            <Lock size={32} />
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-white italic">Protected PDF Detected</h4>
                            <p className="text-xs text-gray-400 mt-1">Enter the password used to encrypt this file.</p>
                        </div>
                    </div>
                    <div className="space-y-4 bg-white/5 p-4 rounded-xl border border-white/10">
                        <Input type="password" label="PDF Password" placeholder="Enter password..." value={pdfPassword} onChange={(e) => setPdfPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handlePdfPasswordSubmit()} />
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 font-black uppercase text-[10px] tracking-widest" onClick={() => setShowPdfPasswordModal(false)}>Cancel</Button>
                        <Button className="flex-1 bg-primary text-black font-black uppercase tracking-widest text-[10px]" disabled={!pdfPassword || pdfParsing} onClick={handlePdfPasswordSubmit}>
                            {pdfParsing ? <Loader2 className="animate-spin" size={14} /> : "Decrypt & Import"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PortfolioPage;
