if __name__ == "__main__":
    import os
    from parsel_parser import extract_uci16
    from predict import predict_from_dict

    # Example audio file (replace with your own path)
    audio_file = "data/healthy_control.wav"
    audio_file2 = "data/PD_patient.wav"
    if not os.path.exists(audio_file):
        print(f"Audio file '{audio_file}' not found. Please provide a valid path.")
    else:
        features = extract_uci16(audio_file)
        print("Extracted features:", len(features))
        result = predict_from_dict(features)
    if not os.path.exists(audio_file2):
        print(f"Audio file '{audio_file2}' not found. Please provide a valid path.")
    else:
        features2 = extract_uci16(audio_file2)
        result2 = predict_from_dict(features2)
        print("Prediction result:", result2)