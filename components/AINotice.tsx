import React, { useEffect, useState } from 'react';

/** Small toast for AI problems (signed out, offline, rate limited). Listens for the 'ai-notice' window event. */
const AINotice: React.FC = () => {
    const [msg, setMsg] = useState('');
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const onNotice = (e: Event) => {
            setMsg(String((e as CustomEvent).detail || ''));
            clearTimeout(timer);
            timer = setTimeout(() => setMsg(''), 6000);
        };
        window.addEventListener('ai-notice', onNotice);
        return () => { window.removeEventListener('ai-notice', onNotice); clearTimeout(timer); };
    }, []);
    if (!msg) return null;
    return (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] max-w-[92vw] sm:max-w-md bg-surface border border-white/15 text-sm text-white rounded-2xl shadow-2xl px-4 py-3 flex items-start gap-3">
            <span className="flex-1">{msg}</span>
            <button onClick={() => setMsg('')} className="text-gray-400 font-bold" aria-label="Dismiss">✕</button>
        </div>
    );
};
export default AINotice;
