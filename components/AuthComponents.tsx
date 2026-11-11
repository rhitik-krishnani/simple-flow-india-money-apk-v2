import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User as UserIcon, Loader2, Sparkles, LogIn } from 'lucide-react';
import { Button, Input, Card } from './ui';
import { loginUser, registerUser, resetPassword, setGuestMode } from '../services/dataService';

export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="w-full max-w-md relative z-10">
            <div className="text-center mb-10 space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-4">
                    <Sparkles size={12} className="text-indigo-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Next-Gen Wealth OS</span>
                </div>
                <h1 className="text-4xl font-display font-bold tracking-widest bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent whitespace-nowrap">
                    INDIAN MONEY CODE
                </h1>
                <p className="text-gray-500 text-sm font-medium tracking-tight">Precision Intelligence. Unified Sovereignty.</p>
            </div>
            {children}
            <div className="mt-12 text-center space-y-4">
                <div className="flex items-center justify-center gap-6">
                    <button className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-indigo-400 transition-colors">Terms of Service</button>
                    <div className="w-1 h-1 rounded-full bg-white/10" />
                    <button className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-indigo-400 transition-colors">Privacy Policy</button>
                </div>
                <div className="max-w-xs mx-auto">
                    <p className="text-[9px] text-gray-600 font-bold leading-relaxed uppercase tracking-tight">
                        Proprietary System: Unauthorized access or reproduction of the Wealth Intelligence Platform logic is strictly prohibited. © {new Date().getFullYear()} Money Code.
                    </p>
                </div>
            </div>
        </div>
    </div>
);

export const LoginPage: React.FC<{ goToSignup: () => void }> = ({ goToSignup }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await loginUser(email, password);
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-8 border-white/10 bg-white/[0.02]">
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-4">
                        <Input 
                            label="Satellite Identifier (Email)" 
                            type="email" 
                            required 
                            value={email} 
                            onChange={e => setEmail(e.target.value)}
                            placeholder="user@wealth.os"
                        />
                        <Input 
                            label="Quantum Key (Password)" 
                            type="password" 
                            required 
                            value={password} 
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    {error && <p className="text-red-400 text-xs font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
                    <Button type="submit" className="w-full h-12 font-black italic tracking-tight" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : 'INITIATE SYNC'}
                    </Button>
                </form>
                <div className="mt-8 pt-8 border-t border-white/5 text-center space-y-4">
                    <button 
                        onClick={() => {
                            setGuestMode(true);
                            window.location.reload(); // Refresh to trigger auth subscriber with guestUser
                        }} 
                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-indigo-300 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        <Sparkles size={14} /> Explore as Guest
                    </button>
                    <button onClick={goToSignup} className="text-xs text-gray-400 hover:text-white transition-colors font-bold uppercase tracking-widest">Construct New Node (Sign Up)</button>
                </div>
            </Card>
        </motion.div>
    );
};

export const SignupPage: React.FC<{ goToLogin: () => void }> = ({ goToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await registerUser(email, password, name);
        } catch (err: any) {
            setError(err.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-8 border-white/10 bg-white/[0.02]">
                <form onSubmit={handleSignup} className="space-y-6">
                    <div className="space-y-4">
                        <Input label="Protocol Name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Satoshi" />
                        <Input label="Satellite Identifier" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="user@wealth.os" />
                        <Input label="Quantum Key" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                    </div>
                    {error && <p className="text-red-400 text-xs font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
                    <Button type="submit" className="w-full h-12 font-black italic tracking-tight" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : 'CONSTRUCT NODE'}
                    </Button>
                </form>
                <div className="mt-8 pt-8 border-t border-white/5 text-center">
                    <button onClick={goToLogin} className="text-xs text-gray-400 hover:text-white transition-colors font-bold uppercase tracking-widest">Existing Operator? (Login)</button>
                </div>
            </Card>
        </motion.div>
    );
};
