#!/usr/bin/env python3
"""
Parkinson's Disease Speech Detection – Standalone Test Script
=============================================================
Tests the trained ML model on two voice samples:
  • samples/healthy_control.wav  (expected: healthy)
  • samples/PD_patient.wav       (expected: Parkinson's disease)

Output:
  • 0–100 % Parkinson's confidence metre
  • Full 22-feature acoustic breakdown with per-feature health flags
  • Qualitative interpretation

Usage:
    cd ml/
    python test_pd_speech.py

Requirements:
    pip install -r requirements.txt
"""

import os
import sys
import warnings
import logging

warnings.filterwarnings("ignore")
logging.getLogger("absl").setLevel(logging.ERROR)

# Suppress TensorFlow verbose startup logs (must be set before import)
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(SCRIPT_DIR, "artifacts")
SAMPLES_DIR = os.path.join(SCRIPT_DIR, "samples")

# ─────────────────────────────────────────────────────────────────────────────
# Console colour helpers
# ─────────────────────────────────────────────────────────────────────────────
BOLD = "\033[1m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"
WIDTH = 64


def _c(text, colour):
    return f"{colour}{text}{RESET}"


# ─────────────────────────────────────────────────────────────────────────────
# Nonlinear / dynamical complexity feature helpers
# ─────────────────────────────────────────────────────────────────────────────

