import json
from pathlib import Path

from services.speech_rate import compute_speech_rate_with_elevenlabs, speech_rate_result_to_dict


FILES = [
    ("northwind_healthy_en.wav", "en"),
    ("northwind_pd_en.wav", "en"),
    ("hindi_demo.wav", "hi"),
    ("telugu_demo.wav", "te"),
    ("mandarin_demo.wav", "zh"),
    ("cantonese_demo.wav", "yue"),
]


def main() -> None:
    base_dir = Path(__file__).resolve().parent
    data_dir = base_dir / "data"

    for filename, lang in FILES:
        audio_path = data_dir / filename
        if not audio_path.exists():
            print(f"[warn] Missing file: {audio_path}")
            continue

        try:
            result = compute_speech_rate_with_elevenlabs(
                str(audio_path),
                language_code=lang,
            )
            payload = speech_rate_result_to_dict(result)
            payload["file"] = filename
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        except Exception as exc:
            print(f"[error] {filename}: {exc}")


if __name__ == "__main__":
    main()
