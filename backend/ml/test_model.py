import json
import logging
import os
import pathlib
import sys

_MEANS_PATH = pathlib.Path(__file__).parent.parent / "inference\\dataset_mean_values.json"
with open(_MEANS_PATH) as _f:
    _DATASET_MEANS = json.load(_f)


def _risk_bucket(score: int) -> str:
    if score < 30:
        return "LOW"
    if score < 60:
        return "MODERATE"
    return "HIGH"

def run_vowel_pipeline(features_dict: dict) -> dict:
    """
    Full Task 1 pipeline:
      download → extract 16 UCI features → fill 6 means → predict → return result dict
    """
    tmp_path = None
    try:
        features_22 = {**features_dict, **_DATASET_MEANS}

        prediction = predict_from_dict(features_22)
        prob = prediction["probability_pd"]
        risk_score = round(prob * 100)
        bucket = _risk_bucket(risk_score)

        print(f"ML result: prob={prob:.3f} score={risk_score} bucket={bucket}")

        return {
            "features_22": features_22,
            "probability_pd": prob,
            "prediction": prediction["prediction"],
            "risk_score": risk_score,
            "risk_bucket": bucket,
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

if __name__ == "__main__":
    import os
    from parsel_parser import extract_uci16
    from predict import predict_from_dict

    # Example audio file (replace with your own path)
    audio_file = "data/healthy_control.wav"
    audio_file2 = "data/PD_patient.wav"
    if not os.path.exists(audio_file):
        print(f"Audio file '{audio_file}' not found. Please provide a valid path.")
    else:
        features = extract_uci16(audio_file)
        print("Extracted features:", len(features))
        result = run_vowel_pipeline(features)
    
    print("\n" * 3)
    if not os.path.exists(audio_file2):
        print(f"Audio file '{audio_file2}' not found. Please provide a valid path.")
    else:
        features2 = extract_uci16(audio_file2)
        result2 = run_vowel_pipeline(features2)
        print("Prediction result:", result2)