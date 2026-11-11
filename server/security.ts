/**
 * Backend security building blocks: Firebase login check, CORS, rate limiting and request validation.
 * Pure middleware factories with no side effects on import, so they can be unit tested (tests/server.test.ts).
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface AuthedUser { uid: string; email?: string; emailVerified: boolean }
declare global { namespace Express { interface Request { user?: AuthedUser } } }

export const parseList = (v?: string): string[] => (v || '').split(',').map(s => s.trim()).filter(Boolean);

// ---------------------------------------------------------------- Firebase ID token verification
const GOOGLE_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/** Verifies a Firebase Auth ID token (RS256, Google public keys). Needs only the project id, no service account. */
export const createTokenVerifier = (projectId: string, getKey?: JWTVerifyGetKey) => {
    const keys = getKey ?? createRemoteJWKSet(new URL(GOOGLE_JWKS));
    return async (token: string): Promise<AuthedUser> => {
        const { payload } = await jwtVerify(token, keys, {
            issuer: `https://securetoken.google.com/${projectId}`,
            audience: projectId,
            algorithms: ['RS256'],
        });
        if (!payload.sub) throw new Error('Token has no subject');
        return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined, emailVerified: payload.email_verified === true };
    };
};

export const requireAuth = (verify: (token: string) => Promise<AuthedUser>): RequestHandler =>
    async (req: Request, res: Response, next: NextFunction) => {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
        if (!token) return void res.status(401).json({ error: 'Sign in to use AI features.', code: 'sign-in-required' });
        try {
            req.user = await verify(token);
            next();
        } catch {
            res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'sign-in-required' });
        }
    };

export const requireAdmin = (adminEmails: string[]): RequestHandler => (req, res, next) => {
    const email = req.user?.email?.toLowerCase();
    if (email && req.user?.emailVerified && adminEmails.map(e => e.toLowerCase()).includes(email)) return next();
    res.status(403).json({ error: 'Not allowed.', code: 'forbidden' });
};

// ---------------------------------------------------------------- CORS
/** Capacitor serves the app from https://localhost (Android) or capacitor://localhost (iOS). */
export const DEFAULT_ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost', 'http://localhost:3000', 'http://localhost:5173'];

export const createCors = (allowed: string[]): RequestHandler => (req, res, next) => {
    const origin = req.headers.origin;
    const ok = !!origin && allowed.includes(origin);
    if (ok) {
        res.setHeader('Access-Control-Allow-Origin', origin!);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return void res.sendStatus(ok ? 204 : 403);
    next();
};

// ---------------------------------------------------------------- Rate limiting (per user, in memory)
export const createRateLimiter = (o: { perMinute: number; perDay: number; now?: () => number }): RequestHandler => {
    const hits = new Map<string, number[]>();
    const now = o.now ?? Date.now;
    return (req, res, next) => {
        const key = req.user?.uid || req.ip || 'anonymous';
        const t = now();
        const day = (hits.get(key) || []).filter(x => t - x < 86_400_000);
        const minute = day.filter(x => t - x < 60_000);
        const limited = (retryMs: number, msg: string) => {
            res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryMs / 1000))));
            res.status(429).json({ error: msg, code: 'rate-limited' });
        };
        if (minute.length >= o.perMinute) return limited(60_000 - (t - minute[0]), 'Too many AI requests. Try again in a minute.');
        if (day.length >= o.perDay) return limited(86_400_000 - (t - day[0]), "You've reached today's AI limit. Try again tomorrow.");
        day.push(t);
        hits.set(key, day);
        if (hits.size > 10_000) for (const [k, v] of hits) if (t - v[v.length - 1] > 86_400_000) hits.delete(k);
        next();
    };
};

// ---------------------------------------------------------------- Request validation
const MIME_OK = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
const str = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Shape/size checks per action. Keeps oversized or malformed payloads away from the (paid) model call. */
export const validateAIRequest = (action: unknown, args: unknown): string | null => {
    if (typeof action !== 'string') return 'Missing action.';
    if (!Array.isArray(args)) return 'Invalid arguments.';
    const a = args as unknown[];
    switch (action) {
        case 'parseVoiceTransaction': return a.length === 1 && str(a[0], 8_000_000) ? null : 'Invalid audio.';
        case 'extractStatementTransactions':
        case 'extractMutualFundInvestments':
            return a.length === 2 && str(a[0], 14_000_000) && typeof a[1] === 'string' && MIME_OK.includes(a[1]) ? null : 'Invalid file. Use a PDF, PNG, JPG or WebP under 10 MB.';
        case 'parsePdfStatement': return a.length === 1 && str(a[0], 400_000) ? null : 'Invalid statement text.';
        case 'getFinancialAdvice': {
            const ctxOk = typeof a[1] === 'object' && a[1] !== null && JSON.stringify(a[1]).length <= 100_000;
            return a.length >= 2 && a.length <= 3 && str(a[0], 1000) && ctxOk && (a[2] === undefined || typeof a[2] === 'string') ? null : 'Invalid question.';
        }
        default: return null; // unknown actions are rejected by the allow-list in server.ts
    }
};
