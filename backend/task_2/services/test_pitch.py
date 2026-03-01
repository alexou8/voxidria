print("RUNNING:", __file__)
import os
from .pitch_variance import extract_pitch_variance, as_json

AUDIO = r"C:\Users\prana\Downloads\PerkinAI\backend\temp_sessions\parkin_patient.wav"

print("Exists?", os.path.exists(AUDIO))
res = extract_pitch_variance(AUDIO)
print(as_json(res))
