from __future__ import annotations

import os
import re
import unicodedata
from dataclasses import dataclass
from typing import Dict, Any, Optional
from pathlib import Path

from dotenv import load_dotenv
from pydub import AudioSegment

import requests


BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")

# Also loads backend/.env when run from backend root (cd backend)
load_dotenv()


@dataclass
class SpeechRateResult:
    duration_seconds: float
    transcript: str
    word_count: int
    model: str
    language_code: str
    reading_speed_cps: float
    speech_rate_wpm: Optional[float]


def _audio_duration_seconds(audio_path: str) -> float:
    """
    Uses pydub to support wav/m4a/mp3/etc.
    Note: for m4a on Windows, ffmpeg is often required.
    """
    audio = AudioSegment.from_file(audio_path)
    return len(audio) / 1000.0


def _clean_transcript(text: str) -> str:
    text = (text or "").strip()
    # Remove code fences if the model returns them (rare for STT but safe)
    text = re.sub(r"^```.*?\n|\n```$", "", text, flags=re.DOTALL).strip()
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _count_words(transcript: str) -> int:
    # word-like tokens (letters/numbers/apostrophes)
    return len(re.findall(r"\b[\w']+\b", transcript, flags=re.UNICODE))


def _count_chars_language_neutral(transcript: str) -> int:
    count = 0
    for ch in transcript:
        category = unicodedata.category(ch)
        if category and category[0] in ("L", "N"):
            count += 1
    return count


def compute_speech_rate_with_elevenlabs(
    audio_path: str,
    *,
    api_key: Optional[str] = None,
    model_id: Optional[str] = None,
    language_code: Optional[str] = None,  # e.g., "en", "hi", "te", "zh", "yue"
) -> SpeechRateResult:
    """
    ElevenLabs Speech-to-Text (Scribe v2).
    Endpoint (batch): POST https://api.elevenlabs.io/v1/speech-to-text
    Form fields: file, model_id, (optional) language_code
    Returns JSON with { "text": "...", ... }

    Env:
      ELEVENLABS_API_KEY (required)
      ELEVENLABS_STT_MODEL_ID (optional, default scribe_v2)
    """
    api_key = api_key or os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("Missing ELEVENLABS_API_KEY. Put it in backend/.env")

    model_id = model_id or os.getenv("ELEVENLABS_STT_MODEL_ID", "scribe_v2")

    duration_seconds = _audio_duration_seconds(audio_path)
    if duration_seconds <= 0.0:
        raise ValueError("Audio duration is 0 seconds — cannot compute speech rate.")

    url = "https://api.elevenlabs.io/v1/speech-to-text"
    headers = {
        "xi-api-key": api_key,
    }

    # Basic mime inference (good enough)
    if audio_path.lower().endswith(".wav"):
        mime = "audio/wav"
    elif audio_path.lower().endswith(".mp3"):
        mime = "audio/mpeg"
    elif audio_path.lower().endswith(".m4a"):
        mime = "audio/mp4"
    else:
        mime = "application/octet-stream"

    data = {"model_id": model_id}
    if language_code:
        data["language_code"] = language_code

    with open(audio_path, "rb") as f:
        files = {"file": (os.path.basename(audio_path), f, mime)}
        resp = requests.post(url, headers=headers, data=data, files=files, timeout=120)

    if resp.status_code != 200:
        # Helpful error info for debugging demo-day failures
        raise RuntimeError(
            f"ElevenLabs STT failed ({resp.status_code}): {resp.text}"
        )

    payload = resp.json()
    transcript = _clean_transcript(payload.get("text", ""))
    char_count = _count_chars_language_neutral(transcript)

    minutes = duration_seconds / 60.0
    reading_speed_cps = (char_count / duration_seconds) if duration_seconds > 0 else 0.0

    language_code_out = (language_code or "").strip()
    if not language_code_out:
        language_code_out = "unknown"
    lang_primary = language_code_out.split("-")[0].lower() if language_code_out != "unknown" else ""
    use_wpm = lang_primary in {"en", "hi", "te"}

    if use_wpm:
        word_count = _count_words(transcript)
        speech_rate_wpm = (word_count / minutes) if minutes > 0 else 0.0
    else:
        word_count = 0
        speech_rate_wpm = None

    return SpeechRateResult(
        duration_seconds=round(duration_seconds, 3),
        transcript=transcript,
        word_count=word_count,
        model=model_id,
        language_code=language_code_out,
        reading_speed_cps=round(reading_speed_cps, 3),
        speech_rate_wpm=round(speech_rate_wpm, 2) if speech_rate_wpm is not None else None,
    )


def speech_rate_result_to_dict(r: SpeechRateResult) -> Dict[str, Any]:
    return {
        "duration_seconds": r.duration_seconds,
        "transcript": r.transcript,
        "word_count": r.word_count,
        "language_code": r.language_code,
        "reading_speed_cps": r.reading_speed_cps,
        "speech_rate_wpm": r.speech_rate_wpm,
        "stt_model": r.model,
        "stt_provider": "elevenlabs",
    }
