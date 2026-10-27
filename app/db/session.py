import asyncpg
from fastapi import Depends, HTTPException, Header
import os

DATABASE_URL = os.getenv("DATABASE_URL")

async def get_db_with_rls(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization Header")

    token = authorization.split(" ")[1]
    # Decode your JWT here to get the user_id (sub claim)
    # user_id = decode_jwt_sub(token)

    conn = await asyncpg.connect(DATABASE_URL)
    async with conn.transaction():
        # Set the JWT claim context so Postgres RLS policies evaluate auth.uid() correctly
        await conn.execute("SET LOCAL request.jwt.claim.sub = $1;", str(user_id))
        yield conn
    await conn.close()