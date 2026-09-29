// Storage for client interviews.
// Uses Upstash Redis over its REST API (what Vercel's "Upstash for Redis" storage integration provides).
// Env vars (either naming works): KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
// Set MEMORY_STORE=1 to use an in-memory store (local testing only; data is lost on restart).

const mem = globalThis.__onboardingMem || (globalThis.__onboardingMem = { kv: new Map(), sets: new Map() });

function config() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function memCommand([op, key, ...rest]) {
  switch (op) {
    case 'GET': return mem.kv.has(key) ? mem.kv.get(key) : null;
    case 'SET': mem.kv.set(key, rest[0]); return 'OK';
    case 'DEL': return mem.kv.delete(key) ? 1 : 0;
    case 'SADD': { const s = mem.sets.get(key) || new Set(); rest.forEach(v => s.add(v)); mem.sets.set(key, s); return rest.length; }
    case 'SREM': { const s = mem.sets.get(key); if (!s) return 0; rest.forEach(v => s.delete(v)); return rest.length; }
    case 'SMEMBERS': return Array.from(mem.sets.get(key) || []);
    case 'MGET': return [key, ...rest].map(k => (mem.kv.has(k) ? mem.kv.get(k) : null));
    default: throw new Error('unsupported command ' + op);
  }
}

async function command(args) {
  if (process.env.MEMORY_STORE === '1') return memCommand(args);
  const c = config();
  if (!c) throw httpError(503, 'storage_not_connected');
  const r = await fetch(c.url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  let j = null;
  try { j = await r.json(); } catch (e) { /* fall through */ }
  if (!r.ok || !j || j.error) throw httpError(502, 'storage_error: ' + ((j && j.error) || r.status));
  return j.result;
}

const KEY = code => 'onboarding:client:' + code;
const INDEX = 'onboarding:clients';

async function getClient(code) {
  const raw = await command(['GET', KEY(code)]);
  return raw ? JSON.parse(raw) : null;
}

async function putClient(client) {
  await command(['SET', KEY(client.code), JSON.stringify(client)]);
  await command(['SADD', INDEX, client.code]);
  return client;
}

async function listClients() {
  const codes = await command(['SMEMBERS', INDEX]);
  if (!codes || !codes.length) return [];
  const raws = await command(['MGET', ...codes.map(KEY)]);
  return raws.filter(Boolean).map(r => JSON.parse(r));
}

async function deleteClient(code) {
  await command(['DEL', KEY(code)]);
  await command(['SREM', INDEX, code]);
}

module.exports = { getClient, putClient, listClients, deleteClient, httpError };
