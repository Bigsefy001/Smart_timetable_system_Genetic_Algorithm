from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi.security import OAuth2PasswordRequestForm
import uuid
import service
from GA import generate_timetable
from typing import Dict, Any
from GA import generate_timetable, Chromosome, ScheduleItem, TimetableGenerator
import logging
logger = logging.getLogger(__name__)


# Use absolute imports instead of relative imports
import models
import schemas
import auth

from database import get_db
from schemas import (
    Lecturer, LecturerCreate, LecturerUpdate,
    Course, CourseCreate, CourseUpdate,
    Department, DepartmentCreate, DepartmentUpdate,
    Room, RoomCreate, RoomUpdate,
    Timeslot, TimeslotCreate, TimeslotUpdate,
    Constraint, ConstraintCreate, ConstraintUpdate,
    User, UserCreate, UserUpdate, Token,
    ConflictItem, ConflictSchema, TimetableStats, TimetableWithConflicts
)
from service import (
    LecturerService, CourseService, DepartmentService,
    RoomService, TimeslotService, ConstraintService, UserService
)
from repositories import (
    LecturerRepository, CourseRepository, DepartmentRepository,
    RoomRepository, TimeslotRepository, ConstraintRepository, UserRepository
)
from auth import (
    create_access_token,
    get_current_user,
    get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    require_role
)
from service import (
    get_lecturers, get_rooms, get_courses, get_constraints,
    get_timetables, create_timetable,
    LecturerService, CourseService, DepartmentService,
    RoomService, TimeslotService, ConstraintService, UserService
)
router = APIRouter()

# Move get_user_service above /signup/ to resolve Pylance error
def get_user_service(db: Session = Depends(get_db)) -> UserService:
    user_repository = UserRepository(db)
    return UserService(user_repository)

# /signup/ endpoint (now references get_user_service after its definition)
@router.post("/signup/", response_model=User, status_code=status.HTTP_201_CREATED)
def signup_user(
    user: UserCreate,
    service: UserService = Depends(get_user_service),
):
    valid_roles = ["admin", "lecturer", "student"]
    if user.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be one of: admin, lecturer, student"
        )
    try:
        return service.create_user(user)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/setup-admin")
async def create_admin(db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == "admin@example.com").first()
    if user:
        print(f"Admin user already exists with role: {user.role}")
        return {"message": "Admin user already exists"}
    
    new_user = models.User(
        user_id=str(uuid.uuid4())[:20],
        email="admin@example.com",
        first_name="Admin",
        last_name="User",
        role="admin",
        password=models.User.get_password_hash("admin123"),
        phone_number="1234567890",
        address="Admin Address"
    )
    
    print(f"Creating admin user with role: {new_user.role}")
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Admin user created successfully", "user_id": new_user.user_id}

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    print(f"Login attempt with username: {form_data.username}")
    
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not user:
        print(f"User not found: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    print(f"User found: {user.email}")
    print(f"Stored password hash: {user.password}")
    print("Attempting to verify password...")
    
    try:
        if not user.verify_password(form_data.password):
            print(f"Invalid password for user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception as e:
        print(f"Password verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error verifying password",
        )
    
    # Update last_login on successful login
    user.last_login = datetime.utcnow()
    db.commit()
    
    valid_roles = ["admin", "lecturer", "student"]
    if not form_data.scopes or len(form_data.scopes) != 1 or form_data.scopes[0] not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or missing role"
        )
    
    requested_role = form_data.scopes[0]
    if user.role != requested_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User role does not match requested role"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

def get_lecturer_service(db: Session = Depends(get_db)) -> LecturerService:
    lecturer_repository = LecturerRepository(db)
    return LecturerService(lecturer_repository)

@router.post("/lecturers/", response_model=Lecturer, status_code=status.HTTP_201_CREATED)
def create_lecturer(
    lecturer: LecturerCreate,
    service: LecturerService = Depends(get_lecturer_service),
    _ = Depends(require_role("admin"))
):
    return service.create_lecturer(lecturer)

@router.get("/lecturers/", response_model=List[Lecturer])
def read_lecturers(
    skip: int = 0,
    limit: int = 100,
    service: LecturerService = Depends(get_lecturer_service),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and teachers can access this endpoint"
        )
    return service.get_all_lecturers(skip, limit)

@router.get("/lecturers/{lecturer_id}", response_model=Lecturer)
def read_lecturer(
    lecturer_id: str,
    service: LecturerService = Depends(get_lecturer_service),
    current_user: User = Depends(get_current_active_user)
):
    lecturer = service.get_lecturer(lecturer_id)
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")
    
    if current_user.role == "teacher" and lecturer_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own profile"
        )
    
    return lecturer

