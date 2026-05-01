# Embedding Service

This optional Python service turns the recommender notebook's embedding model into a backend API.

Model:

```txt
sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
```

It returns 384-dimensional normalized embeddings, matching the PostgreSQL schema.

## Setup

From `embedding_service/`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --host 0.0.0.0 --port 8001
```

Then set the Node backend env:

```env
EMBEDDING_SERVICE_URL=http://localhost:8001
```

## Test

```bash
curl http://localhost:8001/health
```

```bash
curl -X POST http://localhost:8001/embed ^
  -H "Content-Type: application/json" ^
  -d "{\"texts\":[\"Tom Yum Kung spicy sour shrimp soup\"],\"normalize\":true}"
```

If this service is not running, the Node backend falls back to deterministic mock embeddings.
