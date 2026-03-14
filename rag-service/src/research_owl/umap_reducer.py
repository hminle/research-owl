"""UMAP dimensionality reduction for embedding visualization."""

from __future__ import annotations

import numpy as np
import umap


def reduce_embeddings(
    vectors: list[list[float]],
    n_components: int = 2,
) -> list[list[float]]:
    """Reduce high-dimensional vectors to 2D/3D using UMAP."""
    n = len(vectors)
    if n < 2:
        return [[0.0] * n_components] * n

    arr = np.array(vectors, dtype=np.float32)

    # UMAP spectral init fails with very few points; fall back to PCA
    if n < 10:
        from sklearn.decomposition import PCA
        pca = PCA(n_components=n_components)
        result = pca.fit_transform(arr)
        return result.tolist()

    n_neighbors = min(15, n - 1)
    reducer = umap.UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,
        metric="cosine",
        random_state=42,
    )
    result = reducer.fit_transform(arr)
    return result.tolist()
