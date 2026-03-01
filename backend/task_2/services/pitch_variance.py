from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any, Optional
import numpy as np

try:
    import parselmouth
except ImportError as e:
    raise ImportError(
        "Missing dependency: praat-parselmouth. Install with `pip install praat-parselmouth`"
    ) from e


@dataclass
class PitchVarianceResult:
    pitch_mean_hz: float
    pitch_std_hz: float          # <-- use this as pitchVariance
    pitch_var_hz2: float
    voiced_ratio: float
    frames_total: int
    frames_voiced: int
    f0_min_hz: float
    f0_max_hz: float

def extract_pitch_variance(audio_path: str, time_step: float = 0.01, f0_floor: float = 75.0, f0_ceiling: float = 500.0):
    ...
def as_json(result):
    ...


def extract_pitch_variance(
    audio_path: str,
    time_step: float = 0.01,     # 10 ms
    f0_floor: float = 75.0,      # typical adult speech
    f0_ceiling: float = 500.0,
) -> PitchVarianceResult:
    """
    Extract pitch statistics from voiced frames only.
    Uses Praat via parselmouth for robust pitch tracking.
    """
    snd = parselmouth.Sound(audio_path)

    pitch = snd.to_pitch(time_step=time_step, pitch_floor=f0_floor, pitch_ceiling=f0_ceiling)

    f0 = pitch.selected_array["frequency"]  # Hz; unvoiced frames are 0
    frames_total = int(len(f0))
    voiced = f0[f0 > 0.0]
    frames_voiced = int(len(voiced))

    if frames_total == 0 or frames_voiced == 0:
        # No pitch detected (could be silent, noisy, or very short)
        return PitchVarianceResult(
            pitch_mean_hz=0.0,
            pitch_std_hz=0.0,
            pitch_var_hz2=0.0,
            voiced_ratio=0.0,
            frames_total=frames_total,
            frames_voiced=frames_voiced,
            f0_min_hz=0.0,
            f0_max_hz=0.0,
        )

    pitch_mean = float(np.mean(voiced))
    pitch_std = float(np.std(voiced, ddof=0))
    pitch_var = float(np.var(voiced, ddof=0))
    voiced_ratio = float(frames_voiced / frames_total)

    return PitchVarianceResult(
        pitch_mean_hz=pitch_mean,
        pitch_std_hz=pitch_std,
        pitch_var_hz2=pitch_var,
        voiced_ratio=voiced_ratio,
        frames_total=frames_total,
        frames_voiced=frames_voiced,
        f0_min_hz=float(np.min(voiced)),
        f0_max_hz=float(np.max(voiced)),
    )


def as_json(result: PitchVarianceResult) -> Dict[str, Any]:
    """
    JSON-safe dict. Frontend can use `pitch_std_hz` as pitchVariance.
    """
    return {
        "pitch_mean_hz": result.pitch_mean_hz,
        "pitch_std_hz": result.pitch_std_hz,
        "pitch_var_hz2": result.pitch_var_hz2,
        "voiced_ratio": result.voiced_ratio,
        "frames_total": result.frames_total,
        "frames_voiced": result.frames_voiced,
        "f0_min_hz": result.f0_min_hz,
        "f0_max_hz": result.f0_max_hz,
    }
