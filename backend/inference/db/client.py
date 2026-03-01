import logging
import os

from supabase import create_client, Client

log = logging.getLogger(__name__)


def _sb() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


# ---------------------------------------------------------------------------
# Task status helpers
# ---------------------------------------------------------------------------

def get_task_status(session_id: str, task_type: str) -> str | None:
    res = (
        _sb()
        .table("session_tasks")
        .select("task_status")
        .eq("session_id", session_id)
        .eq("task_type", task_type)
        .single()
        .execute()
    )
    return res.data["task_status"] if res.data else None


def mark_processing(session_id: str, task_type: str) -> None:
    _sb().table("session_tasks").update(
        {"task_status": "PROCESSING"}
    ).eq("session_id", session_id).eq("task_type", task_type).execute()


def mark_analyzed_vowel(session_id: str, result: dict) -> None:
    sb = _sb()

    # Risk data goes directly onto test_sessions (no predictions table)
    sb.table("test_sessions").update({
        "risk_score":    result["risk_score"],
        "risk_bucket":   result["risk_bucket"],
        "prediction":    result["probability_pd"],
    }).eq("session_id", session_id).execute()

    sb.table("session_tasks").update({
        "task_status":   "ANALYZED",
        "duration_seconds": result["duration_ms"] / 1000,
        "analysis_json": {
            "feature_summary": result["feature_summary"],
            "probability_pd":  result["probability_pd"],
            "risk_score":      result["risk_score"],
            "risk_bucket":     result["risk_bucket"],
        },
    }).eq("session_id", session_id).eq("task_type", "SUSTAINED_VOWEL").execute()

    log.info(f"[{session_id}] Vowel result stored: score={result['risk_score']} bucket={result['risk_bucket']}")


def mark_analyzed_reading(session_id: str, result: dict) -> None:
    biomarkers = result["biomarkers"]
    _sb().table("session_tasks").update({
        "task_status":      "ANALYZED",
        "duration_seconds": result["duration_ms"] / 1000,
        "transcript_text":  biomarkers.get("transcript", ""),
        "analysis_json": {
            "pause_ratio":       biomarkers.get("pause_ratio"),
            "pitch_std_hz":      biomarkers.get("pitch_std_hz"),
            "loudness_cv":       biomarkers.get("loudness_cv"),
            "speech_rate_wpm":   biomarkers.get("speech_rate_wpm"),
            "reading_speed_cps": biomarkers.get("reading_speed_cps"),
            "transcript":        biomarkers.get("transcript"),
        },
    }).eq("session_id", session_id).eq("task_type", "READING").execute()

    log.info(f"[{session_id}] Reading biomarkers stored")


def mark_failed(session_id: str, task_type: str, error_message: str) -> None:
    _sb().table("session_tasks").update({
        "task_status":   "FAILED",
        "error_code":    "PIPELINE_ERROR",
        "error_message": error_message[:500],
    }).eq("session_id", session_id).eq("task_type", task_type).execute()


def mark_rejected_short_audio(session_id: str, result: dict) -> None:
    _sb().table("session_tasks").update({
        "task_status":      "REJECTED_SHORT_AUDIO",
        "duration_seconds": result.get("duration_ms", 0) / 1000,
        "error_code":       result.get("error_code", "AUDIO_TOO_SHORT"),
        "error_message":    result.get("error_message", ""),
    }).eq("session_id", session_id).eq("task_type", "READING").execute()


# ---------------------------------------------------------------------------
# Summary helpers
# ---------------------------------------------------------------------------

def get_session_for_summary(session_id: str) -> dict | None:
    """
    Returns risk data + reading biomarkers for a session, or None if not ready.
    Risk data is read from test_sessions directly.
    """
    sb = _sb()

    session_res = (
        sb.table("test_sessions")
        .select("session_id, risk_score, risk_bucket, prediction")
        .eq("session_id", session_id)
        .single()
        .execute()
    )
    if not session_res.data or session_res.data.get("risk_score") is None:
        return None

    session = session_res.data

    reading_res = (
        sb.table("session_tasks")
        .select("analysis_json")
        .eq("session_id", session_id)
        .eq("task_type", "READING")
        .single()
        .execute()
    )
    reading = reading_res.data or {}

    return {
        "session_id":        session_id,
        "probability_pd":    session.get("prediction") or (session["risk_score"] / 100),
        "risk_score":        session["risk_score"],
        "risk_bucket":       session["risk_bucket"],
        "reading_biomarkers": reading.get("analysis_json") or {},
    }


def store_gemini_explanation(session_id: str, explanation: str) -> None:
    _sb().table("test_sessions").update(
        {"gemini_explanation": explanation}
    ).eq("session_id", session_id).execute()
