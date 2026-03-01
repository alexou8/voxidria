from __future__ import annotations

from pathlib import Path
from typing import Dict, Any, Optional

# Import your feature modules
from .pause_ratio import compute_pause_ratio
from .pitch_variance import extract_pitch_variance
from .loudness_variance import extract_loudness_variance
from .speech_rate import compute_speech_rate_with_elevenlabs


def analyze_audio_file(
    audio_path: str | Path,
    *,
    language_code: Optional[str] = None,
    label: Optional[str] = None,
    include_transcript: bool = True,
) -> Dict[str, Any]:
    """
    Runs all 4 reading-task metrics:
      - pause_ratio
      - pitch_std_hz
      - loudness_cv
      - speech_rate (WPM + CPS)

    Returns a clean, demo-ready JSON dict.
    """

    audio_path = Path(audio_path).resolve()

    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    # --- 1) Pause Ratio ---
    pause_res = compute_pause_ratio(str(audio_path))

    # --- 2) Pitch ---
    pitch_res = extract_pitch_variance(str(audio_path))

    # --- 3) Loudness ---
    loud_res = extract_loudness_variance(str(audio_path))

    # Use coefficient of variation for mic-robust loudness metric
    loudness_cv = (
        loud_res.rms_std / loud_res.rms_mean
        if loud_res.rms_mean and loud_res.rms_mean != 0
        else 0.0
    )

    # --- 4) Speech Rate (ElevenLabs STT) ---
    sr_res = compute_speech_rate_with_elevenlabs(
        str(audio_path),
        language_code=language_code,
    )

    result = {
        "file": audio_path.name,
        "label": label,
        "language_code": language_code,
        "pause_ratio": round(pause_res.pause_ratio, 3),
        "pitch_std_hz": round(pitch_res.pitch_std_hz, 2),
        "loudness_cv": round(loudness_cv, 3),
        "speech_rate_wpm": sr_res.speech_rate_wpm,
        "reading_speed_cps": sr_res.reading_speed_cps,
    }

    if include_transcript:
        result["transcript"] = sr_res.transcript

    return result