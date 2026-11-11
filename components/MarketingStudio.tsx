import React, { useState, useEffect } from 'react';
import { 
    Film, Play, Download, Loader2, Sparkles, Plus, AlertCircle, Trash2, 
    CheckCircle2, Video, Wand2, Monitor, Smartphone, Clock, Bot
} from 'lucide-react';
import { Card, Button } from './ui';
import { motion, AnimatePresence } from 'motion/react';
import { safeStorage } from '../services/storage';
import { apiFetch } from '../services/api';

interface PromoClip {
    id: string;
    title: string;
    prompt: string;
    operationName?: string;
    status?: 'idle' | 'generating' | 'completed' | 'failed';
    videoUrl?: string;
    progress?: number;
}

const DEFAULT_CLIPS: Omit<PromoClip, 'id'>[] = [
    { title: "Universal Wealth", prompt: "Masterfully cinematic shot of a shimmering gold 3D logo with the letters 'IMC' spinning over a futuristic high-tech Indian landscape, golden hour lighting, hyper-realistic textures, 4k, 60fps feel" },
    { title: "AI Portfolio Audit", prompt: "Sophisticated blue laser scanning across a multi-layered holographic financial dashboard, floating numerical data, depth of field, high-end commercial aesthetic" },
    { title: "The Wealth Pulse", prompt: "Dynamic movement through a sleek digital fiber-optic tunnel representing data flow, transition to a beating heart made of financial charts, pulsing neon light" },
    { title: "Legacy Shield", prompt: "A glowing architectural shield structure protecting a bundle of digital assets, elegant motion, translucent material, premium financial security vibe" },
    { title: "Mutual Fund Flow", prompt: "Photorealistic liquid gold streams converging into a single geometric orb, representing power through diversification, luxury branding, smooth slow-motion" },
    { title: "Safe Bridge", prompt: "A vast silver bridge spanning a chaotic digital ocean, leading to a garden of light, representing financial freedom and safety, cinematic wide shot" },
    { title: "Digital Bullseye", prompt: "Close-up of a glowing digital dart hitting a holographic center in a glass target, floating icons of a house and global travel, success and achievement" },
    { title: "Wealth Team", prompt: "Three professional silhouettes collaborating over a massive glass screen displaying global market maps in gold, high-tech executive office, soft lighting" },
    { title: "Growth Sprout", prompt: "A crystalline futuristic sprout growing from a microchip soil, leaves expanding into glowing data visualizations, organic growth through technology" },
    { title: "The Hidden Opportunity", prompt: "A golden key rising out of a sea of black ink, illuminated by a sharp beam of light, representing clarity and opportunity in wealth management" }
];