@router.put("/lecturers/{lecturer_id}", response_model=Lecturer)
def update_lecturer(
    lecturer_id: str,
    lecturer: LecturerUpdate,
    service: LecturerService = Depends(get_lecturer_service),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role == "teacher" and lecturer_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own profile"
        )
    
    updated_lecturer = service.update_lecturer(lecturer_id, lecturer)
    if not updated_lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")
    return updated_lecturer

@router.delete("/lecturers/{lecturer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lecturer(
    lecturer_id: str,
    service: LecturerService = Depends(get_lecturer_service),
    _ = Depends(require_role("admin"))
):
    if not service.delete_lecturer(lecturer_id):
        raise HTTPException(status_code=404, detail="Lecturer not found")
    return {"message": "Lecturer deleted successfully"}

def get_course_service(db: Session = Depends(get_db)) -> CourseService:
    course_repository = CourseRepository(db)
    return CourseService(course_repository)

@router.post("/courses/", response_model=Course, status_code=status.HTTP_201_CREATED)
def create_course(
    course: CourseCreate,
    service: CourseService = Depends(get_course_service),
    _ = Depends(require_role("admin"))
):
    return service.create_course(course)

@router.get("/courses/", response_model=List[Course])
def read_courses(
    skip: int = 0,
    limit: int = 100,
    service: CourseService = Depends(get_course_service),
    current_user: User = Depends(get_current_active_user)
):
    return service.get_all_courses(skip, limit)

@router.get("/courses/{course_id}", response_model=Course)
def read_course(
    course_id: str,
    service: CourseService = Depends(get_course_service),
    current_user: User = Depends(get_current_active_user)
):
    course = service.get_course(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

@router.put("/courses/{course_id}", response_model=Course)
def update_course(
    course_id: str,
    course: CourseUpdate,
    service: CourseService = Depends(get_course_service),
    _ = Depends(require_role("admin"))
):
    updated_course = service.update_course(course_id, course)
    if not updated_course:
        raise HTTPException(status_code=404, detail="Course not found")
    return updated_course

@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: str,
    service: CourseService = Depends(get_course_service),
    _ = Depends(require_role("admin"))
):
    if not service.delete_course(course_id):
        raise HTTPException(status_code=404, detail="Course not found")
    return {"message": "Course deleted successfully"}

def get_department_service(db: Session = Depends(get_db)) -> DepartmentService:
    department_repository = DepartmentRepository(db)
    return DepartmentService(department_repository)

@router.post("/departments/", response_model=Department, status_code=status.HTTP_201_CREATED)
def create_department(
    department: DepartmentCreate,
    service: DepartmentService = Depends(get_department_service),
    _ = Depends(require_role("admin"))
):
    return service.create_department(department)

@router.get("/departments/", response_model=List[Department])
def read_departments(
    skip: int = 0,
    limit: int = 100,
    service: DepartmentService = Depends(get_department_service),
    current_user: User = Depends(get_current_active_user)
):
    return service.get_all_departments(skip, limit)

