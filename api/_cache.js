// AILOGIC HUB — cache Redis (infra dedicada) com DEGRADAÇÃO SEGURA.
// Sem REDIS_URL, sem o pacote, ou Redis fora do ar => vira no-op e tudo funciona
// normal via Postgres. Reusa a conexão entre invocações quentes (igual ao pool do _db).
const REDIS_URL = process.env.REDIS_URL || '';
let _client = null, _off = !REDIS_URL;

function client() {
  if (_off) return null;
  if (_client) return _client;
  try {
    const Redis = require('ioredis');
    _client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2500,
      retryStrategy: function (times) { return times > 3 ? null : 400; }
    });
    _client.on('error', function () {});          // silencioso: cai no fallback do banco
    _client.on('end', function () { _client = null; });
  } catch (_) { _off = true; _client = null; }     // pacote ausente -> desliga o cache
  return _client;
}

async function cacheGet(key) {
  const c = client(); if (!c) return null;
  try { const v = await c.get(key); return v ? JSON.parse(v) : null; } catch (_) { return null; }
}
async function cacheSet(key, val, ttl) {
  const c = client(); if (!c) return;
  try { await c.set(key, JSON.stringify(val), 'EX', ttl || 25); } catch (_) {}
}
async function cacheDel() {   // apaga uma ou mais chaves (invalidacao apos mutacao)
  const c = client(); if (!c) return;
  const keys = [].slice.call(arguments).filter(Boolean);
  try { if (keys.length) await c.del(keys); } catch (_) {}
}
module.exports = { cacheGet, cacheSet, cacheDel };
