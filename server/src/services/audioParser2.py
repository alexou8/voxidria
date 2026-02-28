# src/services/audioParser.py
import librosa
import numpy as np

import soundfile as sf

MIN_DURATION = 0.5  # seconds

def extract_features(audio_path: str) -> dict:
    """
    Extract features similar to Jitter, Shimmer, PPE using Librosa.
    Returns a dictionary of numerical values, safe for sustained tones.
    """
    # Load audio, convert to mono and resample to 16 kHz
    # y, sr = librosa.load(audio_path, sr=16000, mono=True)
    y, sr = librosa.load("data/example3.wav", sr=16000, mono=True, backend='soundfile')
    print("Loaded", len(y), "samples at", sr, "Hz")
    duration = librosa.get_duration(y=y, sr=sr)

    if duration < MIN_DURATION:
        print(f"Warning: audio too short ({duration:.2f}s). Minimum recommended is {MIN_DURATION}s.")

    # -------------------
    # Pitch (F0) for Jitter
    # -------------------
    try:
        # pyin returns F0 per frame; voiced frames are numbers, unvoiced are NaN
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y, fmin=50, fmax=700, sr=sr
        )
        # Keep only voiced frames
        f0 = f0[~np.isnan(f0)]
        if len(f0) < 2:
            jitter_local = 0
        else:
            # Jitter: mean absolute difference between consecutive periods / mean period
            periods = 1 / f0
            jitter_local = np.mean(np.abs(np.diff(periods))) / np.mean(periods)
    except Exception as e:
        print("Warning: Jitter calculation failed:", e)
        jitter_local = 0

    # -------------------
    # Amplitude envelope for Shimmer
    # -------------------
    try:
        hop_length = 512
        frame_length = 1024
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
        if len(rms) < 2:
            shimmer_local = 0
        else:
            shimmer_local = np.mean(np.abs(np.diff(rms))) / np.mean(rms)
    except Exception as e:
        print("Warning: Shimmer calculation failed:", e)
        shimmer_local = 0

    # -------------------
    # PPE placeholder
    # -------------------
    ppe = 0

    return {
        "Jitter(%)": float(jitter_local),
        "Shimmer": float(shimmer_local),
        "PPE": float(ppe)
    }


# -------------------
# Quick test
# -------------------
if __name__ == "__main__":

    data, sr = sf.read("data/example3.wav")
    print("Loaded", len(data), "samples at", sr, "Hz")
    test_file = "data/example3.wav"  # adjust path
    features = extract_features(test_file)
    print("Extracted features:", features)