/* AILogic Hub — service worker.
   PRINCÍPIO: "sempre atualizado". O app shell (HTML, JS, CSS) é SEMPRE buscado da
   rede primeiro (network-first); o cache é só reserva offline. Assim toda mudança
   publicada chega no ato — nada de versão velha presa no cache.
   Só imagens/fontes/CDN usam cache (stale-while-revalidate) por serem imutáveis.
   /api/* nunca passa pelo cache (dados frescos). */
var CACHE = 'ailogic-v2';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));  // purga caches antigos
    }).then(function () { return self.clients.claim(); })
  );
});

// imutáveis (podem vir do cache): imagens, fontes e CDNs externos
function isImmutable(url) {
  if (/\/api\//.test(url.pathname)) return false;
  if (/\.(?:png|jpe?g|svg|webp|gif|ico|woff2?|ttf)$/i.test(url.pathname)) return true;
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

  // imutáveis -> stale-while-revalidate (rápido + atualiza em background)
  if (isImmutable(url)) {
    event.respondWith(
      caches.open(CACHE).then(function (ca) {
        return ca.match(req).then(function (cached) {
          var net = fetch(req).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) { try { ca.put(req, res.clone()); } catch (_) {} }
            return res;
          }).catch(function () { return cached; });
          return cached || net;
        });
      })
    );
    return;
  }

  // app shell (HTML, JS, CSS e o resto same-origin) -> NETWORK-FIRST.
  // Sempre pega a versão nova; cai no cache só se estiver offline.
  event.respondWith(
    fetch(req).then(function (res) {
      try { var c = res.clone(); caches.open(CACHE).then(function (ca) { ca.put(req, c); }); } catch (_) {}
      return res;
    }).catch(function () {
      return caches.match(req).then(function (m) { return m || caches.match('/visaogeral'); });
    })
  );
});
