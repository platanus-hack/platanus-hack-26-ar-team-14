"""Vector index for the Programa + in-memory OA catalog.

Single source of state for the curriculum module. Loads on first access,
caches in process memory.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings

from app.config import settings
from app.curriculum.parser import (
    OA,
    extract_oas_mate_5to,
    extract_programa_chunks,
)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = BACKEND_ROOT / "docs"
CHROMA_DIR = BACKEND_ROOT / ".chroma"
COLLECTION = "programa_mate_5to"


def _embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=settings.embed_model,
        base_url=settings.embed_base_url,
        api_key=settings.openrouter_api_key.get_secret_value(),
        check_embedding_ctx_length=False,  # OpenRouter passthrough
    )


def build_index() -> Chroma:
    """One-shot: parse Programa, embed every chunk, persist to disk."""
    chunks = extract_programa_chunks(DOCS_DIR / "programa-matematica-5to.pdf")
    docs = [
        Document(
            page_content=c.text,
            metadata={
                "unidad": c.unidad,
                "pagina": c.pagina,
                "oa_codes": ",".join(c.oa_codes),  # Chroma metadata = scalars
            },
        )
        for c in chunks
    ]
    CHROMA_DIR.mkdir(exist_ok=True)
    store = Chroma.from_documents(
        documents=docs,
        embedding=_embeddings(),
        collection_name=COLLECTION,
        persist_directory=str(CHROMA_DIR),
    )
    return store


@lru_cache(maxsize=1)
def get_vectorstore() -> Chroma:
    """Load the persisted index, building it once if missing."""
    if not CHROMA_DIR.exists() or not any(CHROMA_DIR.iterdir()):
        return build_index()
    return Chroma(
        collection_name=COLLECTION,
        embedding_function=_embeddings(),
        persist_directory=str(CHROMA_DIR),
    )


@lru_cache(maxsize=1)
def get_oa_catalog() -> tuple[OA, ...]:
    return tuple(extract_oas_mate_5to(DOCS_DIR / "bases-1-6.pdf"))
