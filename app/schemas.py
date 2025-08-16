from pydantic import BaseModel
from typing import Optional

class BookMsg(BaseModel):
	name: str
	phone : str
	message : str

class LoginData(BaseModel):
    username: str
    password: str

class TourCreate(BaseModel):
    name: str
    description: str
    country: str
    duration: str
    old_price: Optional[int] = None
    price: int
    best: bool = False
