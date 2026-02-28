import parselmouth
import numpy as np

def _safe_float(x, default=0.0):
    try:
        if x is None:
            return float(default)
        x = float(x)
        if np.isnan(x) or np.isinf(x):
            return float(default)
        return x
    except Exception:
        return float(default)

def extract_uci16(audio_path: str, f0min: float = 75, f0max: float = 500) -> dict:
    snd = parselmouth.Sound(audio_path)

    # -------------------
    # Pitch stats (Fo, Fhi, Flo)
    # -------------------
    try:
        pitch = parselmouth.praat.call(
    snd,
    "To Pitch (cc)",
    0.0,
    50,     # lower floor
    600     # higher ceiling
)
        n_voiced = parselmouth.praat.call(pitch, "Count voiced frames")
        print("Voiced frames:", n_voiced)
        fo = parselmouth.praat.call(pitch, "Get mean", 0, 0, "Hertz")
        fhi = parselmouth.praat.call(pitch, "Get maximum", 0, 0, "Hertz", "Parabolic")
        flo = parselmouth.praat.call(pitch, "Get minimum", 0, 0, "Hertz", "Parabolic")
    except Exception:
        fo, fhi, flo = 0.0, 0.0, 0.0

    # -------------------
    # PointProcess for jitter/shimmer
    # -------------------
    try:
        pp = parselmouth.praat.call(snd, "To PointProcess (periodic, cc)", f0min, f0max)
    except Exception:
        pp = None

    # Praat standard-ish parameters (robust defaults)
    t1, t2 = 0.0, 0.0
    period_floor = 0.0001     # 0.1 ms
    period_ceiling = 0.02     # 20 ms
    max_period_factor = 1.3
    max_amp_factor = 1.6

    # -------------------
    # Jitter family
    # -------------------
    jitter_local = jitter_abs = rap = ppq = ddp = 0.0
    if pp is not None:
        try:
            jitter_local = parselmouth.praat.call(pp, "Get jitter (local)", t1, t2, period_floor, period_ceiling, max_period_factor)
            jitter_abs   = parselmouth.praat.call(pp, "Get jitter (local, absolute)", t1, t2, period_floor, period_ceiling, max_period_factor)
            rap          = parselmouth.praat.call(pp, "Get jitter (rap)", t1, t2, period_floor, period_ceiling, max_period_factor)
            ppq          = parselmouth.praat.call(pp, "Get jitter (ppq5)", t1, t2, period_floor, period_ceiling, max_period_factor)
            ddp          = parselmouth.praat.call(pp, "Get jitter (ddp)", t1, t2, period_floor, period_ceiling, max_period_factor)
        except Exception:
            pass

    # -------------------
    # Shimmer family (needs [sound, pointprocess])
    # -------------------
    shimmer_local = shimmer_db = apq3 = apq5 = apq11 = dda = 0.0
    if pp is not None:
        try:
            shimmer_local = parselmouth.praat.call([snd, pp], "Get shimmer (local)", t1, t2, period_floor, period_ceiling, max_period_factor, max_amp_factor)
            shimmer_db    = parselmouth.praat.call([snd, pp], "Get shimmer (local_dB)", t1, t2, period_floor, period_ceiling, max_period_factor, max_amp_factor)
            apq3          = parselmouth.praat.call([snd, pp], "Get shimmer (apq3)", t1, t2, period_floor, period_ceiling, max_period_factor, max_amp_factor)
            apq5          = parselmouth.praat.call([snd, pp], "Get shimmer (apq5)", t1, t2, period_floor, period_ceiling, max_period_factor, max_amp_factor)
            apq11         = parselmouth.praat.call([snd, pp], "Get shimmer (apq11)", t1, t2, period_floor, period_ceiling, max_period_factor, max_amp_factor)
            dda           = parselmouth.praat.call([snd, pp], "Get shimmer (dda)", t1, t2, period_floor, period_ceiling, max_period_factor, max_amp_factor)
        except Exception:
            pass

    # -------------------
    # Harmonicity -> HNR (Praat gives HNR directly)
    # NHR is available in Praat for some workflows, but not always exposed consistently.
    # We'll return HNR accurately; NHR as a safe derived proxy for MVP unless you want a stricter Praat-based NHR.
    # -------------------
    hnr = 0.0
    try:
        harmonicity = parselmouth.praat.call(snd, "To Harmonicity (cc)", 0.01, f0min, 0.1, 1.0)
        hnr = parselmouth.praat.call(harmonicity, "Get mean", 0, 0)
    except Exception:
        pass

    # Proxy NHR from HNR (not perfect, but stable). If you want “true Praat NHR”, tell me and I’ll implement it.
    nhr = 0.0
    try:
        hnr_val = _safe_float(hnr, 0.0)
        nhr = 1.0 / (10 ** (hnr_val / 10.0)) if hnr_val > 0 else 0.0
    except Exception:
        nhr = 0.0

    return {
        # Pitch
        "MDVP:Fo(Hz)": _safe_float(fo),
        "MDVP:Fhi(Hz)": _safe_float(fhi),
        "MDVP:Flo(Hz)": _safe_float(flo),

        # Jitter
        "MDVP:Jitter(%)": _safe_float(jitter_local),
        "MDVP:Jitter(Abs)": _safe_float(jitter_abs),
        "MDVP:RAP": _safe_float(rap),
        "MDVP:PPQ": _safe_float(ppq),
        "Jitter:DDP": _safe_float(ddp),

        # Shimmer
        "MDVP:Shimmer": _safe_float(shimmer_local),
        "MDVP:Shimmer(dB)": _safe_float(shimmer_db),
        "Shimmer:APQ3": _safe_float(apq3),
        "Shimmer:APQ5": _safe_float(apq5),
        "MDVP:APQ": _safe_float(apq11),   # UCI uses MDVP:APQ; Praat often provides apq11
        "Shimmer:DDA": _safe_float(dda),

        # Noise
        "NHR": _safe_float(nhr),
        "HNR": _safe_float(hnr),
    }


# Quick test
if __name__ == "__main__":
    feats = extract_uci16("server/data/healthy_control.wav")  # adjust path
    for k in sorted(feats.keys()):
        print(f"{k:16s} = {feats[k]}")