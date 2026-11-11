import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lightbulb, X, TrendingUp, ShieldCheck, Target, ArrowRight } from 'lucide-react';
import { Button } from './ui';

interface Tip {
    id: number;
    title: string;
    content: string;
    icon: React.ReactNode;
    category: 'Mutual Funds' | 'Investing' | 'Security' | 'Savings';
}

const TIPS: Tip[] = [
    {
        id: 1,
        title: "Still researching for the right mutual fund?",
        content: "Nearly 80% of actively managed funds underperform their respective indices over a 10-year period. Don't let high expense ratios eat your returns. DYOR (Do Your Own Research) before committing to active funds vs index funds.",
        icon: <TrendingUp className="text-amber-400" size={24} />,
        category: "Mutual Funds"
    },
    {
        id: 2,
        title: "The Power of compounding in Mid & Small Caps",
        content: "While Large Caps provide stability, Mid and Small Caps often offer higher growth potential over long horizons. However, they come with higher volatility. Diversify wisely based on your risk appetite.",
        icon: <TrendingUp className="text-green-400" size={24} />,
        category: "Investing"
    },
    {
        id: 3,
        title: "Emergency Fund: Your Financial Shield",
        content: "Always keep at least 6 months of expenses in a liquid fund or savings account before you start aggressive investing. Security first, growth second.",
        icon: <ShieldCheck className="text-blue-400" size={24} />,
        category: "Security"
    },
    {
        id: 4,
        title: "Set it and Forget it",
        content: "Automated SIPs (Systematic Investment Plans) beat market timing 9/10 times. Consistency is the secret sauce of wealth creation.",
        icon: <Target className="text-purple-400" size={24} />,
        category: "Savings"
    }
];

const FinancialAwarenessModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentTip, setCurrentTip] = useState<Tip>(TIPS[0]);

    useEffect(() => {
        // Pick a random tip or cycle through them
        const randomIndex = Math.floor(Math.random() * TIPS.length);
        setCurrentTip(TIPS[randomIndex]);
        
        // Delay the appearance slightly for better UX
        const timer = setTimeout(() => {
            setIsOpen(true);
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        try {
            sessionStorage.setItem('financial_tip_shown', 'true');
        } catch (e) {
            console.warn("Storage write denied inside iframe environment:", e);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-lg bg-surface border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                    >
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16 rounded-full" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 blur-3xl -ml-16 -mb-16 rounded-full" />

                        <div className="relative p-8">
                            <button 
                                onClick={handleClose}
                                className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                                    <Lightbulb className="text-primary" size={28} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-primary/80">Growth Mindset</h3>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Insights for Smart Investors</p>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                                    {currentTip.icon}
                                    <span className="text-[10px] font-black uppercase text-gray-300">{currentTip.category}</span>
                                </div>
                                <h2 className="text-2xl font-black leading-tight text-white">
                                    {currentTip.title}
                                </h2>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    {currentTip.content}
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button 
                                    onClick={handleClose}
                                    className="w-full h-12 text-sm font-black uppercase tracking-widest"
                                >
                                    I Understand <ArrowRight className="ml-2" size={16} />
                                </Button>
                                <p className="text-[9px] text-center text-gray-600 font-bold uppercase tracking-widest italic">
                                    Education is the best investment. DYOR.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default FinancialAwarenessModal;
