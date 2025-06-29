from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, time
from datetime import datetime

print("Loading schemas.py")
# ====================== LECTURER SCHEMAS ======================
class LecturerBase(BaseModel):
    lecturer_name: str
    department_id: Optional[str] = None
    hire_date: Optional[date] = None
    lecturer_availability: Optional[str] = None
    office_location: Optional[str] = None
    phone_number: Optional[str] = None

class LecturerCreate(LecturerBase):
    lecturer_id: str

class LecturerUpdate(BaseModel):
    lecturer_name: Optional[str] = None
    department_id: Optional[str] = None
    hire_date: Optional[date] = None
    lecturer_availability: Optional[str] = None
    office_location: Optional[str] = None
    phone_number: Optional[str] = None

class Lecturer(LecturerBase):
    lecturer_id: str
    
    class Config:
        from_attributes = True

# ====================== COURSE SCHEMAS ======================
class CourseBase(BaseModel):
    course_name: str
    course_code: str
    year: int
    semester: str
    no_of_students: int
    credit: int
    department_id: Optional[str] = None

class CourseCreate(CourseBase):
    course_id: str

class CourseUpdate(BaseModel):
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[str] = None
    no_of_students: Optional[int] = None
    credit: Optional[int] = None
    department_id: Optional[str] = None

class Course(CourseBase):
    course_id: str
    
    class Config:
        from_attributes = True

# ====================== DEPARTMENT SCHEMAS ======================
class DepartmentBase(BaseModel):
    department_name: str
    department_head: Optional[str] = None
    building: Optional[str] = None
    user_id: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    department_id: str

class DepartmentUpdate(BaseModel):
    department_name: Optional[str] = None
    department_head: Optional[str] = None
    building: Optional[str] = None
    user_id: Optional[str] = None

class Department(DepartmentBase):
    department_id: str
    
    class Config:
        from_attributes = True

# ====================== ROOM SCHEMAS ======================
class RoomBase(BaseModel):
    room_name: Optional[str] = None
    building: Optional[str] = None
    capacity: Optional[int] = None
    room_type: Optional[str] = None

class RoomCreate(RoomBase):
    room_id: str

class RoomUpdate(BaseModel):
    room_name: Optional[str] = None
    building: Optional[str] = None
    capacity: Optional[int] = None
    room_type: Optional[str] = None

class Room(RoomBase):
    room_id: str
    
    class Config:
        from_attributes = True

# ====================== TIMESLOT SCHEMAS ======================
class TimeslotBase(BaseModel):
    course_id: Optional[str] = None
    lecturer_id: Optional[str] = None
    room_id: Optional[str] = None
    course_name: Optional[str] = None
    lecturer_name: Optional[str] = None
    room_name: Optional[str] = None
    day_of_the_week: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    semester: Optional[str] = None
    year: Optional[int] = None
    timetable_number: Optional[int] = None

class TimeslotCreate(TimeslotBase):
    course_id: str
    lecturer_id: str
    room_id: str
    course_name: str
    lecturer_name: str
    room_name: str
    day_of_the_week: str
    start_time: time
    end_time: time
    semester: str

class TimeslotUpdate(TimeslotBase):
    pass

class Timeslot(TimeslotBase):
    timeslot_id: int
    course_id: str
    lecturer_id: str
    room_id: str
    course_name: str
    lecturer_name: str
    room_name: str
    day_of_the_week: str
    start_time: time
    end_time: time
    semester: str
    timetable_number: int

    class Config:
        from_attributes = True

# ====================== CONSTRAINT SCHEMAS ======================
class ConstraintBase(BaseModel):
    constraint_type: str
    constraint_value: str
    course_id: Optional[str] = None
    lecturer_id: Optional[str] = None
    room_id: Optional[str] = None

class ConstraintCreate(ConstraintBase):
    constraint_id: str

class ConstraintUpdate(BaseModel):
    constraint_type: Optional[str] = None
    constraint_value: Optional[str] = None
    course_id: Optional[str] = None
    lecturer_id: Optional[str] = None
    room_id: Optional[str] = None

class Constraint(ConstraintBase):
    constraint_id: str
    
    class Config:
        from_attributes = True

# ====================== USER SCHEMAS ======================

class UserBase(BaseModel):
    department_id: Optional[str] = None
    room_id: Optional[str] = None
    first_name: str
    last_name: str
    email: EmailStr
    role: Optional[str] = None
    password: str
    phone_number: Optional[str] = None
    address: Optional[str] = None
    username: Optional[str] = None
    dob: Optional[date] = None
    student_id: Optional[str] = None
    program: Optional[str] = None
    year_of_study: Optional[str] = None

class UserCreate(UserBase):
    user_id: str
    
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    department_id: Optional[str] = None
    room_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    password: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    username: Optional[str] = None
    dob: Optional[date] = None
    student_id: Optional[str] = None
    program: Optional[str] = None
    year_of_study: Optional[str] = None
    
    class Config:
        from_attributes = True

class User(UserBase):
    user_id: str
    
    class Config:
        from_attributes = True

# ====================== RESPONSE SCHEMAS ======================
class MessageResponse(BaseModel):
    message: str

class ErrorResponse(BaseModel):
    detail: str

class ListResponse(BaseModel):
    items: List
    total: int
    skip: int
    limit: int

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

class UserLogin(BaseModel):
    email: str
    password: str

class TimetableBase(BaseModel):
    course_id: str
    lecturer_id: str
    room_id: str
    timeslot: str
    day: str

class TimetableCreate(TimetableBase):
    pass

class Timetable(TimetableBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

class ConflictItem(BaseModel):
    course_id: str
    course_name: str
    lecturer_name: str
    room_name: str
    day: str
    time: str
    semester: Optional[str] = None  # Add semester
    year: Optional[int] = None      # Add year

    class Config:
        from_attributes = True

class ConflictSchema(BaseModel):
    type: str
    description: str
    constraint: Optional[str] = None
    items: List[ConflictItem]

    class Config:
        from_attributes = True

class TimetableStats(BaseModel):
    fitness: float
    hard_violations: int
    soft_violations: int
    total_conflicts: int

    class Config:
        from_attributes = True

class TimetableWithConflicts(BaseModel):
    schedule: List[Timeslot]
    conflicts: List[ConflictSchema]
    stats: TimetableStats

    class Config:
        from_attributes = True