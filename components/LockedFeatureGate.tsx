import React from 'react';
import { ShieldAlert, Zap, Lock, Compass, ArrowRight } from 'lucide-react';
import { Card, Button } from './ui';
import { motion } from 'motion/react';

interface LockedFeatureGateProps {
    featureName: string;
    requiredLevel: number;
    requiredLevelName: string;
    userLevel: number;
    userLevelName: string;
    progressToNext: number;
    badgeColor: string;
    requirementsText: string;
    onBackToSafety: () => void;
}

export const LockedFeatureGate: React.FC<LockedFeatureGateProps> = ({
    featureName,
    requiredLevel,
    requiredLevelName,
    userLevel,
    userLevelName,
    progressToNext,
    badgeColor,
    requirementsText,
    onBackToSafety
}) => {
    return (
        <div className="min-h-[70vh] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-xl w-full"
            >
                <Card className="p-8 bg-gradient-to-br from-indigo-950/40 via-surface to-surface border-indigo-500/20 text-center relative overflow-hidden shadow-2xl">
                    {/* Floating Glow Orbs */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />

                    {/* Lock Icon Emblem */}
                    <div className="relative mx-auto w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400 mb-6 group hover:scale-105 transition-transform duration-300 shadow-inner">
                        <Lock size={32} className="group-hover:rotate-12 transition-transform" />
                        <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-[9px] font-black px-2 py-0.5 rounded-full border border-white/10">LVL {requiredLevel}</div>
                    </div>

                    <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
                        {featureName} Locked
                    </h2>
                    
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1 mb-6">
                        Exclusivity Milestone • Requires Rank: <span className="text-indigo-400">{requiredLevelName}</span>
                    </p>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 mb-6 text-left space-y-4">
                        <p className="text-xs text-gray-300 leading-relaxed font-medium">
                            The <strong className="text-white">{featureName}</strong> is reserved for investors driving mature capital growth. Leveling up builds your discipline and unlocks advanced strategic workflows automatically.
                        </p>
                        
                        <div className="pt-3 border-t border-white/5">
                            <p className="text-[10px] uppercase font-black tracking-widest text-indigo-400 mb-2">Roadmap to Unlock</p>
                            <p className="text-xs text-gray-400 leading-snug italic font-medium">
                                "{requirementsText}"
                            </p>
                        </div>
                    </div>

                    {/* Current User Status & Progress */}
                    <div className="bg-surface/50 border border-white/5 rounded-2xl p-5 mb-8 text-left space-y-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none">Your Rank</p>
                                <p className="text-sm font-black text-white mt-1 flex items-center gap-1.5">
                                    <Zap size={14} className="text-indigo-400 animate-pulse" />
                                    {userLevelName} <span className="text-xs text-gray-500 font-bold">(Lvl {userLevel})</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none">Rank Progress</p>
                                <p className="text-sm font-black text-indigo-400 mt-1">{progressToNext}%</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressToNext}%` }}
                                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            onClick={onBackToSafety}
                            className="flex-1 h-12 text-[10px] font-black uppercase bg-white/5 border border-white/10 hover:bg-white/10 text-white"
                        >
                            <Compass size={14} className="mr-1.5" /> Back to Dashboard
                        </Button>
                        <Button
                            onClick={onBackToSafety}
                            className="flex-1 h-12 text-[10px] font-black uppercase bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                        >
                            Grow Portfolio <ArrowRight size={14} className="ml-1.5" />
                        </Button>
                    </div>
                </Card>
            </motion.div>
        </div>
    );
};
