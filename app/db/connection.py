import time
from collections.abc import AsyncIterator

from sqlalchemy import event, exc
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

connect_args = {}
if ":6543" in settings.database_url or "pooler.supabase.com" in settings.database_url:
    connect_args["statement_cache_size"] = 0

engine = create_async_engine(
    settings.database_url,
    echo=settings.db_echo,
    pool_size=settings.db_pool_min_size,
    max_overflow=settings.db_pool_max_size - settings.db_pool_min_size,
    pool_recycle=240,
    pool_use_lifo=True,
    connect_args=connect_args,
)

# Supabase's pooler (and flaky networks) silently drop idle sockets, which made the
# first request after a quiet period fail with "connection was closed in the middle
# of operation". pool_pre_ping would fix that but costs a full round trip on every
# checkout, so only ping connections that have sat idle long enough to be suspect.
_IDLE_PING_AFTER_SECONDS = 30


@event.listens_for(engine.sync_engine, "checkin")
def _record_checkin_time(dbapi_connection, connection_record):
    connection_record.info["checked_in_at"] = time.monotonic()


@event.listens_for(engine.sync_engine, "checkout")
def _ping_if_idle(dbapi_connection, connection_record, connection_proxy):
    checked_in_at = connection_record.info.get("checked_in_at")
    if checked_in_at is None or time.monotonic() - checked_in_at < _IDLE_PING_AFTER_SECONDS:
        return
    try:
        engine.dialect.do_ping(dbapi_connection)
    except Exception as error:
        # Tells the pool to discard this connection and retry with a fresh one.
        raise exc.DisconnectionError() from error


AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession | None]:
    if settings.storage_backend != "database":
        yield None
        return

    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
