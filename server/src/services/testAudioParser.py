from src.services.audioParser import extract_features

# Path to a WAV audio file for testing
audio_file = "data/example.wav"  # replace with your own file

features = extract_features(audio_file)

print("Extracted features:")
for k, v in features.items():
    print(f"{k}: {v}")