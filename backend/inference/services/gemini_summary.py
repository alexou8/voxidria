import logging
import os

import requests

log = logging.getLogger(__name__)


def generate_summary(
    probability_pd: float,
    risk_score: int,
    risk_bucket: str,
    reading_biomarkers: dict,
) -> str:
    """
    Calls Gemini to produce a plain-language clinical summary of the full session.
    Returns the explanation as a plain text string.
    """
    api_key = os.environ["GEMINI_API_KEY"]
    model = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")

    pause_ratio = reading_biomarkers.get("pause_ratio", "N/A")
    pitch_std = reading_biomarkers.get("pitch_std_hz", "N/A")
    loudness_cv = reading_biomarkers.get("loudness_cv", "N/A")
    speech_rate = reading_biomarkers.get("speech_rate_wpm", "N/A")

    prompt = f"""You are a clinical speech analysis assistant generating a screening summary for a Parkinson's disease screening tool.

The user completed two voice tasks. Here are the results:

**ML Risk Score:** {risk_score}/100 ({risk_bucket} risk)
**Estimated PD Probability:** {probability_pd:.2f}

**Reading Task Biomarkers:**
- Pause Ratio: {pause_ratio} (proportion of silence in speech; higher = more pausing)
- Pitch Variability (std dev): {pitch_std} Hz (lower = more monotone, a PD indicator)
- Loudness Variability (CV): {loudness_cv} (lower = more flat volume, a PD indicator)
- Speech Rate: {speech_rate} WPM (lower = slower speech, can indicate motor difficulty)

Write a neutral, professional 3–4 paragraph plain-language explanation for the user. Structure it as follows:

**Paragraph 1:** Explain what the risk score means in plain terms. Do not claim it is a diagnosis.
**Paragraph 2:** Interpret the pause ratio and speech rate results.
**Paragraph 3:** Interpret the pitch and loudness variability results.
**Paragraph 4:** Recommend next steps and remind the user this is a screening tool only, not a medical diagnosis.

Use **bold** for key terms. Do not use bullet points. Do not use medical jargon. Be empathetic and factual."""

    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1024,
            },
        },
        timeout=30,
    )
    resp.raise_for_status()

    data = resp.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return text.strip()
