import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Loader2, Check, RefreshCw, Bell, ChevronRight, MessageSquare, Bot, Lock, BarChart3, Languages
} from 'lucide-react';

import { 
    User, ViewState
} from './types';
import { Language, translations } from './translations';
import { 
    logoutUser, subscribeToAuth,
    resendVerificationEmail, checkEmailVerificationStatus, 
    trackAppEvent, addTransaction, getBudgets,
    getInvestments, getLoans, getInsurance
} from './services/dataService';
import { 
    requestNotificationPermission, scheduleLocalNotification, 
    handleIncomingSms, registerSmsListener, startSmsBackgroundService 
} from './services/nativeBridge';

import { Navbar, Sidebar, BottomNav } from './components/Layout';
import { Card, Button, Modal, Input, Select } from './components/ui';
import { AuthLayout, LoginPage, SignupPage } from './components/AuthComponents';
import FinancialAwarenessModal from './components/FinancialAwarenessModal';
import { SplashScreen } from './components/SplashScreen';
import { LockedFeatureGate } from './components/LockedFeatureGate';
import { Transaction, TransactionType, BudgetCategory } from './types';
import { safeStorage } from './services/storage';

// Lazy load pages for performance
const AIChatBot = lazy(() => import('./components/AIChatBot'));
const DashboardPage = lazy(() => import('./components/DashboardPage'));
const BudgetPage = lazy(() => import('./components/BudgetPage'));
const PortfolioPage = lazy(() => import('./components/PortfolioPage'));
import AINotice from './components/AINotice';
const GoalsPage = lazy(() => import('./components/GoalsPage'));
const ReportsPage = lazy(() => import('./components/ReportsPage').then(m => ({ default: m.ReportsPage })));

