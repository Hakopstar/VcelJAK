from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from gevent import getcurrent

import os


"""
    engine_clientmodifier - object with psycopg engine

"""
engine_clientmodifier = create_engine(
    f"postgresql+psycopg://client_modifier:{os.getenv('POSTGRES_USERS_ACCESS_PASS')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/clients_system",
    pool_pre_ping=True,
    echo=False,
    future=True,
    isolation_level="READ COMMITTED"
)

session_clientmodifier = scoped_session(sessionmaker(bind=engine_clientmodifier), scopefunc=getcurrent)