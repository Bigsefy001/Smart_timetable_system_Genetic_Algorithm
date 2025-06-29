// src/components/TimetableVisualization.jsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Button, FormControl, InputLabel, Select, MenuItem, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import axiosInstance from '../axiosInstance';
import { useAuth } from '../context/AuthContext';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(3),
  borderRadius: '8px',
  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
}));

const TimeSlot = styled(Box)(({ theme, isOccupied, courseType, hasConflict }) => ({
  height: 'auto',
  minHeight: '60px',
  borderRadius: '4px',
  padding: theme.spacing(0.5),
  backgroundColor: isOccupied ? 
    (courseType === 'lecture' ? '#bbdefb' : 
     courseType === 'lab' ? '#c8e6c9' : 
     courseType === 'seminar' ? '#ffecb3' : '#e1bee7') 
    : '#f5f5f5',
  border: hasConflict ? '2px solid red' : '1px solid #e0e0e0',
  cursor: isOccupied ? 'pointer' : 'default',
  '&:hover': {
    boxShadow: isOccupied ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',
    transform: isOccupied ? 'translateY(-2px)' : 'none',
    transition: 'all 0.2s ease-in-out',
  },
}));

const LegendItem = styled(Box)(({ theme, color }) => ({
  display: 'flex',
  alignItems: 'center',
  marginRight: theme.spacing(2),
}));

const ColorBox = styled(Box)(({ color }) => ({
  width: '16px',
  height: '16px',
  borderRadius: '4px',
  backgroundColor: color,
  marginRight: '8px',
}));

const TimetableGridContainer = styled(Grid)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'nowrap',
  width: '100%',
  minWidth: 'max-content',
  overflow: 'auto',
  '& .MuiGrid-item': {
    flexShrink: 0,
    minWidth: '150px',
  },
  '& .MuiGrid-item:first-of-type': {
    minWidth: '120px',
    maxWidth: '120px',
    flexBasis: '120px',
  },
}));

const PrintStyles = styled('style')`
  @media print {
    body * {
      visibility: hidden;
    }
    .printable-timetable, .printable-timetable * {
      visibility: visible;
    }
    .printable-timetable {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      padding: 20px;
    }
    .no-print {
      display: none;
    }
    .timetable-grid {
      font-size: 11px;
      page-break-inside: auto;
    }
    .timetable-grid > div {
      page-break-inside: avoid;
    }
  }
`;