def _dfa(signal, min_box=4, n_scales=10):
    """Detrended Fluctuation Analysis – returns scaling exponent α.

    DFA quantifies long-range correlations in a time series.
    Healthy voices typically show α ≈ 0.5–0.9; PD voices often deviate.
    """
    N = len(signal)
    max_box = max(min_box + 1, N // 4)
    y = np.cumsum(signal - signal.mean())
    scales = np.unique(
        np.round(
            np.logspace(np.log10(min_box), np.log10(max_box), n_scales)
        ).astype(int)
    )
    flucts, valid_scales = [], []
    for n in scales:
        n_seg = N // n
        if n_seg < 1:
            continue
        rms_vals = []
        for k in range(n_seg):
            seg = y[k * n: (k + 1) * n]
            t = np.arange(n, dtype=float)
            trend = np.polyval(np.polyfit(t, seg, 1), t)
            rms_vals.append(np.sqrt(np.mean((seg - trend) ** 2)))
        flucts.append(np.mean(rms_vals))
        valid_scales.append(n)
    if len(flucts) < 2:
        return 0.7
    alpha = np.polyfit(
        np.log(valid_scales),
        np.log(np.array(flucts) + 1e-12),
        1,
    )[0]
    return float(np.clip(alpha, 0.3, 1.5))


def _ppe(f0_voiced):
    """Pitch Period Entropy – normalised Shannon entropy of log-F0 distribution.

    High PPE (> ~0.4) indicates irregular pitch control, a PD marker.
    """
    if len(f0_voiced) < 4:
        return 0.0
    lf = np.log(f0_voiced + 1e-10)
    lo, hi = lf.min(), lf.max()
    if hi == lo:
        return 0.0
    lf_norm = (lf - lo) / (hi - lo)
    counts, _ = np.histogram(lf_norm, bins=30, range=(0.0, 1.0))
    p = counts[counts > 0] / counts.sum()
    return float(np.clip(-np.sum(p * np.log(p)) / np.log(30), 0.0, 1.0))


def _rpde(signal, m=4, tau=1, epsilon=None, max_pts=2000):
    """Recurrence Period Density Entropy (simplified Chebyshev-distance version).

    Quantifies how far the voice signal deviates from a perfectly periodic orbit.
    Higher RPDE → more irregular / less periodic → higher PD risk.
    """
    x = signal[:max_pts]
    N = len(x)
    n = N - (m - 1) * tau
    if n < 10:
        return 0.5
    X = np.array([x[i: i + m * tau: tau] for i in range(n)])
    if epsilon is None:
        epsilon = 0.2 * X.std()
    if epsilon == 0:
        return 0.5
    periods = []
    for i in range(min(n, 200)):
        d = np.max(np.abs(X[i + 1:] - X[i]), axis=1)
        idx = np.where(d < epsilon)[0]
        if len(idx) > 1:
            periods.extend(np.diff(idx).tolist())
    if not periods:
        return 0.5
    T = np.array(periods, dtype=int)
    T_max = int(T.max())
    if T_max < 1:
        return 0.5
    cnt = np.bincount(T)[1: T_max + 1]
    p = cnt / (cnt.sum() + 1e-12)
    p = p[p > 0]
    return float(np.clip(-np.sum(p * np.log(p)) / np.log(T_max + 1), 0.0, 1.0))


def _d2(signal, m=4, tau=1, max_pts=1500):
    """Correlation Dimension D2 (Grassberger–Procaccia estimate).

    Measures the fractal complexity of the vocal signal.
    PD voices tend to show higher or more erratic D2.
    """
    from scipy.spatial.distance import pdist

    x = signal[:max_pts]
    N = len(x)
    n = N - (m - 1) * tau
    if n < 20:
        return 2.0
    X = np.array([x[i: i + m * tau: tau] for i in range(n)])
    n_samp = min(n, 300)
    idx = np.random.choice(n, n_samp, replace=False)
    dists = pdist(X[idx], "chebyshev")
    dists = dists[dists > 0]
    if len(dists) < 10:
        return 2.0
    r1, r2 = np.percentile(dists, 5), np.percentile(dists, 50)
    if r2 <= r1:
        return 2.0
    r_vals = np.logspace(np.log10(r1), np.log10(r2), 15)
    C = np.array([np.sum(dists < r) / len(dists) for r in r_vals])
    valid = C > 0
    if valid.sum() < 2:
        return 2.0
    d2 = np.polyfit(np.log(r_vals[valid]), np.log(C[valid]), 1)[0]
    return float(np.clip(d2, 0.5, 10.0))


def _spreads(f0_voiced):
    """spread1 and spread2 – nonlinear F0 variation measures.

    spread1 ≈ minimum deviation of log-F0 from the mean (negative).
    spread2 ≈ interquartile range of log-F0 distribution.
    """
    if len(f0_voiced) < 4:
        return 0.0, 0.0
    lf = np.log(f0_voiced + 1e-10)
    spread1 = float(lf.min() - lf.mean())
    spread2 = float(np.percentile(lf, 75) - np.percentile(lf, 25))
    return spread1, spread2


# ─────────────────────────────────────────────────────────────────────────────
# Acoustic feature extraction  (16 Praat features + 6 nonlinear = 22 total)
# ─────────────────────────────────────────────────────────────────────────────

def _safe_float(x, default=0.0):
    try:
        v = float(x)
        return default if (v != v or v == float("inf") or v == float("-inf")) else v
    except Exception:
        return float(default)


def extract_all_features(audio_path, f0min=50.0, f0max=600.0):
    """Return a dict of all 22 UCI voice biomarkers extracted from *audio_path*.

    16 acoustic features are computed via Praat (praat-parselmouth).
    6 nonlinear dynamical complexity features are computed via NumPy/SciPy.
    Also returns the voiced F0 time-series array for display purposes.
    """
    import parselmouth
    import librosa

    snd = parselmouth.Sound(audio_path)

    # ── Pitch ──────────────────────────────────────────────────────────────
    pitch_obj = parselmouth.praat.call(
        snd, "To Pitch (cc)",
        0.0, f0min, f0max,
        15, 0, 0.03, 0.45, 0.01, 0.35, 0.14,
    )
    voiced_count = parselmouth.praat.call(pitch_obj, "Count voiced frames")

    fo = fhi = flo = float("nan")
    if voiced_count > 0:
        fo = _safe_float(
            parselmouth.praat.call(pitch_obj, "Get mean", 0, 0, "Hertz"), float("nan")
        )
        fhi = _safe_float(
            parselmouth.praat.call(
                pitch_obj, "Get maximum", 0, 0, "Hertz", "Parabolic"
            ),
            float("nan"),
        )
        flo = _safe_float(
            parselmouth.praat.call(
                pitch_obj, "Get minimum", 0, 0, "Hertz", "Parabolic"
            ),
            float("nan"),
        )

    # Fall back to librosa pyin if Praat finds no voiced frames
    f0_array = pitch_obj.selected_array["frequency"]
    f0_voiced = f0_array[f0_array > 0]
    if len(f0_voiced) == 0:
        y_lb, sr_lb = librosa.load(audio_path, sr=16000, mono=True)
        f0_all, _, _ = librosa.pyin(y_lb, fmin=f0min, fmax=f0max, sr=sr_lb)
        f0_voiced = f0_all[~np.isnan(f0_all)]
        if len(f0_voiced) > 0:
            fo = float(np.mean(f0_voiced))
            fhi = float(np.max(f0_voiced))
            flo = float(np.min(f0_voiced))

    # ── PointProcess (for jitter / shimmer) ────────────────────────────────
    try:
        pp = parselmouth.praat.call(
            snd, "To PointProcess (periodic, cc)", f0min, f0max
        )
    except Exception:
        pp = None

    t1, t2 = 0.0, 0.0
    period_floor, period_ceiling, max_pf, max_af = 0.0001, 0.02, 1.3, 1.6

    jitter_local = jitter_abs = rap = ppq = ddp = 0.0
    if pp is not None:
        try:
            jitter_local = _safe_float(
                parselmouth.praat.call(
                    pp, "Get jitter (local)",
                    t1, t2, period_floor, period_ceiling, max_pf,
                )
            )
            jitter_abs = _safe_float(
                parselmouth.praat.call(
                    pp, "Get jitter (local, absolute)",
                    t1, t2, period_floor, period_ceiling, max_pf,
                )
            )
            rap = _safe_float(
                parselmouth.praat.call(
                    pp, "Get jitter (rap)",
                    t1, t2, period_floor, period_ceiling, max_pf,
                )
            )
            ppq = _safe_float(
                parselmouth.praat.call(
                    pp, "Get jitter (ppq5)",
                    t1, t2, period_floor, period_ceiling, max_pf,
                )
            )
            ddp = _safe_float(
                parselmouth.praat.call(
                    pp, "Get jitter (ddp)",
                    t1, t2, period_floor, period_ceiling, max_pf,
                )
            )
        except Exception:
            pass

    shimmer_local = shimmer_db = apq3 = apq5 = apq11 = dda = 0.0
    if pp is not None:
        try:
            shimmer_local = _safe_float(
                parselmouth.praat.call(
                    [snd, pp], "Get shimmer (local)",
                    t1, t2, period_floor, period_ceiling, max_pf, max_af,
                )
            )
            shimmer_db = _safe_float(
                parselmouth.praat.call(
                    [snd, pp], "Get shimmer (local_dB)",
                    t1, t2, period_floor, period_ceiling, max_pf, max_af,
                )
            )
            apq3 = _safe_float(
                parselmouth.praat.call(
                    [snd, pp], "Get shimmer (apq3)",
                    t1, t2, period_floor, period_ceiling, max_pf, max_af,
                )
            )
            apq5 = _safe_float(
                parselmouth.praat.call(
                    [snd, pp], "Get shimmer (apq5)",
                    t1, t2, period_floor, period_ceiling, max_pf, max_af,
                )
            )
            apq11 = _safe_float(
                parselmouth.praat.call(
                    [snd, pp], "Get shimmer (apq11)",
                    t1, t2, period_floor, period_ceiling, max_pf, max_af,
                )
            )
            dda = _safe_float(
                parselmouth.praat.call(
                    [snd, pp], "Get shimmer (dda)",
                    t1, t2, period_floor, period_ceiling, max_pf, max_af,
                )
            )
        except Exception:
            pass

    # ── HNR / NHR ──────────────────────────────────────────────────────────
    hnr = 0.0
    try:
        harmonicity = parselmouth.praat.call(
            snd, "To Harmonicity (cc)", 0.01, f0min, 0.1, 1.0
        )
        hnr = _safe_float(
            parselmouth.praat.call(harmonicity, "Get mean", 0, 0), 0.0
        )
    except Exception:
        pass
    nhr = (
        1.0 / (10 ** (hnr / 10.0))
        if hnr >= 0.1
        else 0.0
    )

    # ── Nonlinear features (computed on F0 time series, matching UCI approach) ──
    # F0 time series provides the signal used for DFA / RPDE / D2 in the
    # original Tsanas et al. dataset.  Fall back to raw audio only when the
    # voiced F0 array is too short.
    if len(f0_voiced) >= 32:
        nl_signal = f0_voiced.astype(np.float64)
    else:
        y_raw, _ = librosa.load(audio_path, sr=16000, mono=True)
        nl_signal = y_raw.astype(np.float64)

    spread1, spread2 = _spreads(f0_voiced)
    ppe = _ppe(f0_voiced)
    dfa = _dfa(nl_signal)
    rpde = _rpde(nl_signal)
    d2 = _d2(nl_signal)

    features = {
        # Pitch
        "MDVP:Fo(Hz)": _safe_float(fo, 0.0),
        "MDVP:Fhi(Hz)": _safe_float(fhi, 0.0),
        "MDVP:Flo(Hz)": _safe_float(flo, 0.0),
        # Jitter
        "MDVP:Jitter(%)": jitter_local,
        "MDVP:Jitter(Abs)": jitter_abs,
        "MDVP:RAP": rap,
        "MDVP:PPQ": ppq,
        "Jitter:DDP": ddp,
        # Shimmer
        "MDVP:Shimmer": shimmer_local,
        "MDVP:Shimmer(dB)": shimmer_db,
        "Shimmer:APQ3": apq3,
        "Shimmer:APQ5": apq5,
        "MDVP:APQ": apq11,
        "Shimmer:DDA": dda,
        # Noise
        "NHR": _safe_float(nhr, 0.0),
        "HNR": hnr,
        # Nonlinear
        "RPDE": rpde,
        "DFA": dfa,
        "spread1": spread1,
        "spread2": spread2,
        "D2": d2,
        "PPE": ppe,
    }
    return features, f0_voiced


# ─────────────────────────────────────────────────────────────────────────────
# Model prediction
# ─────────────────────────────────────────────────────────────────────────────

def predict_pd_probability(features_dict):
    """Load the trained model and return Parkinson's probability (0.0 – 1.0)."""
    import joblib
    from tensorflow import keras  # type: ignore

    model = keras.models.load_model(
        os.path.join(ARTIFACTS_DIR, "parkinsons_model.h5")
    )
    scaler = joblib.load(os.path.join(ARTIFACTS_DIR, "scaler.joblib"))
    feature_names = joblib.load(os.path.join(ARTIFACTS_DIR, "feature_names.joblib"))

    x = np.array(
        [[float(features_dict.get(f, 0.0)) for f in feature_names]],
        dtype=np.float32,
    )
    x_sc = scaler.transform(x)
    prob = float(model.predict(x_sc, verbose=0)[0][0])
    return prob


# ─────────────────────────────────────────────────────────────────────────────
# Display helpers
# ─────────────────────────────────────────────────────────────────────────────

def _confidence_bar(prob, bar_width=40):
    """Render an ASCII progress bar (green = healthy, red = PD)."""
    filled = int(round(prob * bar_width))
    bar = "█" * filled + "░" * (bar_width - filled)
    colour = RED if prob >= 0.5 else GREEN
    return f"{colour}{bar}{RESET}  {prob * 100:5.1f} %"


def _section(title):
    print("\n" + "─" * WIDTH)
    print(f"  {BOLD}{title}{RESET}")
    print("─" * WIDTH)


def _feature_row(name, value, unit="", hi_bad=True, norm_lo=None, norm_hi=None):
    """Print one feature with an optional ✓ / ↑ / ↓ flag."""
    flag = ""
    if norm_lo is not None and norm_hi is not None:
        if hi_bad:
            flag = _c(" ✓", GREEN) if value <= norm_hi else _c(" ↑ HIGH", RED)
        else:
            flag = _c(" ✓", GREEN) if value >= norm_lo else _c(" ↓ LOW", YELLOW)
    print(f"  {name:<26} {value:>10.5f}  {unit:<5}{flag}")


def _interpret(prob, label):
    pct = prob * 100
    if label == "healthy":
        if pct < 30:
            return _c("✔  LOW RISK  – vocal features within healthy range.", GREEN)
        if pct < 60:
            return _c("⚠  BORDERLINE – some vocal irregularities detected.", YELLOW)
        return _c("✗  HIGH RISK – model flagged significant vocal anomalies.", RED)
    else:  # pd
        if pct >= 60:
            return _c("✔  HIGH RISK – biomarkers consistent with Parkinson's.", RED)
        if pct >= 30:
            return _c("⚠  BORDERLINE – moderate vocal irregularities.", YELLOW)
        return _c("✗  LOW RISK  – model did not detect strong PD patterns.", GREEN)


# ─────────────────────────────────────────────────────────────────────────────
# Per-sample analysis
# ─────────────────────────────────────────────────────────────────────────────

def analyse_sample(audio_path, label):
    expected_str = "HEALTHY" if label == "healthy" else "Parkinson's (PD)"
    _section(f"File : {os.path.basename(audio_path)}")
    print(f"  Expected label : {BOLD}{expected_str}{RESET}\n")

    print("  Extracting vocal biomarkers …")
    try:
        features, f0_voiced = extract_all_features(audio_path)
    except Exception as exc:
        print(f"  {RED}Feature extraction failed: {exc}{RESET}")
        return

    print("  Running neural-network classifier …")
    try:
        prob = predict_pd_probability(features)
    except Exception as exc:
        print(f"  {RED}Prediction failed: {exc}{RESET}")
        return

    # ── Confidence metre ───────────────────────────────────────────────────
    _section("Parkinson's Confidence Metre")
    print(f"  {_confidence_bar(prob)}")
    verdict = "PARKINSON'S DETECTED" if prob >= 0.5 else "HEALTHY"
    v_colour = RED if prob >= 0.5 else GREEN
    print(
        f"\n  Verdict  : {_c(BOLD + verdict + RESET, v_colour)}"
        f"  ({prob * 100:.2f} % PD probability)"
    )
    print(f"  {_interpret(prob, label)}")

    # ── Acoustic insights ──────────────────────────────────────────────────
    _section("Acoustic Biomarker Breakdown")
    print(f"  {'Feature':<26} {'Value':>10}  {'Unit':<5}  Status\n")

    print(f"  {_c('── Pitch (fundamental frequency) ──', CYAN)}")
    _feature_row("MDVP:Fo(Hz)  [mean F0]",  features["MDVP:Fo(Hz)"],
                 "Hz",  hi_bad=False, norm_lo=85,   norm_hi=255)
    _feature_row("MDVP:Fhi(Hz) [max F0]",   features["MDVP:Fhi(Hz)"],   "Hz")
    _feature_row("MDVP:Flo(Hz) [min F0]",   features["MDVP:Flo(Hz)"],
                 "Hz",  hi_bad=False, norm_lo=50,   norm_hi=200)

    print(f"\n  {_c('── Jitter (period-to-period F0 variation) ──', CYAN)}")
    _feature_row("MDVP:Jitter(%)",           features["MDVP:Jitter(%)"],
                 "%",   norm_lo=0, norm_hi=0.008)
    _feature_row("MDVP:Jitter(Abs)",         features["MDVP:Jitter(Abs)"],
                 "s",   norm_lo=0, norm_hi=0.0001)
    _feature_row("MDVP:RAP",                 features["MDVP:RAP"],
                 "",    norm_lo=0, norm_hi=0.005)
    _feature_row("MDVP:PPQ",                 features["MDVP:PPQ"],
                 "",    norm_lo=0, norm_hi=0.005)
    _feature_row("Jitter:DDP",               features["Jitter:DDP"],
                 "",    norm_lo=0, norm_hi=0.015)

    print(f"\n  {_c('── Shimmer (amplitude variation) ──', CYAN)}")
    _feature_row("MDVP:Shimmer",             features["MDVP:Shimmer"],
                 "",    norm_lo=0, norm_hi=0.060)
    _feature_row("MDVP:Shimmer(dB)",         features["MDVP:Shimmer(dB)"],
                 "dB",  norm_lo=0, norm_hi=0.600)
    _feature_row("Shimmer:APQ3",             features["Shimmer:APQ3"],
                 "",    norm_lo=0, norm_hi=0.040)
    _feature_row("Shimmer:APQ5",             features["Shimmer:APQ5"],
                 "",    norm_lo=0, norm_hi=0.050)
    _feature_row("MDVP:APQ",                 features["MDVP:APQ"],
                 "",    norm_lo=0, norm_hi=0.050)
    _feature_row("Shimmer:DDA",              features["Shimmer:DDA"],
                 "",    norm_lo=0, norm_hi=0.120)

    print(f"\n  {_c('── Noise / Harmonics ──', CYAN)}")
    _feature_row("HNR  [higher = healthier]", features["HNR"],
                 "dB",  hi_bad=False, norm_lo=20, norm_hi=9999)
    _feature_row("NHR  [lower = healthier]",  features["NHR"],
                 "",    norm_lo=0, norm_hi=0.030)

    print(f"\n  {_c('── Nonlinear Dynamical Complexity ──', CYAN)}")
    _feature_row("RPDE",                     features["RPDE"],
                 "",    norm_lo=0, norm_hi=0.650)
    _feature_row("DFA (α)",                  features["DFA"],
                 "",    hi_bad=False, norm_lo=0.50, norm_hi=0.95)
    _feature_row("spread1",                  features["spread1"],
                 "",    hi_bad=False, norm_lo=-6.5, norm_hi=-0.1)
    _feature_row("spread2",                  features["spread2"],
                 "",    norm_lo=0, norm_hi=0.50)
    _feature_row("D2",                       features["D2"],
                 "",    norm_lo=0, norm_hi=4.0)
    _feature_row("PPE",                      features["PPE"],
                 "",    norm_lo=0, norm_hi=0.40)

    # ── Live F0 statistics ────────────────────────────────────────────────
    if len(f0_voiced) > 0:
        print(f"\n  {_c('── F0 Time-Series Statistics ──', CYAN)}")
        cov = float(np.std(f0_voiced) / (np.mean(f0_voiced) + 1e-10))
        _feature_row("Mean F0 (live)",       float(np.mean(f0_voiced)), "Hz")
        _feature_row("Std-dev F0",           float(np.std(f0_voiced)),  "Hz")
        _feature_row("CoV F0",               cov,                       "")
        print(f"  {'Voiced frames':<26} {len(f0_voiced):>10d}")

    print()


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

SAMPLES = [
    ("healthy_control.wav", "healthy"),
    ("PD_patient.wav", "pd"),
]


def main():
    print("=" * WIDTH)
    print(
        f"  {BOLD}{CYAN}PARKINSON'S DISEASE SPEECH DETECTION – TEST SUITE{RESET}"
    )
    print(f"  Model  : 3-layer neural network (TensorFlow/Keras)")
    print(f"  Input  : 22 vocal biomarkers extracted via Praat + NumPy/SciPy")
    print(f"  Output : 0 – 100 % Parkinson's confidence per voice sample")
    print("=" * WIDTH)

    if not os.path.isdir(ARTIFACTS_DIR):
        print(f"\n{RED}ERROR: artifacts/ directory not found at {ARTIFACTS_DIR}{RESET}")
        print("Run this script from the ml/ directory or ensure artifacts are present.")
        sys.exit(1)

    found = 0
    for filename, label in SAMPLES:
        audio_path = os.path.join(SAMPLES_DIR, filename)
        if not os.path.isfile(audio_path):
            print(f"\n  {YELLOW}[SKIP] File not found: {audio_path}{RESET}")
            continue
        found += 1
        analyse_sample(audio_path, label)

    if found == 0:
        print(f"\n{RED}No audio samples found in {SAMPLES_DIR}{RESET}")
        print("Place healthy_control.wav and PD_patient.wav in the samples/ directory.")
        sys.exit(1)

    print("=" * WIDTH)
    print(
        f"  {BOLD}DISCLAIMER:{RESET} This tool is for research purposes only."
    )
    print("  It is NOT a certified medical diagnostic device.")
    print("=" * WIDTH)


if __name__ == "__main__":
    main()
