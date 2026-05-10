"""Herramienta de agente para registrar resultados de una prueba aplicada.

Cuando el docente sube un Excel/CSV con notas individuales por estudiante,
el agente lo lee desde el contexto del chat (las planillas ya llegan como
texto en el último mensaje del usuario), calcula los agregados y llama a
`registrar_resultados_prueba`. Una sola llamada deja el material listo
para mostrarse en la columna de Resultados del plan anual.
"""

from __future__ import annotations

from datetime import datetime, timezone

from langchain_core.tools import tool

from app.db import SessionLocal
from app.models import Material


@tool
def registrar_resultados_prueba(
    material_id: int,
    n_alumnos: int,
    promedio: float,
    pct_aprobados: float,
) -> dict:
    """Guarda los resultados agregados de una prueba ya aplicada.

    Úsalo cuando el docente sube una planilla (Excel/CSV) con notas
    individuales: calcula los agregados desde la planilla y llámame con
    ellos. El material debe existir y ser de tipo prueba.

    Args:
        material_id: id del material (kind='prueba') al que pertenece la
            prueba aplicada. Lo encuentras llamando a `listar_plan` y
            mirando el campo `material` de cada fila.
        n_alumnos: cantidad de estudiantes evaluados (filas con nota
            válida).
        promedio: promedio simple de las notas (escala 1.0 a 7.0,
            redondea a un decimal).
        pct_aprobados: porcentaje de notas mayores o iguales a 4.0,
            entre 0 y 100 (redondea a un decimal).
    """
    if not (0.0 <= pct_aprobados <= 100.0):
        return {"error": "pct_aprobados fuera de rango (0–100)."}
    if not (1.0 <= promedio <= 7.0):
        return {"error": "promedio fuera de rango (1.0–7.0)."}
    if n_alumnos <= 0:
        return {"error": "n_alumnos debe ser positivo."}

    with SessionLocal() as db:
        material = db.get(Material, material_id)
        if material is None:
            return {"error": f"Material {material_id} no existe."}
        if material.kind != "prueba":
            return {
                "error": (
                    f"Material {material_id} es de tipo '{material.kind}', "
                    "no 'prueba'. Solo las pruebas registran resultados."
                )
            }

        material.n_alumnos = int(n_alumnos)
        material.promedio = round(float(promedio), 1)
        material.pct_aprobados = round(float(pct_aprobados), 1)
        material.resultados_uploaded_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(material)
        return {
            "ok": True,
            "material_id": material.id,
            "n_alumnos": material.n_alumnos,
            "promedio": material.promedio,
            "pct_aprobados": material.pct_aprobados,
        }


RESULTADOS_TOOLS = [registrar_resultados_prueba]
