# Contributing

## Getting started

### Prerequisites

- Docker & Docker Compose (for the full stack)
- Node 20+ (frontend only)
- Python 3.12+ (backend only)

### Run locally

```bash
cp .env.example .env
# Set TMT_API_KEY in .env

docker compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

### Frontend dev server (hot-reload)

```bash
cd frontend-react
npm install
npm run dev      # http://localhost:5173
```

Point it at the backend by setting `VITE_API_BASE=http://localhost:8000` in `frontend-react/.env.local`.

### Backend only

```bash
cd doc-service-python
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Project layout

```
tmt-file-translator/
├── .github/              # CI workflow, issue & PR templates
├── doc-service-python/
│   └── app/
│       ├── config.py          # Shared constants
│       ├── main.py            # App init + router registration
│       ├── translator.py      # Cache + dedup + orchestration
│       ├── tmt_client.py      # TMT API client (TmtClient class)
│       ├── models.py          # Pydantic models
│       ├── handlers/          # PDF / DOCX / CSV parsers
│       ├── routes/
│       │   ├── translate.py   # /api/v1/translate endpoints
│       │   └── files.py       # /extract and /reconstruct
│       └── services/
│           └── file_service.py  # Validation + extraction helpers
└── frontend-react/
    └── src/
        ├── config.ts          # API base URL (reads VITE_API_BASE)
        ├── constants.ts       # File-size / extension limits
        ├── hooks/
        │   ├── useTranslation.ts  # SSE stream consumer
        │   └── useEta.ts          # ETA calculation hook
        ├── components/
        │   ├── ui/Chip.tsx
        │   ├── preview/       # PDF / DOCX / CSV inline previewers
        │   ├── DiffViewer.tsx
        │   ├── ProgressTracker.tsx
        │   ├── SuccessCard.tsx
        │   └── Modal.tsx
        ├── types/index.ts
        └── utils/download.ts
```

## Making changes

1. **Branch** off `main`: `git checkout -b feat/my-change`
2. **Make your change** and verify `docker compose up --build` still works.
3. **Run the frontend type-check** before pushing:
   ```bash
   cd frontend-react && npm run build
   ```
4. **Open a PR** using the template — fill in every checklist item.

## Code style

- **Python**: follow the existing patterns; run `python -m compileall -q app/` to catch syntax errors.
- **TypeScript**: strict mode is enabled; `npm run build` must pass with zero errors.
- No `console.log` in committed code.
- No secrets in source files — use `.env` only.

## Adding a new file format

1. Create `doc-service-python/app/handlers/<format>_handler.py` with `extract_<format>` and `reconstruct_<format>` functions.
2. Register the extension in `app/config.py` (`SUPPORTED_EXTENSIONS`, `CONTENT_TYPES`).
3. Wire it into `app/services/file_service.py` (`extract_file` and `reconstruct_file`).
4. Add the extension to `ACCEPTED_EXTENSIONS` in `frontend-react/src/constants.ts` and to the `FileUpload` component's `accept` attribute.
