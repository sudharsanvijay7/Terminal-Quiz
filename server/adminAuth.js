'use strict';
/*
 * Admin authentication for Terminal Quiz.
 *
 *  - Password is never stored in plain text: only a salted scrypt hash is kept.
 *    (Set ADMIN_PASSWORD in the environment to override it at startup.)
 *  - Constant-time password comparison.
 *  - Per-IP brute-force protection with escalating lockouts + a delay on every failure.
 *  - Random 256-bit session tokens, stored server-side only as SHA-256 hashes.
 *  - Sessions expire after IDLE_MS of inactivity or ABSOLUTE_MS in total, and can be revoked (logout).
 *  - Everything lives in memory: restarting the server logs every admin out and clears all lockouts.
 */
const crypto = require('crypto');

// scrypt hash of the event admin password (salt + hash, hex).
const DEFAULT_SALT = '9769e5aedef17fc6429c8986beedd431';
const DEFAULT_HASH = '7cebe5553ff215662b40f8249c2973b185c93d2cf5183b4bc5f8f326d25d9123b2046114710292f8829a0e71eb7bf45e9e1e96536c67f55efc8b06dc9f87bc08';
const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;

const MAX_PASSWORD_LEN = 200;
const MAX_FAILS = 5;                       // failed attempts before a lockout
const FAIL_WINDOW_MS = 15 * 60 * 1000;     // failures older than this are forgotten
const LOCKOUT_BASE_MS = 5 * 60 * 1000;     // first lockout, doubles each time, capped below
const LOCKOUT_MAX_MS = 30 * 60 * 1000;
const FAIL_DELAY_MS = 800;                 // slow down every wrong guess
const IDLE_MS = 30 * 60 * 1000;            // dashboard polls every 3s, so this only hits abandoned sessions
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
const MAX_SESSIONS = 5;

let salt = Buffer.from(DEFAULT_SALT, 'hex');
let hash = Buffer.from(DEFAULT_HASH, 'hex');
if (process.env.ADMIN_PASSWORD) {
  salt = crypto.randomBytes(16);
  hash = crypto.scryptSync(String(process.env.ADMIN_PASSWORD), salt, KEYLEN, SCRYPT);
}

const sessions = new Map();   // sha256(token) -> { created, last, ip }
const attempts = new Map();   // ip -> { fails, first, lockedUntil, lockouts }

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clientIp(req) {
  return String(req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length === 0 || pw.length > MAX_PASSWORD_LEN) return false;
  const test = crypto.scryptSync(pw, salt, KEYLEN, SCRYPT);
  return crypto.timingSafeEqual(test, hash);
}

/** Seconds remaining if this IP is locked out, otherwise 0. */
function lockedFor(ip) {
  const a = attempts.get(ip);
  if (!a || !a.lockedUntil) return 0;
  const left = a.lockedUntil - Date.now();
  if (left <= 0) { a.lockedUntil = 0; a.fails = 0; return 0; }
  return Math.ceil(left / 1000);
}

function recordFailure(ip) {
  const now = Date.now();
  let a = attempts.get(ip);
  if (!a || now - a.first > FAIL_WINDOW_MS) a = { fails: 0, first: now, lockedUntil: 0, lockouts: a ? a.lockouts : 0 };
  a.fails++;
  if (a.fails >= MAX_FAILS) {
    a.lockouts++;
    a.lockedUntil = now + Math.min(LOCKOUT_BASE_MS * 2 ** (a.lockouts - 1), LOCKOUT_MAX_MS);
  }
  attempts.set(ip, a);
  return a;
}

function pruneSessions() {
  const now = Date.now();
  for (const [k, s] of sessions) {
    if (now - s.last > IDLE_MS || now - s.created > ABSOLUTE_MS) sessions.delete(k);
  }
}

function createSession(ip) {
  pruneSessions();
  while (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(sha(token), { created: now, last: now, ip });
  return token;
}

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

/** True if the request carries a valid admin session (and refreshes its idle timer). */
function isAdmin(req) {
  const t = bearer(req);
  if (!t || t.length > 200) return false;
  const k = sha(t);
  const s = sessions.get(k);
  if (!s) return false;
  const now = Date.now();
  if (now - s.last > IDLE_MS || now - s.created > ABSOLUTE_MS) { sessions.delete(k); return false; }
  s.last = now;
  return true;
}

function revoke(req) {
  const t = bearer(req);
  if (t) sessions.delete(sha(t));
}

/**
 * Verify a password for `ip`, applying lockout + failure delay.
 * Resolves to { ok:true } | { ok:false, locked:true, retryAfter } | { ok:false, locked:false }.
 */
async function verify(ip, password) {
  const wait = lockedFor(ip);
  if (wait) return { ok: false, locked: true, retryAfter: wait };
  if (checkPassword(password)) {
    attempts.delete(ip);
    return { ok: true };
  }
  const a = recordFailure(ip);
  await sleep(FAIL_DELAY_MS);
  const nowLocked = lockedFor(ip);
  return nowLocked
    ? { ok: false, locked: true, fresh: true, retryAfter: nowLocked }
    : { ok: false, locked: false, remaining: Math.max(0, MAX_FAILS - a.fails) };
}

setInterval(() => {
  pruneSessions();
  const now = Date.now();
  for (const [ip, a] of attempts) if (!a.lockedUntil && now - a.first > FAIL_WINDOW_MS) attempts.delete(ip);
}, 60 * 1000).unref();

module.exports = { clientIp, verify, createSession, isAdmin, revoke };