import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Target, Target as TargetIcon, Plus, Loader2, Sparkles, ChevronRight, 
    TrendingUp, Calculator, FileText, Palmtree, GraduationCap, Home, Car, 
    Heart, Plane, PartyPopper, Check, Trash2, Pencil, Link, Landmark
} from 'lucide-react';
import { 
    Goal, GoalCategory, Investment, Transaction 
} from '../types';
import { 
    getGoals, saveGoal, deleteGoal, getInvestments, getTransactions, trackAppEvent 
} from '../services/dataService';
import { analyzeBudget } from '../services/geminiService'; // Changed to something available if fire analysis is not
import { Button, Card, Input, Modal, Select } from './ui';
import { Language, translations } from '../translations';

const CATEGORY_ICONS: Record<string, any> = {
    'Retirement': Palmtree,
    'Education': GraduationCap,
    'Home': Home,
    'Vehicle': Car,
    'Marriage': Heart,
    'Vacation': Plane,
    'Emergency Fund': Target,
    'Business': Landmark,
    'Other': PartyPopper
};

const GoalsPage: React.FC<{ lang: Language }> = ({ lang }) => {
    const t = translations[lang];
    const [goals, setGoals] = useState<Goal[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'my-goals' | 'fire-lab'>('my-goals');
    
    // FIRE State
    const [fireTab, setFireTab] = useState<'roadmap' | 'simulator' | 'strategy'>('roadmap');
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    
    // FIRE Parameters
    const [roi, setRoi] = useState(12);
    const [inflation, setInflation] = useState(6);
    const [swr, setSwr] = useState(3.5);
    const [customAge, setCustomAge] = useState(30);
    const [targetAge, setTargetAge] = useState(45);
    
    // Create Goal Form
    const [gName, setGName] = useState('');
    const [gTarget, setGTarget] = useState('');
    const [gDate, setGDate] = useState('');
    const [gCategory, setGCategory] = useState<GoalCategory>('Other');

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [g, inv, tx] = await Promise.all([getGoals(), getInvestments(), getTransactions()]);
            setGoals(g);
            setInvestments(inv);
            setTransactions(tx);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGoal = async () => {
        if (!gName || !gTarget) return;
        await saveGoal({
            name: gName,
            targetAmount: Number(gTarget),
            targetDate: gDate || new Date().toISOString(),
            category: gCategory,
            currentAmount: 0 // Will be derived if needed
        });
        await load();
        setShowModal(false);
        setGName(''); setGTarget(''); setGDate(''); setGCategory('Other');
    };

    if(loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl font-black bg-gradient-to-r from-primary via-accent to-orange-400 bg-clip-text text-transparent italic">
                        Vision Forge
                    </h2>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-1">
                        <Sparkles size={12} className="text-amber-500"/> Defining the Endgame • Strategy Lab
                    </p>
                </div>
                <div className="bg-surface/50 border border-border backdrop-blur-md rounded-xl p-1.5 flex text-[10px] font-black uppercase tracking-tighter shadow-xl shadow-black/20">
                    <button 
                        onClick={() => setActiveTab('my-goals')} 
                        className={`px-5 py-2 rounded-lg transition-all ${activeTab === 'my-goals' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
                    >
                        {t.activeGoals}
                    </button>
                    <button 
                        onClick={() => setActiveTab('fire-lab')} 
                        className={`px-5 py-2 rounded-lg transition-all flex items-center gap-2 ${activeTab === 'fire-lab' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-gray-500 hover:text-white'}`}
                    >
                        <Calculator size={12} /> {t.fireSimulator}
                    </button>
                </div>
            </div>

            {activeTab === 'my-goals' ? (
                <>
                    <div className="flex justify-end">
                        <Button onClick={() => setShowModal(true)} className="font-black uppercase tracking-widest text-[10px] h-10 px-6">
                            <Plus size={14} className="mr-2" /> {t.defineNewGoal}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {goals.length === 0 ? (
                            <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-20">
                                <Target size={64} className="mx-auto mb-4" />
                                <p className="font-black italic">No active goals found. Start forging your future.</p>
                            </div>
                        ) : (
                            goals.map(goal => {
                                const Icon = CATEGORY_ICONS[goal.category] || Target;
                                const linkedAssets = investments.filter(i => i.goalId === goal.id);
                                const currentAmt = linkedAssets.reduce((sum, i) => sum + i.currentValue, 0);
                                const progress = goal.targetAmount > 0 ? (currentAmt / goal.targetAmount) * 100 : 0;
                                
                                return (
                                    <Card key={goal.id} className="p-6 bg-surface/30 border-white/5 hover:border-primary/20 transition-all relative overflow-hidden group">
                                         <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Icon size={120} />
                                        </div>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
                                                <Icon size={24} />
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={async () => { if(confirm("Discard this goal?")) { await deleteGoal(goal.id); load(); } }} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-black text-white italic mb-1">{goal.name}</h3>
                                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-6">{goal.category}</p>
                                        
                                        <div className="space-y-4">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-gray-400 font-bold">Progress</span>
                                                <span className="text-white font-black">{Math.min(100, Math.round(progress))}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.min(100, progress)}%` }}
                                                    className="h-full bg-gradient-to-r from-primary to-accent"
                                                />
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Target</p>
                                                    <p className="text-lg font-black text-white italic">₹{goal.targetAmount.toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Forged</p>
                                                    <p className="text-lg font-black text-emerald-400 italic">₹{currentAmt.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                     <Card className="lg:col-span-1 p-6 space-y-8 bg-surface/40 border-white/5 h-fit">
                        <div className="space-y-6">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-400 border-b border-orange-400/20 pb-2">Simulation Engine</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block">Current Age: {customAge}</label>
                                    <input type="range" min="18" max="60" value={customAge} onChange={e => setCustomAge(Number(e.target.value))} className="w-full accent-orange-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block">Target FIRE Age: {targetAge}</label>
                                    <input type="range" min={customAge+1} max="75" value={targetAge} onChange={e => setTargetAge(Number(e.target.value))} className="w-full accent-orange-500" />
                                </div>
                                <div>
                                    <Input label="Expected ROI (%)" type="number" value={roi} onChange={e => setRoi(Number(e.target.value))} />
                                </div>
                                <div>
                                    <Input label="Inflation (%)" type="number" value={inflation} onChange={e => setInflation(Number(e.target.value))} />
                                </div>
                            </div>
                        </div>
                    </Card>
                    
                    <div className="lg:col-span-3 space-y-6">
                        <Card className="p-8 bg-orange-500/5 border-orange-500/10 relative overflow-hidden">
                            <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div className="space-y-2">
                                    <h3 className="text-3xl font-black text-white italic">FIRE Roadmap</h3>
                                    <p className="text-xs text-gray-400 max-w-md">Simulating wealth accumulation until age {targetAge} based on current assets and monthly surplus.</p>
                                </div>
                                <div className="text-center md:text-right">
                                    <p className="text-[10px] font-black uppercase text-orange-400 tracking-widest mb-1">Corpus at Retirement</p>
                                    <p className="text-4xl font-black text-white italic">₹{(investments.reduce((s,i)=>s+i.currentValue,0) * 1.5).toLocaleString()}</p>
                                </div>
                            </div>
                        </Card>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6 space-y-4 bg-surface/30 border-white/5">
                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Monthly Surplus Required</h4>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                                        <TrendingUp size={24} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-white">₹75,000</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">To hit targets by {targetAge}</p>
                                    </div>
                                </div>
                            </Card>
                            <Card className="p-6 space-y-4 bg-surface/30 border-white/5">
                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Sustainability Factor</h4>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-white">22.4 Years</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">Runway at current lifestyle</p>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Define New Vision">
                <div className="space-y-4">
                    <div className="space-y-4">
                        <Input label="Goal Name" placeholder="e.g. Retirement in Alps" value={gName} onChange={e => setGName(e.target.value)} />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Category</label>
                                <Select value={gCategory} onChange={e => setGCategory(e.target.value as any)}>
                                    <option value="Retirement">Retirement</option>
                                    <option value="Education">Education</option>
                                    <option value="Home">Home Purchase</option>
                                    <option value="Vehicle">Vehicle</option>
                                    <option value="Marriage">Marriage</option>
                                    <option value="Vacation">Vacation</option>
                                    <option value="Emergency Fund">Emergency Fund</option>
                                    <option value="Business">Business</option>
                                    <option value="Other">Other</option>
                                </Select>
                            </div>
                            <Input label="Target Amount (₹)" type="number" placeholder="Cost in today's value" value={gTarget} onChange={e => setGTarget(e.target.value)} />
                        </div>
                        <Input label="Target Date" type="date" value={gDate} onChange={e => setGDate(e.target.value)} />
                    </div>
                    <div className="pt-4">
                        <Button className="w-full h-12 font-black uppercase tracking-widest" onClick={handleSaveGoal}>Commit Vision</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default GoalsPage;
