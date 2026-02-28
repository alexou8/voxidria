import parselmouth

def extract_features(audio_path: str) -> dict:
    snd = parselmouth.Sound(audio_path)
    point_process = parselmouth.praat.call(snd, "To PointProcess (periodic, cc)", 75, 500)

    # Corrected jitter call with 4 arguments
    jitter_local = parselmouth.praat.call(point_process, "Get jitter (local)", 0, 0.02, 0.03)

    # Corrected shimmer call (same arguments work)
    shimmer_local = parselmouth.praat.call([snd, point_process], "Get shimmer (local)", 0, 0.02, 0.03, 1.3)

    # PPE placeholder
    ppe = 0

    return {
        "Jitter(%)": jitter_local,
        "Shimmer": shimmer_local,
        "PPE": ppe
    }