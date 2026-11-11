import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';
import { createTokenVerifier, requireAuth, requireAdmin, createCors, createRateLimiter, validateAIRequest, parseList, DEFAULT_ORIGINS } from '../server/security';

let passed = 0;
const t = async (name: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log('ok  -', name); };

const PROJECT = 'demo-project';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), alg: 'RS256', use: 'sig', kid: 'k1' };
const verify = createTokenVerifier(PROJECT, createLocalJWKSet({ keys: [jwk] }));
const sign = (o: { sub?: string; email?: string; verified?: boolean; iss?: string; aud?: string; exp?: string } = {}) =>
    new SignJWT({ email: o.email, email_verified: o.verified ?? true })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setSubject(o.sub ?? 'user-1').setIssuer(o.iss ?? `https://securetoken.google.com/${PROJECT}`).setAudience(o.aud ?? PROJECT)
        .setIssuedAt().setExpirationTime(o.exp ?? '1h').sign(privateKey);

let clock = 1_000_000;
const app = express();
app.use(createCors([...DEFAULT_ORIGINS, 'https://app.example.com']));
app.post('/ai', requireAuth(verify), createRateLimiter({ perMinute: 3, perDay: 5, now: () => clock }), express.json(), (req, res) => res.json({ uid: req.user!.uid }));
app.get('/admin', requireAuth(verify), requireAdmin(['Boss@Example.com']), (_req, res) => res.json({ ok: true }));
const server = http.createServer(app);
await new Promise<void>(r => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const call = (path: string, init: RequestInit = {}) => fetch(base + path, init);
const auth = async (o?: Parameters<typeof sign>[0]) => ({ Authorization: `Bearer ${await sign(o)}`, 'Content-Type': 'application/json' });

await t('Auth: rejects missing, malformed, wrong-project and expired tokens', async () => {
    assert.equal((await call('/ai', { method: 'POST' })).status, 401);
    assert.equal((await call('/ai', { method: 'POST', headers: { Authorization: 'Bearer nonsense' } })).status, 401);
    assert.equal((await call('/ai', { method: 'POST', headers: await auth({ aud: 'other-project' }) })).status, 401);
    assert.equal((await call('/ai', { method: 'POST', headers: await auth({ iss: 'https://securetoken.google.com/other' }) })).status, 401);
    assert.equal((await call('/ai', { method: 'POST', headers: await auth({ exp: '-1h' }) })).status, 401);
    const r = await call('/ai', { method: 'POST' }); assert.equal((await r.json()).code, 'sign-in-required');
});
await t('Auth: accepts a valid token and exposes the uid', async () => {
    const r = await call('/ai', { method: 'POST', headers: await auth({ sub: 'abc123' }), body: '{}' });
    assert.equal(r.status, 200); assert.equal((await r.json()).uid, 'abc123');
});
await t('Admin: only verified listed emails (case-insensitive)', async () => {
    assert.equal((await call('/admin', { headers: await auth({ email: 'someone@x.com' }) })).status, 403);
    assert.equal((await call('/admin', { headers: await auth({ email: 'boss@example.com', verified: false }) })).status, 403);
    assert.equal((await call('/admin', { headers: await auth({ email: 'boss@example.com' }) })).status, 200);
});
await t('Rate limit: per-minute and per-day, per user, with Retry-After', async () => {
    const h = await auth({ sub: 'limited' });
    for (let i = 0; i < 3; i++) assert.equal((await call('/ai', { method: 'POST', headers: h, body: '{}' })).status, 200);
    const blocked = await call('/ai', { method: 'POST', headers: h, body: '{}' });
    assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get('retry-after')) > 0);
    assert.equal((await call('/ai', { method: 'POST', headers: await auth({ sub: 'other-user' }), body: '{}' })).status, 200); // other users unaffected
    clock += 61_000; // minute window passes
    assert.equal((await call('/ai', { method: 'POST', headers: h, body: '{}' })).status, 200);
    assert.equal((await call('/ai', { method: 'POST', headers: h, body: '{}' })).status, 200);
    clock += 61_000;
    const daily = await call('/ai', { method: 'POST', headers: h, body: '{}' }); // 6th call within a day (limit 5)
    assert.equal(daily.status, 429); assert.equal((await daily.json()).code, 'rate-limited');
});
await t('CORS: Capacitor origins allowed, unknown origins not', async () => {
    const ok = await call('/ai', { method: 'OPTIONS', headers: { Origin: 'https://localhost', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(ok.status, 204); assert.equal(ok.headers.get('access-control-allow-origin'), 'https://localhost');
    assert.match(ok.headers.get('access-control-allow-headers') || '', /Authorization/);
    assert.equal((await call('/ai', { method: 'OPTIONS', headers: { Origin: 'capacitor://localhost' } })).status, 204);
    assert.equal((await call('/ai', { method: 'OPTIONS', headers: { Origin: 'https://app.example.com' } })).status, 204);
    const bad = await call('/ai', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    assert.equal(bad.status, 403); assert.equal(bad.headers.get('access-control-allow-origin'), null);
});
await t('Validation: payload shape and size per action', async () => {
    assert.equal(validateAIRequest('getFinancialAdvice', ['how do I save?', { investments: [] }, 'en']), null);
    assert.ok(validateAIRequest('getFinancialAdvice', ['x'.repeat(1001), {}, 'en']));
    assert.ok(validateAIRequest('getFinancialAdvice', ['q', 'not-an-object']));
    assert.equal(validateAIRequest('extractStatementTransactions', ['AAAA', 'application/pdf']), null);
    assert.ok(validateAIRequest('extractStatementTransactions', ['AAAA', 'application/x-msdownload']));
    assert.ok(validateAIRequest('extractMutualFundInvestments', ['x'.repeat(14_000_001), 'application/pdf']));
    assert.ok(validateAIRequest('parseVoiceTransaction', []));
    assert.ok(validateAIRequest('parsePdfStatement', 'not-an-array'));
    assert.ok(validateAIRequest(undefined, []));
});
await t('Config: parseList trims and drops blanks', () => assert.deepEqual(parseList(' a@x.com, ,b@y.com '), ['a@x.com', 'b@y.com']));

server.close();
console.log(`\n${passed} server tests passed`);