@router.get("/departments/{department_id}", response_model=Department)
def read_department(
    department_id: str,
    service: DepartmentService = Depends(get_department_service),
    current_user: User = Depends(get_current_active_user)
):
    department = service.get_department(department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return department

@router.put("/departments/{department_id}", response_model=Department)
def update_department(
    department_id: str,
    department: DepartmentUpdate,
    service: DepartmentService = Depends(get_department_service),
    _ = Depends(require_role("admin"))
):
    updated_department = service.update_department(department_id, department)
    if not updated_department:
        raise HTTPException(status_code=404, detail="Department not found")
    return updated_department

@router.delete("/departments/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    department_id: str,
    service: DepartmentService = Depends(get_department_service),
    _ = Depends(require_role("admin"))
):
    if not service.delete_department(department_id):
        raise HTTPException(status_code=404, detail="Department not found")
    return {"message": "Department deleted successfully"}

def get_room_service(db: Session = Depends(get_db)) -> RoomService:
    room_repository = RoomRepository(db)
    return RoomService(room_repository)

@router.post("/rooms/", response_model=Room, status_code=status.HTTP_201_CREATED)
def create_room(
    room: RoomCreate,
    service: RoomService = Depends(get_room_service),
    _ = Depends(require_role("admin"))
):
    return service.create_room(room)

@router.get("/rooms/", response_model=List[Room])
def read_rooms(
    skip: int = 0,
    limit: int = 100,
    service: RoomService = Depends(get_room_service),
    current_user: User = Depends(get_current_active_user)
):
    return service.get_all_rooms(skip, limit)

@router.get("/rooms/{room_id}", response_model=Room)
def read_room(
    room_id: str,
    service: RoomService = Depends(get_room_service),
    current_user: User = Depends(get_current_active_user)
):
    room = service.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room

@router.put("/rooms/{room_id}", response_model=Room)
def update_room(
    room_id: str,
    room: RoomUpdate,
    service: RoomService = Depends(get_room_service),
    _ = Depends(require_role("admin"))
):
    updated_room = service.update_room(room_id, room)
    if not updated_room:
        raise HTTPException(status_code=404, detail="Room not found")
    return updated_room

@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    room_id: str,
    service: RoomService = Depends(get_room_service),
    _ = Depends(require_role("admin"))
):
    if not service.delete_room(room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    return {"message": "Room deleted successfully"}

def get_timeslot_service(db: Session = Depends(get_db)) -> TimeslotService:
    timeslot_repository = TimeslotRepository(db)
    return TimeslotService(timeslot_repository)

@router.post("/timeslots/", response_model=Timeslot, status_code=status.HTTP_201_CREATED)
def create_timeslot(
    timeslot: TimeslotCreate,
    service: TimeslotService = Depends(get_timeslot_service),
    _ = Depends(require_role("admin"))
):
    return service.create_timeslot(timeslot)

@router.get("/timeslots/", response_model=List[Timeslot])
def read_timeslots(
    skip: int = 0,
    limit: int = 100,
    service: TimeslotService = Depends(get_timeslot_service),
    current_user: User = Depends(get_current_active_user)
):
    return service.get_all_timeslots(skip, limit)

@router.get("/timeslots/{timeslot_id}", response_model=Timeslot)
def read_timeslot(
    timeslot_id: int,
    service: TimeslotService = Depends(get_timeslot_service),
    current_user: User = Depends(get_current_active_user)
):
    timeslot = service.get_timeslot(str(timeslot_id))
    if not timeslot:
        raise HTTPException(status_code=404, detail="Timeslot not found")
    return timeslot

@router.get("/timetable-status/")
async def check_timetable_status(semester: str, year: Optional[int] = None, db: Session = Depends(get_db)):
    timeslots = db.query(models.Timeslot).filter(models.Timeslot.semester == semester)
    if year is not None:
        timeslots = timeslots.filter(models.Timeslot.year == year)
    count = timeslots.count()
    return {"status": "complete" if count > 0 else "running", "timeslot_count": count}

@router.put("/timeslots/{timeslot_id}", response_model=Timeslot)
def update_timeslot(
    timeslot_id: int,
    timeslot: TimeslotUpdate,
    service: TimeslotService = Depends(get_timeslot_service),
    _ = Depends(require_role("admin"))
):
    updated_timeslot = service.update_timeslot(str(timeslot_id), timeslot)
    if not updated_timeslot:
        raise HTTPException(status_code=404, detail="Timeslot not found")
    return updated_timeslot

@router.delete("/timeslots/{timeslot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timeslot(
    timeslot_id: int,
    service: TimeslotService = Depends(get_timeslot_service),
    _ = Depends(require_role("admin"))
):
    if not service.delete_timeslot(str(timeslot_id)):
        raise HTTPException(status_code=404, detail="Timeslot not found")
    return {"message": "Timeslot deleted successfully"}

def get_constraint_service(db: Session = Depends(get_db)) -> ConstraintService:
    constraint_repository = ConstraintRepository(db)
    return ConstraintService(constraint_repository)

@router.post("/constraints/", response_model=Constraint, status_code=status.HTTP_201_CREATED)
def create_constraint(
    constraint: ConstraintCreate,
    service: ConstraintService = Depends(get_constraint_service),
    _ = Depends(require_role("admin"))
):
    return service.create_constraint(constraint)

@router.get("/constraints/", response_model=List[Constraint])
def read_constraints(
    skip: int = 0,
    limit: int = 100,
    service: ConstraintService = Depends(get_constraint_service),
    current_user: User = Depends(get_current_active_user)
):
    return service.get_all_constraints(skip, limit)

@router.get("/constraints/{constraint_id}", response_model=Constraint)
def read_constraint(
    constraint_id: str,
    service: ConstraintService = Depends(get_constraint_service),
    current_user: User = Depends(get_current_active_user)
):
    constraint = service.get_constraint(constraint_id)
    if not constraint:
        raise HTTPException(status_code=404, detail="Constraint not found")
    return constraint

@router.put("/constraints/{constraint_id}", response_model=Constraint)
def update_constraint(
    constraint_id: str,
    constraint: ConstraintUpdate,
    service: ConstraintService = Depends(get_constraint_service),
    _ = Depends(require_role("admin"))
):
    updated_constraint = service.update_constraint(constraint_id, constraint)
    if not updated_constraint:
        raise HTTPException(status_code=404, detail="Constraint not found")
    return updated_constraint

@router.delete("/constraints/{constraint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_constraint(
    constraint_id: str,
    service: ConstraintService = Depends(get_constraint_service),
    _ = Depends(require_role("admin"))
):
    if not service.delete_constraint(constraint_id):
        raise HTTPException(status_code=404, detail="Constraint not found")
    return {"message": "Constraint deleted successfully"}

# get_user_service was moved above /signup/, so it's no longer needed here
# Keeping other user-related endpoints in their original order

@router.post("/users/", response_model=User, status_code=status.HTTP_201_CREATED)
def create_user(
    user: UserCreate,
    service: UserService = Depends(get_user_service),
    _ = Depends(require_role("admin"))
):
    return service.create_user(user)

@router.get("/users/", response_model=List[User])
def read_users(
    skip: int = 0,
    limit: int = 100,
    service: UserService = Depends(get_user_service),
    _ = Depends(require_role("admin"))
):
    return service.get_all_users(skip, limit)

@router.get("/users/{user_id}", response_model=User)
def read_user(
    user_id: str,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role != "admin" and user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own profile"
        )
    
    user = service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/users/{user_id}", response_model=User)
def update_user(
    user_id: str,
    user: UserUpdate,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role != "admin" and user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own profile"
        )
    
    updated_user = service.update_user(user_id, user)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    return updated_user

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    service: UserService = Depends(get_user_service),
    _ = Depends(require_role("admin"))
):
    if not service.delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

