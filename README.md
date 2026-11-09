# History Quest

Interactive history battle quiz application built with Next.js 14, Tailwind CSS, and Neon Serverless PostgreSQL.

## Environment Variables

Copy `.env.example` to `.env` (or configure in Vercel):

- `DATABASE_URL`: Connection string for Neon Serverless PostgreSQL.
- `DATABASE_URL_POOLED`: Optional pooled connection string for high-concurrency environments.
- `LLM_PROVIDER`: `google` (default) or `openai`.
- `LLM_API_KEY`: API key for Gemini or OpenAI for AI-assisted quiz generation.
- `APP_PASSCODE`: Optional single-user gate passcode (default: `history123`).

## Development

```bash
# Install dependencies
npm install

# Push schema to database
npm run db:push

# Run local development server
npm run dev

# Run test suite
npm test

# Build for production
npm run build
```
