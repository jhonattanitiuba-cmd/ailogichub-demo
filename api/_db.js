// AILOGIC HUB — pool de conexão Postgres compartilhado.
// Conectar ao banco self-hosted leva ~1s; abrir conexão NOVA a cada request
// deixava tudo lento. Um Pool de escopo de módulo (mantido entre invocações
// quentes da mesma função serverless) reusa a conexão -> chamadas seguintes ~230ms.
const { Pool } = require('pg');
const DB_URL = process.env.DB_URL || '';

let _pool = null;
function pool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: DB_URL,
      ssl: false,
      keepAlive: true,
      max: 2,                        // poucas conexões por função (evita estourar limite do banco)
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 8000
    });
    // erro em conexão ociosa (ex.: banco fechou) não pode derrubar o processo
    _pool.on('error', function () {});
  }
  return _pool;
}
async function db(q, p) { return pool().query(q, p); }

module.exports = { db, pool };
