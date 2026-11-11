import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Bot, Send } from 'lucide-react';
import { ChatMessage } from '../types';
import { getInvestments, getBudgets, getLoans } from '../services/dataService';
import { getFinancialAdvice } from '../services/geminiService';

const AIChatBot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: '1', role: 'model', text: 'Namaste! I am your AI financial assistant. Ask me about your portfolio, budget, or general finance.', timestamp: new Date() }
    ]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if(isOpen) scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;
        
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        const [investments, budgets, loans] = await Promise.all([
            getInvestments(),
            getBudgets(),
            getLoans()
        ]);
        
        const context = { investments, budgets, loans };
        const replyText = await getFinancialAdvice(userMsg.text, context);
        const botMsg: ChatMessage = { id: (Date.now()+1).toString(), role: 'model', text: replyText, timestamp: new Date() };
        
        setMessages(prev => [...prev, botMsg]);
        setLoading(false);
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="fixed bottom-6 right-6 w-14 h-14 bg-primary hover:bg-indigo-600 rounded-full shadow-xl flex items-center justify-center text-white z-50 transition-all hover:scale-105"
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-24 right-6 w-[90vw] md:w-96 h-[500px] bg-surface border border-border rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden"
                    >
                        <div className="bg-primary/10 p-4 border-b border-primary/20 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center font-bold">AI</div>
                                <div>
                                    <h3 className="font-bold text-sm">Money Buddy AI</h3>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-gray-800 text-gray-200'}`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-3 bg-background border-t border-border flex gap-2">
                            <input 
                                className="flex-1 bg-gray-800 border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="Ask financial advice..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                            />
                            <button onClick={handleSend} disabled={loading || !input.trim()} className="p-2 bg-primary rounded-full text-white">
                                <Send size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default AIChatBot;
