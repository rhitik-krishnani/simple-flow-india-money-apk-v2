import React from 'react';
import { 
    Home, Wallet, Briefcase, Landmark, Target as TargetIcon, Menu, LogOut, LayoutDashboard, ShieldAlert, Calculator, FileText, User as UserIcon, Languages, Users, BarChart3
} from 'lucide-react';
import { User, ViewState } from '../types';
import { Language, translations } from '../translations';
import { BrandLogo } from './BrandLogo';
import { safeStorage } from '../services/storage';

export const Navbar: React.FC<{ 
    user: User, 
    toggleSidebar: () => void, 
    onLogout: () => void, 
    setView: (v: ViewState) => void,
    lang: Language,
    toggleLang: () => void
}> = ({ user, toggleSidebar, onLogout, setView, lang, toggleLang }) => {
    const t = translations[lang];
    return (
    <header className="h-16 border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 shadow-2xl">
        <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="lg:hidden text-gray-400 hover:text-white pointer-events-auto">
                <Menu size={24} />
            </button>
            <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => setView('dashboard')}>
                <BrandLogo size={36} className="hover:scale-110 transition-transform duration-300" />
                <h1 className="text-lg md:text-xl font-display font-black text-white tracking-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] sm:max-w-none">
                    {t.assetForge}
                </h1>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button 
                onClick={toggleLang}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-white/10 transition-all"
            >
                <Languages size={14} />
                {lang === 'en' ? 'English' : 'हिंदी'}
            </button>
            <div 
                className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1.5 rounded-lg transition-colors border border-transparent hover:border-white/10"
                onClick={() => setView('profile')}
            >
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center font-bold text-white text-xs">
                    {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                </div>
            </div>
            <button onClick={onLogout} className="text-gray-400 hover:text-red-400 p-2 transition-colors">
                <LogOut size={20} />
            </button>
        </div>
    </header>
    );
};

export const BottomNav: React.FC<{ currentView: ViewState, setView: (v: ViewState) => void, onMore: () => void }> = ({ currentView, setView, onMore }) => {
    const items = [
        { id: 'dashboard', label: 'Home', icon: Home },
        { id: 'budget', label: 'Spend', icon: Wallet },
        { id: 'portfolio', label: 'Stack', icon: Briefcase },
        { id: 'calculators', label: 'Tools', icon: Calculator },
        { id: 'goals', label: 'Goals', icon: TargetIcon },
    ];

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 min-h-[4.25rem] bg-background/85 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-2 pt-1 z-50 pb-safe">
            {items.map(item => (
                <button
                    key={item.id}
                    onClick={() => setView(item.id as ViewState)}
                    className={`flex flex-col items-center justify-center gap-0.5 min-w-[60px] transition-all ${currentView === item.id ? 'text-white' : 'text-gray-500'}`}
                >
                    <span className={`rounded-full px-4 py-1 transition-all ${currentView === item.id ? 'bg-primary/25 text-violet-300' : ''}`}><item.icon size={21} /></span>
                    <span className={`text-[11px] font-bold tracking-tight ${currentView === item.id ? 'opacity-100' : 'opacity-70'}`}>{item.label}</span>
                </button>
            ))}
            <button
                onClick={onMore}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[60px] text-gray-400"
            >
                <Menu size={20} />
                <span className="text-[10px] font-bold opacity-70">More</span>
            </button>
        </nav>
    );
};

const LEVEL_REQUIREMENTS: Record<string, { level: number }> = {
};

export const Sidebar: React.FC<{ 
    isOpen: boolean, 
    setView: (v: ViewState) => void, 
    currentView: ViewState, 
    closeMobile: () => void,
    lang: Language,
    userLevel?: number
}> = ({ isOpen, setView, currentView, closeMobile, lang, userLevel = 1 }) => {
    const t = translations[lang];

    const mainNav = [
        { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
        { id: 'portfolio', label: t.portfolio, icon: Briefcase },
        { id: 'budget', label: t.budget, icon: Wallet },
        { id: 'goals', label: t.goals, icon: TargetIcon },
    ];

    const deepInsights = [
        { id: 'reports', label: t.reports, icon: BarChart3 },
        { id: 'loans', label: t.loans, icon: Landmark },
        { id: 'insurance', label: t.insurance, icon: ShieldAlert },
    ];

    const tools = [
        { id: 'calculators', label: t.calculators, icon: Calculator },
    ];

    const NavGroup = ({ title, items }: { title: string, items: any[] }) => (
        <div className="mb-6">
            <h3 className="px-4 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{title}</h3>
            <div className="space-y-1">
                {items.map(item => {
                    const req = LEVEL_REQUIREMENTS[item.id];
                    const isLocked = req && userLevel < req.level;
                    return (
                        <button
                            key={item.id}
                            onClick={() => { setView(item.id as ViewState); closeMobile(); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${currentView === item.id ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm' : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'}`}
                        >
                            <item.icon size={16} className={currentView === item.id ? 'text-indigo-400' : 'text-gray-500'} />
                            <span className="flex-1 text-left">{item.label}</span>
                            {isLocked && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold scale-95">
                                    L{req.level} 🔒
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <>
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={closeMobile}
                />
            )}
            <aside className={`fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] lg:h-auto bg-background/80 backdrop-blur-md border-r border-border w-64 transform transition-transform duration-300 z-40 overflow-y-auto thin-scrollbar ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <nav className="p-4 pt-6">
                    <NavGroup title="Essentials" items={mainNav} />
                    <NavGroup title="Insights" items={deepInsights} />
                    <NavGroup title="Tools" items={tools} />

                    {/* Admin section for owner */}
                    {(safeStorage.getItem('user_email') === 'kkishore1981@gmail.com') && (
                        <div className="mt-8 pt-6 border-t border-white/5 opacity-80">
                            <h3 className="px-4 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500/60">System</h3>
                            <div className="space-y-1">
                                <button
                                    onClick={() => { setView('admin-analytics'); closeMobile(); }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${currentView === 'admin-analytics' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm' : 'text-gray-500 hover:bg-white/5 hover:text-indigo-400'}`}
                                >
                                    <ShieldAlert size={16} />
                                    Platform Pulse
                                </button>
                                <button
                                    onClick={() => { setView('marketing-studio'); closeMobile(); }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${currentView === 'marketing-studio' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm' : 'text-gray-500 hover:bg-white/5 hover:text-indigo-400'}`}
                                >
                                    <FileText size={16} />
                                    Promo Studio
                                </button>
                            </div>
                        </div>
                    )}
                </nav>
            </aside>
        </>
    );
};
