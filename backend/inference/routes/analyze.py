import logging
import os
import time

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db.client import (
    get_task_status,
    mark_processing,
    mark_analyzed_vowel,
    mark_analyzed_reading,
    mark_failed,
    mark_rejected_short_audio,
)
from services.vowel_pipeline import run_vowel_pipeline
from services.reading_pipeline import run_reading_pipeline

router = APIRouter()
log = logging.getLogger(__name__)

ALLOWED_TASK_TYPES = {"SUSTAINED_VOWEL", "READING"}


class AnalyzeRequest(BaseModel):
    session_id: str
    task_type: str
    audio_path: str
    language_code: str = "en"


@router.post("/analyze")
def analyze(body: AnalyzeRequest, x_inference_secret: str = Header(None)):
    secret = os.getenv("INFERENCE_SHARED_SECRET", "")
    if not secret or x_inference_secret != secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    session_id = body.session_id
    task_type = body.task_type
    start = time.time()

    log.info(f"[{session_id}] /analyze task_type={task_type}")

    if task_type not in ALLOWED_TASK_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown task_type: {task_type}")

    # ── Idempotency check ────────────────────────────────────────────────────
    current_status = get_task_status(session_id, task_type)
    if current_status == "ANALYZED":
        log.info(f"[{session_id}] Already ANALYZED — skipping")
        return {"ok": True, "skipped": True, "task_type": task_type, "task_status": "ANALYZED"}

    # ── State: PROCESSING ────────────────────────────────────────────────────
    mark_processing(session_id, task_type)

    try:
        if task_type == "SUSTAINED_VOWEL":
            result = run_vowel_pipeline(session_id, body.audio_path)
            mark_analyzed_vowel(session_id, result)

        else:  # READING
            result = run_reading_pipeline(session_id, body.audio_path, body.language_code)

            if result.get("rejected"):
                mark_rejected_short_audio(session_id, result)
                elapsed = round((time.time() - start) * 1000)
                log.warning(
                    f"[{session_id}] REJECTED_SHORT_AUDIO "
                    f"duration_ms={result['duration_ms']} elapsed_ms={elapsed}"
                )
                return JSONResponse(
                    status_code=400,
                    content={
                        "ok": False,
                        "task_type": task_type,
                        "duration_ms": result["duration_ms"],
                        "task_status": "REJECTED_SHORT_AUDIO",
                        "error": "AUDIO_TOO_SHORT",
                        "min_seconds": 13,
                    },
                )

            mark_analyzed_reading(session_id, result)

        elapsed = round((time.time() - start) * 1000)
        log.info(
            f"[{session_id}] ANALYZED task_type={task_type} "
            f"duration_ms={result['duration_ms']} elapsed_ms={elapsed}"
        )

        return {
            "ok": True,
            "task_type": task_type,
            "duration_ms": result["duration_ms"],
            "task_status": "ANALYZED",
        }

    except Exception as exc:
        elapsed = round((time.time() - start) * 1000)
        log.error(
            f"[{session_id}] Pipeline FAILED task_type={task_type} "
            f"elapsed_ms={elapsed} error={exc}",
            exc_info=True,
        )
        mark_failed(session_id, task_type, str(exc))
        raise HTTPException(status_code=500, detail=str(exc))
