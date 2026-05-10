"""Upload helpers shared by HTTP handlers."""

from fastapi import HTTPException, UploadFile, status


async def read_upload_bytes(
    file: UploadFile,
    *,
    max_bytes: int,
    empty_detail: str,
    too_large_detail: str,
) -> bytes:
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=too_large_detail,
        )
    if not data:
        raise HTTPException(status_code=400, detail=empty_detail)
    return data
