/* ===== AI LOGIC HUB — camada de autenticação (Supabase Auth) =====
 * Depende de: hub-config.js (window.HUB_CONFIG) e supabase-js (window.supabase).
 * Responsabilidades:
 *   1) Interceptar fetch('/api/...') e anexar o access_token (Bearer).
 *   2) Gate de página: sem sessão -> manda pro /login.
 *   3) Login/logout e refresh de token via supabase-js.
 * Segurança real é server-side (api/_auth.js). Este gate é UX.
 */
(function () {
  'use strict';

  var CFG = window.HUB_CONFIG || {};
  var STORAGE_KEY = 'ailogic-auth'; // storageKey fixo do supabase-js
  var FLAG = 'ailogic_auth';        // flag legada usada pelo gate inline das telas

  // ---- lê o access_token direto do localStorage (síncrono, não espera o supabase-js) ----
  function readToken() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      var tok = s && (s.access_token || (s.currentSession && s.currentSession.access_token));
      var exp = s && (s.expires_at || (s.currentSession && s.currentSession.expires_at));
      if (exp && (Date.now() / 1000) > (exp + 5)) return null; // expirado
      return tok || null;
    } catch (_) { return null; }
  }

  function setFlag(on) {
    try { on ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG); } catch (_) {}
  }

  // ---- 1) interceptor de fetch para /api/ ----
  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var isApi = /^\/api\//.test(url) || /\/api\//.test(url);
    if (!isApi) return _fetch(input, init);
    init = init || {};
    var headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
    var tok = readToken();
    if (tok && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + tok);
    init.headers = headers;
    return _fetch(input, init).then(function (res) {
      if (res.status === 401 && !/\/login/.test(location.pathname)) {
        setFlag(false);
        location.replace('/login');
      }
      return res;
    });
  };

  // ---- 2) cliente supabase-js (login/refresh) ----
  var sb = null;
  function client() {
    if (sb) return sb;
    if (!window.supabase || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return null;
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    // mantém a flag legada em sincronia com a sessão real
    sb.auth.onAuthStateChange(function (_evt, session) { setFlag(!!session); });
    return sb;
  }

  // ---- 3) gate de página ----
  function guard() {
    if (/\/login/.test(location.pathname)) return;
    if (!readToken()) { setFlag(false); location.replace('/login'); }
  }

  // API pública
  window.hubAuth = {
    client: client,
    token: readToken,
    async signIn(email, password) {
      var c = client(); if (!c) throw new Error('config ausente');
      var r = await c.auth.signInWithPassword({ email: email, password: password });
      if (r.error) throw r.error;
      setFlag(true);
      return r.data;
    },
    async signOut() {
      try { var c = client(); if (c) await c.auth.signOut(); } catch (_) {}
      setFlag(false);
      location.replace('/login');
    },
    async user() {
      var c = client(); if (!c) return null;
      var r = await c.auth.getUser(); return r && r.data ? r.data.user : null;
    }
  };

  // inicializa cliente quando o supabase-js estiver disponível (refresh de token)
  function boot() { if (window.supabase) client(); else setTimeout(boot, 60); }
  boot();

  // ---- pinta o usuário logado no rodapé da sidebar (.profile) ----
  function paintUser() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY); if (!raw) return;
      var s = JSON.parse(raw);
      var u = (s && s.user) || (s && s.currentSession && s.currentSession.user);
      if (!u) return;
      var meta = u.user_metadata || {};
      var email = u.email || '';
      var nome = meta.nome || (email ? email.split('@')[0] : 'Usuário');
      var perfil = meta.perfil || 'Usuário';
      var ini = (nome.trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('') || 'U').toUpperCase();
      function apply() {
        var p = document.querySelector('.profile'); if (!p) return;
        var st = p.querySelector('strong'); if (st) st.textContent = nome;
        var sp = p.querySelector('span'); if (sp) sp.textContent = perfil.charAt(0).toUpperCase() + perfil.slice(1);
        var av = p.querySelector('.avatar'); if (av) av.textContent = ini;
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
      else apply();
    } catch (_) {}
  }

  // roda o gate assim que possível (fora da tela de login)
  guard();
  paintUser();
})();
