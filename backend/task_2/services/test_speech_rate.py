from .speech_rate import compute_speech_rate_with_elevenlabs, speech_rate_result_to_dict

if __name__ == "__main__":
    # Run from backend root:
    # python -m task_2.services.test_speech_rate
    audio_path = "temp_sessions/ak.m4a"  # your real speech file
    result = compute_speech_rate_with_elevenlabs(audio_path)
    print(speech_rate_result_to_dict(result))
