# VitaControl 🩺

Sistema de controle financeiro para consultas de fonoaudiologia da **Vitalab Medicina Diagnóstica**.

## ✨ Funcionalidades

- **📸 OCR com IA** — Upload de fotos do sistema iQuery ou listagem de repasse para extração automática de dados via Claude Vision
- **📊 Dashboard** — Cards de resumo (Em Aberto, Pago, Vencido) + tabela filtável
- **💳 Confirmação de Pagamento** — Cruzamento automático de repasses com registros por número de OS
- **📥 Exportação Excel** — Download em formato `.xlsx` com filtros
- **🔐 Autenticação** — Login com email/senha, 2 perfis (Admin e Visualização)
- **📱 Mobile-first** — Interface responsiva otimizada para celular

## 🛠 Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Estilização**: Tailwind CSS
- **Banco de dados**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **Autenticação**: NextAuth.js v5
- **IA/OCR**: Google Gemini API (Gemini 1.5 Flash Free Tier)
- **Exportação Excel**: SheetJS (xlsx)
- **Deploy**: Vercel

## 🚀 Setup Local

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha os valores:

```bash
cp .env.example .env.local
```

Variáveis necessárias:
- `DATABASE_URL` — URL de conexão Supabase (porta 6543, transaction mode)
- `DIRECT_URL` — URL direta Supabase (porta 5432, para migrações)
- `GEMINI_API_KEY` — Chave da API Google Gemini (AI Studio)
- `NEXTAUTH_SECRET` — Gere com: `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000`

### 3. Configurar banco de dados

```bash
npx prisma generate
npx prisma db push
```

### 4. Criar usuários iniciais

Configure as senhas no `.env.local`:
```
ADMIN_PASSWORD=suaSenhaAdmin
VIEWER_PASSWORD=suaSenhaViewer
```

Execute o seed:
```bash
npx tsx prisma/seed.ts
```

### 5. Iniciar o servidor

```bash
npm run dev
```

Acesse: http://localhost:3000

## 📦 Deploy no Vercel

1. Push para o GitHub
2. Conecte ao Vercel
3. Configure as variáveis de ambiente no painel do Vercel
4. Deploy automático! 🚀

## 📋 Tabela de Preços

| Exame | Valor |
|-------|-------|
| Audiometria Tonal | R$ 35,00 |
| Audiometria Tonal e Vocal | R$ 50,00 |
| Outros | Extraído do documento |

## 👥 Usuários

| Perfil | Acesso |
|--------|--------|
| **Admin** | Acesso total: upload, edição, confirmação de pagamento |
| **Visualização** | Read-only: dashboard e exportação |
