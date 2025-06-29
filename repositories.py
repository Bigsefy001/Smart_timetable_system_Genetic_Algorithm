from sqlalchemy.orm import Session
from models import Lecturer, Course, Department, Room, Timeslot, Constraint, User

class BaseRepository:
    def __init__(self, model, db: Session):
        self.model = model
        self.db = db
        # Define primary key field mapping for each model
        self.pk_field = {
            Lecturer: "lecturer_id",
            Course: "course_id",
            Department: "department_id",
            Room: "room_id",
            Timeslot: "timeslot_id",
            Constraint: "constraint_id",
            User: "user_id",
        }.get(model, "id")  # Default to "id" if not specified

    def get(self, id: str):
        # Use getattr to dynamically access the primary key field
        return self.db.query(self.model).filter(getattr(self.model, self.pk_field) == id).first()

    def get_all(self, skip: int = 0, limit: int = 100):
        return self.db.query(self.model).offset(skip).limit(limit).all()

    def create(self, obj_in: dict):
        db_obj = self.model(**obj_in)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def update(self, db_obj, obj_in: dict):
        for field in obj_in:
            setattr(db_obj, field, obj_in[field])
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def delete(self, id: str):
        # Updated to use the correct primary key field
        obj = self.db.query(self.model).filter(getattr(self.model, self.pk_field) == id).first()
        if obj:
            self.db.delete(obj)
            self.db.commit()

class LecturerRepository(BaseRepository):
    def __init__(self, db: Session):
        super().__init__(Lecturer, db)
        
    def get_by_department(self, department_id: str):
        return self.db.query(self.model).filter(
            self.model.department_id == department_id
        ).all()

class CourseRepository(BaseRepository):
    def __init__(self, db: Session):
        super().__init__(Course, db)
        
    def get_by_department(self, department_id: str):
        return self.db.query(self.model).filter(
            self.model.department_id == department_id
        ).all()
        
    def get_by_semester(self, semester: str):
        return self.db.query(self.model).filter(
            self.model.semester == semester
        ).all()

class DepartmentRepository(BaseRepository):
    def __init__(self, db: Session):
        super().__init__(Department, db)
        
    def get_by_building(self, building: str):
        return self.db.query(self.model).filter(
            self.model.building == building
        ).all()

class RoomRepository(BaseRepository):
    def __init__(self, db: Session):
        super().__init__(Room, db)
        
    def get_by_building(self, building: str):
        return self.db.query(self.model).filter(
            self.model.building == building
        ).all()
        
    def get_by_type(self, room_type: str):
        return self.db.query(self.model).filter(
            self.model.room_type == room_type
        ).all()
        
    def get_available_rooms(self, capacity: int):
        return self.db.query(self.model).filter(
            self.model.capacity >= capacity
        ).all()

class TimeslotRepository(BaseRepository):
    def __init__(self, db: Session):
        super().__init__(Timeslot, db)
        
    def get_by_course(self, course_id: str):
        return self.db.query(self.model).filter(
            self.model.course_id == course_id
        ).all()
        
    def get_by_room(self, room_id: str):
        return self.db.query(self.model).filter(
            self.model.room_id == room_id
        ).all()
        
    def get_by_day(self, day: str):
        return self.db.query(self.model).filter(
            self.model.day_of_the_week == day
        ).all()

class ConstraintRepository(BaseRepository):
    def __init__(self, db: Session):
        super().__init__(Constraint, db)
        
    def get_by_type(self, constraint_type: str):
        return self.db.query(self.model).filter(
            self.model.constraint_type == constraint_type
        ).all()
        
    def get_by_lecturer(self, lecturer_id: str):
        return self.db.query(self.model).filter(
            self.model.lecturer_id == lecturer_id
        ).all()
        
    def get_by_course(self, course_id: str):
        return self.db.query(self.model).filter(
            self.model.course_id == course_id
        ).all()

class UserRepository(BaseRepository):
    def __init__(self, db: Session):
        super().__init__(User, db)
        
    def get_by_department(self, department_id: str):
        return self.db.query(self.model).filter(
            self.model.department_id == department_id
        ).all()
        
    def get_by_role(self, role: str):
        return self.db.query(self.model).filter(
            self.model.role == role
        ).all()
        
    def get_by_email(self, email: str):
        return self.db.query(self.model).filter(
            self.model.email == email
        ).first()
        
    def get_by_username(self, username: str):
        return self.db.query(self.model).filter(
            self.model.username == username
        ).first()