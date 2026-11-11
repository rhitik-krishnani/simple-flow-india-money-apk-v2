import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader2, BarChart3 } from 'lucide-react';
import { Card } from './ui';
import { getGlobalAnalytics } from '../services/dataService';
import { translations, Language } from '../translations';
import { safeStorage } from '../services/storage';

export const AdminAnalyticsPage: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [lang] = useState<Language>(() => (safeStorage.getItem('app_lang') as Language) || 'en');
    const t = translations[lang];

    useEffect(() => {
        getGlobalAnalytics().then(setStats).catch(err => {
            console.error("Failed to load analytics in component", err);
            setStats({
                totalHits: 0,
                uniqueUsers: 0,
                totalUsers: 0,
                featureUsage: {}
            });
        });
    }, []);

    if(stats?.error === 'PERMISSION_DENIED') return (
        <div className="h-96 flex flex-col items-center justify-center space-y-6 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                <BarChart3 size={32} />
            </div>
            <div className="space-y-2">
                <h2 className="text-xl font-black text-white">Encrypted Signal Blocked</h2>
                <p className="text-sm text-gray-400">Your admin credentials are valid, but the secure data layer requires a **verified email** to authorize this high-level sync.</p>
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl w-full text-left space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Authorization Checklist</p>
                <div className="flex items-center gap-3 text-xs font-medium">
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-black">✓</div>
                    <span>Admin Email Match (kkishore1981@gmail.com)</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium text-amber-400">
                    <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center text-[10px]">!</div>
                    <span>Email Verification Status</span>
                </div>
            </div>
            <p className="text-[10px] text-gray-500 italic">Please go to your Profile and click "Resend Link" if you haven't verified kkishore1981@gmail.com yet.</p>
        </div>
    );

    if(!stats) return (
        <div className="h-64 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Syncing Platform Heartbeat...</p>
        </div>
    );

    const sortedFeatures = Object.entries(stats.featureUsage || {})
        .filter(([name]) => !name.startsWith('calculator_'))
        .sort((a: any, b: any) => b[1] - a[1]);

    const sortedCalculators = Object.entries(stats.featureUsage || {})
        .filter(([name]) => name.startsWith('calculator_'))
        .map(([name, count]) => [name.replace('calculator_', '').toUpperCase(), count])
        .sort((a: any, b: any) => b[1] - a[1]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black italic">Platform Pulse</h2>
                <div className="text-[10px] font-black uppercase text-gray-500 tracking-widest border border-white/5 px-3 py-1 rounded-full">
                    Live System Monitor
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 bg-surface border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">{t.totalUsers}</p>
                    <p className="text-4xl font-black italic">{stats.totalUsers}</p>
                    <p className="text-[10px] text-gray-500 mt-2 italic font-bold">Accounts created</p>
                </Card>
                <Card className="p-6 bg-indigo-500/5 border-indigo-500/20">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">{t.activeUsers}</p>
                    <p className="text-4xl font-black italic">{stats.uniqueUsers}</p>
                    <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(stats.uniqueUsers / (stats.totalUsers || 1)) * 100}%` }} className="h-full bg-indigo-500" />
                    </div>
                </Card>
                <Card className="p-6 bg-emerald-500/5 border-emerald-500/20">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">{t.totalHits}</p>
                    <p className="text-4xl font-black italic">{stats.totalHits}</p>
                    <p className="text-[10px] text-gray-500 mt-2 italic font-bold">Total server interactions</p>
                </Card>
                <Card className="p-6 bg-surface border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Feature Engagement</p>
                    <div className="space-y-2 mt-4">
                        {sortedFeatures.slice(0, 3).map(([name, count]: any) => (
                            <div key={name} className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase text-gray-400">{name}</span>
                                <span className="text-xs font-black">{count}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                     <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Core Feature Engagement</h3>
                     <p className="text-[10px] text-gray-500 mb-6 uppercase tracking-wider">Top visited view states & system controls</p>
                     <div className="space-y-4">
                         {sortedFeatures.length === 0 ? (
                             <div className="text-center py-10 opacity-30 italic text-sm">Waiting for incoming signals...</div>
                         ) : sortedFeatures.map(([name, count]: any) => (
                             <div key={name} className="space-y-1">
                                 <div className="flex justify-between text-[10px] font-black uppercase">
                                     <span className="text-indigo-300">{name}</span>
                                     <span className="text-gray-400">{count} hits</span>
                                 </div>
                                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                     <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(count / (sortedFeatures[0] ? sortedFeatures[0][1] as number : 1)) * 100}%` }}
                                        className="h-full bg-indigo-500/50"
                                     />
                                 </div>
                             </div>
                         ))}
                     </div>
                </Card>

                <Card className="p-6">
                     <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-2">Calculator Engagement Drill-Down</h3>
                     <p className="text-[10px] text-gray-500 mb-6 uppercase tracking-wider">Most triggered calculators to support product roadmapping</p>
                     <div className="space-y-4">
                         {sortedCalculators.length === 0 ? (
                             <div className="text-center py-10 opacity-30 italic text-[11px] uppercase tracking-wider text-gray-500">No calculators computed yet. Switch tabs in the Calculators page to sync stats.</div>
                         ) : sortedCalculators.map(([name, count]: any) => (
                             <div key={name} className="space-y-1">
                                 <div className="flex justify-between text-[10px] font-black uppercase">
                                     <span className="text-emerald-400">{name} Calculator</span>
                                     <span className="text-gray-400">{count} runs</span>
                                 </div>
                                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                     <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(count / (sortedCalculators[0] ? sortedCalculators[0][1] as number : 1)) * 100}%` }}
                                        className="h-full bg-emerald-500/50"
                                     />
                                 </div>
                             </div>
                         ))}
                     </div>
                </Card>
            </div>
        </div>
    );
};
