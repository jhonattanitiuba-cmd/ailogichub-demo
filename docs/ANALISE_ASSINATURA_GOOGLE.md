# Análise — Assinatura Digital de Documentos (Item 12)

> Subsídio técnico para a **decisão** do item 12 do Relatório de Adequações.
> **Aviso:** este documento é um apoio técnico, não parecer jurídico. A validade legal para contratos imobiliários deve ser confirmada com o jurídico/advogado da empresa.

## 1. O que precisa ser avaliado (do relatório)
Envio · assinatura · trilha de auditoria · identidade do signatário · armazenamento · permissões · LGPD · validade jurídica do processo.

## 2. Contexto legal (Brasil) — resumo
- **MP 2.200-2/2001** institui a ICP-Brasil e reconhece assinaturas eletrônicas.
- **Lei 14.063/2020** define três níveis: **simples**, **avançada** e **qualificada** (com certificado ICP-Brasil).
- Para **contratos entre particulares** (compra/venda, locação), a assinatura **eletrônica avançada** costuma ser aceita quando há prova de autoria e integridade (trilha de auditoria, e-mail, IP, carimbo de tempo). Registro em cartório pode exigir requisitos adicionais.
- **LGPD:** o processo trata dados pessoais (nome, CPF, e-mail, IP, geolocalização). Exige base legal (execução de contrato), minimização e contrato com o operador (o provedor de assinatura).

> Conclusão prática: para o fluxo do Hub, o ponto crítico não é "assinar dentro do Google", e sim **ter trilha de auditoria robusta + identidade do signatário + armazenamento seguro**, com validade reconhecida.

## 3. Opções avaliadas

### Opção A — Google Workspace eSignature (nativo no Docs/Drive)
- Assinatura dentro do próprio Google Docs/Drive; disponível em planos Workspace específicos.
- **Prós:** integra ao ecossistema Google já usado; sem novo fornecedor; armazenamento no Drive.
- **Contras:** recurso pensado para fluxos genéricos (EUA/global); **sem certificação ICP-Brasil**; trilha de auditoria e identidade menos aderentes à norma brasileira; validade para imóveis no Brasil é frágil sem camada adicional.
- **Veredito:** insuficiente sozinho para contratos imobiliários no Brasil.

### Opção B — Google Drive (armazenamento) + provedor de assinatura BR integrado
Provedores brasileiros com API: **Clicksign, ZapSign, D4Sign, Autentique**.
- Fluxo: gerar/selecionar documento → enviar para assinatura via API do provedor → signatários assinam (e-mail/SMS/selfie/token) → provedor devolve PDF assinado + **manifesto de auditoria** → armazenar no Drive/Blob e vincular ao negócio.
- **Prós:** trilha de auditoria completa (hash, IP, timestamp, e-mail), opções de identidade (token, selfie, ICP-Brasil quando exigido), **aderência à Lei 14.063 e à prática do mercado imobiliário BR**; LGPD com DPA do provedor.
- **Contras:** novo fornecedor + custo por documento/assinatura; integração via API (2–4 dias de dev).
- **Veredito:** **caminho recomendado** para validade e auditoria no Brasil.

### Opção C — Só um provedor BR (sem depender do Google)
Igual à B, mas armazenando no próprio provedor + Vercel Blob, sem Drive.
- **Prós:** menos peças; independe do Workspace.
- **Contras:** perde a integração com o Drive/Google que o relatório menciona.

## 4. Comparativo

| Critério | A · Google eSignature | B · Drive + provedor BR | C · Provedor BR |
|----------|:--:|:--:|:--:|
| Validade jurídica BR (imóveis) | ⚠️ Frágil | ✅ Forte | ✅ Forte |
| Trilha de auditoria | ⚠️ Básica | ✅ Completa | ✅ Completa |
| Identidade do signatário | ⚠️ Limitada | ✅ Token/selfie/ICP | ✅ Token/selfie/ICP |
| ICP-Brasil (quando exigido) | ❌ Não | ✅ Sim | ✅ Sim |
| Integração com Google/Drive | ✅ Nativa | ✅ Armazenamento | ➖ Opcional |
| Esforço de dev | Baixo | Médio (API) | Médio (API) |
| Custo | Incluso no plano | Por documento | Por documento |
| LGPD (DPA/operador) | Google | Provedor + Google | Provedor |

## 5. Recomendação
**Opção B** — Google Drive para armazenamento + **um provedor brasileiro** (avaliar Clicksign ou ZapSign primeiro, por custo/API) para a assinatura com trilha de auditoria. Entrega a validade e a auditoria que o mercado imobiliário exige, mantendo o vínculo com o Google que o relatório pede.

Se a diretoria decidir que **nesta versão** a assinatura eletrônica avançada basta (sem ICP-Brasil), a Opção B já cobre. Se algum contrato exigir ICP-Brasil, o mesmo provedor oferece esse nível.

## 6. Teste completo a executar (após a decisão)
1. Gerar ou selecionar o documento do negócio.
2. Enviar para assinatura (signatários: cliente + imobiliária).
3. Assinar (com o método de identidade escolhido).
4. Acompanhar o **status** (enviado / visto / assinado) dentro do Hub.
5. Receber o **PDF assinado + manifesto de auditoria** e armazená-lo vinculado ao negócio.
6. Validar: LGPD (base legal + DPA), retenção e permissões de acesso ao documento.

> Se a assinatura integrada não for viável nesta versão, formalizar a decisão e a alternativa (ex.: assinatura fora do Hub, anexando o PDF assinado ao negócio) — conforme o critério de aceite do item 12.

## 7. Próximo passo
- [ ] Diretoria escolhe o nível de assinatura (avançada x qualificada/ICP)
- [ ] Escolher o provedor (cotar Clicksign / ZapSign / D4Sign / Autentique)
- [ ] Jurídico valida a aderência à LGPD e à validade para os contratos usados
- [ ] Dev integra via API (a estrutura de `contratos` já existe no banco: `status_assinatura`, `assinado_em`, `url_assinado`)
