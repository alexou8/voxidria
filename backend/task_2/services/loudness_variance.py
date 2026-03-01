from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any
import numpy as np
from pydub import AudioSegment


@dataclass
class LoudnessVarianceResult:
    rms_mean: float
    rms_std: float              # <-- use this as loudnessVariance
    rms_var: float
    frames_total: int
    frames_used: int
    clipped_ratio: float        # quality check


def extract_loudness_variance(
    audio_path: str,
    frame_ms: int = 50,                 # 50ms frames is a good default
    silence_rms_threshold: float = 200.0,  # skip ultra-quiet frames (int16-ish scale)
) -> LoudnessVarianceResult:
    """
    Computes RMS variability over frames. Returns stats on non-silent frames.
    """
    audio = AudioSegment.from_file(audio_path).set_channels(1)

    samples = np.array(audio.get_array_of_samples()).astype(np.float32)

    # Normalize to [-1, 1] based on sample width (e.g., 16-bit)
    max_val = float(1 << (8 * audio.sample_width - 1))
    x = samples / max_val

    sr = audio.frame_rate
    frame_len = int(sr * (frame_ms / 1000.0))
    frame_len = max(frame_len, 1)

    frames_total = int(np.ceil(len(x) / frame_len))

    rms_list = []
    clipped_frames = 0

    for i in range(frames_total):
        start = i * frame_len
        end = min((i + 1) * frame_len, len(x))
        frame = x[start:end]
        if frame.size == 0:
            continue

        rms = float(np.sqrt(np.mean(frame * frame)))

        # Convert RMS to int16-ish magnitude for thresholding
        if rms * 32768.0 < silence_rms_threshold:
            continue

        rms_list.append(rms)

        # Simple clipping detection: >1% samples near full scale
        if float(np.mean(np.abs(frame) > 0.98)) > 0.01:
            clipped_frames += 1

    frames_used = len(rms_list)

    if frames_used == 0:
        return LoudnessVarianceResult(
            rms_mean=0.0,
            rms_std=0.0,
            rms_var=0.0,
            frames_total=frames_total,
            frames_used=0,
            clipped_ratio=0.0,
        )

    rms_arr = np.array(rms_list, dtype=np.float32)
    rms_mean = float(np.mean(rms_arr))
    rms_std = float(np.std(rms_arr, ddof=0))   # <-- loudnessVariance
    rms_var = float(np.var(rms_arr, ddof=0))
    clipped_ratio = float(clipped_frames / frames_used)

    return LoudnessVarianceResult(
        rms_mean=rms_mean,
        rms_std=rms_std,
        rms_var=rms_var,
        frames_total=frames_total,
        frames_used=frames_used,
        clipped_ratio=clipped_ratio,
    )


def as_json(result: LoudnessVarianceResult) -> Dict[str, Any]:
    return {
        "rms_mean": result.rms_mean,
        "rms_std": result.rms_std,
        "rms_var": result.rms_var,
        "frames_total": result.frames_total,
        "frames_used": result.frames_used,
        "clipped_ratio": result.clipped_ratio,
    }
