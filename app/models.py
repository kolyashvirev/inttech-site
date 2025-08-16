from app.database import Base
from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy import Float, ForeignKey, LargeBinary, JSON
from sqlalchemy.orm import relationship
from werkzeug.security import generate_password_hash, check_password_hash

class Tour(Base):
	__tablename__ = 'tours'
	id = Column(Integer, primary_key=True)
	name = Column(String(50), nullable=False)
	description = Column(String(1000), nullable=False)
	country = Column(String(50), nullable=False)
	duration = Column(String(50), primary_key=False)
	old_price = Column(Integer, primary_key=False)
	price = Column(Integer, primary_key=False)
	photo = Column(LargeBinary)
	best = Column(Boolean)


class Book(Base):
	__tablename__ = "book"
	id = Column(Integer, primary_key=True, index=True, autoincrement=True)
	name = Column(String(100), nullable=False)
	phone = Column(String(21), nullable=False)
	message = Column(String(500), nullable=False)

class User(Base):
	__tablename__ = 'users'
	id = Column(Integer, primary_key=True)
	username = Column(String(50), unique=True, nullable=False)
	password_hash = Column(String(255), nullable=False)