const TimetableVisualization = ({ timetablesByYear, conflicts = [] }) => {
  const { token } = useAuth();
  const [filteredTimetableData, setFilteredTimetableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewType, setViewType] = useState('weekly');
  const [selectedUser, setSelectedUser] = useState('all');
  const [userType, setUserType] = useState('class');
  const [selectedYear, setSelectedYear] = useState('all');
  const [courses, setCourses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [debugMode, setDebugMode] = useState(true);

  const timeSlots = [
    '08:30-10:30',
    '10:30-12:30',
    '12:30-14:30',
    '14:30-16:30',
    '16:30-18:30',
    '18:30-20:30'
  ];
  
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const timeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') {
      console.warn('Invalid time string:', timeStr);
      return 0;
    }
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn('Invalid time format:', timeStr);
      return 0;
    }
    return hours * 60 + (minutes || 0);
  };

  const normalizeTime = (timeStr) => {
    if (!timeStr) return '08:00';
    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    const [hours, minutes = '00'] = timeStr.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  };

  const normalizeDay = (dayStr) => {
    if (!dayStr) return 'Monday';
    const dayMap = {
      'monday': 'Monday',
      'tuesday': 'Tuesday', 
      'wednesday': 'Wednesday',
      'thursday': 'Thursday',
      'friday': 'Friday',
      'mon': 'Monday',
      'tue': 'Tuesday',
      'wed': 'Wednesday', 
      'thu': 'Thursday',
      'fri': 'Friday'
    };
    return dayMap[dayStr.toLowerCase()] || dayStr;
  };

  const getFilteredTimetableData = () => {
    let allData = Object.values(timetablesByYear).flat();
    
    if (selectedYear !== 'all') {
      allData = allData.filter(item => item.year === selectedYear || item.year === 'N/A');
    }
    
    if (selectedUser !== 'all') {
      allData = allData.filter(item => {
        switch (userType) {
          case 'class':
            return item.class === selectedUser;
          case 'lecturer':
            return item.lecturer === selectedUser;
          case 'room':
            return item.room === selectedUser;
          default:
            return true;
        }
      });
    }
    
    return allData;
  };

  const detectConflictForTimeSlot = (day, timeRange, scheduledClass) => {
    if (!scheduledClass || !conflicts || conflicts.length === 0) {
      return { hasConflict: false, conflictDetails: null };
    }

    const [startTimeStr, endTimeStr] = timeRange.split('-');
    const currentStartMinutes = timeToMinutes(startTimeStr.trim());
    const currentEndMinutes = timeToMinutes(endTimeStr.trim());
    const normalizedDay = normalizeDay(day);

    for (let conflictIndex = 0; conflictIndex < conflicts.length; conflictIndex++) {
      const conflict = conflicts[conflictIndex];
      
      if (debugMode) {
        console.log(`🔍 Checking conflict ${conflictIndex + 1}:`, {
          conflictType: conflict.type,
          conflictDescription: conflict.description,
          conflictSeverity: conflict.severity,
          conflictDetails: conflict.details
        });
      }

      let conflictItems = [];
      if (conflict.details) {
        if (Array.isArray(conflict.details.items)) {
          conflictItems = conflict.details.items;
        } else if (Array.isArray(conflict.details)) {
          conflictItems = conflict.details;
        }
      } else if (Array.isArray(conflict.items)) {
        conflictItems = conflict.items;
      }

      for (let itemIndex = 0; itemIndex < conflictItems.length; itemIndex++) {
        const item = conflictItems[itemIndex];
        
        if (debugMode) {
          console.log(`  📋 Checking conflict item ${itemIndex + 1}:`, item);
        }

        const conflictDay = normalizeDay(item.day || item.dayOfWeek);
        const timeRangeStr = item.time || item.timeSlot || `${item.startTime}-${item.endTime}`;
        
        if (!timeRangeStr || !timeRangeStr.includes('-')) {
          if (debugMode) {
            console.warn(`  ⚠️ Invalid time range format:`, timeRangeStr);
          }
          continue;
        }

        const [startTime, endTime] = timeRangeStr.split('-').map(t => normalizeTime(t.trim()));
        const conflictStartMinutes = timeToMinutes(startTime);
        const conflictEndMinutes = timeToMinutes(endTime);

        const dayMatch = conflictDay === normalizedDay;
        
        const timeOverlap = (
          (currentStartMinutes < conflictEndMinutes && currentEndMinutes > conflictStartMinutes)
        );

        const courseMatch = (item.courseName || item.course) === scheduledClass.course;
        const roomMatch = (item.roomName || item.room) === scheduledClass.room;
        const lecturerMatch = (item.lecturerName || item.lecturer) === scheduledClass.lecturer;
        const classMatch = (item.className || item.class) === scheduledClass.class;

        const yearMatch = !item.year || !scheduledClass.year || 
                         String(item.year) === String(scheduledClass.year) || 
                         item.year === 'N/A' || scheduledClass.year === 'N/A';
        
        const semesterMatch = !item.semester || !scheduledClass.semester || 
                             item.semester === scheduledClass.semester;

        const resourceMatch = courseMatch || roomMatch || lecturerMatch || classMatch;

        if (debugMode) {
          console.log(`  🔍 Match checks:`, {
            dayMatch: `${conflictDay} === ${normalizedDay} = ${dayMatch}`,
            timeOverlap: `${currentStartMinutes}-${currentEndMinutes} overlaps ${conflictStartMinutes}-${conflictEndMinutes} = ${timeOverlap}`,
            courseMatch: `${item.courseName || item.course} === ${scheduledClass.course} = ${courseMatch}`,
            roomMatch: `${item.roomName || item.room} === ${scheduledClass.room} = ${roomMatch}`,
            lecturerMatch: `${item.lecturerName || item.lecturer} === ${scheduledClass.lecturer} = ${lecturerMatch}`,
            classMatch: `${item.className || item.class} === ${scheduledClass.class} = ${classMatch}`,
            resourceMatch,
            yearMatch,
            semesterMatch
          });
        }

        if (dayMatch && timeOverlap && resourceMatch && yearMatch && semesterMatch) {
          if (debugMode) {
            console.log(`🚨 CONFLICT DETECTED for ${day} ${timeRange}:`, {
              scheduledClass,
              conflictItem: item,
              conflict: conflict
            });
          }

          return {
            hasConflict: true,
            conflictDetails: {
              conflict,
              item,
              type: conflict.type,
              severity: conflict.severity,
              description: conflict.description
            }
          };
        }
      }
    }

    return { hasConflict: false, conflictDetails: null };
  };

  useEffect(() => {
    const fetchSupportingData = async () => {
      setLoading(true);
      try {
        const [coursesRes, roomsRes, lecturersRes] = await Promise.all([
          axiosInstance.get('/courses/', { headers: { Authorization: `Bearer ${token}` } }),
          axiosInstance.get('/rooms/', { headers: { Authorization: `Bearer ${token}` } }),
          axiosInstance.get('/lecturers/', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setCourses(coursesRes.data);
        setRooms(roomsRes.data);
        setLecturers(lecturersRes.data);
      } catch (err) {
        console.error('Error fetching supporting data:', err);
        setError('Failed to load supporting data.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchSupportingData();
    }
  }, [token]);

  useEffect(() => {
    setFilteredTimetableData(getFilteredTimetableData());
  }, [timetablesByYear, conflicts, selectedUser, userType, selectedYear]);

  useEffect(() => {
    if (debugMode) {
      console.log('Timetable data updated:', {
        timetablesByYear,
        conflicts,
        filteredTimetableData
      });
    }
  }, [timetablesByYear, conflicts, filteredTimetableData, debugMode]);

  // FIXED: Updated getScheduledClasses to match exact time slots
  const getScheduledClasses = (day, timeRange) => {
    const normalizedDay = normalizeDay(day);
    
    return filteredTimetableData.filter(item => {
      const itemDay = normalizeDay(item.day);
      const itemStartTime = normalizeTime(item.startTime);
      const itemEndTime = normalizeTime(item.endTime);
      
      // Create the time range string for this class
      const itemTimeRange = `${itemStartTime}-${itemEndTime}`;
      
      const yearMatch = selectedYear === 'all' || item.year == selectedYear || item.year === 'N/A';
      const isMatchingDay = itemDay === normalizedDay;
      
      // FIXED: Exact time slot matching instead of overlap
      const isExactTimeMatch = itemTimeRange === timeRange;
      
      if (debugMode && isMatchingDay && yearMatch) {
        console.log(`Checking class: ${item.course}`, {
          itemDay,
          normalizedDay,
          itemTimeRange,
          targetTimeRange: timeRange,
          isExactTimeMatch,
          isMatchingDay,
          yearMatch
        });
      }
      
      return isMatchingDay && isExactTimeMatch && yearMatch;
    });
  };

  // FIXED: Added function to determine course type for proper coloring
  const getCourseType = (courseName) => {
    if (!courseName) return 'other';
    
    const courseNameLower = courseName.toLowerCase();
    if (courseNameLower.includes('lab')) {
      return 'lab';
    } else if (courseNameLower.includes('seminar')) {
      return 'seminar';
    } else if (courseNameLower.includes('lecture')) {
      return 'lecture';
    }
    
    // Default to lecture for courses without specific type indicators
    return 'lecture';
  };

  const handleTimeSlotClick = (scheduledClass, conflictDetails) => {
    if (scheduledClass) {
      console.log('Class details:', scheduledClass);
      if (conflictDetails) {
        console.log('Conflict details:', conflictDetails);
      }
    }
  };

  const handleViewTypeChange = (event) => {
    setViewType(event.target.value);
  };

  const handleUserTypeChange = (event) => {
    setUserType(event.target.value);
    setSelectedUser('all');
  };

  const handleSelectedUserChange = (event) => {
    setSelectedUser(event.target.value);
  };

  const handleExport = () => {
    try {
      setLoading(true);
      const dataToExport = filteredTimetableData;
      
      if (!dataToExport.length) {
        alert('No timetable to export!');
        return;
      }

      const headers = ['Day', 'Start Time', 'End Time', 'Course', 'Room', 'Lecturer', 'Class', 'Year', 'Semester'];
      const rows = dataToExport.map(item => [
        item.day,
        item.startTime,
        item.endTime,
        item.course,
        item.room,
        item.lecturer,
        item.class,
        item.year,
        item.semester,
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `timetable_${selectedYear}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('Timetable exported as CSV!');
    } catch (err) {
      alert('Export failed: ' + err.message);
      console.error('Export error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    try {
      setLoading(true);
      window.print();
    } catch (err) {
      setError('Failed to print timetable. Please try again.');
      console.error('Error printing timetable:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAllClasses = () => {
    const allClasses = new Set();
    Object.values(timetablesByYear).forEach(data => {
      data.forEach(item => {
        if (item.class) allClasses.add(item.class);
      });
    });
    return Array.from(allClasses);
  };

  const getAllLecturers = () => {
    const allLecturers = new Set();
    Object.values(timetablesByYear).forEach(data => {
      data.forEach(item => {
        if (item.lecturer) allLecturers.add(item.lecturer);
      });
    });
    return Array.from(allLecturers);
  };

  const getAllRooms = () => {
    const allRooms = new Set();
    Object.values(timetablesByYear).forEach(data => {
      data.forEach(item => {
        if (item.room) allRooms.add(item.room);
      });
    });
    return Array.from(allRooms);
  };

  const getAllYears = () => {
    const allYears = new Set();
    Object.values(timetablesByYear).forEach(data => {
      data.forEach(item => {
        if (item.year && item.year !== 'N/A') allYears.add(item.year);
      });
    });
    return Array.from(allYears).sort();
  };

  const classes = getAllClasses();
  const lecturerList = getAllLecturers();
  const roomList = getAllRooms();
  const years = getAllYears();

  return (
    <Box>
      <PrintStyles />
      <StyledPaper className="no-print">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5">Timetable Visualization</Typography>
          <Box display="flex" gap={2}>
            <FormControl size="small" style={{ minWidth: 120 }}>
              <InputLabel>View</InputLabel>
              <Select value={viewType} onChange={handleViewTypeChange} label="View">
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" style={{ minWidth: 120 }}>
              <InputLabel>User Type</InputLabel>
              <Select value={userType} onChange={handleUserTypeChange} label="User Type">
                <MenuItem value="class">Class</MenuItem>
                <MenuItem value="lecturer">Lecturer</MenuItem>
                <MenuItem value="room">Room</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" style={{ minWidth: 200 }}>
              <InputLabel>Select {userType}</InputLabel>
              <Select 
                value={selectedUser} 
                onChange={handleSelectedUserChange} 
                label={`Select ${userType}`}
              >
                <MenuItem value="all">All {userType}s</MenuItem>
                {userType === 'class' && classes.map(cls => (
                  <MenuItem key={cls} value={cls}>{cls}</MenuItem>
                ))}
                {userType === 'lecturer' && lecturerList.map(lecturer => (
                  <MenuItem key={lecturer} value={lecturer}>{lecturer}</MenuItem>
                ))}
                {userType === 'room' && roomList.map(room => (
                  <MenuItem key={room} value={room}>{room}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" style={{ minWidth: 120 }}>
              <InputLabel>Year</InputLabel>
              <Select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)} 
                label="Year"
              >
                <MenuItem value="all">All Years</MenuItem>
                {years.map(year => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" color="primary" onClick={handleExport}>Export</Button>
            <Button variant="contained" color="primary" onClick={handlePrint}>Print</Button>
            <Button 
              variant="outlined" 
              color={debugMode ? "secondary" : "default"}
              onClick={() => setDebugMode(!debugMode)}
            >
              Debug: {debugMode ? 'ON' : 'OFF'}
            </Button>
          </Box>
        </Box>

        <Box display="flex" mb={2}>
          <LegendItem>
            <ColorBox color="#bbdefb" />
            <Typography variant="body2">Lecture</Typography>
          </LegendItem>
          <LegendItem>
            <ColorBox color="#c8e6c9" />
            <Typography variant="body2">Lab</Typography>
          </LegendItem>
          <LegendItem>
            <ColorBox color="#ffecb3" />
            <Typography variant="body2">Seminar</Typography>
          </LegendItem>
          <LegendItem>
            <ColorBox color="#e1bee7" />
            <Typography variant="body2">Other</Typography>
          </LegendItem>
        </Box>

        {debugMode && (
          <Box mb={2} p={2} bgcolor="#f5f5f5" borderRadius={1}>
            <Typography variant="h6" mb={1}>Debug Information</Typography>
            <Typography variant="body2">
              Total Classes: {filteredTimetableData.length}
            </Typography>
            <Typography variant="body2">
              Total Conflicts: {conflicts.length}
            </Typography>
            <Typography variant="body2">
              Conflict Types: {conflicts.map(c => c.type).join(', ') || 'None'}
            </Typography>
            <Typography variant="body2">
              First 3 Classes: {JSON.stringify(filteredTimetableData.slice(0, 3).map(c => ({
                course: c.course,
                day: c.day,
                time: `${c.startTime}-${c.endTime}`,
                year: c.year,
                class: c.class,
                room: c.room,
                lecturer: c.lecturer
              })))}
            </Typography>
            {conflicts.length > 0 && (
              <Box mt={1}>
                <Typography variant="body2" fontWeight="bold">Conflicts Details:</Typography>
                {conflicts.map((conflict, index) => (
                  <Typography key={index} variant="caption" display="block">
                    {index + 1}. {conflict.description} ({conflict.type} - {conflict.severity})
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}
      </StyledPaper>

      <StyledPaper className="printable-timetable">
        {loading ? (
          <Typography>Loading timetable data...</Typography>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : filteredTimetableData.length === 0 ? (
          <Typography>No timetable data available for the selected filters.</Typography>
        ) : (
          <TimetableGridContainer container className="timetable-grid">
            <Grid item>
              <Box height="40px"></Box>
              {timeSlots.map((timeRange, index) => (
                <Box 
                  key={index} 
                  height="60px" 
                  display="flex" 
                  alignItems="center" 
                  justifyContent="center"
                  borderBottom="1px solid #e0e0e0"
                >
                  <Typography variant="body2" style={{ fontSize: '9px', textAlign: 'center', lineHeight: '1.2' }}>
                    {timeRange}
                  </Typography>
                </Box>
              ))}
            </Grid>

            {days.map((day, dayIndex) => (
              <Grid item key={dayIndex}>
                <Box 
                  height="40px" 
                  display="flex" 
                  alignItems="center" 
                  justifyContent="center" 
                  bgcolor="#f0f0f0"
                  borderRadius="4px 4px 0 0"
                  fontWeight="bold"
                >
                  {day}
                </Box>
                {timeSlots.map((timeRange, timeIndex) => {
                  const scheduledClasses = getScheduledClasses(day, timeRange);
                  const hasConflict = scheduledClasses.some(classItem => 
                    detectConflictForTimeSlot(day, timeRange, classItem).hasConflict
                  );

                  return (
                    <TimeSlot 
                      key={timeIndex} 
                      isOccupied={scheduledClasses.length > 0}
                      courseType={scheduledClasses.length > 0 ? getCourseType(scheduledClasses[0].course) : 'other'}
                      hasConflict={hasConflict}
                      onClick={() => handleTimeSlotClick(scheduledClasses, hasConflict)}
                    >
                      {scheduledClasses.length > 0 && (
                        <>
                          {scheduledClasses.map((classItem, idx) => (
                            <React.Fragment key={idx}>
                              <Typography variant="subtitle2" fontWeight="bold" noWrap style={{ fontSize: '11px' }}>
                                {classItem.course}
                              </Typography>
                              <Typography variant="body2" noWrap style={{ fontSize: '10px' }}>
                                {classItem.room}
                              </Typography>
                              <Typography variant="caption" noWrap style={{ fontSize: '9px' }}>
                                {classItem.lecturer}
                              </Typography>
                              {idx < scheduledClasses.length - 1 && <hr style={{ margin: '2px 0' }} />}
                            </React.Fragment>
                          ))}
                          {hasConflict && (
                            <Typography variant="caption" color="error" fontWeight="bold" style={{ fontSize: '8px' }}>
                              ⚠️ Conflict
                            </Typography>
                          )}
                        </>
                      )}
                    </TimeSlot>
                  );
                })}
              </Grid>
            ))}
          </TimetableGridContainer>
        )}
      </StyledPaper>

      <StyledPaper className="no-print">
        <Typography variant="h6" mb={2}>Scheduling Conflicts</Typography>
        <Box display="flex" flexDirection="column" gap={1}>
          {conflicts.length > 0 ? (
            conflicts.map((conflict, index) => (
              <Chip 
                key={index}
                label={`${conflict.description} (${conflict.type})`}
                color={conflict.severity === 'hard' ? 'error' : 'warning'}
                onClick={() => {
                  console.log('Conflict details:', conflict);
                  if (debugMode) {
                    alert(`Conflict: ${conflict.description}\nType: ${conflict.type}\nSeverity: ${conflict.severity}`);
                  }
                }}
              />
            ))
          ) : (
            <Typography>No conflicts detected.</Typography>
          )}
        </Box>
      </StyledPaper>
    </Box>
  );
};

export default TimetableVisualization;