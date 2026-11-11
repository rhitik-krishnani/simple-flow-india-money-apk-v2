/**
 * DeepSeek client (OpenAI-compatible chat API), called straight from the app. No backend needed.
 *
 * Build-time settings (Vite env, baked into the bundle):
 *   VITE_DEEPSEEK_API_KEY  - your DeepSeek key. NOTE: anything baked into an APK can be extracted from it.
 *                            Fine for personal use / a few testers. Before publishing publicly, use a proxy (below).
 *   VITE_AI_PROXY_URL      - optional. Base URL of a proxy that holds the key (e.g. a Cloudflare Worker that
 *                            forwards /chat/completions to https://api.deepseek.com). When set, no key is sent.
 *   VITE_DEEPSEEK_MODEL    - optional, defaults to "deepseek-chat".
 *
 * Inside the Android app the request goes through Capacitor's native HTTP, so WebView CORS rules don't apply.
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { AIError } from './api';

const env = (import.meta as any).env || {};
const API_KEY = (env.VITE_DEEPSEEK_API_KEY as string | undefined)?.trim() || '';
const PROXY = ((env.VITE_AI_PROXY_URL as string | undefined) || '').trim().replace(/\/+$/, '');
const MODEL = (env.VITE_DEEPSEEK_MODEL as string | undefined)?.trim() || 'deepseek-chat';
const BASE = PROXY || 'https://api.deepseek.com';

export const isAIConfigured = () => !!(PROXY || API_KEY);

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const TIMEOUT_MS = 90_000;

const post = async (url: string, headers: Record<string, string>, body: unknown): Promise<{ status: number; data: any }> => {
    if (Capacitor.isNativePlatform()) {
        const res = await CapacitorHttp.request({
            url, method: 'POST', headers, data: body,
            connectTimeout: TIMEOUT_MS, readTimeout: TIMEOUT_MS, responseType: 'json',
        });
        let data = res.data;
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch { /* keep text */ } }
        return { status: res.status, data };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
        let data: any = null;
        try { data = await res.json(); } catch { /* not JSON */ }
        return { status: res.status, data };
    } finally {
        clearTimeout(timer);
    }
};

/** Sends a chat request and returns the assistant's text. Throws AIError with a user-friendly message. */
export const deepseekChat = async (
    messages: ChatMessage[],
    opts: { json?: boolean; temperature?: number; maxTokens?: number } = {}
): Promise<string> => {
    if (!isAIConfigured()) throw new AIError('not-configured', 'AI is not available in this build yet (no DeepSeek key was set).');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new AIError('network', "You're offline. Connect to the internet to use AI features.");
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (!PROXY) headers.Authorization = `Bearer ${API_KEY}`;

    const body: Record<string, unknown> = {
        model: MODEL,
        messages,
        temperature: opts.temperature ?? (opts.json ? 0 : 0.7),
        max_tokens: opts.maxTokens ?? (opts.json ? 8000 : 1500),
        stream: false,
    };
    if (opts.json) body.response_format = { type: 'json_object' };

    let res: { status: number; data: any };
    try {
        res = await post(`${BASE}/chat/completions`, headers, body);
    } catch {
        throw new AIError('network', "Couldn't reach the AI service. Check your internet connection and try again.");
    }

    if (res.status === 401) throw new AIError('not-configured', 'The DeepSeek API key was rejected. Check the key used for this build.');
    if (res.status === 402) throw new AIError('server', 'The DeepSeek account has run out of balance. Top it up and try again.');
    if (res.status === 429) throw new AIError('rate-limited', 'Too many AI requests. Try again in a minute.');
    if (res.status < 200 || res.status >= 300) {
        console.error('DeepSeek error', res.status, res.data?.error?.message);
        throw new AIError('server', 'The AI service had a problem. Please try again.');
    }

    const text: string = res.data?.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) throw new AIError('server', 'The AI returned an empty answer. Please try again.');
    return text;
};

/** Asks for JSON (DeepSeek JSON mode) and parses it. The prompt must mention "json". */
export const deepseekJSON = async <T = any>(system: string, user: string): Promise<T> => {
    const text = await deepseekChat([{ role: 'system', content: system }, { role: 'user', content: user }], { json: true });
    try {
        return JSON.parse(text);
    } catch {
        // Occasionally wrapped in a code fence
        const m = text.match(/\{[\s\S]*\}/);
        if (m) { try { return JSON.parse(m[0]); } catch { /* fallthrough */ } }
        throw new AIError('server', 'The AI answer could not be read. Please try again.');
    }
};
