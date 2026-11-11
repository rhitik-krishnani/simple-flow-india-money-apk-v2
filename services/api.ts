/**
 * Client for the AI backend.
 *  - Web:   same origin, relative URLs (the server also serves the app).
 *  - Android/iOS app (Capacitor): the app runs from https://localhost, so it MUST be built with
 *    VITE_API_BASE_URL pointing at the hosted backend, for example  VITE_API_BASE_URL=https://api.example.com
 * Every request carries the user's Firebase ID token; the server rejects anything without one.
 */
export type AIErrorCode = 'sign-in-required' | 'rate-limited' | 'network' | 'not-configured' | 'server';

export class AIError extends Error {
    constructor(public code: AIErrorCode, message: string) { super(message); this.name = 'AIError'; }
}

const BASE = ((import.meta.env?.VITE_API_BASE_URL as string | undefined) || '').replace(/\/+$/, '');
export const apiUrl = (path: string) => BASE + path;

let tokenProvider: (() => Promise<string | null>) | null = null;
/** Registered once by dataService after Firebase Auth is initialised (keeps this file free of imports). */
export const setAITokenProvider = (fn: () => Promise<string | null>) => { tokenProvider = fn; };

const isNativeApp = () => !!(globalThis as any).Capacitor?.isNativePlatform?.();

export const apiFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (isNativeApp() && !BASE) throw new AIError('not-configured', 'AI is not available in this build yet.');

    let token: string | null = null;
    try { token = tokenProvider ? await tokenProvider() : null; } catch { token = null; }
    if (!token) throw new AIError('sign-in-required', 'Sign in to use AI features. They are not available in Guest Mode.');

    let res: Response;
    try {
        res = await fetch(apiUrl(path), { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
    } catch {
        throw new AIError('network', "Couldn't reach the AI service. Check your internet connection and try again.");
    }
    if (res.ok) return res;

    let message = '';
    try { message = (await res.clone().json())?.error || ''; } catch { /* not JSON */ }
    if (res.status === 401) throw new AIError('sign-in-required', message || 'Please sign in again to use AI features.');
    if (res.status === 429) throw new AIError('rate-limited', message || 'Too many AI requests. Try again in a minute.');
    if (res.status === 503) throw new AIError('not-configured', message || 'AI is not set up yet.');
    throw new AIError('server', message || 'The AI service had a problem. Please try again.');
};

/** Shows a short, dismissible notice (rendered by <AINotice /> in the app shell). */
export const notifyAI = (message: string) => {
    try { window.dispatchEvent(new CustomEvent('ai-notice', { detail: message })); } catch { /* non-browser */ }
};
