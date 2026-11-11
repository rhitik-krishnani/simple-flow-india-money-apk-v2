import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
    <div className={`bg-surface/80 border border-white/5 rounded-3xl p-6 shadow-lg shadow-black/20 backdrop-blur-sm ${className}`} {...props}>
        {children}
    </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger', size?: 'sm' | 'md' | 'lg' | string }> = ({ children, className = '', variant = 'primary', size = 'md', ...props }) => {
    const sizes: Record<string, string> = { sm: 'px-3.5 py-1.5 text-sm min-h-9', md: 'px-5 py-2.5 min-h-11', lg: 'px-7 py-3.5 text-base min-h-12' };
    const base = `${sizes[size] || sizes.md} rounded-full font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`;
    const variants = {
        default: "bg-primary hover:brightness-110 text-white shadow-lg shadow-violet-500/40",
        primary: "bg-primary hover:brightness-110 text-white shadow-lg shadow-violet-500/40",
        secondary: "bg-accent hover:brightness-110 text-black",
        outline: "border border-white/15 hover:bg-white/5 text-gray-200",
        ghost: "hover:bg-white/5 text-gray-400 hover:text-white",
        danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
    };
    return <button className={`${base} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
    <div className="flex flex-col gap-1.5 w-full">
        {label && <label className="text-sm text-gray-400 font-medium">{label}</label>}
        <input 
            className={`bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors ${className}`}
            {...props}
        />
    </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, children, className = '', ...props }) => (
    <div className="flex flex-col gap-1.5 w-full">
        {label && <label className="text-sm text-gray-400 font-medium">{label}</label>}
        <select 
            className={`bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors appearance-none ${className}`}
            {...props}
        >
            {children}
        </select>
    </div>
);

export const Badge: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${className}`}>
        {children}
    </span>
);

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.96, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 40 }}
                        className="bg-surface border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl max-h-[92vh] pb-safe overflow-y-auto"
                    >
                        <div className="flex justify-between items-center p-6 border-b border-border">
                            <h3 className="text-xl font-semibold text-white">{title}</h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

/** Tiny safe markdown renderer (headings, bold, italic, bullets, rules). No HTML is ever injected. */
const renderInline = (text: string, key: string): React.ReactNode[] =>
    text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).filter(Boolean).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={`${key}-${i}`} className="font-bold text-white">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={`${key}-${i}`}>{part.slice(1, -1)}</em>;
        return <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>;
    });

export const RichText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
    <div className={className}>
        {(text || '').split('\n').map((line, i) => {
            const k = `l${i}`;
            if (/^###\s/.test(line)) return <h4 key={k} className="font-bold text-white mt-4 mb-1">{renderInline(line.slice(4), k)}</h4>;
            if (/^##\s/.test(line)) return <h3 key={k} className="text-base font-bold text-white mt-5 mb-1">{renderInline(line.slice(3), k)}</h3>;
            if (/^#\s/.test(line)) return <h2 key={k} className="text-xl font-black text-white text-center mb-3">{renderInline(line.slice(2), k)}</h2>;
            if (/^---+\s*$/.test(line)) return <hr key={k} className="border-white/10 my-4" />;
            if (/^[-•]\s/.test(line)) return <p key={k} className="pl-4 -indent-3">• {renderInline(line.slice(2), k)}</p>;
            if (!line.trim()) return <div key={k} className="h-2" />;
            return <p key={k}>{renderInline(line, k)}</p>;
        })}
    </div>
);
