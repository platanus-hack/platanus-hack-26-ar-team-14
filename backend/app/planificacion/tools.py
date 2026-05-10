"""Herramientas de planificación de calendario para Matemática 5° básico.

Dos herramientas, intencionalmente acotadas:

- `clases_en_mes`          cuenta clases M/Mi/V en un mes calendario.
- `clases_restantes_mes`   cuenta clases M/Mi/V desde una fecha hasta fin de mes.

Supuesto canónico: la asignatura tiene 3 clases por semana, agendadas lunes,
miércoles y viernes. Es una heurística — los colegios reales varían. No se
descuentan feriados ni interrupciones.
"""

from __future__ import annotations

import calendar
from datetime import date

from langchain_core.tools import tool

CLASS_WEEKDAYS = (0, 2, 4)


def _validar_mes(mes: int) -> None:
    if not 1 <= mes <= 12:
        raise ValueError(f"Mes inválido: {mes}. Debe estar entre 1 y 12.")


def _parsear_fecha(fecha: str) -> date:
    try:
        return date.fromisoformat(fecha)
    except ValueError as exc:
        raise ValueError(
            f"Fecha inválida: {fecha!r}. Debe estar en formato YYYY-MM-DD."
        ) from exc


def _fechas_clase(year: int, mes: int, desde_dia: int = 1) -> list[date]:
    _, ultimo_dia = calendar.monthrange(year, mes)
    return [
        date(year, mes, d)
        for d in range(desde_dia, ultimo_dia + 1)
        if date(year, mes, d).weekday() in CLASS_WEEKDAYS
    ]


@tool
def clases_en_mes(year: int, mes: int) -> dict:
    """Cuenta las clases de Matemática 5° básico en un mes calendario.

    Supuesto: 3 clases por semana, agendadas lunes, miércoles y viernes.
    Es una heurística — los colegios reales varían. No se descuentan
    feriados ni interrupciones; el agente debe mencionarle este supuesto
    al usuario.

    Args:
        year: año, ej. 2026.
        mes: número de mes 1..12.

    Devuelve total de clases y el listado de fechas en formato YYYY-MM-DD.
    """
    _validar_mes(mes)
    fechas = _fechas_clase(year, mes)
    return {
        "year": year,
        "mes": mes,
        "total_clases": len(fechas),
        "fechas": [f.isoformat() for f in fechas],
    }


@tool
def clases_restantes_mes(fecha: str | None = None) -> dict:
    """Cuenta las clases de Matemática 5° básico que quedan en el mes,
    desde la fecha indicada (inclusive) hasta el último día del mismo mes.

    Supuesto: 3 clases por semana, agendadas lunes, miércoles y viernes.
    Es una heurística — los colegios reales varían. No se descuentan
    feriados ni interrupciones; el agente debe mencionarle este supuesto
    al usuario.

    Args:
        fecha: fecha de referencia en formato YYYY-MM-DD. Si es None,
            se usa la fecha de hoy.

    Devuelve la fecha de referencia, año, mes, número de clases restantes
    y el listado de fechas en formato YYYY-MM-DD.
    """
    referencia = _parsear_fecha(fecha) if fecha is not None else date.today()
    fechas = _fechas_clase(referencia.year, referencia.month, desde_dia=referencia.day)
    return {
        "fecha_referencia": referencia.isoformat(),
        "year": referencia.year,
        "mes": referencia.month,
        "clases_restantes": len(fechas),
        "fechas": [f.isoformat() for f in fechas],
    }
