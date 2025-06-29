from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models
import routes
import sys
import os
import sys


# Add the current directory to the system path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Timetable System API",
    description="Single-folder implementation for timetable management",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routes
app.include_router(routes.router)

@app.get("/")
def read_root():
    return {"message": "Timetable System API - Single Folder Implementation"}