// Native Lazy components from Pages
const LoansPage = lazy(() => import('./components/Pages').then(m => ({ default: m.LoansPage })));
const InsurancePage = lazy(() => import('./components/Pages').then(m => ({ default: m.InsurancePage })));
const CalculatorsPage = lazy(() => import('./components/Pages').then(m => ({ default: m.CalculatorsPage })));
const AdminAnalyticsPage = lazy(() => import('./components/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const MarketingStudio = lazy(() => import('./components/MarketingStudio').then(m => ({ default: m.MarketingStudio })));

const PageLoader = () => (
    <div className="h-64 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
    </div>
);

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isVerified, setIsVerified] = useState(true);
    const [resending, setResending] = useState(false);
    const [resendStatus, setResendStatus] = useState<string | null>(null);
    const [view, setView] = useState<ViewState>('login');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [splashComplete, setSplashComplete] = useState(false);
    const [lang, setLang] = useState<Language>(() => (safeStorage.getItem('app_lang') as Language) || 'en');

    // SMS Tracking State
    const [pendingSmsTxn, setPendingSmsTxn] = useState<Partial<Transaction> | null>(null);
    const [showSmsModal, setShowSmsModal] = useState(false);
    const [budgets, setBudgets] = useState<BudgetCategory[]>([]);

    // Gamified Level Up State
    const [userLevelData, setUserLevelData] = useState({
        level: 1,
        name: "ROOKIE",
        badgeColor: "gray",
        progress: 15,
        nextLevel: "BUILDER"
    });

    const updateUserLevel = async () => {
        try {
            const [inv, loans, ins] = await Promise.all([
                getInvestments(),
                getLoans(),
                getInsurance()
            ]);
            
            const totalWealth = inv.reduce((sum, i) => sum + i.currentValue, 0);
            const totalDebt = loans.reduce((sum, l) => sum + l.outstanding, 0);
            const netWorth = totalWealth - totalDebt;

            let level = 1;
            let name = "ROOKIE";
            let badgeColor = "gray";
            let nextLevel = "BUILDER";
            let progress = 30;

            if (netWorth >= 5000000) { // ₹50L+ 
                level = 4;
                name = "VANGUARD";
                badgeColor = "purple";
                nextLevel = "ZENITH";
                progress = Math.min(99, Math.round((Math.max(0, netWorth - 5000000) / 25000000) * 100));
            } else if (netWorth >= 2500000) { // ₹25L-₹50L
                level = 3;
                name = "OPTIMIZED";
                badgeColor = "indigo";
                nextLevel = "VANGUARD";
                progress = Math.min(99, Math.round(((netWorth - 2500000) / 2500000) * 100));
            } else if (netWorth >= 500000) { // ₹5L-₹25L
                level = 2;
                name = "BUILDER";
                badgeColor = "blue";
                nextLevel = "OPTIMIZED";
                progress = Math.min(99, Math.round(((netWorth - 500000) / 2000000) * 100));
            } else {
                level = 1;
                name = "ROOKIE";
                badgeColor = "gray";
                nextLevel = "BUILDER";
                progress = Math.min(99, Math.round((Math.max(0, netWorth) / 500000) * 100));
            }

            setUserLevelData({
                level,
                name,
                badgeColor,
                progress,
                nextLevel
            });
        } catch (e) {
            console.error("Failed to estimate user level", e);
        }
    };

    useEffect(() => {
        if (user) {
            updateUserLevel();
        }
    }, [view, user]);

    const t = translations[lang];

    const toggleLang = () => {
        const nextLang = lang === 'en' ? 'hi' : 'en';
        setLang(nextLang);
        safeStorage.setItem('app_lang', nextLang);
    };

    const handleNavigate = (v: ViewState) => {
        setView(v);
        trackAppEvent(`view_${v}`);
    };

    const handleCheckVerification = async () => {
        setResending(true);
        try {
            const verified = await checkEmailVerificationStatus();
            setIsVerified(verified);
            if (verified) {
                setResendStatus("Success! Your email is verified.");
            } else {
                setResendStatus("Email is still not verified.");
            }
        } catch (err) {
            setResendStatus("Status check failed.");
        } finally {
            setResending(false);
            setTimeout(() => setResendStatus(null), 5000);
        }
    };

    const handleResend = async () => {
        setResending(true);
        try {
            await resendVerificationEmail();
            setResendStatus("Verification link sent! Please check your spam folder too.");
        } catch (err: any) {
            console.error("Resend Verification Error:", err);
            const msg = err.message || "Unknown error";
            const code = err.code || "no-code";
            setResendStatus(`Failed: ${code} - ${msg}`);
        } finally {
            setResending(false);
            setTimeout(() => setResendStatus(null), 10000);
        }
    };

    useEffect(() => {
        // Watchdog timer: If Firebase Auth takes too long to respond (e.g. iframe sandbox blockages),
        // gracefully clear loading and let the user access login or Guest Mode.
        const watchdog = setTimeout(() => {
            setAuthLoading((currentLoading) => {
                if (currentLoading) {
                    console.warn("Auth initialization timed out due to sandboxed environment. Gracefully resolving loading state...");
                    setView('login');
                    return false;
                }
                return currentLoading;
            });
        }, 3500);

        const unsubscribe = subscribeToAuth(async (u) => {
            clearTimeout(watchdog);
            setUser(u);
            setAuthLoading(false);
            if (u) {
                if (u.email) safeStorage.setItem('user_email', u.email);
                setView('dashboard');
                trackAppEvent('user_login', { email: u.email });
                
                // Background check for verification to not block initial render
                checkEmailVerificationStatus().then(verified => {
                    setIsVerified(verified);
                }).catch(err => console.warn("Background verification check failed:", err));

                // Initialize SMS tracking if user is logged in
                registerSmsListener((txn) => {
                    setPendingSmsTxn(txn);
                    setShowSmsModal(true);
                });
                
                // Fetch budgets for merchant mapping
                getBudgets().then(setBudgets).catch(e => console.error("Failed to load budgets for SMS mapping", e));
            } else {
                setView('login');
            }
        });
        return () => {
            clearTimeout(watchdog);
            unsubscribe();
        };
    }, []);

    const handleLogout = async () => {
        safeStorage.removeItem('user_email');
        await logoutUser();
        // Listener updates state
    };

    const handleConfirmSmsTxn = async () => {
        if (!pendingSmsTxn || !pendingSmsTxn.amount) return;
        
        try {
            await addTransaction({
                ...pendingSmsTxn,
                id: '', // Will be generated
                date: pendingSmsTxn.date || new Date().toISOString(),
                type: pendingSmsTxn.type || TransactionType.EXPENSE,
                description: pendingSmsTxn.description || pendingSmsTxn.merchant || 'SMS Detected'
            } as Transaction);
            
            trackAppEvent('sms_transaction_added', { merchant: pendingSmsTxn.merchant });
            setShowSmsModal(false);
            setPendingSmsTxn(null);
        } catch (e) {
            console.error("Failed to add SMS transaction:", e);
            alert("Failed to save transaction.");
        }
    };

    if (!splashComplete) return <SplashScreen lang={lang} onComplete={() => setSplashComplete(true)} />;

    if (authLoading) return <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={48} /></div>;

    if (!user) {
        return (
            <AuthLayout>
                {view === 'signup' ? (
                    <SignupPage goToLogin={() => setView('login')} /> 
                ) : (
                    <LoginPage goToSignup={() => setView('signup')} />
                )}
            </AuthLayout>
        );
    }

    return (
        <div className="min-h-screen bg-background text-white flex flex-col pb-16 lg:pb-0">
            <Navbar 
                user={user} 
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
                onLogout={handleLogout}
                setView={handleNavigate}
                lang={lang}
                toggleLang={toggleLang}
            />
            <div className="flex flex-1 relative max-w-[1600px] mx-auto w-full overflow-hidden">
                <Sidebar 
                    isOpen={sidebarOpen} 
                    setView={handleNavigate} 
                    currentView={view} 
                    closeMobile={() => setSidebarOpen(false)} 
                    lang={lang}
                    userLevel={userLevelData.level}
                />
                
                <main className="flex-1 p-4 lg:p-8 overflow-y-auto w-full overflow-x-hidden min-h-0 bg-background/50">
                    <div className="max-w-6xl mx-auto w-full pb-20 lg:pb-0">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={view}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25, ease: "easeInOut" }}
                            >
                                <Suspense fallback={<PageLoader />}>
                                    {view === 'dashboard' && <DashboardPage setView={handleNavigate} lang={lang} userLevel={userLevelData.level} />}
                                    {view === 'budget' && <BudgetPage lang={lang} />}
                                    {view === 'portfolio' && <PortfolioPage lang={lang} />}
                                    {view === 'goals' && <GoalsPage lang={lang} />}
                                    {view === 'reports' && <ReportsPage lang={lang} />}
                                    {view === 'loans' && <LoansPage />}
                                    {view === 'insurance' && <InsurancePage />}
                                    {view === 'calculators' && <CalculatorsPage />}
                                    {view === 'admin-analytics' && <AdminAnalyticsPage />}
                                    {view === 'marketing-studio' && <MarketingStudio />}
                                </Suspense>
                                {view === 'profile' && (
                                    <div className="max-w-md mx-auto mt-10">
                                        <Card>
                                            <div className="text-center mb-6">
                                                <div className="relative inline-block">
                                                    <div className="w-20 h-20 bg-primary rounded-full mx-auto flex items-center justify-center text-3xl font-bold mb-4 shadow-lg shadow-primary/20 border-4 border-white/5">
                                                        {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                                                    </div>
                                                    {isVerified && (
                                                        <div className="absolute -bottom-1 -right-1 bg-green-500 p-1.5 rounded-full border-4 border-surface shadow-xl shadow-green-500/20">
                                                            <Check size={12} className="text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <h2 className="text-2xl font-black">{user.displayName}</h2>
                                                <p className="text-gray-400 text-sm flex items-center justify-center gap-2">
                                                    {user.email}
                                                    {isVerified ? (
                                                        <span className="text-green-500 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-green-500/10 rounded border border-green-500/20">Verified</span>
                                                    ) : (
                                                        <span className="text-amber-500 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">Unverified</span>
                                                    )}
                                                </p>
                                            </div>

                                            {!isVerified && (
                                                <div className="bg-amber-500/5 rounded-xl p-4 mb-6 border border-amber-500/10">
                                                    <p className="text-amber-200 text-xs font-medium mb-3">Verification required for data recovery and security.</p>
                                                    {resendStatus && (
                                                        <p className="text-amber-400 text-[10px] font-bold mb-3 animate-pulse">{resendStatus}</p>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <button 
                                                            disabled={resending}
                                                            onClick={handleCheckVerification}
                                                            className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-2 rounded-lg transition-all border border-white/10 flex items-center justify-center gap-2"
                                                        >
                                                            <RefreshCw size={14} className={resending ? "animate-spin" : ""} /> Refresh
                                                        </button>
                                                        <button 
                                                            disabled={resending}
                                                            onClick={handleResend}
                                                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold py-2 rounded-lg transition-all"
                                                        >
                                                            {resending ? "Sending..." : "Resend Link"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-3">
                                                <div className="pt-4 pb-2">
                                                    <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1 mb-3">Native Mobile Engine</h3>
                                                    <div className="space-y-2">
                                                        <button 
                                                            onClick={async () => {
                                                                const granted = await requestNotificationPermission();
                                                                if (granted) {
                                                                    alert("Notifications are on. We will alert you when a bank SMS is picked up.");
                                                                    await scheduleLocalNotification("Indian Money Code Mobile", "You'll now receive smart nudges for your budget.");
                                                                }
                                                            }}
                                                            className="w-full flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:bg-white/5 transition-all text-left"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                                                    <Bell size={16} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold">Smart Nudges</p>
                                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Budget Alerts</p>
                                                                </div>
                                                            </div>
                                                            <ChevronRight size={16} className="text-gray-500" />
                                                        </button>

                                                        <button 
                                                            onClick={async () => {
                                                                const success = await startSmsBackgroundService();
                                                                if (success) {
                                                                    alert("SMS Permission check triggered. On a native Android device, this will start the listening service.");
                                                                    // Simulate detection 1 second later
                                                                    setTimeout(() => {
                                                                        const mockSms = "Spent ₹ 850.00 at STARBUCKS using ICICI Bank Card xx9012 on 23-Apr-26.";
                                                                        handleIncomingSms(mockSms);
                                                                    }, 1000);
                                                                }
                                                            }}
                                                            className="w-full flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:bg-white/5 transition-all text-left"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                                    <MessageSquare size={16} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold">Smart SMS Tracking</p>
                                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Auto-Expense Detection</p>
                                                                </div>
                                                            </div>
                                                            <div className="bg-indigo-500/10 text-indigo-400 text-[10px] uppercase font-bold px-2 py-1 rounded border border-indigo-500/20">Android Only</div>
                                                        </button>


                                                    </div>
                                                </div>

                                                {user.email === 'kkishore1981@gmail.com' && (
                                                    <Button 
                                                        className="w-full font-bold border-indigo-500/50 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20" 
                                                        variant="outline"
                                                        onClick={() => handleNavigate('admin-analytics')}
                                                    >
                                                        <BarChart3 size={16} className="mr-2"/> View App Heartbeat
                                                    </Button>
                                                )}
                                                <Button className="w-full font-bold" variant="outline">Account Settings</Button>
                                                <Button className="w-full font-bold text-red-400 hover:bg-red-500/10 border-red-500/20" variant="outline" onClick={handleLogout}>Secure Logout</Button>
                                            </div>
                                        </Card>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Simple Financial Disclaimer Footer */}
                        <footer className="mt-12 py-12 border-t border-white/5">
                            <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
                                <div className="flex justify-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                                    <span className="hover:text-indigo-400 cursor-pointer transition-colors">Privacy</span>
                                    <span className="hover:text-indigo-400 cursor-pointer transition-colors">Terms</span>
                                    <span className="hover:text-indigo-400 cursor-pointer transition-colors">Security</span>
                                </div>
                                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                                    <p className="text-[11px] text-gray-500 leading-relaxed italic max-w-3xl mx-auto">
                                        <span className="text-amber-500/80 font-bold uppercase not-italic mr-2">The Real Talk:</span>
                                        No-nonsense, no-advice, just pure data-driven intelligence. We aren't recommending anything, and we definitely aren't selling anything. Just AI insights to help you stay sharp. DYOR.
                                    </p>
                                </div>
                                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">
                                    © {new Date().getFullYear()} Indian Money Code • Wealth Intelligence Platform
                                </p>
                            </div>
                        </footer>
                    </div>
                </main>
            </div>
            <BottomNav 
                currentView={view} 
                setView={handleNavigate} 
                onMore={() => setSidebarOpen(true)} 
            />
            <AINotice />
            <Suspense fallback={null}>
                <AIChatBot />
            </Suspense>
            <FinancialAwarenessModal />
            <Modal 
                isOpen={showSmsModal} 
                onClose={() => setShowSmsModal(false)} 
                title={t.smsDetected}
            >
                <div className="space-y-6">
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
                        <p className="text-[10px] uppercase font-black tracking-widest text-primary">{t.reviewTransaction}</p>
                        <div className="flex justify-between items-end">
                            <div>
                                <h4 className="text-xl font-black">{pendingSmsTxn?.merchant}</h4>
                                <p className="text-gray-400 text-xs">{pendingSmsTxn?.description}</p>
                            </div>
                            <p className="text-2xl font-black text-white">₹{pendingSmsTxn?.amount?.toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Input 
                            label={t.amount} 
                            type="number" 
                            value={pendingSmsTxn?.amount || ''} 
                            onChange={e => setPendingSmsTxn(prev => ({ ...prev, amount: parseFloat(e.target.value) }))} 
                        />
                        <Select 
                            label={t.category} 
                            value={pendingSmsTxn?.category || ''} 
                            onChange={e => setPendingSmsTxn(prev => ({ ...prev, category: e.target.value }))}
                        >
                            <option value="">-- Choose Category --</option>
                            {budgets.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                            {['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Investment', 'Other'].map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </Select>
                        <div className="flex gap-2">
                            <Button 
                                className="flex-1" 
                                variant="outline" 
                                onClick={() => setShowSmsModal(false)}
                            >
                                {t.ignoreSms}
                            </Button>
                            <Button 
                                className="flex-[2]" 
                                onClick={handleConfirmSmsTxn}
                            >
                                {t.approveAndAdd}
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default App;
