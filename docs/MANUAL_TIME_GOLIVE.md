# Manual do time - go-live pleno

Itens que não são código e dependem de configuração ou decisão do time. Cada um com o porquê,
onde fazer, o passo a passo e como validar. Uso interno (a pasta docs não vai para produção).

Convenção de escrita: português do Brasil, sem travessão e sem til solto; acentos preservados.

---

## Visão geral: o que cada item destrava

- Chave 1, SUPABASE_SERVICE_ROLE_KEY no Vercel: sem ela, cadastrar corretor ou imobiliária grava
  no banco mas não cria o login. Destrava o onboarding com acesso.
- Chave 2, SMTP do Supabase: sem ele, o "Esqueci a senha" não entrega o e-mail. Destrava a
  recuperação de senha.
- Chave 3, política de backup do banco: garante cópia recente e restaurável. Segurança e LGPD.
- Decisão, provedor de assinatura digital: abre o contrato e a documentação de ponta a ponta com
  validade jurídica (P0-08 e P0-09).

---

## Chave 1: SUPABASE_SERVICE_ROLE_KEY

Por que: o sistema cria o login do corretor ou gestor via API administrativa do Supabase. Sem essa
chave, o cadastro é salvo mas ninguém consegue acessar (o corretor fica "Convite pendente").

Passos:
1. No Supabase: Project Settings, aba API, copie a chave service_role (a secreta, não a anon).
2. No Vercel: projeto do Hub, Settings, Environment Variables. Adicione SUPABASE_SERVICE_ROLE_KEY
   com esse valor. Confirme que SUPABASE_URL também existe.
3. Marque para produção (e preview, se usarem). Salve e refaça o deploy (Redeploy) para valer.
4. Validar: no painel, cadastre um corretor de teste. Ele deve aparecer como Ativo e conseguir
   logar. Se ficar "Convite pendente", a chave não pegou.

Segurança: a service_role ignora as regras de acesso do banco. Ela só pode viver no servidor
(Vercel), nunca no navegador nem em repositório. No código, já é usada apenas nas funções de servidor.

---

## Chave 2: SMTP do Supabase (e-mail)

Por que: o "Esqueci a senha" pede ao Supabase para enviar o e-mail de redefinição. Sem SMTP
configurado (ou no limite do e-mail padrão), o e-mail não chega e a pessoa não redefine.

Passos:
1. No Supabase: Authentication, seção de e-mails ou SMTP. Configure um SMTP próprio (provedor de
   e-mail da empresa) ou confirme que o envio padrão está ativo e sem bloqueio.
2. Em Authentication, URL Configuration: confirme que a URL de redirecionamento /redefinir do
   domínio de produção está na lista de URLs permitidas.
3. Personalize o remetente e o texto do e-mail, para chegar com a marca do Hub e não cair em spam.
4. Validar: na tela de login, use "Esqueci a senha" com um e-mail real. O e-mail deve chegar, o
   link abrir /redefinir e a nova senha funcionar.

---

## Chave 3: política de backup do banco

Por que: antes de receber dados reais de clientes, é preciso garantir cópia recente e restaurável.
Requisito de segurança e de LGPD.

Se o Postgres é gerenciado pelo Supabase: no Supabase, Database, Backups. Confirme a frequência
(diária) e a retenção. Se o plano permitir, ligue o Point in Time Recovery (PITR). Anote quem pode
restaurar.

Se o Postgres é próprio (self-hosted): configure um pg_dump agendado (diário), com cópia guardada
fora do mesmo servidor, com retenção definida (por exemplo 7 a 30 dias) e arquivo criptografado.

Passos:
1. Definir onde os backups vivem, com que frequência e por quanto tempo ficam guardados.
2. Validar de verdade: fazer um teste de restauração num ambiente separado. Backup que nunca foi
   restaurado não é backup confiável.

---

## Decisão: provedor de assinatura digital

Por que: hoje o contrato só gera um documento para impressão; não há assinatura com validade
jurídica nem trilha. Escolher e integrar um provedor abre o contrato e a documentação de ponta a
ponta (P0-08 e P0-09).

Critérios para escolher: validade jurídica no Brasil, API para integração, trilha de auditoria
(signatários, carimbo de tempo, IP, hash do documento), envio por e-mail e WhatsApp, webhook de
status (assinado ou recusado), custo por documento e ambiente de testes (sandbox). Opções comuns no
mercado: Clicksign, D4Sign, ZapSign, Autentique, DocuSign.

Passos:
1. Time decide o provedor pelos critérios acima e cria a conta (com ambiente de testes).
2. Obter a chave de API e definir as variáveis no Vercel (por exemplo SIGN_API_KEY). Repassar as
   credenciais com segurança.
3. Desenvolvimento (etapa seguinte): gerar o contrato a partir do negócio, enviar para assinatura,
   receber o webhook e gravar o documento assinado com a trilha.
4. Testar no sandbox de ponta a ponta antes de ligar em produção.

---

## Checklist de conclusão

- [ ] SUPABASE_SERVICE_ROLE_KEY configurada no Vercel e cadastro de corretor validado (time)
- [ ] SMTP do Supabase configurado e "Esqueci a senha" validado de ponta a ponta (time)
- [ ] Backup confirmado (frequência e retenção) e teste de restauração feito (time)
- [ ] Provedor de assinatura escolhido e conta com sandbox criada (time)
- [ ] Credenciais de assinatura repassadas para iniciar a integração (time)
- [ ] Integração de assinatura implementada e testada no sandbox (desenvolvimento)
