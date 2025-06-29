import random
import csv
import numpy as np
from typing import List, Dict, Tuple, Set, Optional
import copy
import multiprocessing
from datetime import datetime, time
from dataclasses import dataclass
from pkg_resources import get_distribution
from sqlalchemy.orm import Session
from sqlalchemy import text
from models import Lecturer, Course, Room, Timeslot, Constraint
from database import get_db
import logging
from collections import defaultdict
# Configure the logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
# Utility data classes for the genetic algorithm
@dataclass
class TimeSlot:
    day: str
    start_time: time
    end_time: time

@dataclass
class ScheduleItem:
    course_id: str  # Add course_id
    course_name: str
    lecturer_id: str  # Add lecturer_id for consistency
    lecturer_name: str  
    room_id: str  # Add room_id for consistency
    room_name: str
    day: str
    start_time: time
    end_time: time
    timeslot_id: Optional[str] = None
    semester: Optional[str] = None  # Add semester
    year: Optional[int] = None

# Constants for the genetic algorithm
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
# Calculate how many periods fit between 8:30 and 18:30
STARTING_HOUR = 8  # 8 AM
STARTING_MINUTE = 30  # 30 minutes
ENDING_HOUR = 18  # 6 PM
ENDING_MINUTE = 30  # 30 minutes
PERIOD_DURATION = 120  # 120 minutes per period

# Calculate available minutes and how many periods fit
AVAILABLE_MINUTES = (ENDING_HOUR * 60 + ENDING_MINUTE) - (STARTING_HOUR * 60 + STARTING_MINUTE)
PERIODS_PER_DAY = AVAILABLE_MINUTES // PERIOD_DURATION  # Integer division to get whole periods
MAX_GENERATIONS_WITHOUT_IMPROVEMENT = 50

# Constraint penalty weights
HARD_CONSTRAINT_PENALTY = 500.0  # Heavily penalize hard constraint violations
SOFT_CONSTRAINT_PENALTY = 2.0    # Normal penalty for soft constraints

# Helper function to convert period number to time
def period_to_time(period: int) -> Tuple[time, time]:
    # Start at 8:30 AM
    start_hour = STARTING_HOUR
    start_minute = STARTING_MINUTE
    
    # Add period offset (each period is PERIOD_DURATION minutes)
    period_offset_minutes = (period - 1) * PERIOD_DURATION
    total_start_minutes = start_hour * 60 + start_minute + period_offset_minutes
    
    # Calculate start hour and minute
    start_hour = total_start_minutes // 60
    start_minute = total_start_minutes % 60
    
    # Calculate end time
    total_end_minutes = total_start_minutes + PERIOD_DURATION
    end_hour = total_end_minutes // 60
    end_minute = total_end_minutes % 60
    
    # Create time objects
    start_time = time(hour=start_hour, minute=start_minute)
    end_time = time(hour=end_hour, minute=end_minute)
    
    return start_time, end_time

# Helper function to check if two timeslots overlap
def timeslots_overlap(slot1: TimeSlot, slot2: TimeSlot) -> bool:
       if slot1.day != slot2.day:
           return False
       def time_to_minutes(t):
           # Handle both string and time objects
           if isinstance(t, str):
               try:
                   t = datetime.strptime(t, '%H:%M:%S').time()
               except ValueError:
                   t = datetime.strptime(t, '%H:%M').time()
           return t.hour * 60 + t.minute
       
       s1_start = time_to_minutes(slot1.start_time)
       s1_end = time_to_minutes(slot1.end_time)
       s2_start = time_to_minutes(slot2.start_time)
       s2_end = time_to_minutes(slot2.end_time)
       
       return (
           (s1_start <= s2_start < s1_end) or
           (s1_start < s2_end <= s1_end) or
           (s2_start <= s1_start < s2_end) or
           (s2_start < s1_end <= s2_end)
       )


# Helper function to parse time string (format: "HH:MM")
def parse_time_string(time_str: str) -> time:
    try:
        return datetime.strptime(time_str, '%H:%M:%S').time()
    except ValueError:
        hours, minutes = map(int, time_str.split(':'))
        return time(hour=hours, minute=minutes)

@dataclass
class Conflict:
    type: str
    description: str
    items: List[ScheduleItem]
    constraint: Optional[str] = None
    constraint_value: Optional[str] = None  # Added to fix constructor error
    severity: str = 'hard'

class Chromosome:
    def __init__(self, schedule_items: List[ScheduleItem] = None):
        self.schedule_items = schedule_items or []
        self.fitness = 0.0
        # Track violations for debugging and solution improvement
        self.hard_violations = 0
        self.soft_violations = 0
        self.conflicts = []  # Now using Conflict objects instead of strings
        
    
    def copy(self):
        new_chromosome = Chromosome(copy.deepcopy(self.schedule_items))
        new_chromosome.fitness = self.fitness
        new_chromosome.hard_violations = self.hard_violations
        new_chromosome.soft_violations = self.soft_violations
        new_chromosome.conflicts = copy.deepcopy(self.conflicts)
        return new_chromosome

