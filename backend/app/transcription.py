"""Speech-to-text via OpenRouter's /audio/transcriptions endpoint."""

import base64

import httpx

from app.config import settings

_FORMAT_BY_CONTENT_TYPE = {
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/flac": "flac",
}

_VALID_FORMATS = {"wav", "mp3", "m4a", "aac", "ogg", "webm", "flac"}


def _resolve_format(filename: str | None, content_type: str | None) -> str:
    if content_type:
        # Trim codec suffix like "audio/webm;codecs=opus"
        ct = content_type.split(";", 1)[0].strip().lower()
        if ct in _FORMAT_BY_CONTENT_TYPE:
            return _FORMAT_BY_CONTENT_TYPE[ct]
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[1].lower()
        if ext in _VALID_FORMATS:
            return ext
    return "webm"


async def transcribe_audio(
    *, audio_bytes: bytes, filename: str | None, content_type: str | None
) -> str:
    """Send audio to OpenRouter STT and return the transcribed text."""
    fmt = _resolve_format(filename, content_type)
    payload = {
        "model": settings.stt_model,
        "input_audio": {
            "data": base64.b64encode(audio_bytes).decode("ascii"),
            "format": fmt,
        },
        "language": settings.stt_language,
    }
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key.get_secret_value()}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.embed_base_url}/audio/transcriptions",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
    text = data.get("text", "")
    if not isinstance(text, str):
        raise ValueError(f"Unexpected STT response: {data!r}")
    return text
