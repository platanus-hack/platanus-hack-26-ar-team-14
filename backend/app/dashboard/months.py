"""Mapping between Spanish month names (free-text from `PlanAnualItem.mes`)
and 1-12 month numbers."""

import unicodedata

SPANISH_MONTHS_TITLE: list[str] = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
]

_MONTH_TO_NUMBER: dict[str, int] = {
    unicodedata.normalize("NFKD", name)
    .encode("ascii", "ignore")
    .decode("ascii")
    .lower(): idx + 1
    for idx, name in enumerate(SPANISH_MONTHS_TITLE)
}


def month_number(mes: str | None) -> int | None:
    """Return 1-12 for a Spanish month name, or None if it doesn't parse.

    Accent-insensitive and case-insensitive. Trims whitespace.
    """
    if not mes:
        return None
    key = (
        unicodedata.normalize("NFKD", mes.strip())
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    return _MONTH_TO_NUMBER.get(key)


def month_title(n: int) -> str:
    """Return the Spanish title-case name for a 1-12 month number."""
    return SPANISH_MONTHS_TITLE[n - 1]
