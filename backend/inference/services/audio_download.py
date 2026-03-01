import logging
import os
import tempfile

import requests

log = logging.getLogger(__name__)

_CONTENT_TYPE_TO_EXT = {
    "audio/webm": ".webm",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
}


def download_audio(audio_url: str) -> str:
    """
    Downloads a private Supabase Storage file using the service role key.
    Returns the path to a temp file. Caller must delete it when done.
    """
    service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
    }

    resp = requests.get(audio_url, headers=headers, timeout=30)
    resp.raise_for_status()

    content_type = resp.headers.get("content-type", "audio/webm").split(";")[0].strip()
    ext = _CONTENT_TYPE_TO_EXT.get(content_type, ".webm")

    tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    tmp.write(resp.content)
    tmp.close()

    log.info(f"Downloaded audio → {tmp.name} ({len(resp.content)} bytes, {content_type})")
    return tmp.name
