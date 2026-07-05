/* AiLogic Hub — service worker mínimo.
   Existe para habilitar a instalação do PWA (beforeinstallprompt no Android/Chrome).
   Não faz cache offline: apenas repassa as requisições para a rede. */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function () {
  // pass-through: deixa o navegador tratar normalmente (sem cache).
});
