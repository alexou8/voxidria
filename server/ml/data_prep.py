import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib

def load_and_prepare(csv_path="data/parkinsons.csv"):
    df = pd.read_csv(csv_path)

    # drop identifier
    df = df.drop(columns=["name"])

    X = df.drop(columns=["status"]).astype("float32")
    y = df["status"].astype("int32")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc = scaler.transform(X_test)

    joblib.dump(scaler, "artifacts/scaler.joblib")
    joblib.dump(list(X.columns), "artifacts/feature_names.joblib")

    return X_train_sc, X_test_sc, y_train.values, y_test.values