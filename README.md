# TMT File Translator — Google TMT Hackathon 2026

**Track B2 Submission · Kathmandu University**

A document translation tool that preserves exact formatting and layout while translating between English, Nepali, and Tamang. Upload a PDF, DOCX, or CSV — get back the same file in the target language, pixel-accurate.

---

## Features

### Translation
- **SSE streaming** — live segment-by-segment progress instead of a single blocking wait
- **Deduplication** — repeated sentences are translated once, applied everywhere
- **Disk-persisted LRU cache** — translations survive server restarts; re-translating the same document is near-instant
- **Rate-limit handling** — automatic 65-second backoff on TMT 429 responses with a live countdown in the UI
- **Cancel mid-job** — abort button stops the translation immediately; already-cached segments are kept
- **Request calibration** — probes the TMT API at startup to find the minimum safe interval between requests

### Format support
| Format | What is preserved |
|--------|-------------------|
| `.pdf` | Exact coordinate mapping, Devanagari font scaling |
| `.docx` | Paragraphs, tables, runs, bold/italic styles |
| `.csv` / `.tsv` | Grid structure and delimiters |

### UI
- **Preview before downloading** — side-by-side diff view (original vs translated) inside a modal
- **Inline editing** — edit any translated segment directly in the browser; modified segments are amber-highlighted
- **Save & Download** — if edits were made, the file is reconstructed server-side before download
- **Auto-download mode** — uncheck "Preview before downloading" and the file downloads automatically the moment translation finishes
- **File preview & edit** — preview uploaded DOCX before translating; edit content and save back as a real `.docx`
- **1 MB upload limit** — enforced both on drop and after in-browser edits

---

## Architecture

Two services only — Java orchestrator has been removed.

```
┌──────────────────────────────────────────────────┐
│  React Frontend  (Port 3000)                     │
│  Vite + TypeScript + Tailwind CSS v4             │
└────────────────────┬─────────────────────────────┘
                     │  SSE stream  (multipart POST)
                     ▼
┌──────────────────────────────────────────────────┐
│  Python Doc Service  (Port 8000)                 │
│  FastAPI + PyMuPDF + python-docx                 │
│                                                  │
│  POST /api/v1/translate/stream                   │
│    ├─ extract segments from file                 │
│    ├─ check LRU cache (50 000-entry cap)         │
│    ├─ deduplicate unique texts                   │
│    ├─ call TMT API sequentially (throttled)      │
│    └─ stream progress events back to browser     │
│                                                  │
│  POST /reconstruct                               │
│    └─ rebuild file with edited segments          │
│                                                  │
│  .tmt-cache.json  (disk-persisted LRU)           │
└──────────────────────────────────────────────────┘
                     │
                     ▼
         TMT API  (tmt.ilprl.ku.edu.np)
```

### Cache design

The cache lives in `.tmt-cache.json` and is loaded into an in-memory `OrderedDict` at startup.

- **Key**: `"{src_lang}\0{tgt_lang}\0{original_text}"`
- **Eviction**: LRU — when the in-memory dict exceeds 50 000 entries, the least-recently-used entry is dropped. Cache hits move the entry to the most-recent position.
- **Write-through**: every new translation is flushed to disk immediately, so a crash mid-job loses at most the current in-flight segment.
- **Startup trimming**: if the file on disk already exceeds 50 000 entries (written before the cap was introduced), the oldest entries are dropped on load and a warning is logged.

---

## Quick Start

### Requirements
- Docker and Docker Compose
- A TMT API key

### 1. Configure environment

```bash
cp .env.example .env
# edit .env and set your TMT_API_KEY
```

### 2. Run

```bash
docker compose up --build
```

Open **http://localhost:3000**

### 3. Stop

```bash
docker compose down
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
| `sourceLang` | string | Source language code (e.g. `en`) |
| `targetLang` | string | Target language code (e.g. `ne`, `tam`) |

**SSE event types**

| Event type | Payload fields | Description |
|------------|---------------|-------------|
| `extracted` | `total` | Segments extracted, translation starting |
| `segment` | `current`, `total` | One segment translated |
| `backoff` | `seconds` | Rate-limited — waiting N seconds |
| `done` | `filename`, `file` (base64), `mediaType`, `segments`, `segmentCount`, `cacheHits`, `apiCalls`, `processingTimeMs` | Translation complete |
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

Returns `{"status": "ok"}`. Used by Docker Compose healthcheck.

---

## Project Structure

```
tmt-file-translator/
├── docker-compose.yml
├── .env.example
│
├── doc-service-python/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py            # FastAPI routes + SSE streaming
│       ├── translator.py      # Cache + dedup + orchestration
│       ├── tmt_client.py      # TMT API client + rate-limit handling
│       ├── models.py          # Pydantic models
│       └── handlers/
│           ├── pdf_handler.py
│           ├── docx_handler.py
│           └── csv_handler.py
│
└── frontend-react/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── App.tsx
        ├── hooks/
        │   └── useTranslation.ts   # SSE stream consumer
        ├── components/
        │   ├── FileUpload.tsx
        │   ├── FilePreview.tsx
        │   ├── LanguageSelector.tsx
        │   ├── ProgressTracker.tsx  # Live progress + countdown + cancel
        │   ├── DiffViewer.tsx       # Side-by-side segment editor
        │   └── Modal.tsx
        └── types/
            └── index.ts
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, Lucide Icons |
| Backend | Python 3.12, FastAPI, Uvicorn |
| Document parsing | PyMuPDF (PDF), python-docx (DOCX) |
| HTTP client | httpx (sync, for TMT API calls) |
| Streaming | Server-Sent Events via FastAPI `StreamingResponse` |
| Containerisation | Docker, Docker Compose |

---

## Supported Languages

| Code | Language |
|------|----------|
| `en` | English |
| `ne` | Nepali |
| `tam` | Tamang |
