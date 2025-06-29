import re
from sqlalchemy.orm import Session
import logging
from sqlalchemy.sql import func
from typing import Optional, List
from models import User as UserModel
from pydantic import ValidationError
from fastapi import HTTPException
from repositories import (
    LecturerRepository, 
    CourseRepository,
    DepartmentRepository,
    RoomRepository,
    TimeslotRepository,
    ConstraintRepository,
    UserRepository
)
from models import (
    Lecturer, 
    Course,
    Department,
    Room,
    Timeslot,
    Constraint,
    User
)
from schemas import (
    LecturerCreate, LecturerUpdate,
    CourseCreate, CourseUpdate,
    DepartmentCreate, DepartmentUpdate,
    RoomCreate, RoomUpdate,
    TimeslotCreate, TimeslotUpdate,
    ConstraintCreate, ConstraintUpdate,
    UserCreate, UserUpdate
)
from sqlalchemy.orm import Session
from datetime import datetime
class LecturerService:
    def __init__(self, lecturer_repository: LecturerRepository):
        self.repository = lecturer_repository

    def create_lecturer(self, lecturer: LecturerCreate) -> Lecturer:
        return self.repository.create(lecturer.model_dump())

    def get_lecturer(self, lecturer_id: str) -> Optional[Lecturer]:
        return self.repository.get(lecturer_id)

    def get_all_lecturers(self, skip: int = 0, limit: int = 100) -> List[Lecturer]:
        return self.repository.get_all(skip, limit)

    def update_lecturer(self, lecturer_id: str, lecturer: LecturerUpdate) -> Optional[Lecturer]:
        db_lecturer = self.repository.get(lecturer_id)
        if not db_lecturer:
            return None
        return self.repository.update(db_lecturer, lecturer.model_dump(exclude_unset=True))

    def delete_lecturer(self, lecturer_id: str) -> bool:
        lecturer = self.repository.get(lecturer_id)
        if not lecturer:
            return False
        self.repository.delete(lecturer_id)
        return True

class CourseService:
    def __init__(self, course_repository: CourseRepository):
        self.repository = course_repository

    def create_course(self, course: CourseCreate) -> Course:
        return self.repository.create(course.model_dump())

    def get_course(self, course_id: str) -> Optional[Course]:
        return self.repository.get(course_id)

    def get_all_courses(self, skip: int = 0, limit: int = 100) -> List[Course]:
        return self.repository.get_all(skip, limit)

    def update_course(self, course_id: str, course: CourseUpdate) -> Optional[Course]:
        db_course = self.repository.get(course_id)
        if not db_course:
            return None
        return self.repository.update(db_course, course.model_dump(exclude_unset=True))

    def delete_course(self, course_id: str) -> bool:
        course = self.repository.get(course_id)
        if not course:
            return False
        self.repository.delete(course_id)
        return True

class DepartmentService:
    def __init__(self, department_repository: DepartmentRepository):
        self.repository = department_repository

    def create_department(self, department: DepartmentCreate) -> Department:
        return self.repository.create(department.model_dump())

    def get_department(self, department_id: str) -> Optional[Department]:
        return self.repository.get(department_id)

    def get_all_departments(self, skip: int = 0, limit: int = 100) -> List[Department]:
        return self.repository.get_all(skip, limit)

    def update_department(self, department_id: str, department: DepartmentUpdate) -> Optional[Department]:
        db_department = self.repository.get(department_id)
        if not db_department:
            return None
        return self.repository.update(db_department, department.model_dump(exclude_unset=True))

    def delete_department(self, department_id: str) -> bool:
        department = self.repository.get(department_id)
        if not department:
            return False
        self.repository.delete(department_id)
        return True

class RoomService:
    def __init__(self, room_repository: RoomRepository):
        self.repository = room_repository

    def create_room(self, room: RoomCreate) -> Room:
        return self.repository.create(room.model_dump())

    def get_room(self, room_id: str) -> Optional[Room]:
        return self.repository.get(room_id)

    def get_all_rooms(self, skip: int = 0, limit: int = 100) -> List[Room]:
        return self.repository.get_all(skip, limit)

    def update_room(self, room_id: str, room: RoomUpdate) -> Optional[Room]:
        db_room = self.repository.get(room_id)
        if not db_room:
            return None
        return self.repository.update(db_room, room.model_dump(exclude_unset=True))

    def delete_room(self, room_id: str) -> bool:
        room = self.repository.get(room_id)
        if not room:
            return False
        self.repository.delete(room_id)
        return True