class TimetableGenerator:
    def __init__(self, db: Session, semester: str, year=None, timeslots=None,
             population_size=50, max_generations=100, crossover_rate=0.8,
             mutation_rate=0.05, elitism_count=5, tournament_size=5):
        print(f"Initializing TimetableGenerator for semester: {semester}" + 
            (f" and year: {year}" if year else ""))
        self.db = db
        self.semester = semester
        self.year = year
        self.timeslots = timeslots or []  # Store timeslots, default to empty list if None
        self.population_size = population_size
        self.max_generations = max_generations
        self.crossover_rate = crossover_rate
        self.mutation_rate = mutation_rate
        self.elitism_count = elitism_count
        self.tournament_size = tournament_size
        self.lecturers = self._load_lecturers()
        self.courses = self._load_courses(year=year)
        self.rooms = self._load_rooms()
        self.constraints = self._load_constraints()
        self.course_lecturer_mapping = self._create_course_lecturer_mapping()
        
        # Debug resource availability
        lab_rooms = [r for r_id, r in self.rooms.items() if getattr(r, 'room_type', '') == 'LAB']
        print(f"Available lab rooms: {[f'{r.room_id} (capacity: {r.capacity})' for r in lab_rooms]}")
        print(f"Lab courses: {[f'{c.course_id} ({c.course_name}, students: {c.no_of_students})' for c_id, c in self.courses.items() if 'Lab' in c.course_name]}")
        print(f"Lecturer assignments: {[(c_id, self.course_lecturer_mapping.get(c_id)) for c_id in self.courses.keys()]}")
        print(f"Constraints: {[f'{c.constraint_id}: {c.constraint_type} = {c.constraint_value}' for c in self.constraints]}")
        
        print(f"Loaded {len(self.lecturers)} lecturers, {len(self.courses)} courses, "
            f"{len(self.rooms)} rooms, {len(self.constraints)} constraints, "
            f"{len(self.timeslots)} timeslots")
        if len(self.courses) == 0:
            print(f"WARNING: No courses found for semester {semester}" + 
                (f" and year {year}" if year else ""))
        self.population = []
        self.pool = None
        self.hard_constraints = [c for c in self.constraints if c.constraint_id.startswith('HC')]
        self.soft_constraints = [c for c in self.constraints if c.constraint_id.startswith('SC')]
        print(f"Loaded {len(self.hard_constraints)} hard constraints and "
            f"{len(self.soft_constraints)} soft constraints")
        
    
        
    def create_chromosome(self) -> Chromosome:
        """Create a chromosome from provided timeslots or generate a random one if none provided."""
        if self.timeslots:
            # Use provided timeslots to create the chromosome
            schedule_items = []
            for ts in self.timeslots:
                schedule_item = ScheduleItem(
                    course_id=ts.course_id,
                    course_name=ts.course_name,
                    lecturer_id=ts.lecturer_id,
                    lecturer_name=ts.lecturer_name,
                    room_id=ts.room_id,
                    room_name=ts.room_name,
                    day=ts.day_of_the_week,
                    start_time=ts.start_time,
                    end_time=ts.end_time,
                    timeslot_id=ts.timeslot_id,
                    semester=ts.semester,
                    year=ts.year
                )
                schedule_items.append(schedule_item)
            return Chromosome(schedule_items)
        else:
            # Fallback to random chromosome generation if no timeslots provided
            return self.create_random_chromosome()
        
    def __del__(self):
        if self.pool:
            self.pool.close()
            self.pool.join()

    def _initialize_pool(self):
        if self.pool is None:
            self.pool = multiprocessing.Pool(processes=multiprocessing.cpu_count())

            
    def _create_course_lecturer_mapping(self) -> Dict[str, str]:
        """
        Create a mapping of course_id to lecturer_id based on available data
        This ensures each course is assigned to the correct lecturer
        """
        mapping = {}
        
        # First, check courses for lecturer assignment
        for course_id, course in self.courses.items():
            if hasattr(course, 'lecturer_id') and course.lecturer_id:
                mapping[course_id] = course.lecturer_id
        
        # Then, check lecturers for course assignments
        for lecturer_id, lecturer in self.lecturers.items():
            if hasattr(lecturer, 'course_id') and lecturer.course_id:
                # Extract the course_id (could be a single value or list)
                course_ids = []
                if isinstance(lecturer.course_id, list):
                    course_ids = lecturer.course_id
                else:
                    course_ids = [lecturer.course_id]
                
                # Assign this lecturer to each of their courses
                for course_id in course_ids:
                    mapping[course_id] = lecturer_id
            
            # Also check the courses list if it exists
            if hasattr(lecturer, 'courses') and lecturer.courses:
                for course_id in lecturer.courses:
                    mapping[course_id] = lecturer_id
        
        print(f"Created course to lecturer mapping with {len(mapping)} entries")
        return mapping
            
    def _load_lecturers(self) -> Dict[str, Lecturer]:
        """Load all lecturers from the database and associate with their courses"""
        lecturers = {}
        db_lecturers = self.db.query(Lecturer).all()
            
        for lecturer in db_lecturers:
            lecturers[lecturer.lecturer_id] = lecturer
            # Initialize courses list if it doesn't exist
            if not hasattr(lecturer, 'courses'):
                lecturer.courses = []
            
            # Add the course_id from the lecturer record
            if hasattr(lecturer, 'course_id') and lecturer.course_id:
                lecturer.courses.append(lecturer.course_id)
        
        return lecturers
    def _load_courses(self, year=None):
        """
        Load courses for the specified semester and optionally filtered by year
        """
        courses = {}
        query = self.db.query(Course).filter(Course.semester == self.semester)
        
        # Filter by year if specified
        if year is not None and year > 0:
            query = query.filter(Course.year == year)
        
        db_courses = query.all()
        for course in db_courses:
            # Store the course in the dictionary
            courses[course.course_id] = course
            
            # Determine how many sessions this course needs based on credit hours
            if hasattr(course, 'credit'):
                # Assuming 1 credit = 1 hour per week, and each session is 2 hours
                # So a 3-credit course would have 1-2 sessions per week
                sessions_count = max(1, course.credit // 2)
                course.sessions_count = sessions_count
            else:
                # Default to 1 session if credit information is not available
                course.sessions_count = 1
        
        print(f"Loaded {len(courses)} courses for semester {self.semester}" + 
            (f" and year {year}" if year else ""))
        
        # Verify we have courses
        if len(courses) == 0:
            print(f"WARNING: No courses found for semester {self.semester}" + 
                (f" and year {year}" if year else ""))
        
        return courses

            
    def _load_rooms(self) -> Dict[str, Room]:
        """Load all rooms from the database"""
        rooms = self.db.query(Room).all()
        return {room.room_id: room for room in rooms}
    
    def _load_constraints(self) -> List[Constraint]:
        """Load all constraints from the database"""
        constraints = self.db.query(Constraint).all()
        return constraints
    
    def initialize_population(self):
        """Create an initial random population of chromosomes"""
        print("Initializing population...")
        self.population = []
        
        for _ in range(self.population_size):
            chromosome = self.create_random_chromosome()
            self.population.append(chromosome)
        
        print(f"Population initialized with {len(self.population)} chromosomes")
    
    def create_random_chromosome(self) -> Chromosome:
        chromosome = Chromosome()
        lecturer_schedule = {l_id: {day: [] for day in DAYS} for l_id in self.lecturers}
        room_schedule = {r_id: {day: [] for day in DAYS} for r_id in self.rooms}
        student_schedule = defaultdict(lambda: {day: [] for day in DAYS})
        
        # Helper function to check valid timeslot (especially for Friday prayer time)
        def is_valid_timeslot(day, period):
            if day == "Friday":
                start_time, end_time = period_to_time(period)
                prayer_start = time(12, 30)
                prayer_end = time(14, 30)
                return not ((start_time >= prayer_start and start_time < prayer_end) or 
                        (end_time > prayer_start and end_time <= prayer_end))
            return True

        # Generate valid time slots excluding Friday prayer time
        valid_time_slots = []
        for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
            for period in range(1, PERIODS_PER_DAY + 1):
                if is_valid_timeslot(day, period):
                    start_time, end_time = period_to_time(period)
                    valid_time_slots.append(TimeSlot(day=day, start_time=start_time, end_time=end_time))
        
        # Sort courses by priority: lab courses first, then by student count
        course_order = sorted(
            self.courses.keys(),
            key=lambda c_id: (
                'Lab' not in self.courses[c_id].course_name,
                -self.courses[c_id].no_of_students
            )
        )
        
        # Track scheduled courses to ensure none are missed
        scheduled_courses = set()
        
        for course_id in course_order:
            course = self.courses[course_id]
            sessions_needed = getattr(course, 'sessions_count', 1)
            student_group = getattr(course, 'student_group', course_id)
            
            assigned_lecturer_id = self.course_lecturer_mapping.get(course_id)
            if not assigned_lecturer_id:
                print(f"Warning: No lecturer assigned for course {course_id}")
                continue
                
            is_lab_course = "Lab" in course.course_name
            
            # Find suitable rooms with capacity (with 10% buffer)
            suitable_rooms = [
                r_id for r_id, r in self.rooms.items()
                if r.capacity >= course.no_of_students * 1.1 and 
                ((is_lab_course and getattr(r, 'room_type', '') == "LAB") or 
                 (not is_lab_course))
            ]
            
            if not suitable_rooms:
                print(f"Warning: No suitable rooms found for {course.course_name}")
                suitable_rooms = list(self.rooms.keys())  # Fallback to all rooms
                
            for session in range(sessions_needed):
                scheduled = False
                max_attempts = 200
                attempts = 0
                
                while not scheduled and attempts < max_attempts:
                    attempts += 1
                    new_timeslot = random.choice(valid_time_slots)
                    
                    # Check lecturer availability
                    lecturer_conflict = any(
                        timeslots_overlap(new_timeslot, existing_slot)
                        for existing_slot in lecturer_schedule[assigned_lecturer_id][new_timeslot.day]
                    )
                    if lecturer_conflict:
                        continue
                        
                    # Find available room
                    random.shuffle(suitable_rooms)
                    room_id = None
                    for r_id in suitable_rooms:
                        room_conflict = any(
                            timeslots_overlap(new_timeslot, existing_slot)
                            for existing_slot in room_schedule[r_id][new_timeslot.day]
                        )
                        if not room_conflict:
                            room_id = r_id
                            break
                            
                    if not room_id:
                        continue
                        
                    # Check student group availability
                    student_conflict = any(
                        timeslots_overlap(new_timeslot, existing_slot)
                        for existing_slot in student_schedule[student_group][new_timeslot.day]
                    )
                    if student_conflict:
                        continue
                        
                    # If all checks passed, schedule the course
                    schedule_item = ScheduleItem(
                        course_id=course_id,
                        course_name=course.course_name,
                        lecturer_id=assigned_lecturer_id,
                        lecturer_name=self.lecturers[assigned_lecturer_id].lecturer_name,
                        room_id=room_id,
                        room_name=self.rooms[room_id].room_name,
                        day=new_timeslot.day,
                        start_time=new_timeslot.start_time,
                        end_time=new_timeslot.end_time,
                        semester=self.semester,
                        year=self.year
                    )
                    chromosome.schedule_items.append(schedule_item)
                    lecturer_schedule[assigned_lecturer_id][new_timeslot.day].append(new_timeslot)
                    room_schedule[room_id][new_timeslot.day].append(new_timeslot)
                    student_schedule[student_group][new_timeslot.day].append(new_timeslot)
                    scheduled = True
                    scheduled_courses.add(course_id)
                    
                if not scheduled:
                    print(f"Warning: Could not schedule {course.course_name} after {max_attempts} attempts")
        
        # Ensure all courses are scheduled - fallback with potential conflicts
        missing_courses = set(self.courses.keys()) - scheduled_courses
        for course_id in missing_courses:
            course = self.courses[course_id]
            print(f"Fallback scheduling for missing course: {course.course_name}")
            
            assigned_lecturer_id = self.course_lecturer_mapping.get(course_id)
            if not assigned_lecturer_id:
                assigned_lecturer_id = random.choice(list(self.lecturers.keys()))
                
            # Find any available timeslot and room, even if it causes conflicts
            # Choose day with least classes
            chosen_day = min(get_distribution.keys(), key=lambda d: get_distribution[d])
            day_slots = [ts for ts in valid_time_slots if ts.day == chosen_day]
            if not day_slots:
                day_slots = valid_time_slots
                
            new_timeslot = random.choice(day_slots)
            room_id = random.choice(list(self.rooms.keys()))
            
            schedule_item = ScheduleItem(
                course_id=course_id,
                course_name=course.course_name,
                lecturer_id=assigned_lecturer_id,
                lecturer_name=self.lecturers[assigned_lecturer_id].lecturer_name,
                room_id=room_id,
                room_name=self.rooms[room_id].room_name,
                day=new_timeslot.day,
                start_time=new_timeslot.start_time,
                end_time=new_timeslot.end_time,
                semester=self.semester,
                year=self.year
            )
            chromosome.schedule_items.append(schedule_item)
            get_distribution[new_timeslot.day] += 1
        
        return chromosome
    def calculate_fitness(self, chromosome: Chromosome) -> float:
        """Calculate fitness score with proper conflict detection"""
        hard_constraints_penalty = 0
        soft_constraints_penalty = 0
        chromosome.conflicts = []
        chromosome.hard_violations = 0
        chromosome.soft_violations = 0
        
        # Initialize tracking structures
        room_bookings = defaultdict(list)  # {room_id: [timeslots]}
        lecturer_bookings = defaultdict(list)  # {lecturer_id: [timeslots]}
        student_group_bookings = defaultdict(list)  # {student_group: [timeslots]}
        sessions_scheduled = defaultdict(int)
        
        # First pass: collect all bookings and validate individual items
        for item in chromosome.schedule_items:
            timeslot = TimeSlot(day=item.day, start_time=item.start_time, end_time=item.end_time)
            course = self.courses.get(item.course_id)
            
            if not course:
                self._add_conflict(
                    chromosome,
                    "MISSING_COURSE",
                    f"Course {item.course_id} not found in database",
                    [item],
                    severity="hard"
                )
                hard_constraints_penalty += 50000  # Very high penalty
                continue
            
            # Track session count
            sessions_scheduled[item.course_id] += 1
            
            # Check room capacity (HC3)
            room = self.rooms.get(item.room_id)
            if room and room.capacity < course.no_of_students:
                self._add_conflict(
                    chromosome,
                    "ROOM_CAPACITY",
                    f"Room {item.room_id} (capacity: {room.capacity}) too small for course {course.course_name} ({course.no_of_students} students)",
                    [item],
                    "HC3",
                    "hard"
                )
                hard_constraints_penalty += 10000
                
            # Check lab course in lab room (HC4)
            is_lab_course = "Lab" in course.course_name
            if is_lab_course and getattr(room, 'room_type', '') != "LAB":
                self._add_conflict(
                    chromosome,
                    "LAB_COURSE_IN_NON_LAB_ROOM",
                    f"Lab course {course.course_name} scheduled in non-lab room {item.room_id}",
                    [item],
                    "HC4",
                    "hard"
                )
                hard_constraints_penalty += 50000
                
            # Check lecturer assignments (HC7)
            expected_lecturer = self.course_lecturer_mapping.get(item.course_id)
            if expected_lecturer and expected_lecturer != item.lecturer_id:
                self._add_conflict(
                    chromosome,
                    "INCORRECT_LECTURER",
                    f"Course {course.course_name} assigned to wrong lecturer {item.lecturer_id} (should be {expected_lecturer})",
                    [item],
                    "HC7",
                    "hard"
                )
                hard_constraints_penalty += 50000
            
            # Check Friday prayer time (HC13)
            if item.day == "Friday":
                prayer_start = time(12, 30)
                prayer_end = time(14, 30)
                if (item.start_time >= prayer_start and item.start_time < prayer_end) or \
                (item.end_time > prayer_start and item.end_time <= prayer_end):
                    self._add_conflict(
                        chromosome,
                        "PRAYER_TIME_CONFLICT",
                        f"Class scheduled during Friday prayer time (12:30-14:30)",
                        [item],
                        "HC13",
                        "hard"
                    )
                    hard_constraints_penalty += 50000
            
            # Collect bookings for overlap detection
            room_bookings[item.room_id].append((timeslot, item))
            lecturer_bookings[item.lecturer_id].append((timeslot, item))
            
            # Get student group (fallback to course_id if not specified)
            student_group = getattr(course, 'student_group', item.course_id)
            student_group_bookings[student_group].append((timeslot, item))
            
            # Check soft constraints
            # Weekend classes (SC4)
            if item.day in ["Saturday", "Sunday"]:
                self._add_conflict(
                    chromosome,
                    "WEEKEND_CLASS",
                    f"Class scheduled on weekend: {item.day}",
                    [item],
                    "SC4",
                    "soft"
                )
                soft_constraints_penalty += 1
                
            # Early morning classes (SC1)
            early_start = time(8, 30)
            early_end = time(10, 0)
            if (item.start_time < early_end and item.end_time > early_start):
                self._add_conflict(
                    chromosome,
                    "EARLY_MORNING_CLASS",
                    f"Class scheduled during early morning hours (8:30-10:00)",
                    [item],
                    "SC1",
                    "soft"
                )
                soft_constraints_penalty += 0.5
                
            # Late evening classes (SC2)
            late_start = time(16, 0)
            late_end = time(18, 30)
            if (item.start_time < late_end and item.end_time > late_start):
                self._add_conflict(
                    chromosome,
                    "LATE_EVENING_CLASS",
                    f"Class scheduled during late evening hours (16:00-18:30)",
                    [item],
                    "SC2",
                    "soft"
                )
                soft_constraints_penalty += 0.5
        
        # Second pass: detect overlap conflicts
        processed_conflicts = set()  # To avoid duplicate conflict reporting
        
        for item in chromosome.schedule_items:
            timeslot = TimeSlot(day=item.day, start_time=item.start_time, end_time=item.end_time)
            course = self.courses.get(item.course_id)
            if not course:
                continue
                
            student_group = getattr(course, 'student_group', item.course_id)
            
            # Check room overlaps (HC2)
            room_conflicts = [
                existing_item for existing_slot, existing_item in room_bookings[item.room_id]
                if existing_item.course_id != item.course_id and timeslots_overlap(timeslot, existing_slot)
            ]
            
            if room_conflicts:
                conflict_id = tuple(sorted([item.course_id] + [c.course_id for c in room_conflicts]))
                if ("ROOM_OVERLAP", conflict_id) not in processed_conflicts:
                    self._add_conflict(
                        chromosome,
                        "ROOM_OVERLAP",
                        f"Room {item.room_name} double-booked",
                        [item] + room_conflicts,
                        "HC2",
                        "hard"
                    )
                    hard_constraints_penalty += 10000
                    processed_conflicts.add(("ROOM_OVERLAP", conflict_id))
            
            # Check lecturer overlaps (HC1)
            lecturer_conflicts = [
                existing_item for existing_slot, existing_item in lecturer_bookings[item.lecturer_id]
                if existing_item.course_id != item.course_id and timeslots_overlap(timeslot, existing_slot)
            ]
            
            if lecturer_conflicts:
                conflict_id = tuple(sorted([item.course_id] + [c.course_id for c in lecturer_conflicts]))
                if ("LECTURER_OVERLAP", conflict_id) not in processed_conflicts:
                    self._add_conflict(
                        chromosome,
                        "LECTURER_OVERLAP",
                        f"Lecturer {item.lecturer_name} has overlapping classes",
                        [item] + lecturer_conflicts,
                        "HC1",
                        "hard"
                    )
                    hard_constraints_penalty += 10000
                    processed_conflicts.add(("LECTURER_OVERLAP", conflict_id))
            
            # Check student group overlaps (HC5)
            student_conflicts = [
                existing_item for existing_slot, existing_item in student_group_bookings[student_group]
                if existing_item.course_id != item.course_id and timeslots_overlap(timeslot, existing_slot)
            ]
            
            if student_conflicts:
                conflict_id = tuple(sorted([item.course_id] + [c.course_id for c in student_conflicts]))
                if ("STUDENT_OVERLAP", conflict_id) not in processed_conflicts:
                    self._add_conflict(
                        chromosome,
                        "STUDENT_OVERLAP",
                        f"Student group {student_group} has overlapping classes",
                        [item] + student_conflicts,
                        "HC5",
                        "hard"
                    )
                    hard_constraints_penalty += 10000
                    processed_conflicts.add(("STUDENT_OVERLAP", conflict_id))
        
        # Check missing courses (HC8)
        missing_courses = set(self.courses.keys()) - {item.course_id for item in chromosome.schedule_items}
        if missing_courses:
            self._add_conflict(
                chromosome,
                "MISSING_COURSES",
                f"Missing {len(missing_courses)} courses: {', '.join(missing_courses)}",
                [],
                "HC8",
                "hard"
            )
            hard_constraints_penalty += len(missing_courses) * 10000
            
        # Check session counts (SC1 for overscheduling, HC9 for underscheduling)
        for course_id, course in self.courses.items():
            sessions_needed = getattr(course, 'sessions_count', 1)
            scheduled = sessions_scheduled.get(course_id, 0)
            
            if scheduled < sessions_needed:
                self._add_conflict(
                    chromosome,
                    "UNDER_SCHEDULED",
                    f"{course.course_name} has only {scheduled}/{sessions_needed} sessions scheduled",
                    [x for x in chromosome.schedule_items if x.course_id == course_id],
                    "HC9",
                    "hard"
                )
                hard_constraints_penalty += (sessions_needed - scheduled) * 10000
            elif scheduled > sessions_needed:
                self._add_conflict(
                    chromosome,
                    "OVER_SCHEDULED",
                    f"{course.course_name} has {scheduled}/{sessions_needed} sessions (too many)",
                    [x for x in chromosome.schedule_items if x.course_id == course_id],
                    "SC1",
                    "soft"
                )
                soft_constraints_penalty += (scheduled - sessions_needed) * 10
        
        # Calculate timeslot utilization
        used_timeslots = set()
        for item in chromosome.schedule_items:
            timeslot_str = f"{item.day}_{item.start_time}_{item.end_time}"
            used_timeslots.add(timeslot_str)
        
        total_possible_slots = PERIODS_PER_DAY * 5  # 5 weekdays
        utilization = len(used_timeslots) / total_possible_slots
        soft_constraints_penalty += (1 - utilization) * 5  # Penalize low utilization
        
        # Store violation counts
        chromosome.hard_violations = sum(1 for c in chromosome.conflicts if c.severity == 'hard')
        chromosome.soft_violations = sum(1 for c in chromosome.conflicts if c.severity == 'soft')
        
        # Final fitness calculation
        if hard_constraints_penalty > 0:
            fitness = 1 / (1 + hard_constraints_penalty)
        else:
            fitness = 1 + (1 / (1 + soft_constraints_penalty))
            
        return fitness

    def _add_conflict(self, chromosome, conflict_type, description, items, constraint=None, severity="hard"):
        """Enhanced conflict grouping with deduplication"""
        # Check if similar conflict already exists
        existing_conflict = None
        for conflict in chromosome.conflicts:
            if (conflict.type == conflict_type and 
                conflict.constraint == constraint and
                conflict.severity == severity):
                # Check if any items are the same
                common_items = set(i.course_id for i in conflict.items) & set(i.course_id for i in items)
                if common_items:
                    existing_conflict = conflict
                    break
        
        if existing_conflict:
            # Merge with existing conflict
            existing_items = {i.course_id: i for i in existing_conflict.items}
            for item in items:
                if item.course_id not in existing_items:
                    existing_conflict.items.append(item)
        else:
            # Create new conflict
            conflict = Conflict(
                type=conflict_type,
                description=description,
                items=items,
                constraint=constraint,
                severity=severity
            )
            chromosome.conflicts.append(conflict)
        
    def _process_constraints(self, item: ScheduleItem, timeslot: TimeSlot, 
                   hard_constraints_penalty, soft_constraints_penalty,
                   chromosome: Chromosome):
        if item.day == "Friday":
            prayer_start = time(12, 30)
            prayer_end = time(14, 30)
            prayer_slot = TimeSlot(day="Friday", start_time=prayer_start, end_time=prayer_end)
            if timeslots_overlap(timeslot, prayer_slot):
                hard_constraints_penalty += 1000
                chromosome.conflicts.append(Conflict(
                    type="PRAYER_TIME_CONFLICT",
                    description=f"Class scheduled during Friday prayer time (12:30-14:30)",
                    items=[item],
                    constraint="HC13",
                    constraint_value="STRICT",
                    severity="hard"
                ))
                return hard_constraints_penalty, soft_constraints_penalty

        for constraint in self.constraints:
            if ((constraint.course_id == item.course_id or constraint.course_id is None) and
                (constraint.lecturer_id == item.lecturer_id or constraint.lecturer_id is None) and
                (constraint.room_id == item.room_id or constraint.room_id is None)):

                constraint_type = constraint.constraint_type.upper()
                severity = "hard" if constraint.constraint_id.startswith("HC") else "soft"
                penalty = HARD_CONSTRAINT_PENALTY if severity == "hard" else SOFT_CONSTRAINT_PENALTY
                
                if constraint_type == "NO_WEEKEND_CLASSES":
                    weekend_days = constraint.constraint_value.split('&')
                    if item.day.strip() in [day.strip() for day in weekend_days]:
                        if item.day.strip() == "Sunday":
                            hard_constraints_penalty += 10.0
                            severity = "hard"
                        else:
                            soft_constraints_penalty += 0.5
                            severity = "soft"
                            
                        chromosome.conflicts.append(Conflict(
                            type="WEEKEND_CLASS",
                            description=f"Class scheduled on weekend day {item.day}",
                            items=[ScheduleItem(
                                course_id=item.course_id,
                                course_name=item.course_name,
                                lecturer_id=item.lecturer_id,
                                lecturer_name=item.lecturer_name,
                                room_id=item.room_id,
                                room_name=item.room_name,
                                day=item.day,
                                start_time=item.start_time,
                                end_time=item.end_time,
                                semester=self.semester,
                                year=self.year
                            )],
                            constraint=constraint.constraint_id,
                            constraint_value="STRICT" if item.day.strip() == "Sunday" else "PREFERRED",
                            severity=severity
                        ))

                elif constraint_type in ["AVIOD_EARLY_MORNING_CLASS", "AVOID_EARLY_MORNING_CLASS"]:
                    early_start, early_end = constraint.constraint_value.split('-')
                    early_start_time = parse_time_string(early_start)
                    early_end_time = parse_time_string(early_end)
                    early_slot = TimeSlot(day=item.day, start_time=early_start_time, end_time=early_end_time)
                    if timeslots_overlap(timeslot, early_slot):
                        soft_constraints_penalty += 0.5
                        chromosome.conflicts.append(Conflict(
                            type="EARLY_MORNING_CLASS",
                            description=f"Class scheduled during early morning hours {early_start}-{early_end}",
                            items=[ScheduleItem(
                                course_id=item.course_id,
                                course_name=item.course_name,
                                lecturer_id=item.lecturer_id,
                                lecturer_name=item.lecturer_name,
                                room_id=item.room_id,
                                room_name=item.room_name,
                                day=item.day,
                                start_time=item.start_time,
                                end_time=item.end_time,
                                semester=self.semester,
                                year=self.year
                            )],
                            constraint=constraint.constraint_id,
                            constraint_value="PREFERRED",
                            severity="soft"
                        ))

                elif constraint_type == "AVOID_LATE_NIGHT_CLASS":
                    late_start, late_end = constraint.constraint_value.split('-')
                    late_start_time = parse_time_string(late_start)
                    late_end_time = parse_time_string(late_end)
                    late_slot = TimeSlot(day=item.day, start_time=late_start_time, end_time=late_end_time)
                    if timeslots_overlap(timeslot, late_slot):
                        soft_constraints_penalty += 0.5
                        chromosome.conflicts.append(Conflict(
                            type="LATE_NIGHT_CLASS",
                            description=f"Class scheduled during late night hours {late_start}-{late_end}",
                            items=[ScheduleItem(
                                course_id=item.course_id,
                                course_name=item.course_name,
                                lecturer_id=item.lecturer_id,
                                lecturer_name=item.lecturer_name,
                                room_id=item.room_id,
                                room_name=item.room_name,
                                day=item.day,
                                start_time=item.start_time,
                                end_time=item.end_time,
                                semester=self.semester,
                                year=self.year
                            )],
                            constraint=constraint.constraint_id,
                            constraint_value="PREFERRED",
                            severity="soft"
                        ))

                elif (constraint_type == "PRAYER_TIME_FRIDAY" or 
                    constraint_type == "PRAYER_TIME") and item.day == "Friday":
                    prayer_times = constraint.constraint_value.split('-')
                    if len(prayer_times) == 2:
                        prayer_start_time = parse_time_string(prayer_times[0])
                        prayer_end_time = parse_time_string(prayer_times[1])
                        prayer_slot = TimeSlot(day="Friday", start_time=prayer_start_time, end_time=prayer_end_time)
                        if timeslots_overlap(timeslot, prayer_slot):
                            hard_constraints_penalty += 1000
                            chromosome.conflicts.append(Conflict(
                                type="PRAYER_TIME_CONFLICT",
                                description=f"Class scheduled during Friday prayer time {prayer_times[0]}-{prayer_times[1]}",
                                items=[ScheduleItem(
                                    course_id=item.course_id,
                                    course_name=item.course_name,
                                    lecturer_id=item.lecturer_id,
                                    lecturer_name=item.lecturer_name,
                                    room_id=item.room_id,
                                    room_name=item.room_name,
                                    day=item.day,
                                    start_time=item.start_time,
                                    end_time=item.end_time,
                                    semester=self.semester,
                                    year=self.year
                                )],
                                constraint=constraint.constraint_id,
                                constraint_value="STRICT",
                                severity="hard"
                            ))

                elif constraint_type == "AVOID_CONSECUTIVE_LECTURES":
                    rest_minutes = int(constraint.constraint_value)
                    lecturer_schedule = self.lecturer_schedules.get(item.lecturer_id, {}).get(item.day, [])
                    for existing_slot in lecturer_schedule:
                        gap_minutes = abs(
                            (timeslot.start_time.hour * 60 + timeslot.start_time.minute) -
                            (existing_slot.end_time.hour * 60 + existing_slot.end_time.minute)
                        )
                        if gap_minutes < rest_minutes:
                            soft_constraints_penalty += 0.5
                            conflicting_item = next(
                                (x for x in chromosome.schedule_items 
                                if x.lecturer_id == item.lecturer_id 
                                and x.day == item.day 
                                and x.start_time == existing_slot.start_time 
                                and x.end_time == existing_slot.end_time),
                                None
                            )
                            if conflicting_item:
                                chromosome.conflicts.append(Conflict(
                                    type="INSUFFICIENT_REST_TIME",
                                    description=f"Less than {rest_minutes} minutes between classes for lecturer {item.lecturer_id}",
                                    items=[ScheduleItem(
                                        course_id=item.course_id,
                                        course_name=item.course_name,
                                        lecturer_id=item.lecturer_id,
                                        lecturer_name=item.lecturer_name,
                                        room_id=item.room_id,
                                        room_name=item.room_name,
                                        day=item.day,
                                        start_time=item.start_time,
                                        end_time=item.end_time,
                                        semester=self.semester,
                                        year=self.year
                                    ), ScheduleItem(
                                        course_id=conflicting_item.course_id,
                                        course_name=conflicting_item.course_name,
                                        lecturer_id=conflicting_item.lecturer_id,
                                        lecturer_name=conflicting_item.lecturer_name,
                                        room_id=conflicting_item.room_id,
                                        room_name=conflicting_item.room_name,
                                        day=conflicting_item.day,
                                        start_time=conflicting_item.start_time,
                                        end_time=conflicting_item.end_time,
                                        semester=self.semester,
                                        year=self.year
                                    )],
                                    constraint=constraint.constraint_id,
                                    constraint_value="PREFERRED",
                                    severity="soft"
                                ))
                
                elif constraint_type == "EVENING_LECTURES_IN_AC_ROOMS":
                    evening_start, evening_end = constraint.constraint_value.split('-')
                    evening_start_time = parse_time_string(evening_start)
                    evening_end_time = parse_time_string(evening_end)
                    evening_slot = TimeSlot(day=item.day, start_time=evening_start_time, end_time=evening_end_time)
                    if timeslots_overlap(timeslot, evening_slot):
                        room = self.rooms[item.room_id]
                        has_ac = hasattr(room, 'has_ac') and room.has_ac
                        if not has_ac:
                            soft_constraints_penalty += 1.0
                            chromosome.conflicts.append(Conflict(
                                type="NON_AC_EVENING_CLASS",
                                description=f"Evening class in non-AC room {item.room_id}",
                                items=[ScheduleItem(
                                    course_id=item.course_id,
                                    course_name=item.course_name,
                                    lecturer_id=item.lecturer_id,
                                    lecturer_name=item.lecturer_name,
                                    room_id=item.room_id,
                                    room_name=item.room_name,
                                    day=item.day,
                                    start_time=item.start_time,
                                    end_time=item.end_time,
                                    semester=self.semester,
                                    year=self.year
                                )],
                                constraint=constraint.constraint_id,
                                constraint_value="PREFERRED",
                                severity="soft"
                            ))
        
        course = self.courses[item.course_id]
        room = self.rooms[item.room_id]
        course_name = course.course_name if hasattr(course, 'course_name') else ""
        room_type = room.room_type if hasattr(room, 'room_type') else ""
        
        if "Lab" in course_name and room_type != "LAB":
            hard_constraints_penalty += 5
            chromosome.conflicts.append(Conflict(
                type="LAB_COURSE_IN_NON_LAB_ROOM",
                description=f"Lab course {course_name} scheduled in non-lab room {room.room_name}",
                items=[ScheduleItem(
                    course_id=item.course_id,
                    course_name=item.course_name,
                    lecturer_id=item.lecturer_id,
                    lecturer_name=item.lecturer_name,
                    room_id=item.room_id,
                    room_name=item.room_name,
                    day=item.day,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    semester=self.semester,
                    year=self.year
                )],
                constraint="HC11",
                constraint_value="STRICT",
                severity="hard"
            ))
        
        if any(suffix in course_name.split() for suffix in ["A", "B", "C", "D"]) and room_type != "LAB":
            soft_constraints_penalty += 0.8
            chromosome.conflicts.append(Conflict(
                type="LETTERED_COURSE_IN_NON_LAB_ROOM",
                description=f"Lettered course {course_name} scheduled in non-lab room {room.room_name}",
                items=[ScheduleItem(
                    course_id=item.course_id,
                    course_name=item.course_name,
                    lecturer_id=item.lecturer_id,
                    lecturer_name=item.lecturer_name,
                    room_id=item.room_id,
                    room_name=item.room_name,
                    day=item.day,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    semester=self.semester,
                    year=self.year
                )],
                constraint="SC3",
                constraint_value="PREFERRED",
                severity="soft"
            ))
        
        class_start_minutes = timeslot.start_time.hour * 60 + timeslot.start_time.minute
        class_end_minutes = timeslot.end_time.hour * 60 + timeslot.end_time.minute
        
        earliest_allowed = STARTING_HOUR * 60 + STARTING_MINUTE
        latest_allowed = ENDING_HOUR * 60 + ENDING_MINUTE
        
        if class_start_minutes < earliest_allowed or class_end_minutes > latest_allowed:
            hard_constraints_penalty += 3
            chromosome.conflicts.append(Conflict(
                type="OUTSIDE_ALLOWED_HOURS",
                description=f"Class scheduled outside allowed hours (8:30-18:30)",
                items=[ScheduleItem(
                    course_id=item.course_id,
                    course_name=item.course_name,
                    lecturer_id=item.lecturer_id,
                    lecturer_name=item.lecturer_name,
                    room_id=item.room_id,
                    room_name=item.room_name,
                    day=item.day,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    semester=self.semester,
                    year=self.year
                )],
                constraint="HC12",
                constraint_value="STRICT",
                severity="hard"
            ))
        
        return hard_constraints_penalty, soft_constraints_penalty
    
    
    def evaluate_population(self):
        """Calculate fitness for all chromosomes in the population"""
        for chromosome in self.population:
            chromosome.fitness = self.calculate_fitness(chromosome)
    
    def tournament_selection(self) -> Chromosome:
        tournament = random.sample(self.population, self.tournament_size)
        return max(tournament, key=lambda chromosome: chromosome.fitness)

    
    def crossover(self, parent1: Chromosome, parent2: Chromosome) -> Tuple[Chromosome, Chromosome]:
        if random.random() > self.crossover_rate:
            return parent1.copy(), parent2.copy()
        
        p1_items_by_course = {item.course_id: item for item in parent1.schedule_items}
        p2_items_by_course = {item.course_id: item for item in parent2.schedule_items}
        
        child1_items = []
        child2_items = []
        
        all_courses = set(list(p1_items_by_course.keys()) + list(p2_items_by_course.keys()))
        
        for course_id in all_courses:
            if course_id in p1_items_by_course and course_id in p2_items_by_course:
                if random.random() < 0.5:
                    child1_items.append(p1_items_by_course[course_id])
                    child2_items.append(p2_items_by_course[course_id])
                else:
                    child1_items.append(p2_items_by_course[course_id])
                    child2_items.append(p1_items_by_course[course_id])
            elif course_id in p1_items_by_course:
                child1_items.append(p1_items_by_course[course_id])
                child2_items.append(self._create_random_schedule_item(course_id))
            else:
                child2_items.append(p2_items_by_course[course_id])
                child1_items.append(self._create_random_schedule_item(course_id))
        
        child1 = Chromosome(child1_items)
        child2 = Chromosome(child2_items)
        
        return child1, child2
    
    
    def _create_random_schedule_item(self, course_id: str) -> ScheduleItem:
        """Create a random schedule item for a course with room diversity in mind"""
        course = self.courses[course_id]
        
        # Find the assigned lecturer for this course
        assigned_lecturer_id = self.course_lecturer_mapping.get(course_id)
        
        # If no assigned lecturer found, assign randomly as fallback
        if not assigned_lecturer_id:
            assigned_lecturer_id = random.choice(list(self.lecturers.keys()))
        
        # Check if this is a lab course or lettered course    
        course_name = course.course_name if hasattr(course, 'course_name') else ""
        is_lab_course = "Lab" in course_name
        is_lettered_course = any(suffix in course_name.split() for suffix in ["A", "B", "C", "D"])
        
        # Identify student group for this course
        student_group = course.student_group if hasattr(course, 'student_group') else course_id
        
        # Find suitable rooms based on course type
        suitable_rooms = []
        if is_lab_course:
            # Try to find LAB rooms with sufficient capacity
            lab_rooms = [r_id for r_id, r in self.rooms.items() 
                        if hasattr(r, 'room_type') and r.room_type == "LAB" 
                        and r.capacity >= course.no_of_students]
            
            if lab_rooms:
                suitable_rooms = lab_rooms
            else:
                # Fallback to any room with sufficient capacity
                suitable_rooms = [r_id for r_id, r in self.rooms.items() 
                                if r.capacity >= course.no_of_students]
        elif is_lettered_course:
            # For lettered courses, prefer LAB rooms but don't require them
            lab_rooms = [r_id for r_id, r in self.rooms.items() 
                        if hasattr(r, 'room_type') and r.room_type == "LAB" 
                        and r.capacity >= course.no_of_students]
            
            if lab_rooms and random.random() < 0.7:  # 70% chance to use a LAB room
                suitable_rooms = lab_rooms
            else:
                suitable_rooms = [r_id for r_id, r in self.rooms.items() 
                                if r.capacity >= course.no_of_students]
        else:
            # For other courses, any room with sufficient capacity
            suitable_rooms = [r_id for r_id, r in self.rooms.items() 
                            if r.capacity >= course.no_of_students]
        
        if not suitable_rooms:
            suitable_rooms = list(self.rooms.keys())
        
        # ENHANCED ROOM SELECTION: 
        # 1. Check which rooms this student group has already used in the current chromosome
        used_rooms = set()
        for item in self.population[0].schedule_items if self.population else []:
            if item.course_id == course_id or (hasattr(course, 'student_group') and 
            hasattr(self.courses.get(item.course_id), 'student_group') and 
            course.student_group == self.courses[item.course_id].student_group):
                used_rooms.add(item.room_id)
        
        # 2. Prioritize unused rooms with sufficient capacity
        unused_rooms = [r_id for r_id in suitable_rooms if r_id not in used_rooms]
        
        # 3. Select a room with preference for unused rooms
        if unused_rooms:
            room_id = random.choice(unused_rooms)
        else:
            # If all rooms have been used, add randomness by shuffling options instead of picking first
            room_id = random.choice(suitable_rooms)
        
        # ONLY WEEKDAYS - NEVER WEEKENDS
        day = random.choice(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
        
        period = random.randint(1, PERIODS_PER_DAY)
        start_time, end_time = period_to_time(period)
        
        return ScheduleItem(
            course_id=course_id,
            course_name=self.courses[course_id].course_name,
            lecturer_id=assigned_lecturer_id,
            lecturer_name=self.lecturers[assigned_lecturer_id].lecturer_name,
            room_id=room_id,
            room_name=self.rooms[room_id].room_name if room_id in self.rooms else 'Unknown',
            day=day,
            start_time=start_time,
            end_time=end_time
        )
    
    def mutate(self, chromosome: Chromosome) -> Chromosome:
        if random.random() > self.mutation_rate:
            return chromosome
        
        mutated = chromosome.copy()
        
        if not mutated.schedule_items:
            return mutated
        
        item_idx = random.randint(0, len(mutated.schedule_items) - 1)
        item = mutated.schedule_items[item_idx]
        
        mutation_type = random.choice(["time", "room", "day"])
        
        if mutation_type == "time":
            period = random.randint(1, PERIODS_PER_DAY)
            start_time, end_time = period_to_time(period)
            item.start_time = start_time
            item.end_time = end_time
        
        elif mutation_type == "room":
            course = self.courses[item.course_id]
            suitable_rooms = [r_id for r_id, r in self.rooms.items() 
                            if r.capacity >= course.no_of_students]
            if suitable_rooms:
                item.room_id = random.choice(suitable_rooms)
                item.room_name = self.rooms[item.room_id].room_name
        
        elif mutation_type == "day":
            item.day = random.choice(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])  # Ensure no weekends
        
        # Correct lecturer assignment
        expected_lecturer = self.course_lecturer_mapping.get(item.course_id)
        if expected_lecturer:
            item.lecturer_id = expected_lecturer
            item.lecturer_name = self.lecturers[expected_lecturer].lecturer_name
        
        return mutated
    
    def evolve(self):
        """Evolve the population for one generation"""
        new_population = []
        
        # Apply elitism - keep the best chromosomes
        elite = sorted(self.population, key=lambda chromosome: chromosome.fitness, reverse=True)[:self.elitism_count]
        new_population.extend(elite)
        
        # Fill the rest of the population with crossover and mutation
        while len(new_population) < self.population_size:
            parent1 = self.tournament_selection()
            parent2 = self.tournament_selection()
            
            child1, child2 = self.crossover(parent1, parent2)
            
            mutated_child1 = self.mutate(child1)
            mutated_child2 = self.mutate(child2)
            
            new_population.append(mutated_child1)
            if len(new_population) < self.population_size:
                new_population.append(mutated_child2)
        
        self.population = new_population
    
    def run(self):
        if not self.courses:
            print("No courses loaded. Terminating timetable generation.")
            return Chromosome()
        
        print("Starting genetic algorithm optimization...")
        
        # Generate initial population with distributed timeslots
        self.initialize_population()
        for i, chromosome in enumerate(self.population):
            self.population[i] = self._distribute_timeslots(chromosome)
        
        best_chromosome = self._run_evolution()
        
        # Ensure Friday prayer time is respected
        for item in best_chromosome.schedule_items:
            if item.day == "Friday":
                prayer_start = time(12, 30)
                prayer_end = time(14, 30)
                if (item.start_time >= prayer_start and item.start_time < prayer_end) or \
                (item.end_time > prayer_start and item.end_time <= prayer_end):
                    # Reschedule this item
                    new_timeslot = self._find_alternative_timeslot(item, best_chromosome, allow_weekends=False)
                    if new_timeslot:
                        item.day = new_timeslot.day
                        item.start_time = new_timeslot.start_time
                        item.end_time = new_timeslot.end_time
        
        return best_chromosome
    def _distribute_timeslots(self, chromosome: Chromosome):
        """Evenly distribute timeslots across available periods"""
        # Group schedule items by day
        by_day = defaultdict(list)
        for item in chromosome.schedule_items:
            by_day[item.day].append(item)
        
        # Calculate target number of classes per day
        total_classes = len(chromosome.schedule_items)
        target_per_day = total_classes // len(by_day)
        
        # For each day, distribute across periods
        for day, items in by_day.items():
            # Sort periods to distribute morning/afternoon evenly
            periods = list(range(1, PERIODS_PER_DAY + 1))
            # Alternate between morning and afternoon periods
            periods = sorted(periods, key=lambda p: (p % 2, p))
            
            # Distribute items across periods
            for i, item in enumerate(items):
                period = periods[i % len(periods)]
                start_time, end_time = period_to_time(period)
                item.start_time = start_time
                item.end_time = end_time
        
        return chromosome
    def _run_evolution(self):
        best_fitness = 0.0
        best_chromosome = None
        generations_without_improvement = 0
        
        for generation in range(self.max_generations):
            self.evolve()
            self.evaluate_population()
            
            current_best = max(self.population, key=lambda c: c.fitness)
            if current_best.fitness > best_fitness:
                best_fitness = current_best.fitness
                best_chromosome = current_best.copy()
                generations_without_improvement = 0
            else:
                generations_without_improvement += 1
                
            if generations_without_improvement >= MAX_GENERATIONS_WITHOUT_IMPROVEMENT:
                break
        
        return best_chromosome
    def _is_friday_prayer_time(self, timeslot: TimeSlot) -> bool:
        """Check if a timeslot overlaps with Friday prayer time"""
        if timeslot.day != "Friday":
            return False
            
        prayer_start = time(12, 30)
        prayer_end = time(14, 30)
        
        # Convert to minutes for easier comparison
        def time_to_minutes(t):
            return t.hour * 60 + t.minute
            
        slot_start = time_to_minutes(timeslot.start_time)
        slot_end = time_to_minutes(timeslot.end_time)
        prayer_start_min = time_to_minutes(prayer_start)
        prayer_end_min = time_to_minutes(prayer_end)
        
        return (slot_start < prayer_end_min and slot_end > prayer_start_min)
    # In GA.py, update the auto_resolve_conflicts function
    def auto_resolve_conflicts(self, chromosome: Chromosome) -> Chromosome:
        print("Starting enhanced auto-resolve process with hard constraint priority...")
        resolved_chromosome = chromosome.copy()
        max_attempts = 50  # Increased attempts for hard constraints
        resolved_conflicts = 0
        
        # First evaluate to get current conflicts
        self.calculate_fitness(resolved_chromosome)
        initial_conflicts = resolved_chromosome.conflicts.copy()
        
        if not initial_conflicts:
            print("No conflicts to resolve")
            return resolved_chromosome
        
        # Track original courses to ensure none are lost
        original_courses = {item.course_id for item in resolved_chromosome.schedule_items}
        
        # Process only hard conflicts first
        hard_conflicts = [c for c in initial_conflicts if c.severity == "hard"]
        
        for conflict in hard_conflicts:
            for attempt in range(max_attempts):
                # Try to resolve each conflict
                if conflict.type in ["ROOM_OVERLAP", "ROOM_CAPACITY"]:
                    # For room conflicts, try to find alternative rooms
                    for item in conflict.items:
                        new_room = self._find_alternative_room(item, resolved_chromosome)
                        if new_room:
                            item.room_id = new_room.room_id
                            item.room_name = new_room.room_name
                            break
                
                elif conflict.type in ["LECTURER_OVERLAP", "STUDENT_OVERLAP"]:
                    # For time conflicts, try to find alternative times
                    for item in conflict.items:
                        new_timeslot = self._find_alternative_timeslot(item, resolved_chromosome, allow_weekends=False)
                        if new_timeslot:
                            item.day = new_timeslot.day
                            item.start_time = new_timeslot.start_time
                            item.end_time = new_timeslot.end_time
                            break
                
                elif conflict.type == "LAB_COURSE_IN_NON_LAB_ROOM":
                    # Ensure lab courses are in lab rooms
                    for item in conflict.items:
                        course = self.courses[item.course_id]
                        lab_rooms = [
                            r_id for r_id, r in self.rooms.items()
                            if hasattr(r, 'room_type') and r.room_type == "LAB"
                            and r.capacity >= course.no_of_students
                        ]
                        if lab_rooms:
                            item.room_id = random.choice(lab_rooms)
                            item.room_name = self.rooms[item.room_id].room_name
                            break
                
                elif conflict.type == "MISSING_COURSES":
                    # Reschedule missing courses
                    for course_id in set(self.courses.keys()) - {item.course_id for item in resolved_chromosome.schedule_items}:
                        schedule_item = self._create_random_schedule_item(course_id)
                        resolved_chromosome.schedule_items.append(schedule_item)
                
                elif conflict.type == "PRAYER_TIME_CONFLICT":
                    for item in conflict.items:
                        new_timeslot = self._find_alternative_timeslot(item, resolved_chromosome, allow_weekends=False)
                        if new_timeslot:
                            item.day = new_timeslot.day
                            item.start_time = new_timeslot.start_time
                            item.end_time = new_timeslot.end_time
                            break
                
                # Re-evaluate after changes
                self.calculate_fitness(resolved_chromosome)
                current_hard_conflicts = [c for c in resolved_chromosome.conflicts if c.severity == "hard"]
                
                # Check if this specific conflict is resolved
                conflict_resolved = True
                for c in current_hard_conflicts:
                    if c.type == conflict.type and set(i.course_id for i in c.items) == set(i.course_id for i in conflict.items):
                        conflict_resolved = False
                        break
                
                if conflict_resolved:
                    resolved_conflicts += 1
                    break
        
        print(f"Resolved {resolved_conflicts}/{len(hard_conflicts)} hard conflicts")
        return resolved_chromosome
    def _find_alternative_timeslot(self, item: ScheduleItem, chromosome: Chromosome, 
                             allow_weekends: bool = False) -> Optional[TimeSlot]:
        """Find alternative timeslot that doesn't violate constraints (only weekdays)"""
        course = self.courses.get(item.course_id)
        if not course:
            return None
        
        # Only use weekdays (Monday-Friday)
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        
        # Sort days by current utilization (least used first)
        day_utilization = {day: 0 for day in days}
        for existing_item in chromosome.schedule_items:
            if existing_item.day in day_utilization:
                day_utilization[existing_item.day] += 1
        days_sorted = sorted(days, key=lambda d: day_utilization[d])
        
        for day in days_sorted:
            # Try periods in order from morning to afternoon
            for period in range(1, PERIODS_PER_DAY + 1):
                start_time, end_time = period_to_time(period)
                candidate_slot = TimeSlot(day=day, start_time=start_time, end_time=end_time)
                
                # Skip Friday prayer time (12:30-14:30)
                if day == "Friday":
                    prayer_start = time(12, 30)
                    prayer_end = time(14, 30)
                    if (start_time >= prayer_start and start_time < prayer_end) or \
                    (end_time > prayer_start and end_time <= prayer_end):
                        continue
                
                # Check for conflicts with lecturer, room, and students
                has_conflict = False
                
                # Check lecturer availability
                for existing_item in chromosome.schedule_items:
                    if existing_item.lecturer_id == item.lecturer_id and existing_item.course_id != item.course_id:
                        existing_slot = TimeSlot(
                            day=existing_item.day,
                            start_time=existing_item.start_time,
                            end_time=existing_item.end_time
                        )
                        if timeslots_overlap(candidate_slot, existing_slot):
                            has_conflict = True
                            break
                
                # Check room availability
                if not has_conflict:
                    for existing_item in chromosome.schedule_items:
                        if existing_item.room_id == item.room_id and existing_item.course_id != item.course_id:
                            existing_slot = TimeSlot(
                                day=existing_item.day,
                                start_time=existing_item.start_time,
                                end_time=existing_item.end_time
                            )
                            if timeslots_overlap(candidate_slot, existing_slot):
                                has_conflict = True
                                break
                
                # Check student group availability
                if not has_conflict:
                    student_group = getattr(course, 'student_group', item.course_id)
                    for existing_item in chromosome.schedule_items:
                        existing_course = self.courses.get(existing_item.course_id)
                        if existing_course and getattr(existing_course, 'student_group', existing_item.course_id) == student_group:
                            existing_slot = TimeSlot(
                                day=existing_item.day,
                                start_time=existing_item.start_time,
                                end_time=existing_item.end_time
                            )
                            if timeslots_overlap(candidate_slot, existing_slot):
                                has_conflict = True
                                break
                
                if not has_conflict:
                    return candidate_slot
        
        return None
    def _find_alternative_room(self, item: ScheduleItem, chromosome: Chromosome) -> Optional[ScheduleItem]:
        course = self.courses.get(item.course_id)
        if not course:
            return None
        
        # Get all suitable rooms
        is_lab_course = "Lab" in course.course_name
        suitable_rooms = []
        
        for room_id, room in self.rooms.items():
            # Check capacity
            if room.capacity < course.no_of_students:
                continue
            
            # Check room type for lab courses
            if is_lab_course and getattr(room, 'room_type', '') != "LAB":
                continue
            
            # Check if room is available at this timeslot
            room_available = True
            for existing_item in chromosome.schedule_items:
                if existing_item.room_id == room_id and existing_item.course_id != item.course_id:
                    existing_slot = TimeSlot(
                        day=existing_item.day,
                        start_time=existing_item.start_time,
                        end_time=existing_item.end_time
                    )
                    new_slot = TimeSlot(
                        day=item.day,
                        start_time=item.start_time,
                        end_time=item.end_time
                    )
                    if timeslots_overlap(existing_slot, new_slot):
                        room_available = False
                        break
            
            if room_available:
                suitable_rooms.append(room)
        
        if suitable_rooms:
            # Prefer rooms with similar capacity to avoid wasting space
            suitable_rooms.sort(key=lambda r: abs(r.capacity - course.no_of_students))
            selected_room = suitable_rooms[0]
            
            # Create a new schedule item with the alternative room
            new_item = ScheduleItem(
                course_id=item.course_id,
                course_name=item.course_name,
                lecturer_id=item.lecturer_id,
                lecturer_name=item.lecturer_name,
                room_id=selected_room.room_id,
                room_name=selected_room.room_name,
                day=item.day,
                start_time=item.start_time,
                end_time=item.end_time,
                semester=item.semester,
                year=item.year
            )
            return new_item
        
        return None
    def save_timetable(self, chromosome: Chromosome, output_file=None):
        """
        Save the timetable to database and optionally to file.
        
        Args:
            chromosome: The chromosome containing schedule data
            output_file: Optional file path to save timetable data
        
        Returns:
            dict: Timetable data structure with schedule, conflicts, and stats
        """
        # Save to database
        self._save_to_database(chromosome)
        
        # Save to file if specified
        if output_file:
            self._save_to_file(chromosome, output_file)
        
        # Build timetable data structure
        schedule_items = []
        for item in chromosome.schedule_items:
            # Fetch course record for each schedule item
            course = None
            if item.course_id in self.courses:
                course = self.courses[item.course_id]
            else:
                # Log when course is not found
                logging.warning(f"Course not found for course_id: {item.course_id}")
            
            # Determine year with fallback logic
            # Priority: course.year > self.year > default to 1
            year = 1  # Default fallback
            if course and hasattr(course, 'year') and course.year is not None:
                year = course.year
            elif hasattr(self, 'year') and self.year is not None:
                year = self.year
            
            schedule_item = {
                'course_id': item.course_id,
                'course_name': course.course_name if course else 'Unknown',
                'lecturer_id': item.lecturer_id,
                'lecturer_name': item.lecturer_name,
                'room_id': item.room_id,
                'room_name': item.room_name,
                'day_of_the_week': item.day,
                'start_time': item.start_time.strftime('%H:%M:%S'),
                'end_time': item.end_time.strftime('%H:%M:%S'),
                'semester': self.semester,
                'year': year,  # Use computed year with fallback logic
                'timetable_number': 1
            }
            schedule_items.append(schedule_item)
        
        # Build conflicts data
        conflicts = []
        for conflict in chromosome.conflicts:
            conflict_items = []
            for item in conflict.items:
                conflict_item = {
                    'course_id': item.course_id,
                    'course_name': item.course_name,
                    'lecturer_name': item.lecturer_name,
                    'room_name': item.room_name,
                    'day': item.day,
                    'time': f"{item.start_time.strftime('%H:%M')}-{item.end_time.strftime('%H:%M')}",
                    'semester': getattr(item, 'semester', self.semester),
                    'year': getattr(item, 'year', self.year)
                }
                conflict_items.append(conflict_item)
            
            conflicts.append({
                'type': conflict.type,
                'description': conflict.description,
                'constraint': conflict.constraint,
                'severity': conflict.severity,
                'items': conflict_items
            })
        
        timetable = {
            'schedule': schedule_items,
            'conflicts': conflicts,
            'stats': {
                'fitness': chromosome.fitness,
                'hard_violations': chromosome.hard_violations,
                'soft_violations': chromosome.soft_violations,
                'total_conflicts': len(chromosome.conflicts)
            }
        }
        
        return timetable

    def _save_to_database(self, chromosome: Chromosome):
        print("Saving timetable to database...")
        try:
            # Clear existing timeslots for the semester and year
            delete_query = text("""
                DELETE FROM timeslot 
                WHERE semester = :semester
                AND (:year IS NULL OR year = :year)
            """)
            self.db.execute(delete_query, {"semester": self.semester, "year": self.year})
            self.db.commit()

            for item in chromosome.schedule_items:
                course = self.courses.get(item.course_id)
                lecturer = self.lecturers.get(item.lecturer_id)
                room = self.rooms.get(item.room_id)

                if not course:
                    logger.error(f"Course {item.course_id} not found in database")
                    continue
                if not lecturer:
                    logger.error(f"Lecturer {item.lecturer_id} not found in database")
                    continue
                if not room:
                    logger.error(f"Room {item.room_id} not found in database")
                    continue
                if not item.day or item.day not in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
                    logger.error(f"Invalid or missing day for course {item.course_id}: {item.day}")
                    continue

                timeslot = Timeslot(
                    course_id=item.course_id,
                    lecturer_id=item.lecturer_id,
                    room_id=item.room_id,
                    course_name=course.course_name if hasattr(course, 'course_name') else item.course_name or "Unknown",
                    lecturer_name=lecturer.lecturer_name if hasattr(lecturer, 'lecturer_name') else item.lecturer_name or "Unknown",
                    room_name=room.room_name if hasattr(room, 'room_name') else item.room_name or "Unknown",
                    day_of_the_week=item.day,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    semester=self.semester or "Fall",  # Default to "Fall"
                    year=self.year if self.year is not None else (course.year if hasattr(course, 'year') and course.year is not None else 1),  # Default to 1
                    timetable_number=1,
                )
                self.db.add(timeslot)

            self.db.commit()
            logger.info("Timetable saved to database successfully")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error saving timetable to database: {str(e)}")
            raise
        
    # In GA.py, replace the _save_to_file method with this updated version
    def _save_to_file(self, chromosome: Chromosome, output_file):
        try:
            with open(output_file, 'w', newline='') as csvfile:
                fieldnames = [
                    'course_name',
                    'lecturer_name',
                    'room_name',
                    'day_of_the_week',
                    'start_time',
                    'end_time',
                    'semester',
                    'year'
                ]
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                
                for item in chromosome.schedule_items:
                    # Validate data before writing
                    course = self.courses.get(item.course_id)
                    lecturer = self.lecturers.get(item.lecturer_id)
                    room = self.rooms.get(item.room_id)
                    
                    if not course:
                        print(f"Error: Course {item.course_id} not found in database")
                        course_name = "Unknown"
                    else:
                        course_name = course.course_name if hasattr(course, 'course_name') else item.course_name
                    
                    if not lecturer:
                        print(f"Error: Lecturer {item.lecturer_id} not found in database")
                        lecturer_name = "Unknown"
                    else:
                        lecturer_name = lecturer.lecturer_name if hasattr(lecturer, 'lecturer_name') else item.lecturer_name
                    
                    if not room:
                        print(f"Error: Room {item.room_id} not found in database")
                        room_name = "Unknown"
                    else:
                        room_name = room.room_name if hasattr(room, 'room_name') else item.room_name
                    
                    writer.writerow({
                        'course_name': course_name,
                        'lecturer_name': lecturer_name,
                        'room_name': room_name,
                        'day_of_the_week': item.day,
                        'start_time': item.start_time.strftime('%H:%M:%S'),
                        'end_time': item.end_time.strftime('%H:%M:%S'),
                        'semester': self.semester,
                        'year': self.year
                    })
            
            print(f"Timetable saved to {output_file} successfully")
        
        except Exception as e:
            print(f"Error saving timetable to file: {e}")
            raise
def generate_timetable(db: Session, semester: str, year=None, parameters: dict = None, output_file=None):
    print(f"Generating timetable for semester {semester}" + (f" and year {year}" if year else ""))
    parameters = parameters or {}
    
    # Validate parameters
    validated_parameters = {
        'populationSize': parameters.get('populationSize', 50),
        'generations': parameters.get('generations', 50),
        'crossoverRate': parameters.get('crossoverRate', 0.8),
        'mutationRate': parameters.get('mutationRate', 0.05),
        'elitismCount': parameters.get('elitismCount', 5),
        'tournamentSize': parameters.get('tournamentSize', 5),
    }
    
    # Check parameter ranges and types
    if not isinstance(validated_parameters['populationSize'], (int, float)) or validated_parameters['populationSize'] < 50 or validated_parameters['populationSize'] > 200:
        raise ValueError("populationSize must be a number between 50 and 200")
    if not isinstance(validated_parameters['generations'], (int, float)) or validated_parameters['generations'] < 50 or validated_parameters['generations'] > 2000:
        raise ValueError("generations must be a number between 50 and 2000")
    if not isinstance(validated_parameters['crossoverRate'], (int, float)) or validated_parameters['crossoverRate'] < 0.7 or validated_parameters['crossoverRate'] > 0.9:
        raise ValueError("crossoverRate must be a number between 0.7 and 0.9")
    if not isinstance(validated_parameters['mutationRate'], (int, float)) or validated_parameters['mutationRate'] < 0.01 or validated_parameters['mutationRate'] > 0.1:
        raise ValueError("mutationRate must be a number between 0.01 and 0.1")
    if not isinstance(validated_parameters['elitismCount'], (int, float)) or validated_parameters['elitismCount'] < 1 or validated_parameters['elitismCount'] > 10:
        raise ValueError("elitismCount must be a number between 1 and 10")
    if not isinstance(validated_parameters['tournamentSize'], (int, float)) or validated_parameters['tournamentSize'] < 2 or validated_parameters['tournamentSize'] > 5:
        raise ValueError("tournamentSize must be a number between 2 and 5")
    
    print(f"Running with parameters: {validated_parameters}")
    
    # Note: Frontend sends 'constraints' (e.g., weightTeacherPreference), but it's not used yet.
    # To use constraints, extend TimetableGenerator to accept and apply them (e.g., in calculate_fitness).
    
    generator = TimetableGenerator(
        db=db,
        semester=semester,
        year=year,
        population_size=int(validated_parameters['populationSize']),
        max_generations=int(validated_parameters['generations']),
        crossover_rate=float(validated_parameters['crossoverRate']),
        mutation_rate=float(validated_parameters['mutationRate']),
        elitism_count=int(validated_parameters['elitismCount']),
        tournament_size=int(validated_parameters['tournamentSize'])
    )
    best_chromosome = generator.run()
    timetable = generator.save_timetable(best_chromosome, output_file)
    return timetable

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Generate optimized timetable')
    parser.add_argument('--semester', required=True, help='Semester (e.g., "Fall", "Spring")')
    parser.add_argument('--year', type=int, help='Academic year')
    parser.add_argument('--output', help='Output file path for CSV')
    args = parser.parse_args()
    db = next(get_db())
    try:
        generate_timetable(db, args.semester, args.year, output_file=args.output)
    finally:
        db.close()

