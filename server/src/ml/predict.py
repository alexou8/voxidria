import numpy as np
import joblib
from tensorflow import keras
from pathlib import Path

MODEL_PATH = "ml/artifacts/parkinsons_model.h5"
SCALER_PATH = "ml/artifacts/scaler.joblib"
FEATURES_PATH = "ml/artifacts/feature_names.joblib"

model = keras.models.load_model(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)
feature_names = joblib.load(FEATURES_PATH)

def predict_from_dict(features: dict) -> dict:
    # ensure correct order + all features present
    x = np.array([[float(features[f]) for f in feature_names]], dtype=np.float32)
    x_sc = scaler.transform(x)

    prob = float(model.predict(x_sc, verbose=0)[0][0])
    return {
        "probability_pd": prob,
        "prediction": 1 if prob >= 0.5 else 0
    }

if __name__ == "__main__":
    # quick test with dummy numbers (replace with real ones later)
    dummy = {f: 0.0 for f in feature_names}
    print(predict_from_dict(dummy))