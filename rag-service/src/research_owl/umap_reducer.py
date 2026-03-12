"""UMAP dimensionality reduction for embedding visualization."""

from __future__ import annotations

import numpy as np
import umap


def reduce_embeddings(
    vectors: list[list[float]],
    n_components: int = 2,
) -> list[list[float]]:
    """Reduce high-dimensional vectors to 2D/3D using UMAP."""
    if len(vectors) < 2:
        return [[0.0] * n_components] * len(vectors)

    arr = np.array(vectors, dtype=np.float32)
    n_neighbors = min(15, len(vectors) - 1)
    reducer = umap.UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,
        metric="cosine",
        random_state=42,
    )
    result = reducer.fit_transform(arr)
    return result.tolist()
