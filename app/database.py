from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import config
import asyncio

Base = declarative_base()

engine = create_async_engine(config.DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def wait_for_db():
    import sqlalchemy
    retries = 10
    for i in range(retries):
        try:
            async with engine.begin() as conn:
                await conn.execute(sqlalchemy.text("SELECT 1"))
            print("✅ Database is ready!")
            return
        except Exception as e:
            print(f"⏳ Waiting for database... ({i+1}/{retries}) Error: {e}")
            await asyncio.sleep(3)
    raise RuntimeError("❌ Database connection failed after retries")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

