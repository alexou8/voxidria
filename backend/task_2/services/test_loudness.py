print("RUNNING:", __file__)

import os
from .loudness_variance import extract_loudness_variance, as_json

AUDIO = r"C:\Users\prana\Downloads\PerkinAI\backend\temp_sessions\parkin_patient.wav"

print("CWD:", os.getcwd())
print("Exists?", os.path.exists(AUDIO))
print("Path:", AUDIO)

res = extract_loudness_variance(AUDIO)
print("DONE")
print(as_json(res))
