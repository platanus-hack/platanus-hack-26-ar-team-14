"""One-shot indexer. Run from backend/:

    uv run python -m scripts.index

Re-runs are idempotent: deletes the existing collection, then rebuilds.
"""

from __future__ import annotations

import shutil

from app.curriculum.store import CHROMA_DIR, build_index


def main() -> None:
    if CHROMA_DIR.exists():
        shutil.rmtree(CHROMA_DIR)
    store = build_index()
    count = store._collection.count()  # type: ignore[attr-defined]
    print(f"Indexed {count} chunks → {CHROMA_DIR}")


if __name__ == "__main__":
    main()
