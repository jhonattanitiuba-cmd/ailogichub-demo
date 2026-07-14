/* ===== AILOGIC HUB — comportamento global ===== */
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
    rocket:'M5 15c-1 1-1.5 4-1.5 4s3-.5 4-1.5M9 13a8 8 0 0 1 8-8h2v2a8 8 0 0 1-8 8M9 13l2 2M14 7.5a1.2 1.2 0 1 0 0 .01',
    apt:'M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3'
  };
  function svg(name){ var d=P[name]; if(!d) return null;
    return '<span class="hub-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
      + d.split('M').filter(Boolean).map(function(s){return '<path d="M'+s.trim()+'"/>';}).join('') + '</svg></span>'; }

  // logo OFICIAL do WhatsApp (glyph preenchido, verde da marca)
  var WA_SVG='<span class="hub-ic"><svg viewBox="0 0 510 512.459" fill="#25D366" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M435.689 74.468C387.754 26.471 324 .025 256.071 0 116.098 0 2.18 113.906 2.131 253.916c-.024 44.758 11.677 88.445 33.898 126.946L0 512.459l134.617-35.311c37.087 20.238 78.85 30.891 121.345 30.903h.109c139.949 0 253.88-113.917 253.928-253.928.024-67.855-26.361-131.645-74.31-179.643v-.012zm-179.618 390.7h-.085c-37.868-.011-75.016-10.192-107.428-29.417l-7.707-4.577-79.886 20.953 21.32-77.889-5.017-7.987c-21.125-33.605-32.29-72.447-32.266-112.322.049-116.366 94.729-211.046 211.155-211.046 56.373.025 109.364 22.003 149.214 61.903 39.853 39.888 61.781 92.927 61.757 149.313-.05 116.377-94.728 211.058-211.057 211.058v.011zm115.768-158.067c-6.344-3.178-37.537-18.52-43.358-20.639-5.82-2.119-10.044-3.177-14.27 3.178-4.225 6.357-16.388 20.651-20.09 24.875-3.702 4.238-7.403 4.762-13.747 1.583-6.343-3.178-26.787-9.874-51.029-31.487-18.86-16.827-31.597-37.598-35.297-43.955-3.702-6.355-.39-9.789 2.775-12.943 2.849-2.848 6.344-7.414 9.522-11.116s4.225-6.355 6.343-10.581c2.12-4.238 1.06-7.937-.522-11.117-1.584-3.177-14.271-34.409-19.568-47.108-5.151-12.37-10.385-10.69-14.269-10.897-3.703-.183-7.927-.219-12.164-.219s-11.105 1.582-16.925 7.939c-5.82 6.354-22.209 21.709-22.209 52.927 0 31.22 22.733 61.405 25.911 65.642 3.177 4.237 44.745 68.318 108.389 95.812 15.135 6.538 26.957 10.446 36.175 13.368 15.196 4.834 29.027 4.153 39.96 2.52 12.19-1.825 37.54-15.353 42.824-30.172 5.283-14.818 5.283-27.529 3.701-30.172-1.582-2.641-5.819-4.237-12.163-7.414l.011-.024z"/></svg></span>';

  /* ---------- 1) ícones do menu (por href) ---------- */
  var NAV={ 'visaogeral':'home','imobiliarias':'building','corretores':'users','pessoas':'idcard',
    'leads':'target','funil':'funnel','agenda':'calendar','whatsapp':'chat','emails':'mail',
    'imoveis':'apt','mapa':'map','captacao':'download','assinaturas':'pen','anuncios':'megaphone',
    'credito':'dollar','locacao':'swap','relatorios':'chart','insights':'sparkle',
    'integracoes':'plug','site':'globe','financeiro':'wallet','suporte':'help',
    'administrador':'gear','config-ia':'sliders' };

  /* ---------- 2) emojis -> ícone ---------- */
  var EMO={ '👥':'users','👤':'idcard','🧑':'idcard','🏠':'home','🏡':'home','🏢':'building','💬':'chat','📁':'folder','🗂':'folder',
    '🤖':'bot','⏱':'clock','⏰':'clock','⏳':'clock','🕒':'clock','📅':'calendar','🗓':'calendar','📄':'file','📃':'file','📋':'file',
    '🏆':'trophy','✨':'sparkle','💡':'sparkle','✔':'check','✅':'check','☑':'check','🎧':'headset','📍':'pin','📌':'pin',
    '📈':'trend','📉':'trend','📊':'chart','🌐':'globe','🔐':'key','🔒':'key','🔑':'key','☏':'phone','📞':'phone','📱':'phone',
    '✉':'mail','📧':'mail','📨':'mail','📥':'inbox','📷':'camera','📸':'camera','💰':'dollar','💵':'wallet','💳':'wallet',
    '🔔':'bell','⚙':'gear','🛡':'shield','🔍':'search','🔎':'search','↗':'arrow','➡':'arrow','⇄':'swap','⇆':'swap',
    '🚀':'rocket','✍':'pen','🖊':'pen','📢':'megaphone','📣':'megaphone','🔌':'plug','🧩':'plug','🎯':'target' };

  var EMOJI_RE=/[⌚-⌛⏩-⏺☀-➿⬀-⯿\u{1F000}-\u{1FAFF}‍️]/gu;
  // siglas sempre em MAIÚSCULO
  var ACR_RE=/\b(sla|pdf|csv|creci|dre|seo|lgpd|crm|api|kpi|cta|spf|dkim|dmarc|sms|url|roi|b2b|cnpj|cpf|cep|wa)\b/gi;

  function replaceIconHosts(){
    // menu
    document.querySelectorAll('.nav-item').forEach(function(a){
      var href=(a.getAttribute('href')||'').split('/').pop().replace(/\.html$/,'')||'visaogeral';
      var ico=a.querySelector('.ico'); if(!ico) return;
      if(href==='whatsapp'){ ico.innerHTML=WA_SVG; return; }
      if(NAV[href]){ var s=svg(NAV[href]); if(s) ico.innerHTML=s; }
    });
    // logo oficial do WhatsApp nos marcadores explícitos
    document.querySelectorAll('.wa-ico').forEach(function(el){ if(!el.querySelector('svg')) el.innerHTML=WA_SVG; });
    // contêineres de ícone com 1 emoji
    document.querySelectorAll('.kpi-icon,.card-icon,.r-ico,.ai,.ph-ico,.support .ico,.metric strong,.fi,.fst-ic,.kpi-ic,.alc-ic,.ins-ic').forEach(function(el){
      var t=(el.textContent||'').trim();
      // WhatsApp: ícone de chat em contexto de WhatsApp -> logo oficial
      if((t==='💬'||EMO[t]==='chat') && /whatsapp/i.test((el.parentElement&&el.parentElement.textContent)||'')){ el.innerHTML=WA_SVG; return; }
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
      v=v.replace(ACR_RE,function(m){return m.toUpperCase();});   // siglas em MAIÚSCULO
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
  function animateCounters(base, root){
    base=base||0; root=root||document;
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var sel='.kpi .value, .value, .count, .num, .metric strong';
    var els=[].slice.call(root.querySelectorAll(sel)).map(function(el){
      var info=parseNum(el.textContent); if(!info||info.val===0) return null;
      var r=el.getBoundingClientRect();
      return {el:el,info:info,y:r.top+(window.scrollY||0),x:r.left};
    }).filter(Boolean);
    els.sort(function(a,b){ return (a.y-b.y)||(a.x-b.x); });
    els.forEach(function(o,idx){
      var el=o.el, info=o.info, start=null, dur=1400, delay=Math.min(idx*45,760);
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

  function reduce(){ return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  /* ---------- 5) entrada do conteúdo: tela > boxes > números ---------- */
  function revealContent(main, initial){
    if(!main) return;
    if(reduce()||!initial){ main.style.opacity='1'; return; }   // SPA: troca instantânea, sem re-animar (evita flip)
    main.style.animation='hubFade .4s ease both';
    var blocks=[];
    [].slice.call(main.children).forEach(function(b){
      if(b.tagName==='HEADER') return;                 // header surge junto com a tela
      if(b.classList&&b.classList.contains('kpis')) blocks=blocks.concat([].slice.call(b.children));
      else blocks.push(b);
    });
    blocks.forEach(function(el,i){ el.classList.add('hub-rise'); el.style.animationDelay=(200+i*42)+'ms'; });
    var cb=200+Math.min(blocks.length*42,760)+120;     // contadores só depois dos boxes
    animateCounters(cb, main);
    // rede de segurança: garante conteúdo visível mesmo se a animação CSS não disparar
    setTimeout(function(){ main.style.animation='none'; main.style.opacity='1'; blocks.forEach(function(el){ el.style.animation='none'; el.style.opacity='1'; }); }, 200+blocks.length*42+900);
  }

  /* ---------- 6) active state do menu ---------- */
  function active(){ var p=(location.pathname.split('/').pop()||'visaogeral').replace(/\.html$/,'')||'visaogeral';
    document.querySelectorAll('.nav-item').forEach(function(a){ var h=(a.getAttribute('href')||'').split('/').pop().replace(/\.html$/,''); a.classList.toggle('active', h===p); }); }

  /* ---------- 7) cascata da sidebar (só em carga real: F5/entrada — SPA não dispara run) ---------- */
  function cascadeSidebar(){
    if(reduce()) return;
    var side=document.querySelector('.sidebar'); if(!side) return;
    var items=[].slice.call(side.children); var n=items.length; if(n<2) return;
    var span=2000;
    items.forEach(function(el,i){ el.classList.add('hub-side-item'); el.style.animationDelay=Math.round(i*(span/(n-1)))+'ms'; });
  }

  /* ---------- 8) recolher/expandir sidebar (mini rail) ---------- */
  function setupCollapse(){
    var app=document.querySelector('.app'), side=document.querySelector('.sidebar'); if(!app||!side) return;
    // envolve o texto (label) de cada nav-item para poder ocultar no modo mini
    side.querySelectorAll('.nav-item').forEach(function(a){
      [].slice.call(a.childNodes).forEach(function(nd){
        if(nd.nodeType===3 && nd.nodeValue.trim()){ var sp=document.createElement('span'); sp.className='nav-label'; sp.textContent=nd.nodeValue.trim(); a.replaceChild(sp,nd); }
      });
    });
    // botão discreto "<" no rodapé da sidebar
    var btn=document.createElement('button'); btn.className='sb-toggle'; btn.type='button'; btn.title='Recolher menu';
    btn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
    side.appendChild(btn);
    if(localStorage.getItem('ailogic_sb')==='1') app.classList.add('sb-collapsed');
    btn.addEventListener('click',function(){ var c=app.classList.toggle('sb-collapsed'); btn.title=c?'Expandir menu':'Recolher menu'; try{localStorage.setItem('ailogic_sb',c?'1':'0');}catch(_){} });
  }

  /* ---------- 9) navegação SPA: sidebar fixa, conteúdo troca sem reload ---------- */
  function runPageScripts(doc){
    [].slice.call(doc.querySelectorAll('body script')).forEach(function(s){
      if(s.src) return;
      var t=s.textContent||'';
      if(/ailogic_auth|hub-pre|classList\.toggle\((["'])active/.test(t)) return; // pula gate/active
      try{ var n=document.createElement('script'); n.textContent=t; document.body.appendChild(n); document.body.removeChild(n); }catch(e){}
    });
  }
  function swapStyles(doc){
    var hub=document.querySelector('link[rel="stylesheet"][href*="hub.css"]');
    document.querySelectorAll('style[data-spa]').forEach(function(s){ s.remove(); });
    [].slice.call(doc.querySelectorAll('head style')).forEach(function(st){
      var n=document.createElement('style'); n.setAttribute('data-spa','1'); n.textContent=st.textContent;
      if(hub) document.head.insertBefore(n, hub); else document.head.appendChild(n); // antes do hub.css (não move o hub.css -> sem piscada)
    });
  }
  var navving=false;
  function navigate(href, push){
    if(navving) return; var slug=(href||'').split('/').pop().split('?')[0]||'visaogeral'; navving=true;
    fetch(slug,{cache:'no-store'}).then(function(r){ return r.text(); }).then(function(html){
      var doc=new DOMParser().parseFromString(html,'text/html');
      var newMain=doc.querySelector('.main');
      if(!newMain){ location.href=slug; return; }
      if(push){ try{ history.pushState({spa:1},'', '/'+slug); }catch(_){} }
      swapStyles(doc);
      var cur=document.querySelector('.main'); if(cur) cur.parentNode.replaceChild(newMain, cur);
      if(doc.title) document.title=doc.title;
      try{ replaceIconHosts(); cleanText(); active(); runPageScripts(doc); revealContent(newMain, true); markWidgets(newMain); }catch(e){}
      window.scrollTo(0,0); navving=false;
    }).catch(function(){ location.href=slug; });
  }
  function setupNav(){
    document.addEventListener('click', function(e){
      if(!e.target||!e.target.closest) return;
      // widget clicável: KPI leva à sua página (ignora se clicou num link/botão dentro)
      var k=e.target.closest('.kpi[data-kpinav]');
      if(k && !e.target.closest('a,button,input,select')){ e.preventDefault(); navigate(k.getAttribute('data-kpinav'), true); return; }
      var a=e.target.closest('.nav-item'); if(!a) return;
      var href=a.getAttribute('href'); if(!href||/^(https?:|mailto:|tel:|#)/.test(href)) return;
      e.preventDefault();
      if(a.classList.contains('active')) return;
      navigate(href, true);
    });
    window.addEventListener('popstate', function(){ navigate(location.pathname, false); });
  }

  /* ---------- 10) botão Sair (logout) no rodapé da sidebar ---------- */
  function doLogout(){
    try{
      if(window.hubAuth && typeof window.hubAuth.signOut==='function'){ window.hubAuth.signOut(); return; }
    }catch(_){}
    // fallback: limpa o estado local e volta para o login
    try{ localStorage.removeItem('ailogic_auth'); localStorage.removeItem('ailogic-auth'); }catch(_){}
    location.replace('/login');
  }
  function setupLogout(){
    var prof=document.querySelector('.sidebar .profile') || document.querySelector('.profile');
    if(!prof || prof.querySelector('.hub-logout')) return;
    if(!document.getElementById('hub-logout-style')){
      var st=document.createElement('style'); st.id='hub-logout-style';
      st.textContent='.hub-logout{margin-left:auto;flex:none;width:34px;height:34px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#cddcf5;border-radius:10px;display:grid;place-items:center;cursor:pointer;transition:background .15s,color .15s,border-color .15s}.hub-logout:hover{background:rgba(233,66,66,.16);border-color:rgba(233,66,66,.5);color:#ffb4b4}.hub-logout svg{width:18px;height:18px}.sb-collapsed .hub-logout{margin:8px auto 0}';
      document.head.appendChild(st);
    }
    var b=document.createElement('button');
    b.type='button'; b.className='hub-logout'; b.title='Sair'; b.setAttribute('aria-label','Sair');
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';
    b.addEventListener('click',function(e){ e.preventDefault(); e.stopPropagation(); doLogout(); });
    prof.appendChild(b);
  }

  /* ---------- 11) widgets clicáveis: cada KPI leva à sua página ---------- */
  var KPINAV={imobili:'imobiliarias',lead:'leads','imóve':'imoveis',imove:'imoveis','negóci':'funil',negoci:'funil',funil:'funil',pipeline:'funil',corretor:'corretores',equipe:'corretores',pesso:'pessoas',contato:'pessoas',agenda:'agenda',visita:'agenda',whatsapp:'whatsapp',convers:'whatsapp',mensag:'whatsapp','e-mail':'emails',email:'emails','captaç':'captacao',captac:'captacao',assinatura:'assinaturas',documento:'assinaturas','crédito':'credito',credito:'credito',financiamento:'credito','locaç':'locacao',locac:'locacao',financ:'financeiro',repass:'financeiro','anúnci':'anuncios',anunci:'anuncios','rodízio':'anuncios',mapa:'mapa',relat:'relatorios',insight:'insights',suporte:'suporte'};
  function _curSlug(){ return (location.pathname.split('/').pop()||'visaogeral').replace(/\.html$/,'')||'visaogeral'; }
  function widgetTarget(el){ var h=el.querySelector('h3'); var t=((h&&h.textContent)||el.textContent||'').toLowerCase(); for(var k in KPINAV){ if(t.indexOf(k)>=0) return KPINAV[k]; } return null; }
  function markWidgets(root){ root=root||document; [].slice.call(root.querySelectorAll('.kpi')).forEach(function(el){ if(el.hasAttribute('data-kpinav')) return; var tg=widgetTarget(el); if(tg && tg!==_curSlug()){ el.setAttribute('data-kpinav',tg); el.style.cursor='pointer'; el.setAttribute('title','Abrir '+tg); } }); }

  try{ window.hubIcons=function(){ try{replaceIconHosts();cleanText();}catch(e){} }; }catch(e){}
  function run(){ try{ replaceIconHosts(); cleanText(); active(); setupCollapse(); setupLogout(); cascadeSidebar(); revealContent(document.querySelector('.main'), true); markWidgets(document); document.documentElement.classList.remove('hub-pre'); setupNav(); }catch(e){ document.documentElement.classList.remove('hub-pre'); } }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
})();
