# Parkinson's Disease Speech Detection – ML Test Module

Standalone test suite for the Parkinson's Disease speech-analysis ML model.
This folder is **completely independent** of the `backend/` and `frontend/`
application code and can be run on any machine that has the dependencies installed.

---

## Directory Structure

```
ml/
├── test_pd_speech.py     # Main test script (entry point)
├── requirements.txt      # Python dependencies
├── README.md             # This file
├── artifacts/            # Trained model files
│   ├── parkinsons_model.h5      # TensorFlow/Keras neural network
│   ├── scaler.joblib            # StandardScaler for feature normalisation
│   └── feature_names.joblib    # Ordered list of the 22 feature names
└── samples/              # Voice recordings used for testing
    ├── healthy_control.wav      # Healthy speaker (expected: no PD)
    └── PD_patient.wav           # Parkinson's patient (expected: PD)
```

---

## Quick Start

```bash
# 1. Navigate to this directory
cd ml/

# 2. (Recommended) Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate      # Linux / macOS
# .venv\Scripts\activate       # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the test
python test_pd_speech.py
```

---

## What the Script Does

1. **Loads** each audio sample from `samples/`.
2. **Extracts 22 vocal biomarkers** using Praat (via `praat-parselmouth`) and
   NumPy/SciPy:
   - **Pitch (3)** – mean, max, min fundamental frequency (F0)
   - **Jitter (5)** – period-to-period F0 variation (MDVP:Jitter, RAP, PPQ, DDP)
   - **Shimmer (6)** – amplitude variation (MDVP:Shimmer, APQ3/5/11, DDA)
   - **Noise/Harmonics (2)** – HNR and NHR
   - **Nonlinear dynamics (6)** – RPDE, DFA (α), spread1, spread2, D2, PPE
3. **Feeds the features** into the trained Keras neural network.
4. **Displays**:
   - A **0–100 % confidence metre** (green = healthy, red = PD)
   - A pass/fail verdict
   - A **per-feature breakdown** with normal-range flags

---

## Model Details

| Property | Value |
|---|---|
| Architecture | 3-layer feedforward neural network |
| Layers | Input(22) → Dense(64, ReLU) → Dense(32, ReLU) → Dense(1, Sigmoid) |
| Training dataset | UCI Parkinson's Dataset (196 voice samples) |
| Output | Sigmoid probability – 0 = healthy, 1 = Parkinson's |

---

## Feature Reference

| Feature | Description | Healthy range |
|---|---|---|
| MDVP:Fo(Hz) | Mean fundamental frequency | 85–255 Hz (male ~85–180 Hz; female ~165–255 Hz) |
| MDVP:Jitter(%) | Local jitter (period variation) | < 0.8 % |
| MDVP:Shimmer | Local shimmer (amplitude variation) | < 0.06 |
| HNR | Harmonics-to-noise ratio | > 20 dB |
| NHR | Noise-to-harmonics ratio | < 0.03 |
| RPDE | Recurrence period density entropy | < 0.65 |
| DFA (α) | Detrended fluctuation analysis exponent | 0.5–0.95 |
| PPE | Pitch period entropy | < 0.40 |

---

## Important Notes

- The **nonlinear features** (RPDE, DFA, spread1, spread2, D2, PPE) are
  computed with simplified algorithms and may differ slightly from the exact
  values in the UCI training dataset.  The acoustic features (jitter, shimmer,
  HNR) are computed with full Praat accuracy.
- This tool is for **research and demonstration purposes only**.
  It is **not** a certified medical diagnostic device.
- Audio should be a sustained vowel (e.g. "ahh") of at least 1–3 seconds for
  best results.
