"""TMT Document Service — FastAPI application entry point."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import EXPOSE_HEADERS
from app.routes.files import router as files_router
from app.routes.translate import router as translate_router
from app.translator import load_cache
from app import tmt_client

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, load_cache)
    await loop.run_in_executor(None, tmt_client.calibrate)
    yield


app = FastAPI(title="TMT Translation Service", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=EXPOSE_HEADERS,
)

app.include_router(translate_router)
app.include_router(files_router)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "doc-service"}
