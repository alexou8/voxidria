print("LOADED pause_ratio.py")
# backend/services/pause_ratio.py

from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, Tuple, List

from pydub import AudioSegment, silence


@dataclass
class PauseRatioResult:
    audio_path: str
    total_seconds: float
    silence_seconds: float
    pause_ratio: float
    pause_count: int
    settings: Dict[str, Any]


def compute_pause_ratio(
    audio_path: str,
    *,
    min_silence_len_ms: int = 600,
    # Option 1: dynamic threshold (recommended)
    # silence_thresh_db is computed as: audio.dBFS - silence_offset_db
    silence_offset_db: float = 16.0,
    # Option 2: fixed threshold (set this to e.g. -35.0 if you want fixed)
    fixed_silence_thresh_db: Optional[float] = None,
    keep_silence_ms: int = 0,
) -> PauseRatioResult:
    """
    Compute pause ratio = (total detected silence duration) / (total audio duration).

    How silence is detected:
    - If fixed_silence_thresh_db is provided (e.g., -35.0), we use that.
    - Otherwise, we use a dynamic threshold: audio.dBFS - silence_offset_db

    Parameters:
    - min_silence_len_ms: minimum length of a silent segment to count as a pause
    - silence_offset_db: used ONLY for dynamic threshold
    - fixed_silence_thresh_db: set to a number to force a fixed threshold
    - keep_silence_ms: keep a little silence at edges of chunks (not needed for ratio; useful if trimming)

    Returns:
    - PauseRatioResult with durations, ratio, and pause count.
    """
    # Load audio (pydub uses ffmpeg under the hood for many formats; WAV works without drama)
    audio = AudioSegment.from_file(audio_path)

    total_ms = len(audio)
    if total_ms <= 0:
        return PauseRatioResult(
            audio_path=audio_path,
            total_seconds=0.0,
            silence_seconds=0.0,
            pause_ratio=0.0,
            pause_count=0,
            settings={
                "min_silence_len_ms": min_silence_len_ms,
                "keep_silence_ms": keep_silence_ms,
                "fixed_silence_thresh_db": fixed_silence_thresh_db,
                "silence_offset_db": silence_offset_db,
                "computed_silence_thresh_db": None,
                "audio_dbfs": getattr(audio, "dBFS", None),
            },
        )

    # Compute threshold
    audio_dbfs = audio.dBFS  # average loudness in dBFS (typically negative)
    if fixed_silence_thresh_db is not None:
        silence_thresh_db = float(fixed_silence_thresh_db)
    else:
        # Dynamic threshold: lower than average loudness by an offset
        silence_thresh_db = float(audio_dbfs - silence_offset_db)

    # Detect silence segments (returns list of [start_ms, end_ms])
    silent_ranges: List[List[int]] = silence.detect_silence(
        audio,
        min_silence_len=min_silence_len_ms,
        silence_thresh=silence_thresh_db,
    )

    # Total silence duration
    silence_ms = 0
    for start_ms, end_ms in silent_ranges:
        silence_ms += max(0, end_ms - start_ms)

    total_seconds = total_ms / 1000.0
    silence_seconds = silence_ms / 1000.0
    pause_ratio = min(1.0, max(0.0, silence_seconds / total_seconds))
    pause_count = len(silent_ranges)

    return PauseRatioResult(
        audio_path=audio_path,
        total_seconds=round(total_seconds, 4),
        silence_seconds=round(silence_seconds, 4),
        pause_ratio=round(pause_ratio, 4),
        pause_count=pause_count,
        settings={
            "min_silence_len_ms": min_silence_len_ms,
            "keep_silence_ms": keep_silence_ms,
            "fixed_silence_thresh_db": fixed_silence_thresh_db,
            "silence_offset_db": silence_offset_db,
            "computed_silence_thresh_db": round(silence_thresh_db, 2),
            "audio_dbfs": round(audio_dbfs, 2) if audio_dbfs is not None else None,
            "silence_ranges_ms": silent_ranges,  # useful for debugging/visualization
        },
    )


def result_to_dict(result: PauseRatioResult) -> Dict[str, Any]:
    """Convenience helper to convert result dataclass to a JSON-friendly dict."""
    return asdict(result)


if __name__ == "__main__":
    import os
    print("✅ pause_ratio.py started")

    test_path = r"C:\Users\prana\Downloads\PerkinAI\backend\temp_sessions\ak.m4a"
    abs_path = os.path.abspath(test_path)

    print("Test path:", test_path)
    print("Absolute path:", abs_path)
    print("File exists?", os.path.exists(test_path))

    res = compute_pause_ratio(test_path, min_silence_len_ms=600, silence_offset_db=16.0)
    print("✅ Result:")
    print(result_to_dict(res))