@router.get("/users/me/", response_model=User)
async def read_users_me(
    current_user: User = Depends(get_current_active_user)
):
    return current_user

@router.post("/generate-timetable/")
async def generate_timetable_endpoint(
    request: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _ = Depends(require_role("admin"))
):
    try:
        semester = request.get("semester")
        year = request.get("year")
        parameters = request.get("parameters", {})
        
        # Validate semester
        if not semester:
            raise HTTPException(status_code=400, detail="Semester is required")
        
        # Handle year with default and validation
        if year is None:
            year = 1
            logger.info("No year provided, defaulting to year 1")
        
        # Validate year is a positive integer
        try:
            year = int(year)
            if year <= 0:
                raise HTTPException(
                    status_code=400, 
                    detail="Year must be a positive integer (1, 2, 3, etc.)"
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400, 
                detail="Year must be a valid positive integer"
            )
        
        # Log the processing details
        logger.info(f"Starting timetable generation for semester: {semester}, year: {year}")
        
        def run_ga_task():
            try:
                logger.info(f"Processing timetable generation for {semester} year {year}")
                
                # Generate timetable with validated parameters
                timetable_result = generate_timetable(db, semester, year, parameters)
                
                logger.info(f"Generated timetable with {len(timetable_result['schedule'])} schedule items")
                
                # Save the timetable
                create_timetable(db, timetable_result['schedule'])
                db.commit()
                
                logger.info(f"Successfully saved timetable for {semester} year {year}")
                
            except ValueError as ve:
                logger.error(f"Validation error in GA task for {semester} year {year}: {str(ve)}")
                db.rollback()
                raise HTTPException(status_code=400, detail=f"Invalid data: {str(ve)}")
                
            except Exception as e:
                logger.error(f"GA task error for {semester} year {year}: {str(e)}")
                db.rollback()
                raise HTTPException(status_code=500, detail=f"Timetable generation failed: {str(e)}")

        # Add the background task
        background_tasks.add_task(run_ga_task)
        
        logger.info(f"Timetable generation task queued for {semester} year {year}")
        return {
            "message": "Timetable generation started", 
            "status": "running",
            "semester": semester,
            "year": year
        }
        
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error starting timetable generation: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error starting timetable generation: {str(e)}"
        )