class TimeslotService:
    def __init__(self, timeslot_repository: TimeslotRepository):
        self.repository = timeslot_repository

    def create_timeslot(self, timeslot: TimeslotCreate) -> Timeslot:
        return self.repository.create(timeslot.model_dump())

    def get_timeslot(self, timeslot_id: str) -> Optional[Timeslot]:
        return self.repository.get(timeslot_id)  # Expects string, converted from int in routes.py

    def get_all_timeslots(self, skip: int = 0, limit: int = 100) -> List[Timeslot]:
        return self.repository.get_all(skip, limit)

    def update_timeslot(self, timeslot_id: str, timeslot: TimeslotUpdate) -> Optional[Timeslot]:
        db_timeslot = self.repository.get(timeslot_id)  # Expects string
        if not db_timeslot:
            return None
        return self.repository.update(db_timeslot, timeslot.model_dump(exclude_unset=True))

    def delete_timeslot(self, timeslot_id: str) -> bool:
        timeslot = self.repository.get(timeslot_id)  # Expects string
        if not timeslot:
            return False
        self.repository.delete(timeslot_id)
        return True

class ConstraintService:
    def __init__(self, constraint_repository: ConstraintRepository):
        self.repository = constraint_repository

    def create_constraint(self, constraint: ConstraintCreate) -> Constraint:
        return self.repository.create(constraint.model_dump())

    def get_constraint(self, constraint_id: str) -> Optional[Constraint]:
        return self.repository.get(constraint_id)

    def get_all_constraints(self, skip: int = 0, limit: int = 100) -> List[Constraint]:
        return self.repository.get_all(skip, limit)

    def update_constraint(self, constraint_id: str, constraint: ConstraintUpdate) -> Optional[Constraint]:
        db_constraint = self.repository.get(constraint_id)
        if not db_constraint:
            return None
        return self.repository.update(db_constraint, constraint.model_dump(exclude_unset=True))

    def delete_constraint(self, constraint_id: str) -> bool:
        constraint = self.repository.get(constraint_id)
        if not constraint:
            return False
        self.repository.delete(constraint_id)
        return True




logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class UserService:
    def __init__(self, user_repository: UserRepository):
        self.repository = user_repository
        self.user_repository = user_repository

    def create_user(self, user: UserCreate) -> User:
        existing_user = self.user_repository.get_by_email(user.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        existing_user = self.user_repository.get_by_username(user.username)
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already taken")
        
        if user.role == "student" and not user.year_of_study:
            raise HTTPException(status_code=400, detail="Year of study is required for students")
        if user.role == "student" and user.year_of_study not in ["1", "2", "3", "4", "pg", "na"]:
            raise HTTPException(status_code=400, detail="Invalid year of study. Must be 1, 2, 3, 4, pg, or na")

        if user.role == "lecturer":
            # Trim and normalize first_name and last_name
            first_name = user.first_name.strip() if user.first_name else ""
            last_name = user.last_name.strip() if user.last_name else ""
            full_name = f"{first_name} {last_name}".strip().lower()
            logger.info(f"Searching for lecturer with full_name: '{full_name}'")
            lecturer = self.user_repository.db.query(Lecturer).filter(
                Lecturer.lecturer_name.ilike(f"%{full_name}%")
            ).first()
            logger.info(f"First query result: {lecturer}")
            if not lecturer:
                # Strip titles from database lecturer_name
                title_patterns = [
                    'associate professor dr.',
                    'associate professor',
                    'professor dr.',
                    'professor',
                    'dr.',
                    'dr',
                    'prof',
                    'assc prof',
                ]
                clean_name_query = func.lower(Lecturer.lecturer_name)
                for title in title_patterns:
                    clean_name_query = func.replace(clean_name_query, title, '')
                lecturer = self.user_repository.db.query(Lecturer).filter(
                    clean_name_query.ilike(f"%{full_name}%")
                ).first()
                logger.info(f"Query with stripped titles result: {lecturer}")
                if not lecturer:
                    # Log all lecturer names for debugging
                    all_lecturers = self.user_repository.db.query(Lecturer).all()
                    logger.info(f"All lecturers: {[l.lecturer_name for l in all_lecturers]}")
                    raise HTTPException(status_code=400, detail="No matching lecturer found in the database")

        # Create a dictionary with only valid fields
        user_data = {
            "user_id": user.user_id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "username": user.username,
            "password": UserModel.get_password_hash(user.password),
            "role": user.role,
            "phone_number": user.phone_number,
            "dob": user.dob,
            "student_id": user.student_id,
            "program": user.program,
            "year_of_study": user.year_of_study,
            "department_id": user.department_id,
            "address": user.address,
            "room_id": user.room_id,
        }
        return self.user_repository.create(user_data)

    def get_user(self, user_id: str) -> Optional[User]:
        return self.repository.get(user_id)

    def get_all_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        return self.repository.get_all(skip, limit)

    def update_user(self, user_id: str, user: UserUpdate) -> Optional[User]:
        db_user = self.repository.get(user_id)
        if not db_user:
            return None
        
        update_data = user.model_dump(exclude_unset=True)
        if "password" in update_data:
            update_data["password"] = UserModel.get_password_hash(update_data["password"])
            
        return self.repository.update(db_user, update_data)

    def delete_user(self, user_id: str) -> bool:
        user = self.repository.get(user_id)
        if not user:
            return False
        self.repository.delete(user_id)
        return True

    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate a user by email and password"""
        user = self.repository.get_by_email(email)
        if not user:
            return None
        if not user.verify_password(password):
            return None
        return user
    


def get_lecturers(db: Session, skip: int = 0, limit: int = 100) -> List[Lecturer]:
    lecturer_service = LecturerService(LecturerRepository(db))
    return lecturer_service.get_all_lecturers(skip, limit)

def get_rooms(db: Session, skip: int = 0, limit: int = 100) -> List[Room]:
    room_service = RoomService(RoomRepository(db))
    return room_service.get_all_rooms(skip, limit)

def get_courses(db: Session, skip: int = 0, limit: int = 100) -> List[Course]:
    course_service = CourseService(CourseRepository(db))
    return course_service.get_all_courses(skip, limit)

def get_constraints(db: Session, skip: int = 0, limit: int = 100) -> List[Constraint]:
    constraint_service = ConstraintService(ConstraintRepository(db))
    return constraint_service.get_all_constraints(skip, limit)

def get_timetables(db: Session, skip: int = 0, limit: int = 100) -> List[Timeslot]:
    timeslot_service = TimeslotService(TimeslotRepository(db))
    return timeslot_service.get_all_timeslots(skip, limit)

from typing import List, Dict
from typing import List, Dict
def create_timetable(db: Session, timetable: List[Dict]):
    """
    Validates timetable data. Database saving is handled by GA.py to avoid duplication.
    """
    timeslot_service = TimeslotService(TimeslotRepository(db))
    validated_timeslots = []
    try:
        for item in timetable:
            try:
                # Validate foreign keys
                course = db.query(Course).filter_by(course_id=item.get("course_id")).first()
                lecturer = db.query(Lecturer).filter_by(lecturer_id=item.get("lecturer_id")).first()
                room = db.query(Room).filter_by(room_id=item.get("room_id")).first()
                if not course:
                    raise HTTPException(status_code=422, detail=f"Invalid course_id: {item.get('course_id')}")
                if not lecturer:
                    raise HTTPException(status_code=422, detail=f"Invalid lecturer_id: {item.get('lecturer_id')}")
                if not room:
                    raise HTTPException(status_code=422, detail=f"Invalid room_id: {item.get('room_id')}")

                # Validate the timeslot data
                timeslot_data = TimeslotCreate(
                    course_id=item.get("course_id"),
                    lecturer_id=item.get("lecturer_id"),
                    room_id=item.get("room_id"),
                    course_name=item.get("course_name", ""),
                    lecturer_name=item.get("lecturer_name", ""),
                    room_name=item.get("room_name", ""),
                    day_of_the_week=item.get("day"),
                    start_time=datetime.strptime(item.get("start_time"), '%H:%M:%S').time(),
                    end_time=datetime.strptime(item.get("end_time"), '%H:%M:%S').time(),
                    semester=item.get("semester"),
                    year=int(item.get("year")) if item.get("year") else None,
                    timetable_number=1
                )
                validated_timeslots.append(timeslot_data)
            except ValidationError as ve:
                print(f"Validation error for timeslot: {item}, error: {ve}")
                raise HTTPException(status_code=422, detail=f"Invalid timeslot data: {str(ve)}")
            except Exception as e:
                print(f"Error processing timeslot: {item}, error: {e}")
                raise HTTPException(status_code=422, detail=f"Error processing timeslot: {str(e)}")
        return validated_timeslots
    except Exception as e:
        print(f"Error in create_timetable: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process timetable: {str(e)}")
    
