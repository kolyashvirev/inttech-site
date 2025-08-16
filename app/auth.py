from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Cookie
from app.config import config
from fastapi.security import OAuth2PasswordBearer
# from .config import logger
from typing import Optional
from app.database import get_db
from app.models import User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

def create_access_token(data: dict):
	to_encode = data.copy()
	
	# Время истечения токена (из конфигурации)
	expire = datetime.utcnow() + timedelta(minutes=config.JWT_EXPIRE_MINUTES)
	
	to_encode.update({"exp": expire})
	
	# Создаем токен с использованием секретного ключа и алгоритма из конфигурации
	encoded_jwt = jwt.encode(to_encode, config.JWT_SECRET_KEY, algorithm=config.JWT_ALGORITHM)
	return encoded_jwt

async def get_token(
    token_header: Optional[str] = Depends(oauth2_scheme),  # Optional для заголовка
    token_cookie: Optional[str] = Cookie(None, alias="token"),
):
    # logger.info("Checking token...")  # Логируем начало проверки
    if token_header:
        # logger.info(f"Token header: {token_header}")  # Логируем токен из заголовка
        return token_header
    if token_cookie:
        # logger.info(f"Token cookie: {token_cookie}")  # Логируем токен из куки
        return token_cookie
    # logger.info("No token provided")  # Логируем отсутствие токена
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )

async def chech_access(
    token: str = Depends(get_token),
    db: AsyncSession = Depends(get_db) # Список допустимых ролей
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Декодируем токен и получаем username
        payload = jwt.decode(token, config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar()

    if not user:
        raise HTTPException(status_code=403, detail="Access denied")
    return username

