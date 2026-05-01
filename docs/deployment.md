# Deployment

This project can be deployed as a Node/Express API on Vercel.

Official Vercel docs support Express apps as Vercel Functions when the Express app is exported. Our app exports from:

- `src/server.js`

Local development still works with:

```bash
npm run dev
```

## Recommended MVP Deployment

Deploy the Node backend to Vercel and keep Supabase as the database.

Python embeddings are optional at runtime:

- If `EMBEDDING_SERVICE_URL` is configured, Node calls the Python FastAPI embedding service.
- If `EMBEDDING_SERVICE_URL` is missing or unreachable, Node falls back to deterministic mock embeddings.

For demo access, this is enough:

- deploy Node API to Vercel
- keep Supabase online
- pre-refresh embeddings locally or with a separately hosted Python service

## Vercel Environment Variables

Set these in Vercel Project Settings > Environment Variables:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
LLM_API_KEY=
EMBEDDING_API_KEY=
EMBEDDING_SERVICE_URL=
GOOGLE_MAPS_API_KEY=
TRANSPORT_DISTANCE_PROVIDER=google
```

Required for current API:

```env
DATABASE_URL
```

Required later for storage/admin Supabase service calls:

```env
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.

## Deploy From GitHub

1. Push this backend repository to GitHub.
2. Open Vercel.
3. Create a new project from the GitHub repository.
4. Framework preset can be **Other** or Vercel auto-detected Node/Express.
5. Add environment variables.
6. Deploy.

After deployment, test:

```bash
curl https://your-vercel-domain.vercel.app/api/health
curl https://your-vercel-domain.vercel.app/api/db/health
curl https://your-vercel-domain.vercel.app/api/tags
```

## Deploy From CLI

Install Vercel CLI:

```bash
npm i -g vercel
```

Login:

```bash
vercel login
```

Deploy preview:

```bash
vercel
```

Deploy production:

```bash
vercel --prod
```

## Frontend Collaborator Usage

Your frontend can call the deployed API base URL:

```txt
https://your-vercel-domain.vercel.app
```

Example:

```js
const API_BASE_URL = "https://your-vercel-domain.vercel.app";

const response = await fetch(`${API_BASE_URL}/api/tags`);
const tags = await response.json();
```

Current CORS setting allows browser access from any origin.

## Python Embedding Service Deployment

Vercel is not the best place for the Python `sentence-transformers` service because ML dependencies and model files can be large.

Recommended hosts:

- Render
- Railway
- Fly.io
- Hugging Face Spaces

Deploy the `embedding_service/` folder there, then set:

```env
EMBEDDING_SERVICE_URL=https://your-embedding-service.example.com
```

The already-generated vectors remain stored in Supabase, so recommendation can still work without calling the Python service on every request.

## Notes

- `express.static()` is ignored by Vercel for static assets. Put frontend/static files in `public/**`.
- Keep long embedding refresh jobs small on Vercel. Use `limit` in `/api/embeddings/refresh`.
- For large embedding refreshes, run locally or use a background worker.
