from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models import Tour, Book, User
from app.schemas import BookMsg, LoginData, TourCreate
from werkzeug.security import check_password_hash, generate_password_hash
from app.auth import create_access_token
from fastapi import HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from io import BytesIO


async def tours(db: AsyncSession):
    result = await db.execute(select(Tour))
    tours_list = result.scalars().all()
    # Преобразуем объекты в словари (без поля photo)
    return [
        {
            "id": t.id,
            "title": t.name,
            "description": t.description,
            "place": t.country,
            "duration": str(t.duration),
            "priceOld": t.old_price,
            "price": t.price,
            "img": f"/tours/{t.id}/photo"
        }
        for t in tours_list
    ]

async def best(db: AsyncSession):
    result = await db.execute(select(Tour).where(Tour.best == True))
    best_list = result.scalars().all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "country": t.country,
            "duration": t.duration,
            "old_price": t.old_price,
            "price": t.price,
            "img": f"/tours/{t.id}/photo"
        }
        for t in best_list
    ]

async def book(data: BookMsg, db: AsyncSession):
    new_booking = Book(
        name=data.name,
        phone=data.phone,
        message=data.message
    )
    db.add(new_booking)
    await db.commit()


async def photo(id: int, db: AsyncSession):
    result = await db.execute(select(Tour).where(Tour.id == id))
    tour = result.scalar()
    if not tour or not tour.photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return StreamingResponse(BytesIO(tour.photo), media_type="image/jpeg")

async def login_controller(data: LoginData, db: AsyncSession):
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar()
    if not user or not check_password_hash(user.password_hash, data.password):
        raise HTTPException(status_code=401, detail="Неверные учетные данные")
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

async def create_user_controller(data: LoginData, db: AsyncSession):
    result = await db.execute(select(User))
    existing_users = result.scalars().first()
    if existing_users:
        raise HTTPException(status_code=403, detail="Пользователи уже существуют")

    new_user = User(
        username=data.username,
        password_hash=generate_password_hash(data.password)
    )
    db.add(new_user)
    await db.commit()
    return {"message": "Пользователь создан"}

async def get_bookings(db: AsyncSession):
    result = await db.execute(select(Book))
    bookings = result.scalars().all()
    return [{"id": b.id, "name": b.name, "phone": b.phone, "message": b.message} for b in bookings]

async def create_tour_controller(data: TourCreate, photo: UploadFile, db: AsyncSession):
    photo_bytes = await photo.read() if photo else None
    new_tour = Tour(
        name=data.name,
        description=data.description,
        country=data.country,
        duration=data.duration,
        old_price=data.old_price,
        price=data.price,
        best=data.best,
        photo=photo_bytes
    )
    db.add(new_tour)
    await db.commit()
    await db.refresh(new_tour)
    return {"id": new_tour.id, "message": "Тур создан"}

# Получить один тур по ID
async def get_tour_controller(tour_id: int, db: AsyncSession):
    result = await db.execute(select(Tour).where(Tour.id == tour_id))
    tour = result.scalar()
    if not tour:
        raise HTTPException(status_code=404, detail="Тур не найден")
    return {
        "id": tour.id,
        "name": tour.name,
        "description": tour.description,
        "country": tour.country,
        "duration": tour.duration,
        "old_price": tour.old_price,
        "price": tour.price,
        "best": tour.best,
        "img": f"/tours/{tour.id}/photo"
    }

# Удаление тура
async def delete_tour_controller(tour_id: int, db: AsyncSession):
    result = await db.execute(select(Tour).where(Tour.id == tour_id))
    tour = result.scalar()
    if not tour:
        raise HTTPException(status_code=404, detail="Тур не найден")
    await db.delete(tour)
    await db.commit()
    return {"message": f"Тур {tour_id} удалён"}

async def update_tour_controller(tour_id: int, data: TourCreate, photo: UploadFile, db: AsyncSession):
    result = await db.execute(select(Tour).where(Tour.id == tour_id))
    tour = result.scalar()
    if not tour:
        raise HTTPException(status_code=404, detail="Тур не найден")

    # Обновляем поля
    tour.name = data.name
    tour.description = data.description
    tour.country = data.country
    tour.duration = data.duration
    tour.old_price = data.old_price
    tour.price = data.price
    tour.best = data.best

    # Обновляем фото только если реально пришёл файл
    if photo is not None and photo.filename:  # filename будет пустым, если файл не загружали
        tour.photo = await photo.read()

    await db.commit()
    await db.refresh(tour)
    return {"message": f"Тур {tour_id} обновлён"}