export const MarketingStudio: React.FC = () => {
    const [clips, setClips] = useState<PromoClip[]>(() => {
        const saved = safeStorage.getItem('imc_promo_clips');
        if (saved) return JSON.parse(saved);
        return DEFAULT_CLIPS.map((c, i) => ({ ...c, id: `clip-${i}`, status: 'idle' }));
    });

    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        safeStorage.setItem('imc_promo_clips', JSON.stringify(clips));
    }, [clips]);

    // Polling for active generations
    useEffect(() => {
        const interval = setInterval(async () => {
            const activeClips = clips.filter(c => c.status === 'generating' && c.operationName);
            if (activeClips.length === 0) return;

            for (const clip of activeClips) {
                try {
                    const res = await apiFetch('/api/video-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ operationName: clip.operationName })
                    });
                    const data = await res.json();

                    if (data.done) {
                        // The download route needs the login token, so fetch it as a blob for this session
                        const vid = await apiFetch(`/api/video-download?name=${encodeURIComponent(clip.operationName!)}`);
                        updateClip(clip.id, { status: 'completed', videoUrl: URL.createObjectURL(await vid.blob()), progress: 100 });
                    } else {
                        updateClip(clip.id, { progress: data.progress || 10 });
                    }
                } catch (e) {
                    console.error("Polling error for", clip.id, e);
                }
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [clips]);

    const updateClip = (id: string, updates: Partial<PromoClip>) => {
        setClips(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const startGeneration = async (clip: PromoClip) => {
        setErrorMsg(null);
        updateClip(clip.id, { status: 'generating', progress: 5 });
        try {
            const res = await apiFetch('/api/generate-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: clip.prompt,
                    aspectRatio,
                    resolution
                })
            });
            const data = await res.json();
            if (data.operationName) {
                updateClip(clip.id, { operationName: data.operationName });
            } else {
                updateClip(clip.id, { status: 'failed' });
                setErrorMsg(data.error || "Failed to start generation. Please check your API key in Settings > Secrets.");
            }
        } catch (e: any) {
            updateClip(clip.id, { status: 'failed' });
            setErrorMsg(e.message || "Network error occurred.");
        }
    };

    return (
        <div className="space-y-8 p-4 lg:p-0 pb-20">
            <header className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                        <Wand2 className="text-indigo-400 animate-pulse" size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black italic text-white leading-none tracking-tighter">Marketing Promo Studio</h2>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mt-1">AI-Powered Campaign Engine (Powered by Veo 3.1 Pro)</p>
                    </div>
                </div>
            </header>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 p-6 space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Campaign Config</h3>
                    
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase text-gray-500">Format</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => setAspectRatio('16:9')}
                                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${aspectRatio === '16:9' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                >
                                    <Monitor size={16} />
                                    <span className="text-[10px] font-black uppercase">Widescreen</span>
                                </button>
                                <button 
                                    onClick={() => setAspectRatio('9:16')}
                                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${aspectRatio === '9:16' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                >
                                    <Smartphone size={16} />
                                    <span className="text-[10px] font-black uppercase">Reel/Story</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase text-gray-500">Resolution</p>
                            <div className="grid grid-cols-3 gap-2">
                                <button 
                                    onClick={() => setResolution('720p')}
                                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${resolution === '720p' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                >
                                    <span className="text-[10px] font-black uppercase">720p</span>
                                </button>
                                <button 
                                    onClick={() => setResolution('1080p')}
                                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${resolution === '1080p' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                >
                                    <span className="text-[10px] font-black uppercase">1080p</span>
                                </button>
                                <button 
                                    onClick={() => setResolution('4k')}
                                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${resolution === '4k' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                >
                                    <span className="text-[10px] font-black uppercase">4K</span>
                                </button>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-400">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold leading-relaxed">{errorMsg}</p>
                            </div>
                        )}

                        <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-2">
                            <div className="flex items-center gap-2 text-indigo-400">
                                <Bot size={14} />
                                <p className="text-[10px] font-black uppercase">Pro Pipeline Status</p>
                            </div>
                            <p className="text-[10px] text-gray-500 leading-relaxed font-medium">Veo 3.1 Pro currently operates with a high-priority but strictly enforced concurrency limit. If you hit a limit, simply wait 60 seconds. Each 5-second clip takes ~2-3 minutes to render.</p>
                        </div>

                        <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl space-y-2">
                            <div className="flex items-center gap-2 text-yellow-500">
                                <AlertCircle size={14} />
                                <span className="text-[10px] font-black uppercase font-display tracking-widest">AIE Protocol Note</span>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed font-bold">
                                Video generation takes 2-4 minutes per clip. Each clip is ~8 seconds. You can generate up to 10 clips to build a full promotional narrative.
                            </p>
                        </div>
                    </div>
                </Card>

                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Clip Sequence (10 scenes)</h3>
                        <div className="flex items-center gap-2">
                             <Clock size={14} className="text-gray-500" />
                             <span className="text-[10px] font-black text-gray-500 uppercase">Estimated Total: 80s</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                            {clips.map((clip, index) => (
                                <motion.div
                                    key={clip.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <Card className={`overflow-hidden border-2 transition-all ${clip.status === 'generating' ? 'border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'border-white/5'}`}>
                                        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/5">
                                            <div className="p-4 flex gap-4 flex-1">
                                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 font-black text-sm shrink-0 border border-white/5">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 space-y-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-sm font-black text-white italic truncate pr-4">{clip.title}</h4>
                                                        {clip.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-500" />}
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 line-clamp-1 font-bold italic">{clip.prompt}</p>
                                                </div>
                                            </div>

                                            <div className="p-4 flex items-center gap-3 bg-black/20 w-full md:w-auto">
                                                {clip.status === 'idle' && (
                                                    <Button 
                                                        onClick={() => startGeneration(clip)}
                                                        className="h-9 px-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                                    >
                                                        <Video size={14} /> Generate
                                                    </Button>
                                                )}

                                                {clip.status === 'generating' && (
                                                    <div className="flex items-center gap-3 w-full md:w-40">
                                                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-indigo-500 transition-all duration-1000" 
                                                                style={{ width: `${clip.progress || 5}%` }} 
                                                            />
                                                        </div>
                                                        <Loader2 className="animate-spin text-indigo-400" size={16} />
                                                    </div>
                                                )}

                                                {clip.status === 'completed' && clip.videoUrl && (
                                                    <div className="flex items-center gap-2">
                                                        <a 
                                                            href={clip.videoUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                                                            title="Watch Clip"
                                                        >
                                                            <Play size={16} />
                                                        </a>
                                                        <a 
                                                            href={clip.videoUrl} 
                                                            download 
                                                            className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                                                            title="Download Clip"
                                                        >
                                                            <Download size={16} />
                                                        </a>
                                                        <button 
                                                            onClick={() => updateClip(clip.id, { status: 'idle', videoUrl: undefined, progress: 0 })}
                                                            className="p-2.5 rounded-xl bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-all"
                                                            title="Reset"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}

                                                {clip.status === 'failed' && (
                                                     <div className="flex items-center gap-2">
                                                         <span className="text-[10px] font-black text-red-500 uppercase">System Error</span>
                                                         <Button 
                                                            onClick={() => startGeneration(clip)}
                                                            variant="outline"
                                                            className="h-8 px-3 text-[9px]"
                                                         >Retry</Button>
                                                     </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    <Card className="p-6 bg-indigo-500/5 border-indigo-500/20 border-dashed">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3">
                                <Sparkles className="text-indigo-400" size={24} />
                                <div>
                                    <p className="text-sm font-black text-white italic">Video Composition Tip</p>
                                    <p className="text-[10px] text-gray-500 font-bold">To combine 2 videos, use a standard mobile editor like CapCut or Premiere Rush. AI generated clips work best as b-roll with a voiceover.</p>
                                </div>
                            </div>
                            <Button variant="outline" className="text-[10px] font-black uppercase h-9 border-dashed">Add Custom Scene</Button>
                        </div>
                    </Card>
                </div>
            </section>
        </div>
    );
};
