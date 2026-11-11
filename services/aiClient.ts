/**
 * OpenRouter client (OpenAI-compatible chat API), called straight from the app. No backend needed.
 *
 * Build-time settings (Vite env, baked into the bundle):
 *   VITE_OPENROUTER_API_KEY - your OpenRouter key. NOTE: anything baked into an APK can be extracted from it.
 *   VITE_AI_MODEL           - optional. Defaults to "openrouter/free" (auto-picks an available free model).
 *                             Example paid model: "deepseek/deepseek-chat".
 *   VITE_AI_PROXY_URL       - optional. Base URL of a proxy that holds the key. When set, no key is sent.
 *
 * Inside the Android app the request goes through Capacitor's native HTTP, so WebView CORS rules don't apply.
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { AIError } from './api';

const env = (import.meta as any).env || {};
const API_KEY = (env.VITE_OPENROUTER_API_KEY as string | undefined)?.trim() || '';
const PROXY = ((env.VITE_AI_PROXY_URL as string | undefined) || '').trim().replace(/\/+$/, '');
const MODEL = (env.VITE_AI_MODEL as string | undefined)?.trim() || 'openrouter/free';
const BASE = PROXY || 'https://openrouter.ai/api/v1';

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
export const aiChat = async (
    messages: ChatMessage[],
    opts: { json?: boolean; temperature?: number; maxTokens?: number } = {}
): Promise<string> => {
    if (!isAIConfigured()) throw new AIError('not-configured', 'AI is not available in this build yet (no OpenRouter key was set).');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new AIError('network', "You're offline. Connect to the internet to use AI features.");
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Title': 'Indian Money Code',
        'HTTP-Referer': 'https://indianmoneycode.app',
    };
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

    // OpenRouter can also return 200 with an error object
    const errMsg: string = res.data?.error?.message || '';
    const status = res.data?.error?.code && res.status === 200 ? Number(res.data.error.code) || 500 : res.status;

    if (status === 401) throw new AIError('not-configured', 'The OpenRouter API key was rejected. Check the key used for this build.');
    if (status === 402) throw new AIError('server', 'The OpenRouter account is out of credits. Top it up or use a free model.');
    if (status === 429) throw new AIError('rate-limited', 'The free AI limit was reached. Try again in a minute (or later today).');
    if (status < 200 || status >= 300) {
        console.error('OpenRouter error', status, errMsg);
        throw new AIError('server', 'The AI service had a problem. Please try again.');
    }

    const text: string = res.data?.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) throw new AIError('server', 'The AI returned an empty answer. Please try again.');
    return text;
};

/** Asks for JSON and parses it. The prompt should describe the json shape. */
export const aiJSON = async <T = any>(system: string, user: string): Promise<T> => {
    const text = await aiChat([{ role: 'system', content: system }, { role: 'user', content: user }], { json: true });
    try {
        return JSON.parse(text);
    } catch {
        // Some models wrap JSON in a code fence or add text around it
        const m = text.match(/\{[\s\S]*\}/);
        if (m) { try { return JSON.parse(m[0]); } catch { /* fallthrough */ } }
        throw new AIError('server', 'The AI answer could not be read. Please try again.');
    }
};
