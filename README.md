# TMT File Translator :http://74.225.253.119:3000/

![Python](https://img.shields.io/badge/Python-3.12-blue)
![Node](https://img.shields.io/badge/Node-20-green)

**Google TMT Hackathon 2026 · Track B2 · Kathmandu University**

A document translation tool that preserves exact formatting and layout while translating between English, Nepali, and Tamang. Upload a PDF, DOCX, or CSV — get back the same file in the target language, pixel-accurate.

---

## Features

### Translation pipeline
- **SSE streaming** — live segment-by-segment progress instead of a single blocking wait
- **Deduplication** — repeated sentences are translated once, applied everywhere
- **Disk-persisted LRU cache** — 50 000-entry cap; survives restarts; re-translating the same document is near-instant
- **Rate-limit handling** — automatic 65-second backoff on TMT 429 responses with a live countdown in the UI
- **Cancel mid-job** — abort button stops translation immediately; already-cached segments are kept
- **Request calibration** — probes the TMT API at startup to find the minimum safe interval between requests

### Format support

| Format | What is preserved |
|--------|-------------------|
| `.pdf` | Exact coordinate mapping, Devanagari font scaling |
| `.docx` | Paragraphs, tables, runs, bold/italic styles |
| `.csv` / `.tsv` | Grid structure and delimiters |

### UI
- **Preview before downloading** — side-by-side diff view (original vs translated) inside a modal
- **Inline editing** — edit any translated segment in the browser; modified segments are amber-highlighted
- **Save & Download** — edits trigger a server-side file reconstruction before download
- **Auto-download mode** — uncheck "Preview before downloading" for an automatic download on completion
- **File preview & edit** — preview uploaded DOCX/CSV before translating; edit content inline

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│  React Frontend  (Port 3000)                     │
│  Vite + TypeScript + Tailwind CSS v4             │
└────────────────────┬─────────────────────────────┘
                     │  nginx reverse-proxy
                     │  SSE stream / multipart POST
                     ▼
┌──────────────────────────────────────────────────┐
│  Python Doc Service  (Port 8000)                 │
│  FastAPI + PyMuPDF + python-docx                 │
│                                                  │
│  POST /api/v1/translate/stream   (SSE)           │
│    ├─ extract segments from file                 │
│    ├─ check LRU cache (50 000-entry cap)         │
│    ├─ deduplicate unique texts                   │
│    ├─ call TMT API sequentially (throttled)      │
│    └─ stream progress events back to browser     │
│                                                  │
│  POST /reconstruct                               │
│    └─ rebuild file with user-edited segments     │
│                                                  │
│  .tmt-cache.json  (disk-persisted LRU)           │
└──────────────────────────────────────────────────┘
                     │
                     ▼
         TMT API  (tmt.ilprl.ku.edu.np)
```

### Cache design

The cache lives in `.tmt-cache.json` (gitignored) and is loaded into an in-memory `OrderedDict` at startup.

| Property | Detail |
|----------|--------|
| Key | `"{src_lang}\0{tgt_lang}\0{original_text}"` |
| Eviction | LRU — oldest entry dropped when the dict exceeds 50 000 entries |
| Recency | Cache hits move the entry to most-recent position |
| Write-through | Every new translation is flushed to disk immediately |
| Startup trim | If the file on disk exceeds the cap, the oldest entries are dropped on load |

---

## Quick Start

### Requirements

- Docker & Docker Compose
- A TMT API key

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env and set your TMT_API_KEY
```

### 2. Start

```bash
docker compose up --build
```

Open **http://localhost:3000**

### 3. Stop

```bash
docker compose down
```

### Local development (no Docker)

**Frontend:**
```bash
cd frontend-react
npm install
# Optional: create frontend-react/.env.local with VITE_API_BASE=http://localhost:8000
npm run dev        # http://localhost:5173
```

**Backend:**
```bash
cd doc-service-python
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## API Reference

All endpoints are on the doc service at **http://localhost:8000**.

### `POST /api/v1/translate/stream`

Translates a document and streams progress as Server-Sent Events.

**Form fields**

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Document to translate (PDF, DOCX, CSV/TSV) |
| `sourceLang` | string | Source language code (`en`) |
| `targetLang` | string | Target language code (`ne`, `tam`) |

**SSE event types**

| Type | Payload | Description |
|------|---------|-------------|
| `extracted` | `total` | Segments extracted, translation starting |
| `segment` | `current`, `total` | One segment translated |
| `backoff` | `seconds` | Rate-limited — waiting N seconds |
| `done` | `filename`, `file` (base64), `mediaType`, `segments`, `segmentCount`, `cacheHits`, `apiCalls`, `processingTimeMs` | Complete |
| `error` | `message` | Fatal error |

### `POST /reconstruct`

Rebuilds the original file with user-edited segment texts.

**Form fields**

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | The original uploaded file |
| `segments` | JSON string | Array of `{id, text, meta}` objects |

Returns the reconstructed file as a binary response.

### `GET /health`

Returns `{"status": "healthy", "service": "doc-service"}`.

---

## Project Structure

```
tmt-file-translator/
├── .github/
│   ├── workflows/ci.yml           # Type-check + build on every push/PR
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── docker-compose.yml
├── .env.example
│
├── doc-service-python/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py               # App init + router registration
│       ├── config.py             # Shared constants (extensions, limits)
│       ├── translator.py         # Cache + dedup + orchestration
│       ├── tmt_client.py         # TMT API client (TmtClient class)
│       ├── models.py             # Pydantic models
│       ├── handlers/
│       │   ├── pdf_handler.py
│       │   ├── docx_handler.py
│       │   └── csv_handler.py
│       ├── routes/
│       │   ├── translate.py      # /api/v1/translate + /stream
│       │   └── files.py          # /extract + /reconstruct
│       └── services/
│           └── file_service.py   # Validation + extraction helpers
│
└── frontend-react/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── App.tsx
        ├── config.ts             # API base URL (reads VITE_API_BASE)
        ├── constants.ts          # File-size / extension limits
        ├── hooks/
        │   ├── useTranslation.ts # SSE stream consumer + state machine
        │   └── useEta.ts         # ETA calculation hook
        ├── components/
        │   ├── ui/Chip.tsx
        │   ├── preview/          # PDF / DOCX / CSV inline previewers
        │   ├── DiffViewer.tsx    # Side-by-side segment editor
        │   ├── ProgressTracker.tsx
        │   ├── SuccessCard.tsx
        │   └── Modal.tsx
        ├── types/index.ts
        └── utils/download.ts
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript 5, Vite 5, Tailwind CSS v4, Lucide Icons |
| Backend | Python 3.12, FastAPI, Uvicorn |
| Document parsing | PyMuPDF (PDF), python-docx (DOCX) |
| HTTP client | httpx (sync, for TMT API calls) |
| Streaming | Server-Sent Events via FastAPI `StreamingResponse` |
| Reverse proxy | nginx (SSE buffering disabled) |
| Containerisation | Docker, Docker Compose |

---

## Supported Languages

| Code | Language | Native |
|------|----------|--------|
| `en` | English | English |
| `ne` | Nepali | नेपाली |
| `tam` | Tamang | तामाङ |

---

## Contributing