@router.get("/timetables/", response_model=List[Timeslot])
def read_timetables(
    skip: int = 0,
    limit: int = 100,
    semester: Optional[str] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        query = db.query(models.Timeslot)
        if semester:
            query = query.filter(models.Timeslot.semester == semester)
        if year is not None:
            query = query.filter(models.Timeslot.year == year)
        timeslots = query.offset(skip).limit(limit).all()
        return timeslots
    except Exception as e:
        print(f"Error fetching timetables: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve timetables.")
    

from models import Timeslot as TimeslotModel



@router.get("/timetables/conflicts/", response_model=TimetableWithConflicts)
def get_timetable_conflicts(
    semester: str,
    year: Optional[int] = None,
    timetable_number: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    logger.info(f"Received request: semester={semester}, year={year}, timetable_number={timetable_number}, user={current_user.email}")

    # Validate semester
    valid_semesters = ["Fall", "Spring", "Summer"]
    if semester not in valid_semesters:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid semester: {semester}. Must be one of {valid_semesters}"
        )

    try:
        # Query timeslots
        query = db.query(TimeslotModel).filter(TimeslotModel.semester == semester)
        if year is not None:
            query = query.filter(TimeslotModel.year == year)
        if timetable_number is not None:
            query = query.filter(TimeslotModel.timetable_number == timetable_number)
        else:
            query = query.order_by(TimeslotModel.timetable_number.desc())

        timeslots = query.all()
        logger.info(f"Retrieved {len(timeslots)} timeslots")

        if not timeslots:
            raise HTTPException(
                status_code=404,
                detail=f"No timetable found for semester={semester}" +
                       (f", year={year}" if year else "") +
                       (f", timetable_number={timetable_number}" if timetable_number else "")
            )

        # Validate timeslot data
        required_fields = [
            "course_id", "lecturer_id", "room_id",
            "course_name", "lecturer_name", "room_name",
            "day_of_the_week", "start_time", "end_time"
        ]
        for ts in timeslots:
            missing_fields = [field for field in required_fields if getattr(ts, field, None) is None]
            if missing_fields:
                logger.warning(f"Invalid timeslot {ts.timeslot_id}: missing fields {missing_fields}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid timeslot data: missing fields {missing_fields} in timeslot {ts.timeslot_id}"
                )

        # Initialize TimetableGenerator
        generator = TimetableGenerator(
            db=db,
            semester=semester,
            year=year,
            timeslots=timeslots
        )

        # Calculate conflicts
        chromosome = generator.create_chromosome()
        fitness = generator.calculate_fitness(chromosome)  # Get fitness (float)
        conflicts = chromosome.conflicts or []  # Get conflicts from chromosome, default to empty list if None

        stats = TimetableStats(
            fitness=fitness,
            hard_violations=sum(1 for c in conflicts if c.severity == "hard"),
            soft_violations=sum(1 for c in conflicts if c.severity == "soft"),
            total_conflicts=len(conflicts)
        )

        # Format conflicts for response
        formatted_conflicts = [
            ConflictSchema(
                type=c.type,
                description=c.description,
                constraint=c.constraint,
                severity=c.severity,
                items=[
                    ConflictItem(
                        course_id=item.course_id,
                        course_name=item.course_name,
                        lecturer_name=item.lecturer_name,
                        room_name=item.room_name,
                        day=item.day,
                        time=f"{item.start_time.strftime('%H:%M')}-{item.end_time.strftime('%H:%M')}",
                        semester=item.semester,
                        year=item.year
                    ) for item in c.items
                ]
            ) for c in conflicts
        ]

        # Format schedule
        schedule = [
            Timeslot(
                timeslot_id=ts.timeslot_id,
                course_id=ts.course_id,
                lecturer_id=ts.lecturer_id,
                room_id=ts.room_id,
                course_name=ts.course_name,
                lecturer_name=ts.lecturer_name,
                room_name=ts.room_name,
                day_of_the_week=ts.day_of_the_week,
                start_time=ts.start_time,
                end_time=ts.end_time,
                semester=ts.semester,
                year=ts.year,
                timetable_number=ts.timetable_number
            ) for ts in timeslots
        ]

        return TimetableWithConflicts(
            schedule=schedule,
            conflicts=formatted_conflicts,
            stats=stats
        )

    except Exception as e:
        logger.error(f"Error processing conflicts: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    
@router.post("/timetables/auto-resolve/")
async def auto_resolve_conflicts(
    request: Dict[str, Any],
    db: Session = Depends(get_db),
    _ = Depends(require_role("admin"))
):
    try:
        semester = request.get("semester", "Fall")
        year = request.get("year")  # May be None to indicate all years

        logger.info(f"Auto-resolving conflicts for semester: {semester}, year: {year or 'all'}")

        # Get all years with timeslots for the semester
        years_query = db.query(TimeslotModel.year).filter(TimeslotModel.semester == semester).distinct()
        years = [row.year for row in years_query.all() if row.year is not None]
        
        if not years:
            logger.info("No timeslots found for the given semester")
            return {
                "success": True,
                "message": "No conflicts found to resolve",
                "resolved": 0,
                "remaining": 0,
                "timetables": [],
                "conflicts": []
            }

        all_timetables = []
        all_conflicts = []
        total_resolved = 0
        total_remaining = 0

        # Process each year
        for year in years:
            logger.info(f"Processing conflicts for semester: {semester}, year: {year}")

            # Initialize timetable generator for this year
            generator = TimetableGenerator(db, semester, year)
            
            # Create a chromosome to evaluate current conflicts
            chromosome = generator.create_chromosome()
            
            # Force evaluation of all conflicts
            generator.calculate_fitness(chromosome)
            initial_conflicts = chromosome.conflicts or []
            initial_conflict_count = len(initial_conflicts)

            logger.info(f"Initial conflicts detected for year {year}: {initial_conflict_count}")

            if initial_conflict_count == 0:
                logger.info(f"No conflicts found for year {year}")
                timetable = generator.save_timetable(chromosome)
                all_timetables.append(timetable)
                continue

            # Perform auto-resolution
            resolved_chromosome = generator.auto_resolve_conflicts(chromosome)
            
            # Re-evaluate after resolution
            generator.calculate_fitness(resolved_chromosome)
            remaining_conflicts = resolved_chromosome.conflicts or []
            resolved_count = initial_conflict_count - len(remaining_conflicts)

            logger.info(f"Year {year}: Resolved {resolved_count} conflicts, {len(remaining_conflicts)} remaining")

            # Save the resolved timetable
            timetable = generator.save_timetable(resolved_chromosome)
            all_timetables.append(timetable)
            all_conflicts.extend([
                {
                    "type": c.type,
                    "description": c.description,
                    "severity": c.severity,
                    "constraint": c.constraint,
                    "items": [{
                        "course_id": item.course_id,
                        "course_name": item.course_name,
                        "lecturer_name": item.lecturer_name,
                        "room_name": item.room_name,
                        "day": item.day,
                        "time": f"{item.start_time.strftime('%H:%M')}-{item.end_time.strftime('%H:%M')}",
                        "semester": item.semester,
                        "year": item.year,
                    } for item in c.items]
                } for c in remaining_conflicts
            ])
            total_resolved += resolved_count
            total_remaining += len(remaining_conflicts)

        return {
            "success": total_resolved > 0 or total_remaining == 0,
            "message": f"Resolved {total_resolved} out of {total_resolved + total_remaining} conflicts across {len(years)} years",
            "resolved": total_resolved,
            "remaining": total_remaining,
            "timetables": all_timetables,
            "conflicts": all_conflicts
        }
    except Exception as e:
        logger.error(f"Auto-resolve error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to auto-resolve conflicts: {str(e)}"
        )