/* AILogic Hub — service worker.
   - Estáticos (hub.js, hub.css, /assets/*, fontes, supabase CDN): stale-while-revalidate
     (serve do cache na hora + atualiza em segundo plano -> navegação instantânea, sempre fresco).
   - Navegações (HTML): network-first (página sempre atual; cai no cache offline).
   - /api/*: sempre rede (dados frescos; nunca do cache). */
var CACHE = 'ailogic-v1';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isStatic(url) {
  if (/\/api\//.test(url.pathname)) return false;
  if (/\.(?:js|css|png|jpe?g|svg|webp|gif|ico|woff2?|ttf)$/i.test(url.pathname)) return true;
  if (url.hostname.indexOf('jsdelivr') >= 0 || url.hostname.indexOf('gstatic') >= 0 || url.hostname.indexOf('googleapis') >= 0) return true;
  return false;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;                 // mutações passam direto
  var url;
  try { url = new URL(req.url); } catch (_) { return; }

  // /api/* -> sempre rede (não intercepta)
  if (/\/api\//.test(url.pathname)) return;

  // navegação (HTML) -> network-first, cai no cache offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        try { var c = res.clone(); caches.open(CACHE).then(function (ca) { ca.put(req, c); }); } catch (_) {}
        return res;
      }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match('/visaogeral'); }); })
    );
    return;
  }

  // estáticos -> stale-while-revalidate
  if (isStatic(url)) {
    event.respondWith(
      caches.open(CACHE).then(function (ca) {
        return ca.match(req).then(function (cached) {
          var net = fetch(req).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) { try { ca.put(req, res.clone()); } catch (_) {} }
            return res;
          }).catch(function () { return cached; });
          return cached || net;   // serve o cache na hora; atualiza em background
        });
      })
    );
    return;
  }
  // resto: deixa o navegador tratar
});
