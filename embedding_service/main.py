import os
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer


MODEL_NAME = os.getenv(
    "EMBEDDING_MODEL_NAME",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)

app = FastAPI(title="Thai Food Matchmaker Embedding Service")
model = SentenceTransformer(MODEL_NAME)


class EmbedRequest(BaseModel):
    texts: List[str] = Field(default_factory=list)
    normalize: bool = True


class EmbedResponse(BaseModel):
    model: str
    dimension: int
    embeddings: List[List[float]]


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": MODEL_NAME,
    }


@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest):
    embeddings = model.encode(
        [text or "" for text in request.texts],
        normalize_embeddings=request.normalize,
    ).tolist()

    dimension = len(embeddings[0]) if embeddings else 384

    return {
        "model": MODEL_NAME,
        "dimension": dimension,
        "embeddings": embeddings,
    }
