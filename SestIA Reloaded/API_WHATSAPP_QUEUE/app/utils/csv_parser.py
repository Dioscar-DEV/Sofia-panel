"""
Utilidades para parsear archivos CSV con Pandas
"""
import pandas as pd
import io
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


async def parse_csv(file_content: bytes) -> List[Dict]:
    """
    Parsea un archivo CSV y retorna una lista de diccionarios.

    Args:
        file_content: Contenido del archivo CSV en bytes

    Returns:
        Lista de diccionarios con los datos del CSV

    Raises:
        ValueError: Si el CSV no contiene las columnas requeridas o está mal formado
    """
    try:
        # Leer CSV
        df = pd.read_csv(io.BytesIO(file_content))

        # Validar que no esté vacío
        if df.empty:
            raise ValueError("El archivo CSV está vacío")

        # Validar columnas obligatorias
        required = ["numero"]
        missing_cols = [col for col in required if col not in df.columns]
        if missing_cols:
            raise ValueError(f"CSV debe contener las columnas: {', '.join(missing_cols)}")

        logger.info(f"CSV parseado exitosamente: {len(df)} filas, columnas: {list(df.columns)}")

        # Normalizar estatus_servicio a minúsculas si existe
        if "estatus_servicio" in df.columns:
            df["estatus_servicio"] = df["estatus_servicio"].astype(str).str.lower()

        # Convertir números a string (eliminar .0 de floats)
        if "numero" in df.columns:
            df["numero"] = df["numero"].astype(str).str.replace('.0', '', regex=False)

        # Convertir a lista de diccionarios
        messages = df.to_dict(orient="records")

        # Limpiar NaN (reemplazar por None)
        for msg in messages:
            for key, value in msg.items():
                if pd.isna(value) or value == 'nan' or value == 'None':
                    msg[key] = None
                elif isinstance(value, str):
                    # Limpiar espacios en blanco
                    msg[key] = value.strip()

        return messages

    except pd.errors.EmptyDataError:
        raise ValueError("El archivo CSV está vacío o mal formado")
    except pd.errors.ParserError as e:
        raise ValueError(f"Error al parsear CSV: {str(e)}")
    except Exception as e:
        logger.error(f"Error al parsear CSV: {str(e)}")
        raise ValueError(f"Error al procesar CSV: {str(e)}")


def validate_csv_size(file_size: int, max_size_mb: int = 50) -> bool:
    """
    Valida que el tamaño del archivo no exceda el límite.

    Args:
        file_size: Tamaño del archivo en bytes
        max_size_mb: Tamaño máximo permitido en MB

    Returns:
        True si es válido, False si no

    Raises:
        ValueError: Si el archivo excede el tamaño máximo
    """
    max_size_bytes = max_size_mb * 1024 * 1024
    if file_size > max_size_bytes:
        raise ValueError(f"El archivo excede el tamaño máximo permitido de {max_size_mb} MB")
    return True
