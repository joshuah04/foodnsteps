# Database engine and session factory
# DATABASE_URL picks the database: SQLite by default, PostgreSQL when deployed
import os
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


def normalize_url(url: str) -> str:
    # hosts like Render hand out postgres:// urls, SQLAlchemy wants the psycopg driver name
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DATABASE_URL = normalize_url(os.environ.get("DATABASE_URL", "sqlite:///./foodnsteps.db"))

# SQLite needs this flag because FastAPI may use the connection from another thread
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    # one database session per request, always closed afterwards
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
