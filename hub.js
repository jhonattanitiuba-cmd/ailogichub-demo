/* ===== AI LOGIC HUB — comportamento global ===== */
(function(){
  'use strict';

  /* ---------- biblioteca de ícones SVG (stroke, herdam currentColor) ---------- */
  var P = {
    home:'M3 11.5 12 4l9 7.5M5 10v10h14V10M9.5 20v-6h5v6',
    building:'M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M15 8h4a1 1 0 0 1 1 1v12M8 7h3M8 11h3M8 15h3M4 21h16',
    users:'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 20v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6',
    idcard:'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 16c.5-2 2-2.5 3-2.5s2.5.5 3 2.5M14 9h5M14 12.5h5M14 16h3',
    target:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01',
    funnel:'M3 5h18l-7 8v6l-4-2v-4z',
    calendar:'M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3 10h18M8 3v4M16 3v4',
    chat:'M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z',
    mail:'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM3 7l9 6 9-6',
    box:'M21 8 12 3 3 8l9 5 9-5ZM3 8v8l9 5 9-5V8M12 13v8',
    map:'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14',
    download:'M12 3v12M7 11l5 4 5-4M5 21h14',
    pen:'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14 6l3 3',
    megaphone:'M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1ZM18 8a4 4 0 0 1 0 8',
    dollar:'M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.8 7 7s2.2 3 5 3.5 5 1.4 5 3.5-2.2 3.5-5 3.5-5-1.1-5-3',
    swap:'M7 7h11l-3-3M17 17H6l3 3',
    chart:'M5 21V10M12 21V4M19 21v-7M3 21h18',
    sparkle:'M12 3v5M12 16v5M3 12h5M16 12h5M12 8l1.6 2.4L16 12l-2.4 1.6L12 16l-1.6-2.4L8 12l2.4-1.6z',
    plug:'M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8ZM12 16v5',
    globe:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9Z',
    wallet:'M3 7h16a1 1 0 0 1 1 1v3h-4a2 2 0 0 0 0 4h4v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1ZM3 7l13-4v4',
    help:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.2 9a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2.5-2.6 2.5M12 17h.01',
    gear:'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 13H4a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 3.4V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 .9 2.7H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4.9Z',
    sliders:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
    folder:'M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z',
    file:'M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v4h4',
    trophy:'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3',
    check:'M21 11.5V12a9 9 0 1 1-5.3-8.2M9 12l2.5 2.5L22 4',
    headset:'M4 18v-6a8 8 0 0 1 16 0v6M4 18a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2ZM20 18a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z',
    pin:'M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    trend:'M3 17l6-6 4 4 8-8M15 7h6v6',
    key:'M15 8a4 4 0 1 0-3.8 4L7 16v3h3l1-1h2l1-1v-2l1-1a4 4 0 0 0-.2-6ZM16 7h.01',
    bot:'M12 3v3M5 9h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM9 14v1M15 14v1M2 12v3M22 12v3',
    bell:'M18 9a6 6 0 1 0-12 0c0 5-2 7-2 7h16s-2-2-2-7M10.5 21a2 2 0 0 0 3 0',
    shield:'M12 21s7-3.2 7-9V6l-7-3-7 3v6c0 5.8 7 9 7 9ZM9.5 12l1.8 1.8L15 10',
    phone:'M5 4h3l1.5 5L7.5 11a12 12 0 0 0 5.5 5.5L15 14l5 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
    search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
    inbox:'M3 12h5l2 3h4l2-3h5M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
    camera:'M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    arrow:'M5 12h14M13 6l6 6-6 6',
    rocket:'M5 15c-1 1-1.5 4-1.5 4s3-.5 4-1.5M9 13a8 8 0 0 1 8-8h2v2a8 8 0 0 1-8 8M9 13l2 2M14 7.5a1.2 1.2 0 1 0 0 .01'
  };
  function svg(name){ var d=P[name]; if(!d) return null;
    return '<span class="hub-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
      + d.split('M').filter(Boolean).map(function(s){return '<path d="M'+s.trim()+'"/>';}).join('') + '</svg></span>'; }

  /* ---------- 1) ícones do menu (por href) ---------- */
  var NAV={ 'index.html':'home','imobiliarias.html':'building','corretores.html':'users','pessoas.html':'idcard',
    'leads.html':'target','funil.html':'funnel','agenda.html':'calendar','whatsapp.html':'chat','emails.html':'mail',
    'imoveis.html':'box','mapa.html':'map','captacao.html':'download','assinaturas.html':'pen','anuncios.html':'megaphone',
    'credito.html':'dollar','locacao.html':'swap','relatorios.html':'chart','insights.html':'sparkle',
    'integracoes.html':'plug','site.html':'globe','financeiro.html':'wallet','suporte.html':'help',
    'administrador.html':'gear','config-ia.html':'sliders' };

  /* ---------- 2) emojis -> ícone ---------- */
  var EMO={ '👥':'users','👤':'idcard','🧑':'idcard','🏠':'home','🏡':'home','🏢':'building','💬':'chat','📁':'folder','🗂':'folder',
    '🤖':'bot','⏱':'clock','⏰':'clock','⏳':'clock','🕒':'clock','📅':'calendar','🗓':'calendar','📄':'file','📃':'file','📋':'file',
    '🏆':'trophy','✨':'sparkle','💡':'sparkle','✔':'check','✅':'check','☑':'check','🎧':'headset','📍':'pin','📌':'pin',
    '📈':'trend','📉':'trend','📊':'chart','🌐':'globe','🔐':'key','🔒':'key','🔑':'key','☏':'phone','📞':'phone','📱':'phone',
    '✉':'mail','📧':'mail','📨':'mail','📥':'inbox','📷':'camera','📸':'camera','💰':'dollar','💵':'wallet','💳':'wallet',
    '🔔':'bell','⚙':'gear','🛡':'shield','🔍':'search','🔎':'search','↗':'arrow','➡':'arrow','⇄':'swap','⇆':'swap',
    '🚀':'rocket','✍':'pen','🖊':'pen','📢':'megaphone','📣':'megaphone','🔌':'plug','🧩':'plug','🎯':'target' };

  var EMOJI_RE=/[⌚-⌛⏩-⏺☀-➿⬀-⯿\u{1F000}-\u{1FAFF}‍️]/gu;

  function replaceIconHosts(){
    // menu
    document.querySelectorAll('.nav-item').forEach(function(a){
      var href=(a.getAttribute('href')||'').split('/').pop();
      var ico=a.querySelector('.ico'); if(ico&&NAV[href]){ var s=svg(NAV[href]); if(s) ico.innerHTML=s; }
    });
    // contêineres de ícone com 1 emoji
    document.querySelectorAll('.kpi-icon,.card-icon,.r-ico,.ai,.ph-ico,.support .ico,.metric strong').forEach(function(el){
      var t=(el.textContent||'').trim();
      if(EMO[t]){ var s=svg(EMO[t]); if(s){ el.innerHTML=s; return; } }
    });
  }

  /* ---------- 3) anti-travessão + limpa emojis soltos do texto ---------- */
  function cleanText(){
    var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
      var p=n.parentNode; if(!p) return NodeFilter.FILTER_REJECT;
      var tag=p.nodeName; if(tag==='SCRIPT'||tag==='STYLE') return NodeFilter.FILTER_REJECT;
      if(p.classList&&p.classList.contains('hub-ic')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    var n, list=[]; while(n=w.nextNode()) list.push(n);
    list.forEach(function(t){
      var v=t.nodeValue, o=v;
      v=v.replace(/\s*[—–]\s*/g,' · ');            // anti-travessão -> middot
      if(EMOJI_RE.test(v)){ v=v.replace(EMOJI_RE,''); }
      v=v.replace(/[ \t]{2,}/g,' ');
      if(v!==o) t.nodeValue=v;
    });
  }

  /* ---------- 4) contadores 0 -> valor, em cascata ---------- */
  function parseNum(txt){
    txt=txt.trim();
    if(!txt||/[:\/]/.test(txt)) return null;            // ignora horas/datas/ratios
    var m=txt.match(/^([^\d-]*)(-?\d[\d.]*(?:,\d+)?)([^\d]*)$/);
    if(!m) return null;
    var pre=m[1], num=m[2], suf=m[3];
    if(/[A-Za-z]{2,}/.test(num)) return null;
    var hasDec=num.indexOf(',')>=0;
    var thousands=!hasDec&&/\d\.\d{3}/.test(num);
    var val=parseFloat(num.replace(/\./g,'').replace(',','.'));
    if(isNaN(val)) return null;
    var dec=hasDec?num.split(',')[1].length:0;
    return {pre:pre,suf:suf,val:val,dec:dec,th:thousands};
  }
  function fmt(v,i){
    var s; if(i.dec) s=v.toLocaleString('pt-BR',{minimumFractionDigits:i.dec,maximumFractionDigits:i.dec});
    else if(i.th) s=Math.round(v).toLocaleString('pt-BR'); else s=String(Math.round(v));
    return i.pre+s+i.suf;
  }
  function animateCounters(){
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var sel='.kpi .value, .value, .count, .num, .metric strong';
    var els=[].slice.call(document.querySelectorAll(sel)).map(function(el){
      var info=parseNum(el.textContent); if(!info||info.val===0) return null;
      var r=el.getBoundingClientRect();
      return {el:el,info:info,y:r.top+(window.scrollY||0),x:r.left};
    }).filter(Boolean);
    els.sort(function(a,b){ return (a.y-b.y)||(a.x-b.x); });
    els.forEach(function(o,idx){
      var el=o.el, info=o.info, start=null, dur=950, delay=Math.min(idx*55,1400);
      var done=false;
      el.textContent=fmt(0,info);
      setTimeout(function(){
        var t0=Date.now();
        function step(){ if(done) return; var p=Math.min((Date.now()-t0)/dur,1);
          var e=1-Math.pow(1-p,3); el.textContent=fmt(info.val*e,info);
          if(p<1) requestAnimationFrame(step); else { done=true; el.textContent=fmt(info.val,info); } }
        requestAnimationFrame(step);
      },delay);
      // rede de segurança: garante valor final mesmo se rAF for estrangulado
      setTimeout(function(){ if(!done){ done=true; el.textContent=fmt(info.val,info); } },delay+dur+120);
    });
  }

  /* ---------- 5) cascata de entrada dos blocos ---------- */
  function riseIn(){
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var blocks=[].slice.call(document.querySelectorAll('.kpis .kpi, .main > .panel, .layout > * , .alert-cell, .fstage, .kcol'));
    blocks.forEach(function(el,i){ el.classList.add('hub-rise'); el.style.animationDelay=Math.min(i*45,900)+'ms'; });
  }

  /* ---------- 6) active state do menu ---------- */
  function active(){ var p=(location.pathname.split('/').pop()||'index.html'); if(!p) p='index.html';
    document.querySelectorAll('.nav-item').forEach(function(a){ a.classList.toggle('active',(a.getAttribute('href')||'')===p); }); }

  function run(){ try{ replaceIconHosts(); cleanText(); active(); riseIn(); animateCounters(); }catch(e){} }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
})();
