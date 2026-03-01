import json
import sys
from pathlib import Path

# Allow running as a script: python backend/task_2/analyze_all_files.py
if __package__ is None or __package__ == "":
    backend_root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(backend_root))

from task_2.services.audio_io import analyze_audio_file

# ---- CHANGE THIS TO THE FILE YOU WANT ----
AUDIO_FILE = Path("ml/data/northwind_HC.WAV")   # change filename here
LANGUAGE = "en"
LABEL = "healthy_control"
# ------------------------------------------


def main():
    result = analyze_audio_file(
        AUDIO_FILE,
        language_code=LANGUAGE,
        label=LABEL,
    )

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
