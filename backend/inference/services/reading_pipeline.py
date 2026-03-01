import logging
import os
import pathlib
import sys

import librosa

_BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from task_2.services.audio_io import analyze_audio_file
from services.audio_download import download_audio

log = logging.getLogger(__name__)

MIN_DURATION_MS = 13_000  # 13 seconds


def _duration_ms(path: str) -> float:
    y, sr = librosa.load(path, sr=None, mono=True)
    return round(librosa.get_duration(y=y, sr=sr) * 1000, 1)


def run_reading_pipeline(session_id: str, audio_url: str, language_code: str = "en") -> dict:
    """
    Full Task 2 pipeline:
      download → duration gate → biomarker extraction (ElevenLabs STT + Parselmouth) → return result dict
    """
    tmp_path = None
    try:
        tmp_path = download_audio(audio_url)
        duration = _duration_ms(tmp_path)
        log.info(f"[{session_id}] Reading audio duration_ms={duration}")

        if duration < MIN_DURATION_MS:
            return {
                "rejected": True,
                "duration_ms": duration,
                "error_code": "AUDIO_TOO_SHORT",
                "error_message": (
                    f"Audio is {duration/1000:.1f}s — minimum required is 13s"
                ),
            }

        biomarkers = analyze_audio_file(tmp_path, language_code=language_code)
        log.info(f"[{session_id}] Biomarkers extracted")

        return {
            "duration_ms": duration,
            "biomarkers": {
                "pause_ratio":       biomarkers.get("pause_ratio"),
                "pitch_std_hz":      biomarkers.get("pitch_std_hz"),
                "loudness_cv":       biomarkers.get("loudness_cv"),
                "speech_rate_wpm":   biomarkers.get("speech_rate_wpm"),
                "reading_speed_cps": biomarkers.get("reading_speed_cps"),
                "transcript":        biomarkers.get("transcript", ""),
            },
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
