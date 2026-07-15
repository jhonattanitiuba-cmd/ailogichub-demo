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
      lazyConnect: true,              // conecta em background; nunca bloqueia o request
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 400,            // se o Redis estiver lento/frio, desiste rápido (era 2500)
      retryStrategy: function (times) { return times > 3 ? null : 400; }
    });
    _client.on('error', function () {});          // silencioso: cai no fallback do banco
    _client.on('end', function () { _client = null; });
    try { _client.connect().catch(function () {}); } catch (_) {}   // dispara a conexão sem await
  } catch (_) { _off = true; _client = null; }     // pacote ausente -> desliga o cache
  return _client;
}
// só usa o Redis quando a conexão está PRONTA -> nunca espera handshake no caminho crítico
function ready() { const c = client(); return (c && c.status === 'ready') ? c : null; }

async function cacheGet(key) {
  const c = ready(); if (!c) return null;
  try { const v = await c.get(key); return v ? JSON.parse(v) : null; } catch (_) { return null; }
}
async function cacheSet(key, val, ttl) {
  const c = ready(); if (!c) return;
  try { await c.set(key, JSON.stringify(val), 'EX', ttl || 25); } catch (_) {}
}
async function cacheDel() {   // apaga uma ou mais chaves (invalidacao apos mutacao)
  const c = ready(); if (!c) return;
  const keys = [].slice.call(arguments).filter(Boolean);
  try { if (keys.length) await c.del(keys); } catch (_) {}
}
module.exports = { cacheGet, cacheSet, cacheDel };
