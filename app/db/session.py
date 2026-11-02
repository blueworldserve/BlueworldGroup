from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core import config

engine = create_engine(
    config.DATABASE_URL,
    pool_pre_ping=True,      # test a pooled connection before use; replace ones the DB closed while idle
    pool_recycle=280,        # retire connections after ~5 min, before most hosts cut idle ones
    pool_size=5,
    max_overflow=10,
    pool_timeout=10,         # fail fast instead of hanging a visitor for 30s
    connect_args={"connect_timeout": 10},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)