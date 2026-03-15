# DrainZero — Backend

Express.js backend for DrainZero AI Tax Optimisation Platform.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env
# Fill in your actual keys in .env

# 3. Run in development
npm run dev

# 4. Run in production
npm start
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/analyse | Tax calculation + health score |
| GET | /api/loopholes?userId= | Matched loopholes for user |
| GET | /api/benefits?userId= | Matched benefits for user |
| POST | /api/agent | AI agentic loop (Phase 3) |
| POST | /api/documents | Document extraction (Phase 3) |
| GET | / | Health check |

## Environment Variables

See `.env.example` for required variables.

## Stack

- Express.js + Node.js
- Supabase (DB + Auth)
- Gemini 1.5 Flash (AI)
- Serper.dev (Web Search)
- Deployed on Render.com
