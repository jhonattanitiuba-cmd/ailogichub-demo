# Análise da CSP (Content Security Policy) - AILogic Hub

Objetivo: preparar a ativação da CSP em modo de bloqueio (enforce) sem quebrar nenhuma tela.
Este documento é o diagnóstico. Nada foi ligado: a CSP segue em modo de relato (Report-Only).

Convenção de escrita: português do Brasil, sem travessão e sem til solto; acentos preservados.

---

## 1. O que temos hoje

A CSP existe, mas em modo de relato (não bloqueia nada, só reportaria). Em vercel.json, header
`Content-Security-Policy-Report-Only`, com esta política:

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob: https:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
frame-src 'self'; frame-ancestors 'self'; object-src 'none';
base-uri 'self'; form-action 'self'; upgrade-insecure-requests
```

Dois pontos importantes de contexto:

- O `Report-Only` não protege contra nada; ele apenas reportaria violações. A proteção real
  só acontece quando trocamos o header para `Content-Security-Policy` (enforce).
- A plataforma usa muito script e estilo inline (e handlers onclick nas telas). Por isso a
  política mantém `'unsafe-inline'` em script-src e style-src. Remover isso exigiria reescrever
  todas as telas com nonce ou hash, o que não é realista agora. Mantendo `'unsafe-inline'`, o
  ganho da CSP fica nas restrições de origem (de onde script, estilo, imagem, fonte e conexão
  podem vir), no bloqueio de object, no controle de frame e no form-action. É um ganho real,
  ainda que parcial contra XSS.

---

## 2. Varredura das telas: o que a CSP em enforce barraria

Hosts externos efetivamente usados pelas telas servidas em produção:

| Host | Uso | Diretiva | Situação na política atual |
|------|-----|----------|-----------------------------|
| fonts.googleapis.com | folha de estilo das fontes | style-src | Permitido |
| fonts.gstatic.com | arquivos de fonte | font-src | Permitido |
| cdn.jsdelivr.net | supabase-js (SDK) | script-src | Permitido |
| unpkg.com | Leaflet (mapa) em bemvindo.html | script-src e style-src | NAO permitido (bloquearia) |
| cdn.tailwindcss.com | Tailwind | script-src | Só no _v1_index_backup.html (não vai para produção) |
| ai-logic-hub-imoveis.bilha.chatgpt.site | base de imagens em site.html | img-src | Passa (img-src libera https:) |

### O único bloqueador real: Leaflet via unpkg em bemvindo.html

- `bemvindo.html` carrega o Leaflet do unpkg:
  - `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` (folha de estilo)
  - `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` (script)
- Como a política atual não inclui unpkg em script-src nem style-src, ligar o enforce hoje
  quebraria o mapa da tela de boas-vindas.

### Não são problema

- `_v1_index_backup.html` (Tailwind e Leaflet via unpkg): é arquivo de backup, bloqueado pelo
  .vercelignore, não é servido em produção. Só voltaria a importar se o backup fosse restaurado.
- Imagens do domínio externo em site.html: a img-src já permite `https:`, então não quebra.
  Observação de higiene (fora de CSP): essa base de imagens aponta para um domínio de demonstração
  (bilha.chatgpt.site); vale trocar por imagens próprias no Storage no futuro, mas não bloqueia o go-live.
- Scripts e estilos inline e handlers onclick: cobertos por `'unsafe-inline'`, não quebram.
- Sem iframes no app: `frame-src 'self'` está de bom tamanho.
- Chamadas de API: o front chama /api/* (mesma origem, self) e o Supabase (*.supabase.co), ambos
  já liberados em connect-src.

---

## 3. Correção necessária antes do enforce (uma só)

Resolver o Leaflet do bemvindo.html. Duas opções, escolher uma:

- Opção A (recomendada): trocar o unpkg pelo cdn.jsdelivr.net, que já está liberado. Menos um
  CDN na política, sem mexer na CSP. Trocar as duas linhas de bemvindo.html para:
  - `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css`
  - `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js`
- Opção B: manter o unpkg e adicioná-lo na política, em script-src e style-src:
  `script-src ... https://unpkg.com` e `style-src ... https://unpkg.com`.

Depois dessa correção, nenhuma tela servida em produção viola a política proposta.

---

## 4. Política proposta para o enforce

Igual à atual (que já é boa), assumindo a Opção A acima (Leaflet no jsdelivr). A única mudança
é o nome do header, de `Content-Security-Policy-Report-Only` para `Content-Security-Policy`:

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob: https:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
frame-src 'self'; frame-ancestors 'self'; object-src 'none';
base-uri 'self'; form-action 'self'; upgrade-insecure-requests
```

Se optarem pela Opção B (manter unpkg), acrescentar `https://unpkg.com` em script-src e style-src.

---

## 5. Plano de ativação seguro (passo a passo, com reversão)

1. Aplicar a correção do Leaflet (seção 3). Deploy normal, sem tocar na CSP ainda.
2. Observação em Report-Only: navegar as telas principais (boas-vindas, site, login, visão geral,
   imóveis, leads, funil, agenda, financeiro, jurídico, whatsapp, marketing) com o console do
   navegador aberto, anotando qualquer aviso de violação de CSP. O Report-Only mostra o que
   bloquearia sem bloquear. Opcional: adicionar um endpoint de report para coletar automaticamente.
3. Zerar as violações: para cada violação observada, ajustar a política (adicionar a origem
   legítima) ou o código (remover o recurso indevido). Repetir até o console ficar limpo.
4. Ligar o enforce: trocar o nome do header para `Content-Security-Policy`. Manter também o
   Report-Only por alguns dias, se quiser dupla checagem, é permitido ter os dois.
5. Verificação pós-enforce: repetir a navegação das telas da etapa 2 confirmando que tudo carrega
   (mapa, fontes, imagens, login, dashboards).
6. Reversão imediata (se algo quebrar): voltar o nome do header para
   `Content-Security-Policy-Report-Only`. É uma linha em vercel.json e um deploy; volta ao estado
   atual na hora, sem perda.

Janela sugerida: fora do horário de pico, com uma pessoa navegando as telas enquanto a outra
observa. Tempo estimado: a correção do Leaflet é rápida; a observação e verificação levam o
tempo de percorrer as telas com calma.

---

## 6. Resumo

- Risco de ligar hoje sem preparar: quebraria o mapa do bemvindo.html (Leaflet via unpkg).
- Preparação necessária: uma correção pequena (Leaflet para jsdelivr) e uma passada de observação.
- Ganho: restrições de origem ativas de verdade, object bloqueado, frame e form-action controlados.
- Limite honesto: com `'unsafe-inline'` mantido, a proteção contra XSS é parcial; a remoção total
  do inline fica como evolução futura (exige nonce ou hash em todas as telas).
- Reversão: trivial (uma linha, um deploy).
