import json
import logging
import os
import pathlib
import sys

import librosa

# Add the backend root to sys.path so ml/ is importable
_BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from ml.parsel_parser import extract_uci16
from ml.predict import predict_from_dict
from services.audio_download import download_audio

log = logging.getLogger(__name__)

_MEANS_PATH = pathlib.Path(__file__).parent.parent / "dataset_mean_values.json"
with open(_MEANS_PATH) as _f:
    _DATASET_MEANS = json.load(_f)

# Approximate healthy reference maxima for normalising feature bar values
_FEATURE_REFS = {
    "MDVP:Jitter(%)":  {"label": "Jitter (pitch irregularity)",    "max": 0.03},
    "MDVP:Shimmer":    {"label": "Shimmer (amplitude instability)", "max": 0.15},
    "HNR":             {"label": "HNR (harmonics-to-noise ratio)",  "max": 30.0},
    "NHR":             {"label": "NHR (noise-to-harmonics ratio)",  "max": 0.3},
}


def _duration_ms(path: str) -> float:
    y, sr = librosa.load(path, sr=None, mono=True)
    return round(librosa.get_duration(y=y, sr=sr) * 1000, 1)


def _risk_bucket(score: int) -> str:
    if score < 30:
        return "LOW"
    if score < 60:
        return "MODERATE"
    return "HIGH"


def _build_feature_summary(features: dict) -> dict:
    summary = {}
    for key, meta in _FEATURE_REFS.items():
        val = features.get(key, 0.0)
        norm = min(1.0, val / meta["max"]) if meta["max"] else 0.0
        if norm < 0.5:
            status = "normal"
        elif norm < 0.85:
            status = "elevated"
        else:
            status = "high"
        summary[key] = {"label": meta["label"], "value": round(val, 5), "status": status}
    return summary


def run_vowel_pipeline(session_id: str, audio_url: str) -> dict:
    """
    Full Task 1 pipeline:
      download → extract 16 UCI features → fill 6 means → predict → return result dict
    """
    tmp_path = None
    try:
        tmp_path = download_audio(audio_url)
        duration = _duration_ms(tmp_path)
        log.info(f"[{session_id}] Vowel audio duration_ms={duration}")

        features_16 = extract_uci16(tmp_path)
        log.info(f"[{session_id}] Extracted 16 UCI features")

        features_22 = {**features_16, **_DATASET_MEANS}

        prediction = predict_from_dict(features_22)
        prob = prediction["probability_pd"]
        risk_score = round(prob * 100)
        bucket = _risk_bucket(risk_score)

        log.info(f"[{session_id}] ML result: prob={prob:.3f} score={risk_score} bucket={bucket}")

        return {
            "duration_ms": duration,
            "features_16": features_16,
            "features_22": features_22,
            "probability_pd": prob,
            "prediction": prediction["prediction"],
            "risk_score": risk_score,
            "risk_bucket": bucket,
            "feature_summary": _build_feature_summary(features_16),
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
