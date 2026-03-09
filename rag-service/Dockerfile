FROM python:3.11-slim AS base

WORKDIR /app

# System dependencies for docling (PDF parsing) and general build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libxcb1 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY src/ ./src/

# Install CPU-only PyTorch first to avoid downloading CUDA packages
RUN pip install --no-cache-dir "torch>=2.0,<2.7" "torchvision>=0.15,<0.22" --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -e .

EXPOSE 8000

CMD ["uvicorn", "research_owl.main:app", "--host", "0.0.0.0", "--port", "8000"]
