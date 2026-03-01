import logging
import os
import time

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from db.client import get_session_for_summary, store_gemini_explanation
from services.gemini_summary import generate_summary

router = APIRouter()
log = logging.getLogger(__name__)


class SummaryRequest(BaseModel):
    session_id: str


@router.post("/generate-summary")
def generate_session_summary(body: SummaryRequest, x_inference_secret: str = Header(None)):
    secret = os.getenv("INFERENCE_SHARED_SECRET", "")
    if not secret or x_inference_secret != secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    session_id = body.session_id
    start = time.time()
    log.info(f"[{session_id}] /generate-summary called")

    session_data = get_session_for_summary(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="No prediction found for this session")

    try:
        explanation = generate_summary(
            probability_pd=session_data["probability_pd"],
            risk_score=session_data["risk_score"],
            risk_bucket=session_data["risk_bucket"],
            reading_biomarkers=session_data["reading_biomarkers"],
        )

        store_gemini_explanation(session_id, explanation)

        elapsed = round((time.time() - start) * 1000)
        log.info(f"[{session_id}] Summary generated and stored elapsed_ms={elapsed}")

        return {"ok": True, "session_id": session_id}

    except Exception as exc:
        log.error(f"[{session_id}] Summary generation failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
