/* ===== AILOGIC HUB — camada de autenticação (Supabase Auth) =====
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

  // ---- tema (claro/escuro) global, aplicado o quanto antes ----
  try { document.documentElement.setAttribute('data-theme', localStorage.getItem('ailogic_theme') || 'light'); } catch (_) {}
  window.hubTheme = {
    get: function () { return document.documentElement.getAttribute('data-theme') || 'light'; },
    set: function (t) { try { localStorage.setItem('ailogic_theme', t); } catch (_) {} document.documentElement.setAttribute('data-theme', t); },
    toggle: function () { this.set(this.get() === 'dark' ? 'light' : 'dark'); }
  };

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

  // ---- 1) interceptor de fetch para /api/ (resiliente: fim do F5) ----
  // Problema que corrige: no 1º load o token guardado pode estar EXPIRADO e o
  // refresh do supabase-js é assíncrono -> a chamada saía sem Bearer -> 401 ->
  // /login (o usuário dava F5 e funcionava). Agora: garante token fresco antes de
  // enviar; em 401 tenta refresh + repete 1x; timeout + 1 retry de rede em GET.
  var _fetch = window.fetch.bind(window);

  // tenta obter um token válido; se o do storage expirou, aguarda o refresh do supabase-js
  function freshToken() {
    var tok = readToken();
    if (tok) return Promise.resolve(tok);
    try {
      var c = client();
      if (c && c.auth && c.auth.getSession) {
        // getSession() dispara o autoRefresh quando necessário
        return c.auth.getSession().then(function (r) {
          var s = r && r.data && r.data.session;
          return (s && s.access_token) || readToken() || null;
        }).catch(function () { return readToken(); });
      }
    } catch (_) {}
    return Promise.resolve(readToken());
  }
  function refreshToken() {
    try {
      var c = client();
      if (c && c.auth && c.auth.refreshSession) {
        return c.auth.refreshSession().then(function (r) {
          var s = r && r.data && r.data.session;
          return (s && s.access_token) || readToken() || null;
        }).catch(function () { return null; });
      }
    } catch (_) {}
    return Promise.resolve(null);
  }
  // fetch com timeout (AbortController) — dispara a requisição UMA vez
  function fetchTimeout(input, init, ms) {
    var ctrl; try { ctrl = new AbortController(); } catch (_) { ctrl = null; }
    if (ctrl) init = Object.assign({}, init, { signal: ctrl.signal });
    var t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (_) {} }, ms || 9000) : null;
    function clear() { if (t) { clearTimeout(t); t = null; } }
    return _fetch(input, init).then(function (r) { clear(); return r; }, function (e) { clear(); throw e; });
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var isApi = /\/api\//.test(url);
    if (!isApi) return _fetch(input, init);
    init = init || {};
    var method = String((init.method || (typeof input !== 'string' && input.method) || 'GET')).toUpperCase();
    var isGet = method === 'GET';

    function doSend(tok, isRetry) {
      var headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
      if (tok && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + tok);
      var cfg = Object.assign({}, init, { headers: headers });
      return fetchTimeout(input, cfg, 9000).then(function (res) {
        // 401: 1 tentativa de refresh + repetição antes de mandar pro /login
        if (res.status === 401 && !isRetry && !/\/login/.test(location.pathname)) {
          return refreshToken().then(function (nt) {
            if (nt) return doSend(nt, true);
            setFlag(false); location.replace('/login'); return res;
          });
        }
        return res;
      }, function (err) {
        // erro de rede/timeout: 1 retry só para GET (idempotente)
        if (isGet && !isRetry) return doSend(tok, true);
        throw err;
      });
    }
    return freshToken().then(function (tok) { return doSend(tok, false); });
  };

  // ---- 2) cliente supabase-js (login/refresh) ----
  // normaliza a URL do Supabase: sem espaços, com https://, sem barra final.
  // Uma env var sem protocolo faria o supabase-js falhar com "Failed to fetch".
  function normUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return u.replace(/\/+$/, '');
  }

  var sb = null;
  function client() {
    if (sb) return sb;
    var url = normUrl(CFG.SUPABASE_URL), anon = String(CFG.SUPABASE_ANON_KEY || '').trim();
    if (!window.supabase || !url || !anon) return null;
    sb = window.supabase.createClient(url, anon, {
      auth: { storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    // mantém a flag legada em sincronia com a sessão real
    sb.auth.onAuthStateChange(function (_evt, session) { setFlag(!!session); });
    return sb;
  }

  // existe sessão no storage? (mesmo com access_token expirado, se há refresh_token
  // a sessão é renovável — não deve mandar pro /login, senão vira o "preciso dar F5")
  function hasSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY); if (!raw) return false;
      var s = JSON.parse(raw);
      var sess = s && (s.currentSession || s);
      return !!(sess && (sess.refresh_token || sess.access_token || sess.user));
    } catch (_) { return false; }
  }

  // ---- 3) gate de página ----
  function guard() {
    if (/\/login/.test(location.pathname)) return;
    // tolerante: token expirado mas renovável NÃO redireciona (o fetch resiliente renova)
    if (!readToken() && !hasSession()) { setFlag(false); location.replace('/login'); }
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
    async signUp(email, password) {
      var c = client(); if (!c) throw new Error('config ausente');
      var r = await c.auth.signUp({ email: email, password: password });
      if (r.error) throw r.error;
      if (r.data && r.data.session) setFlag(true); // confirmacao de email desligada -> ja logado
      return r.data;                               // sem session -> precisa confirmar email
    },
    async resetPassword(email) {
      var c = client(); if (!c) throw new Error('config ausente');
      var r = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/redefinir' });
      if (r.error) throw r.error;
      return true;
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
