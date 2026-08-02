# Roteiro de Testes — Adequações Pré-Testes Finais (produção)

> Valida em produção os 10 itens já entregues, com base nos **critérios de aceite do Relatório Técnico**.
> Marque cada passo. Onde falhar, anote o comportamento observado.

## Pré-requisitos
- [ ] Deploy da `main` concluído na Vercel (últimos commits das 3 fases)
- [ ] Um usuário **Diretoria** real (acesso total)
- [ ] Um e-mail de teste que você consiga abrir (para convites e reset)
- [ ] Variáveis de ambiente na Vercel: `DB_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] SMTP do Supabase configurado (Auth → Email) e **Redirect URLs** incluindo `https://SEU-DOMINIO/redefinir`

---

## Item 01 · Gestor responsável
1. Cadastros → Imobiliárias → **Nova imobiliária**.
2. Preencha o nome. Confirme que o campo **"Gestor responsável"** é obrigatório.
3. Busque um usuário ativo no campo de busca → selecione.
4. Salve e confirme.
- [ ] O gestor aparece vinculado na ficha da imobiliária (subaba "Gestor")
- [ ] Alterar o gestor e salvar reflete após atualizar a tela

## Item 01b · Convidar novo gestor
1. Em "Gestor responsável", clique **"+ Convidar novo gestor"**, informe nome + e-mail.
2. Salve → confirme.
- [ ] Aparece a senha temporária para repasse (ou aviso de login já existente)
- [ ] O gestor convidado consegue entrar com a senha / criar a própria senha

## Item 02 · Corretores + plano
1. No cadastro, seção **"Corretores"**: adicione 2 corretores (seleção ou convite).
2. Observe o contador **"X / 2 vagas"**.
3. Tente adicionar um **3º corretor** com plano **Base**.
- [ ] O 3º é bloqueado com mensagem para habilitar plano superior
4. Troque o plano para **Pro** e adicione o 3º.
- [ ] Agora permite (cota 5)
- [ ] Corretores aparecem na imobiliária correta, com permissões compatíveis

## Item 03 · Cadastro integrado
1. Faça um cadastro completo: empresa + gestor (convite) + 2 corretores (convite).
2. Clique **Salvar** → surge o modal **"Revisar cadastro"**.
- [ ] O resumo mostra empresa, plano, gestor e corretores com as tags corretas
- [ ] Tente repetir o mesmo e-mail em dois convidados → bloqueia (e-mail único)
3. Confirme.
- [ ] Imobiliária criada com usuário principal, gestor e corretores vinculados
- [ ] Cada convidado recebe e-mail / senha e entra só nas áreas autorizadas

## Item 10 · Nome e status de acesso
1. Cadastros → Corretores.
- [ ] Coluna **"Status de acesso"** mostra: Convite pendente / Ativo / Bloqueado
- [ ] Nome, e-mail, perfil e imobiliária aparecem em listas e detalhe
2. Num usuário "Convite pendente", clique **"Convite"** (reenviar).
- [ ] Gera nova senha temporária; usuário consegue acessar

## Item 13 · Abas e subabas
1. Abra o detalhe de uma imobiliária.
- [ ] Subabas: Dados gerais · Gestor · Corretores · Usuários e acesso · Plano e financeiro
- [ ] Trocar de subaba mantém a imobiliária selecionada e destaca a ativa
- [ ] Funciona em computador e celular

## Item 04 · Aba Jurídico (Diretoria)
1. Com usuário **Diretoria**, confirme o item **"Jurídico"** no menu lateral.
2. Abra a página Jurídico.
- [ ] KPIs (casos, valor, honorários, assinados) e tabela de casos carregam
- [ ] É possível **atribuir** um advogado a um negócio
- [ ] É possível **remover** o advogado
3. Faça login com um perfil **não-administrativo** (ex.: corretor).
- [ ] O item "Jurídico" **não** aparece no menu desse perfil

## Item 05 · Recuperação de senha
1. Tela de login → **"Esqueci a senha"** → informe o e-mail cadastrado.
- [ ] O e-mail de redefinição **chega** (se não chegar → checar SMTP/Redirect URLs no Supabase)
2. Abra o link.
- [ ] A tela "Criar nova senha" abre (não mostra "link inválido")
3. Defina uma nova senha.
- [ ] A troca funciona; a senha **anterior** não autentica mais
- [ ] Link reutilizado ou expirado é recusado

## Item 06 · Sessão por inatividade
1. Entre como um perfil **não-administrativo** e deixe a tela **parada 30 min**.
- [ ] Ao voltar, o sistema exige novo login
2. Entre como **Diretoria/admin** e deixe parado **15 min**.
- [ ] Exige novo login (timeout menor para admin)
3. Faça **logout** manual.
- [ ] O acesso é invalidado na hora; reabrir página protegida exige login

## Item 07 · Foto do usuário
1. Clique no **avatar** (rodapé da sidebar) → selecione uma imagem (JPG/PNG/WEBP).
- [ ] A foto aparece no cabeçalho/menu, sem distorção
2. Faça **logout e login** de novo.
- [ ] A foto **permanece** (persistiu no perfil)
3. Tente um arquivo > 3 MB ou formato inválido.
- [ ] É recusado com mensagem clara

## Item 08 · WhatsApp
1. Abra o módulo WhatsApp **várias vezes** seguidas.
- [ ] Abre de forma consistente, sem tela em branco
- [ ] Interface responde em até ~3 s; conversas carregam em até ~5 s (maioria dos casos)
2. Abra uma conversa.
- [ ] As mensagens carregam; se falhar, aparece **"Tentar novamente"** (não spinner infinito)
3. (Opcional) Simule canal lento/offline.
- [ ] Após o timeout, mostra erro compreensível com retry, sem travar a tela

---

## Resultado

| Item | Passou? | Observações |
|------|---------|-------------|
| 01 Gestor | ☐ | |
| 02 Corretores | ☐ | |
| 03 Cadastro integrado | ☐ | |
| 04 Jurídico | ☐ | |
| 05 Reset senha | ☐ | |
| 06 Sessão | ☐ | |
| 07 Foto | ☐ | |
| 08 WhatsApp | ☐ | |
| 10 Status acesso | ☐ | |
| 13 Subabas | ☐ | |

> Só liberar os testes finais após todos os itens acima aprovados em homologação (ver item 11 do relatório).
