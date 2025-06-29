from database import Base  # Import Base explicitly to satisfy PyLance
from sqlalchemy import Column, String, Date, Time, Integer, ForeignKey
from sqlalchemy.orm import relationship
from passlib.context import CryptContext
from passlib.hash import bcrypt
from sqlalchemy import Column, DateTime
import datetime
from datetime import datetime

# Update the CryptContext configuration
pwd_context = CryptContext(
    schemes=["bcrypt", "pbkdf2_sha256"],  # bcrypt as primary, pbkdf2 as fallback
    deprecated="auto",
    bcrypt__rounds=12  # Explicitly set rounds for bcrypt
)

class Lecturer(Base):
    __tablename__ = "lecturer"

    lecturer_id = Column(String(20), primary_key=True, index=True)
    course_id = Column(String, ForeignKey("course.course_id")) 
    lecturer_name = Column(String(100), nullable=False)
    department_id = Column(String(20))
    hire_date = Column(Date)
    office_location = Column(String(50))
    phone_number = Column(String(20))

    timeslots = relationship("Timeslot", back_populates="lecturer")
class Course(Base):
    __tablename__ = "course"

    course_id = Column(String(20), primary_key=True, index=True)
    course_name = Column(String(100), nullable=False)
    course_code = Column(String(20))
    year = Column(Integer)
    semester = Column(String(20))
    no_of_students = Column(Integer)
    credit = Column(Integer)
    department_id = Column(String(20))
    timeslots = relationship("Timeslot", back_populates="course")

class Department(Base):
    __tablename__ = "department"

    department_id = Column(String(20), primary_key=True, index=True)
    department_name = Column(String(100), nullable=False)
    department_head = Column(String(100))
    building = Column(String(50))
    user_id = Column(String(200))

class Room(Base):
    __tablename__ = "room"

    room_id = Column(String(20), primary_key=True, index=True)
    room_name = Column(String(50))
    building = Column(String(50))
    capacity = Column(Integer)
    room_type = Column(String(30))
    timeslots = relationship("Timeslot", back_populates="room")

class Timeslot(Base):
    __tablename__ = 'timeslot'
    timeslot_id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(String(20), ForeignKey("course.course_id"), nullable=False)
    lecturer_id = Column(String(20), ForeignKey("lecturer.lecturer_id"), nullable=False)
    room_id = Column(String(20), ForeignKey("room.room_id"), nullable=False)
    course_name = Column(String(100), nullable=False)
    lecturer_name = Column(String(100), nullable=False)
    room_name = Column(String(100), nullable=False)
    day_of_the_week = Column(String)
    start_time = Column(Time)
    end_time = Column(Time)
    semester = Column(String(20))
    timetable_number = Column(Integer)
    year = Column(Integer)

    # Optional: Add relationships for easier querying
    course = relationship("Course", back_populates="timeslots")
    lecturer = relationship("Lecturer", back_populates="timeslots")
    room = relationship("Room", back_populates="timeslots")
    

class Constraint(Base):
    __tablename__ = "constraints"

    constraint_id = Column(String(20), primary_key=True, index=True)
    constraint_type = Column(String(50), nullable=False)
    constraint_value = Column(String(100), nullable=False)
    course_id = Column(String(20), ForeignKey("course.course_id"))
    lecturer_id = Column(String(20), ForeignKey("lecturer.lecturer_id"))
    room_id = Column(String(20), ForeignKey("room.room_id"))

class User(Base):
    __tablename__ = "users"

    user_id = Column(String(20), primary_key=True, index=True)
    department_id = Column(String(20), ForeignKey("department.department_id"), nullable=True)
    room_id = Column(String(20), ForeignKey("room.room_id"), nullable=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    email = Column(String(120), nullable=False, unique=True)
    role = Column(String(30))
    password = Column(String(100), nullable=False)
    phone_number = Column(String(20))
    address = Column(String(255))
    username = Column(String(50), unique=True, nullable=False)  # Added
    dob = Column(Date, nullable=True)  # Added
    student_id = Column(String(20), nullable=True)  # Added
    program = Column(String(100), nullable=True)  # Added
    year_of_study = Column(String(20), nullable=True)  # Added
    last_login = Column(DateTime, nullable=True)

    def verify_password(self, plain_password: str):
        try:
            return bcrypt.verify(plain_password, self.password)
        except Exception as e:
            print(f"Password verification failed: {str(e)}")
            return False

    @staticmethod
    def get_password_hash(password: str):
        return bcrypt.hash(password)
    
class Timetable(Base):
    __tablename__ = "timetables"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(String(70), ForeignKey("course.course_id"))
    lecturer_id = Column(String(70), ForeignKey('lecturer.lecturer_id'))
    room_id = Column(String(70), ForeignKey("room.room_id"))
    timeslot = Column(String(20))
    day = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)

