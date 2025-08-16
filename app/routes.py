from fastapi import APIRouter, Depends, Form, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth import chech_access
from app.database import get_db
from app.controllers import tours, best, photo, book, login_controller, create_user_controller, get_bookings, create_tour_controller, get_tour_controller, delete_tour_controller, update_tour_controller
from app.schemas import BookMsg, LoginData, TourCreate
from typing import Optional
router = APIRouter()

@router.get("/tours")
async def get_tours(db: AsyncSession = Depends(get_db)):
    return await tours(db)  # Добавлен await

@router.get("/best")
async def get_best(db: AsyncSession = Depends(get_db)):
    return await best(db)  # Добавлен await

@router.post("/book")
async def book_tour(data: BookMsg, db: AsyncSession = Depends(get_db)):
    await book(data, db)
    return {"message": "Бронирование принято!", "data": data}

@router.get("/tours/{tour_id}/photo")
async def get_tour_photo(tour_id: int, db: AsyncSession = Depends(get_db)):
    result = await photo(tour_id, db)
    return result

@router.post("/login")
async def login(data: LoginData, db: AsyncSession = Depends(get_db)):
    return await login_controller(data, db)

@router.post("/create_user")
async def create_user(data: LoginData, db: AsyncSession = Depends(get_db)):
    return await create_user_controller(data, db)
    

@router.get("/bookings")
async def get_all_bookings(db: AsyncSession = Depends(get_db), username: str = Depends(chech_access)):
    return await get_bookings(db)

from fastapi import Form, File, UploadFile
@router.post("/tours", dependencies=[Depends(chech_access)])
async def create_tour(
    name: str = Form(...),
    description: str = Form(...),
    country: str = Form(...),
    duration: str = Form(...),
    old_price: Optional[int] = Form(None),
    price: int = Form(...),
    best: bool = Form(False),
    photo: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    username: str = Depends(chech_access)
):
    data = TourCreate(
        name=name,
        description=description,
        country=country,
        duration=duration,
        old_price=old_price,
        price=price,
        best=best
    )
    return await create_tour_controller(data, photo, db)

@router.get("/tours/{tour_id}")
async def get_tour(tour_id: int, db: AsyncSession = Depends(get_db)):
    return await get_tour_controller(tour_id, db)

@router.delete("/tours/{tour_id}", dependencies=[Depends(chech_access)])
async def delete_tour(tour_id: int, db: AsyncSession = Depends(get_db)):
    return await delete_tour_controller(tour_id, db)

@router.put("/tours/{tour_id}", dependencies=[Depends(chech_access)])
async def update_tour(
    tour_id: int,
    name: str = Form(...),
    description: str = Form(...),
    country: str = Form(...),
    duration: str = Form(...),
    old_price: Optional[int] = Form(None),
    price: int = Form(...),
    best: bool = Form(False),
    photo: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    username: str = Depends(chech_access)
):
    data = TourCreate(
        name=name,
        description=description,
        country=country,
        duration=duration,
        old_price=old_price,
        price=price,
        best=best
    )
    return await update_tour_controller(tour_id, data, photo, db)
