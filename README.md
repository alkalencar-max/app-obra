# App Obra

Gestão de custos de obras, simples: orçamento por etapa, cronograma físico-financeiro, lançamentos e um dashboard de orçado x realizado por medição (BM).

## O que já tem

- **Login** com e-mail e senha, e cadastro da empresa no primeiro acesso.
- **Importar planilha**: lê a planilha "Centro de Custos" (.xlsx, abas `LANÇAMENTO`, `DADOS` e `BASE-CRONO GERAL`) e cria a obra com etapas, cronograma, apropriações, grupos, fornecedores, medições e lançamentos. Mostra um resumo antes de gravar.
- **Lançamentos**: lançar despesas (data, valor, fornecedor, pedido/descrição, apropriação, grupo, BM, obs, pago ou a pagar), filtrar por BM ou descrição, excluir.
- **Etapas e apropriações**: cada apropriação (Canteiro, Projetos, Chapisco e Reboco…) pertence a uma etapa do orçamento (Serviços Iniciais e Projetos, Fase Cinza…). É isso que monta o orçado x realizado sem soma manual.
- **Dashboard**: medição atual, total realizado, R$/m², pago ao empreiteiro, orçamento, saldo, previsto pelo cronograma até o mês, divergência, orçado x realizado por etapa, gasto por grupo, por apropriação e por medição, e a prova real.

Cada empresa só enxerga os próprios dados (Row Level Security no banco).

## Como colocar no ar

### 1. Banco de dados (Supabase)

1. Crie uma conta em [supabase.com](https://supabase.com) (dá para entrar com o GitHub) e um projeto novo. Região: São Paulo.
2. No projeto, abra **SQL Editor**, cole o conteúdo de cada arquivo da pasta `supabase/migrations`, **na ordem do nome**, e clique em **Run**.
3. Em **Authentication > URL Configuration**, coloque o endereço do site (ex.: `https://app-obra.vercel.app`) em **Site URL**.
4. Em **Project Settings > API Keys**, copie a **Project URL** e a **Publishable key**.

### 2. Site (Vercel)

1. Crie uma conta em [vercel.com](https://vercel.com) entrando com o GitHub.
2. **Add New > Project**, escolha o repositório `app-obra`.
3. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com os valores do passo anterior.
4. Clique em **Deploy**.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha com as chaves do Supabase
npm install
npm run dev                  # http://localhost:3000
npm test                     # testes do importador
npm run typecheck
npm run lint
```

Estrutura:

- `supabase/migrations/` tabelas, regras de acesso, visões do dashboard e a função `importar_obra`.
- `src/lib/importador.ts` leitura da planilha "Centro de Custos" (testado em `tests/`).
- `src/app/(app)/` telas logadas: obras, importar, dashboard, lançamentos, etapas e apropriações.
