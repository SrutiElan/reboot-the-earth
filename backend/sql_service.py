"""Shared, bounded SQL executor for the console and AI assistant."""

import math
from datetime import date, datetime, time
from decimal import Decimal
from time import perf_counter
from typing import Any
from uuid import UUID

import sqlglot
from sqlglot import exp
from sqlalchemy.exc import SQLAlchemyError

try:
    from .db import engine
except ImportError:
    from db import engine

MAX_ROWS = 1000
ALLOWED_TABLES = {"ofo_trees", "ofo_plots", "ofo_drone_missions", "catalog_datasets"}


class QueryError(ValueError):
    pass


def json_value(value: Any) -> Any:
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, (Decimal, UUID)):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value).hex()
    if isinstance(value, dict):
        return {str(k): json_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_value(v) for v in value]
    return str(value)


def validate_sql(sql: str) -> str:
    if not sql.strip() or len(sql) > 20000:
        raise QueryError("Enter a SQL query of at most 20,000 characters.")
    try:
        statements = [s for s in sqlglot.parse(sql, read="postgres") if s is not None]
    except sqlglot.errors.ParseError as exc:
        raise QueryError(f"Invalid PostgreSQL query: {exc}") from exc
    if len(statements) != 1 or not isinstance(statements[0], (exp.Select, exp.Union, exp.Intersect, exp.Except)):
        raise QueryError("Only one read-only SELECT or WITH query is allowed.")
    tree = statements[0]
    forbidden = (exp.Insert, exp.Update, exp.Delete, exp.Create, exp.Drop, exp.Alter,
                 exp.Command, exp.Into, exp.Lock, exp.Transaction, exp.Copy)
    if any(isinstance(node, forbidden) for node in tree.walk()):
        raise QueryError("Write and administrative operations are not allowed.")
    ctes = {cte.alias_or_name.lower() for cte in tree.find_all(exp.CTE)}
    for table in tree.find_all(exp.Table):
        if table.catalog or table.db not in ("", "public") or table.name.lower() not in ALLOWED_TABLES | ctes:
            raise QueryError(f"Table {table.name} is not available. Use the OFO tables or catalog_datasets.")
    for fn in tree.find_all(exp.Func):
        name = (fn.name if isinstance(fn, exp.Anonymous) else fn.sql_name()).lower()
        if name.startswith(("pg_", "dblink", "lo_")) or name in {"set_config", "query_to_xml", "xpath", "xmltable"}:
            raise QueryError(f"Function {name} is not available in read-only queries.")
    return tree.sql(dialect="postgres").rstrip(";")


def execute_query(sql: str, max_rows: int = MAX_ROWS) -> dict:
    normalized = validate_sql(sql)
    started = perf_counter()
    try:
        with engine.connect() as connection, connection.begin():
            connection.exec_driver_sql("SET TRANSACTION READ ONLY")
            connection.exec_driver_sql("SET LOCAL ROLE ofo_reader")
            connection.exec_driver_sql("SET LOCAL statement_timeout = '5000ms'")
            connection.exec_driver_sql("SET LOCAL lock_timeout = '1000ms'")
            result = connection.exec_driver_sql(
                f"SELECT * FROM ({normalized}) AS user_query LIMIT {max_rows + 1}"
            )
            # Preserve duplicate column names without overwriting cells.
            columns: list[str] = []
            for name in result.keys():
                unique, suffix = name, 2
                while unique in columns:
                    unique, suffix = f"{name}_{suffix}", suffix + 1
                columns.append(unique)
            raw = result.fetchmany(max_rows + 1)
    except SQLAlchemyError as exc:
        detail = str(exc.orig or exc).splitlines()[0][:600]
        raise QueryError(detail) from exc
    return {
        "columns": columns,
        "rows": [dict(zip(columns, (json_value(v) for v in row))) for row in raw[:max_rows]],
        "row_count": min(len(raw), max_rows),
        "truncated": len(raw) > max_rows,
        "elapsed_ms": round((perf_counter() - started) * 1000, 2),
    }
