import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  AccordionDetails,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  TableContainer, 
  TableCell, 
  Button, 
} from '@mui/material';
import { Link } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import axiosInstance from '../../axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { styled } from '@mui/material/styles';
import Alert from '@mui/material/Alert';

// Styled components
const MainContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flex: 1,
  backgroundColor: '#f5f5f5',
  [theme.breakpoints.down('md')]: {
    flexDirection: 'column',
  },
}));
const HeaderWrapper = styled(Box)({ // Added
  width: '100%',
  height: '60px',
  position: 'fixed',
  top: 0,
  left: 0,
  zIndex: 1100,
  backgroundColor: '#2196F3',
  display: 'flex',
  alignItems: 'center',
  padding: '0 20px',
  color: 'white',
  fontSize: '1.5rem',
  fontWeight: 'bold',
  fontFamily: '"Roboto", sans-serif',
  gap: '10px',
});

const SidebarWrapper = styled(Box)(({ theme }) => ({ // Added
  width: '200px',
  backgroundColor: '#e8ecef',
  padding: '20px 10px',
  marginTop: '60px',
  [theme.breakpoints.down('md')]: {
    width: '100%',
  },
}))

const Content = styled(Box)(({ theme }) => ({
  flex: 1,
  padding: '20px',
  marginTop: '60px',
  [theme.breakpoints.down('md')]: {
    marginTop: '120px',
  },
}));

const PageTitle = styled(Typography)({
  marginBottom: '20px',
  fontWeight: 'bold',
});

const ControlButtons = styled(Box)({
  display: 'flex',
  gap: '10px',
  marginBottom: '20px',
});

const StyledButton = styled('button')(({ variant }) => ({
  padding: '8px 15px',
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  ...(variant === 'primary' && {
    backgroundColor: '#4CAF50',
    color: 'white',
    '&:hover': {
      backgroundColor: '#3e8e41',
    },
  }),
  ...(variant === 'secondary' && {
    backgroundColor: 'white',
    border: '1px solid #ccc',
    color: '#333',
  }),
  ...(variant === 'formPrimary' && {
    backgroundColor: '#2196F3',
    color: 'white',
    '&:hover': {
      backgroundColor: '#1976D2',
    },
  }),
}));

const StyledAlert = styled(Alert)({
  marginBottom: '20px',
});

const StyledAccordion = styled('div')({
  marginBottom: '20px',
  backgroundColor: 'white',
  borderRadius: '8px',
  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
});

const AccordionHeader = styled('div')({
  padding: '15px',
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
});

const FormContainer = styled(Box)({
  padding: '20px',
});

const FormRow = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '20px',
  marginBottom: '20px',
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: '1fr',
  },
}));

const FormGroup = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
});

const FormButtons = styled(Box)({
  display: 'flex',
  gap: '10px',
  justifyContent: 'flex-end',
});

const SearchBox = styled(TextField)({
  margin: '20px 0',
});

const StyledTableContainer = styled(TableContainer)({
  marginTop: '20px',
});

const StyledTableHeadCell = styled(TableCell)({
  backgroundColor: '#2196F3',
  color: 'white',
  padding: '12px',
});

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  padding: '12px',
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const ActionButton = styled('button')(({ variant }) => ({
  padding: '5px 10px',
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  marginRight: '5px',
  ...(variant === 'edit' && {
    backgroundColor: '#FFC107',
    color: 'white',
    '&:hover': {
      backgroundColor: '#e0a800',
    },
  }),
  ...(variant === 'delete' && {
    backgroundColor: '#F44336',
    color: 'white',
    '&:hover': {
      backgroundColor: '#d32f2f',
    },
  }),
}));

const DataInput = () => {
  const theme = useTheme();
  const { token } = useAuth();
  const [expanded, setExpanded] = useState({
    lecturer: true,
    room: false,
    course: false,
    constraint: false,
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [lecturerSearch, setLecturerSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [constraintSearch, setConstraintSearch] = useState('');
  const [lecturers, setLecturers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [constraints, setConstraints] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const notifications = [
    'New timetable update available',
    'Room change for CS101 on Monday',
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lecturerRes, roomRes, courseRes, constraintRes] = await Promise.all([
          axiosInstance.get('/lecturers/', { headers: { Authorization: `Bearer ${token}` } }),
          axiosInstance.get('/rooms/', { headers: { Authorization: `Bearer ${token}` } }),
          axiosInstance.get('/courses/', { headers: { Authorization: `Bearer ${token}` } }),
          axiosInstance.get('/constraints/', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setLecturers(lecturerRes.data);
        setRooms(roomRes.data);
        setCourses(courseRes.data);
        setConstraints(constraintRes.data);
      } catch (error) {
        setErrorMessage(error.response ? error.response.data.detail : 'Error fetching data');
      }
    };
    if (token) {
      fetchData();
    }
  }, [token]);

  const handleToggle = (section) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleShowAll = () => {
    setExpanded({ lecturer: true, room: true, course: true, constraint: true });
  };

  const handleCollapseAll = () => {
    setExpanded({ lecturer: false, room: false, course: false, constraint: false });
  };

  const showMessage = (type, text) => {
    if (type === 'success') {
      setSuccessMessage(text);
      setErrorMessage('');
      setTimeout(() => setSuccessMessage(''), 5000);
    } else {
      setErrorMessage(text);
      setSuccessMessage('');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleFormSubmit = (formId) => async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newItem = Object.fromEntries(formData);

    try {
      if (formId === 'lecturerForm') {
        const response = await axiosInstance.post('/lecturers/', {
          lecturer_id: newItem.lecturerId,
          name: newItem.lecturerName,
          department: newItem.department,
          office_location: newItem.officeLocation,
          phone_number: newItem.phoneNumber,
          email: newItem.email,
        }, { headers: { Authorization: `Bearer ${token}` } });
        setLecturers([...lecturers, response.data]);
      } else if (formId === 'roomForm') {
        const response = await axiosInstance.post('/rooms/', {
          room_id: newItem.roomId,
          name: newItem.roomName,
          building: newItem.building,
          capacity: Number(newItem.capacity),
          room_type: newItem.roomType,
          facilities: facilities,
        }, { headers: { Authorization: `Bearer ${token}` } });
        setRooms([...rooms, response.data]);
        setFacilities([]);
      } else if (formId === 'courseForm') {
        const response = await axiosInstance.post('/courses/', {
          course_id: newItem.courseId,
          name: newItem.courseName,
          department: newItem.department,
          year: Number(newItem.year),
          semester: Number(newItem.semester),
          num_students: Number(newItem.students),
        }, { headers: { Authorization: `Bearer ${token}` } });
        setCourses([...courses, response.data]);
      } else if (formId === 'constraintForm') {
        const response = await axiosInstance.post('/constraints/', {
          constraint_id: newItem.constraintId,
          constraint_type: newItem.constraintType,
          category: newItem.constraintCategory,
          related_to: newItem.relatedTo || 'N/A',
          description: newItem.constraintDescription,
        }, { headers: { Authorization: `Bearer ${token}` } });
        setConstraints([...constraints, response.data]);
      }
      showMessage('success', `${formId.replace('Form', '')} added successfully!`);
      e.target.reset();
    } catch (error) {
      showMessage('error', error.response ? error.response.data.detail : 'Error adding item');
    }
  };

  const filterTable = (data, searchText) => {
    return data.filter((item) =>
      Object.values(item).some((val) => val.toString().toLowerCase().includes(searchText.toLowerCase()))
    );
  };

  const handleEdit = (id) => {
    alert(`Editing item with ID: ${id}`);
  };

  const handleDelete = async (id, setData, data, endpoint) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await axiosInstance.delete(`/${endpoint}/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(data.filter((item) => item.id !== id));
        showMessage('success', 'Item deleted successfully!');
      } catch (error) {
        showMessage('error', error.response ? error.response.data.detail : 'Error deleting item');
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <HeaderWrapper>
        <img 
          src="https://aiu.edu.my/wp-content/uploads/2023/11/AIU-Official-Logo-01.png" 
          alt="Albukhary International University Logo" 
          style={{ height: '40px' }}
        />
        Albukhary International University
      </HeaderWrapper>
      <MainContainer>
        <SidebarWrapper>
          <Typography variant="h6" sx={{ marginBottom: '20px', fontWeight: 'bold' }}>
            MAIN
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link to="/dashboard" style={{ textDecoration: 'none' }}>
              <Button
                variant="text"
                startIcon={<Box component="span" sx={{ fontSize: '18px' }}>📊</Box>}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  color: 'black',
                }}
              >
                Dashboard
              </Button>
            </Link>
            <Button
              variant="text"
              startIcon={<Box component="span" sx={{ fontSize: '18px' }}>📅</Box>}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: 'black',
              }}
            >
              Timetable
            </Button>
            <Button
              variant="text"
              startIcon={<Box component="span" sx={{ fontSize: '18px' }}>👥</Box>}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: 'black',
              }}
            >
              Users
            </Button>
            <Button
              variant="text"
              startIcon={<Box component="span" sx={{ fontSize: '18px' }}>📄</Box>}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: 'black',
              }}
            >
              Courses
            </Button>
            <Button
              variant="text"
              startIcon={<Box component="span" sx={{ fontSize: '18px' }}>📥</Box>}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: 'black',
                backgroundColor: '#e0e0e0',
              }}
            >
              Data Input
            </Button>
          </Box>
          <Typography variant="h6" sx={{ marginTop: '40px', marginBottom: '20px', fontWeight: 'bold' }}>
            TOOLS
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Button
              variant="text"
              startIcon={<Box component="span" sx={{ fontSize: '18px' }}>⚙️</Box>}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: 'black',
              }}
            >
              Settings
            </Button>
            <Button
              variant="text"
              startIcon={<Box component="span" sx={{ fontSize: '18px' }}>📋</Box>}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: 'black',
              }}
            >
              Reports
            </Button>
          </Box>
        </SidebarWrapper>
        <Content>
          <PageTitle variant="h4">Data Input</PageTitle>
          <ControlButtons>
            <StyledButton variant="primary" onClick={handleShowAll}>
              <i className="fas fa-eye" /> Show All
            </StyledButton>
            <StyledButton variant="primary" onClick={handleCollapseAll}>
              <i className="fas fa-eye-slash" /> Collapse All
            </StyledButton>
          </ControlButtons>
          {successMessage && <StyledAlert severity="success">{successMessage}</StyledAlert>}
          {errorMessage && <StyledAlert severity="error">{errorMessage}</StyledAlert>}

          {/* Lecturer Management */}
          <StyledAccordion expanded={expanded.lecturer} onChange={() => handleToggle('lecturer')}>
            <AccordionHeader expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap="10px">
                <i className="fas fa-user-tie" />
                <Typography>Lecturer Management</Typography>
              </Box>
            </AccordionHeader>
            <AccordionDetails>
              <FormContainer>
                <Typography variant="h6" mb="15px">Add New Lecturer</Typography>
                <form id="lecturerForm" onSubmit={handleFormSubmit('lecturerForm')}>
                  <FormRow>
                    <FormGroup>
                      <TextField label="Lecturer ID" name="lecturerId" placeholder="e.g., LECT001" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Lecturer Name" name="lecturerName" placeholder="Full Name" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <FormControl fullWidth required>
                        <InputLabel>Department</InputLabel>
                        <Select label="Department" name="department">
                          <MenuItem value="">Select Department</MenuItem>
                          <MenuItem value="Computer Science">Computer Science</MenuItem>
                          <MenuItem value="Engineering">Engineering</MenuItem>
                          <MenuItem value="Business">Business</MenuItem>
                          <MenuItem value="Medical Sciences">Medical Sciences</MenuItem>
                        </Select>
                      </FormControl>
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Office Location" name="officeLocation" placeholder="Building and Room Number" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Phone Number" name="phoneNumber" placeholder="Contact Number" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Email" name="email" placeholder="Email Address" type="email" required fullWidth />
                    </FormGroup>
                  </FormRow>
                  <FormButtons>
                    <StyledButton variant="secondary" type="reset">Clear</StyledButton>
                    <StyledButton variant="formPrimary" type="submit">Add Lecturer</StyledButton>
                  </FormButtons>
                </form>
                <Box mt="30px">
                  <Typography variant="h6">Existing Lecturers</Typography>
                  <SearchBox
                    placeholder="Search lecturers..."
                    value={lecturerSearch}
                    onChange={(e) => setLecturerSearch(e.target.value)}
                    fullWidth
                  />
                  <StyledTableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <StyledTableHeadCell>ID</StyledTableHeadCell>
                          <StyledTableHeadCell>Name</StyledTableHeadCell>
                          <StyledTableHeadCell>Department</StyledTableHeadCell>
                          <StyledTableHeadCell>Office</StyledTableHeadCell>
                          <StyledTableHeadCell>Contact</StyledTableHeadCell>
                          <StyledTableHeadCell>Actions</StyledTableHeadCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filterTable(lecturers, lecturerSearch).map((lecturer) => (
                          <TableRow key={lecturer.lecturer_id}>
                            <StyledTableCell>{lecturer.lecturer_id}</StyledTableCell>
                            <StyledTableCell>{lecturer.name}</StyledTableCell>
                            <StyledTableCell>{lecturer.department}</StyledTableCell>
                            <StyledTableCell>{lecturer.office_location}</StyledTableCell>
                            <StyledTableCell>{lecturer.phone_number}</StyledTableCell>
                            <StyledTableCell>
                              <ActionButton variant="edit" onClick={() => handleEdit(lecturer.lecturer_id)}>Edit</ActionButton>
                              <ActionButton variant="delete" onClick={() => handleDelete(lecturer.lecturer_id, setLecturers, lecturers, 'lecturers')}>Delete</ActionButton>
                            </StyledTableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </StyledTableContainer>
                </Box>
              </FormContainer>
            </AccordionDetails>
          </StyledAccordion>

          {/* Room Management */}
          <StyledAccordion expanded={expanded.room} onChange={() => handleToggle('room')}>
            <AccordionHeader expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap="10px">
                <i className="fas fa-door-open" />
                <Typography>Room Management</Typography>
              </Box>
            </AccordionHeader>
            <AccordionDetails>
              <FormContainer>
                <Typography variant="h6" mb="15px">Add New Room</Typography>
                <form id="roomForm" onSubmit={handleFormSubmit('roomForm')}>
                  <FormRow>
                    <FormGroup>
                      <TextField label="Room ID" name="roomId" placeholder="e.g., RM101" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Room Name" name="roomName" placeholder="Room Name/Number" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Building" name="building" placeholder="Building Name" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Capacity" name="capacity" placeholder="Number of Students" type="number" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <FormControl fullWidth required>
                        <InputLabel>Room Type</InputLabel>
                        <Select label="Room Type" name="roomType">
                          <MenuItem value="">Select Type</MenuItem>
                          <MenuItem value="Lecture Hall">Lecture Hall</MenuItem>
                          <MenuItem value="Laboratory">Laboratory</MenuItem>
                          <MenuItem value="Seminar Room">Seminar Room</MenuItem>
                          <MenuItem value="Computer Lab">Computer Lab</MenuItem>
                        </Select>
                      </FormControl>
                    </FormGroup>
                    <FormGroup>
                      <FormControl fullWidth>
                        <InputLabel>Facilities</InputLabel>
                        <Select
                          label="Facilities"
                          name="facilities"
                          multiple
                          value={facilities}
                          onChange={(e) => setFacilities(e.target.value)}
                        >
                          <MenuItem value="projector">Projector</MenuItem>
                          <MenuItem value="whiteboard">Whiteboard</MenuItem>
                          <MenuItem value="computers">Computers</MenuItem>
                          <MenuItem value="smartboard">Smart Board</MenuItem>
                        </Select>
                      </FormControl>
                    </FormGroup>
                  </FormRow>
                  <FormButtons>
                    <StyledButton variant="secondary" type="reset" onClick={() => setFacilities([])}>Clear</StyledButton>
                    <StyledButton variant="formPrimary" type="submit">Add Room</StyledButton>
                  </FormButtons>
                </form>
                <Box mt="30px">
                  <Typography variant="h6">Existing Rooms</Typography>
                  <SearchBox
                    placeholder="Search rooms..."
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    fullWidth
                  />
                  <StyledTableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <StyledTableHeadCell>ID</StyledTableHeadCell>
                          <StyledTableHeadCell>Name</StyledTableHeadCell>
                          <StyledTableHeadCell>Building</StyledTableHeadCell>
                          <StyledTableHeadCell>Capacity</StyledTableHeadCell>
                          <StyledTableHeadCell>Type</StyledTableHeadCell>
                          <StyledTableHeadCell>Facilities</StyledTableHeadCell>
                          <StyledTableHeadCell>Actions</StyledTableHeadCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filterTable(rooms, roomSearch).map((room) => (
                          <TableRow key={room.room_id}>
                            <StyledTableCell>{room.room_id}</StyledTableCell>
                            <StyledTableCell>{room.name}</StyledTableCell>
                            <StyledTableCell>{room.building}</StyledTableCell>
                            <StyledTableCell>{room.capacity}</StyledTableCell>
                            <StyledTableCell>{room.room_type}</StyledTableCell>
                            <StyledTableCell>{room.facilities?.join(', ') || 'None'}</StyledTableCell>
                            <StyledTableCell>
                              <ActionButton variant="edit" onClick={() => handleEdit(room.room_id)}>Edit</ActionButton>
                              <ActionButton variant="delete" onClick={() => handleDelete(room.room_id, setRooms, rooms, 'rooms')}>Delete</ActionButton>
                            </StyledTableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </StyledTableContainer>
                </Box>
              </FormContainer>
            </AccordionDetails>
          </StyledAccordion>

          {/* Course Management */}
          <StyledAccordion expanded={expanded.course} onChange={() => handleToggle('course')}>
            <AccordionHeader expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap="10px">
                <i className="fas fa-book" />
                <Typography>Course Management</Typography>
              </Box>
            </AccordionHeader>
            <AccordionDetails>
              <FormContainer>
                <Typography variant="h6" mb="15px">Add New Course</Typography>
                <form id="courseForm" onSubmit={handleFormSubmit('courseForm')}>
                  <FormRow>
                    <FormGroup>
                      <TextField label="Course ID" name="courseId" placeholder="e.g., CS101" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Course Name" name="courseName" placeholder="Course Name" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <FormControl fullWidth required>
                        <InputLabel>Department</InputLabel>
                        <Select label="Department" name="department">
                          <MenuItem value="">Select Department</MenuItem>
                          <MenuItem value="Computer Science">Computer Science</MenuItem>
                          <MenuItem value="Engineering">Engineering</MenuItem>
                          <MenuItem value="Business">Business</MenuItem>
                          <MenuItem value="Medical Sciences">Medical Sciences</MenuItem>
                        </Select>
                      </FormControl>
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Year" name="year" placeholder="e.g., 1" type="number" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Semester" name="semester" placeholder="e.g., 1" type="number" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Number of Students" name="students" placeholder="e.g., 120" type="number" required fullWidth />
                    </FormGroup>
                  </FormRow>
                  <FormButtons>
                    <StyledButton variant="secondary" type="reset">Clear</StyledButton>
                    <StyledButton variant="formPrimary" type="submit">Add Course</StyledButton>
                  </FormButtons>
                </form>
                <Box mt="30px">
                  <Typography variant="h6">Existing Courses</Typography>
                  <SearchBox
                    placeholder="Search courses..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    fullWidth
                  />
                  <StyledTableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <StyledTableHeadCell>ID</StyledTableHeadCell>
                          <StyledTableHeadCell>Name</StyledTableHeadCell>
                          <StyledTableHeadCell>Department</StyledTableHeadCell>
                          <StyledTableHeadCell>Year</StyledTableHeadCell>
                          <StyledTableHeadCell>Semester</StyledTableHeadCell>
                          <StyledTableHeadCell>Students</StyledTableHeadCell>
                          <StyledTableHeadCell>Actions</StyledTableHeadCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filterTable(courses, courseSearch).map((course) => (
                          <TableRow key={course.course_id}>
                            <StyledTableCell>{course.course_id}</StyledTableCell>
                            <StyledTableCell>{course.name}</StyledTableCell>
                            <StyledTableCell>{course.department}</StyledTableCell>
                            <StyledTableCell>{course.year}</StyledTableCell>
                            <StyledTableCell>{course.semester}</StyledTableCell>
                            <StyledTableCell>{course.num_students}</StyledTableCell>
                            <StyledTableCell>
                              <ActionButton variant="edit" onClick={() => handleEdit(course.course_id)}>Edit</ActionButton>
                              <ActionButton variant="delete" onClick={() => handleDelete(course.course_id, setCourses, courses, 'courses')}>Delete</ActionButton>
                            </StyledTableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </StyledTableContainer>
                </Box>
              </FormContainer>
            </AccordionDetails>
          </StyledAccordion>

          {/* Constraint Management */}
          <StyledAccordion expanded={expanded.constraint} onChange={() => handleToggle('constraint')}>
            <AccordionHeader expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap="10px">
                <i className="fas fa-exclamation-circle" />
                <Typography>Constraint Management</Typography>
              </Box>
            </AccordionHeader>
            <AccordionDetails>
              <FormContainer>
                <Typography variant="h6" mb="15px">Add New Constraint</Typography>
                <form id="constraintForm" onSubmit={handleFormSubmit('constraintForm')}>
                  <FormRow>
                    <FormGroup>
                      <TextField label="Constraint ID" name="constraintId" placeholder="e.g., CONST001" required fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <FormControl fullWidth required>
                        <InputLabel>Constraint Type</InputLabel>
                        <Select label="Constraint Type" name="constraintType">
                          <MenuItem value="">Select Type</MenuItem>
                          <MenuItem value="Hard">Hard</MenuItem>
                          <MenuItem value="Soft">Soft</MenuItem>
                        </Select>
                      </FormControl>
                    </FormGroup>
                    <FormGroup>
                      <FormControl fullWidth required>
                        <InputLabel>Category</InputLabel>
                        <Select label="Category" name="constraintCategory">
                          <MenuItem value="">Select Category</MenuItem>
                          <MenuItem value="Lecturer Availability">Lecturer Availability</MenuItem>
                          <MenuItem value="Room Requirements">Room Requirements</MenuItem>
                          <MenuItem value="Course Relationships">Course Relationships</MenuItem>
                          <MenuItem value="Time Restrictions">Time Restrictions</MenuItem>
                        </Select>
                      </FormControl>
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Related To" name="relatedTo" placeholder="e.g., Dr. John Smith or CS101" fullWidth />
                    </FormGroup>
                    <FormGroup>
                      <TextField label="Description" name="constraintDescription" placeholder="Constraint Details" required fullWidth multiline rows={4} />
                    </FormGroup>
                  </FormRow>
                  <FormButtons>
                    <StyledButton variant="secondary" type="reset">Clear</StyledButton>
                    <StyledButton variant="formPrimary" type="submit">Add Constraint</StyledButton>
                  </FormButtons>
                </form>
                <Box mt="30px">
                  <Typography variant="h6">Existing Constraints</Typography>
                  <SearchBox
                    placeholder="Search constraints..."
                    value={constraintSearch}
                    onChange={(e) => setConstraintSearch(e.target.value)}
                    fullWidth
                  />
                  <StyledTableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <StyledTableHeadCell>ID</StyledTableHeadCell>
                          <StyledTableHeadCell>Type</StyledTableHeadCell>
                          <StyledTableHeadCell>Category</StyledTableHeadCell>
                          <StyledTableHeadCell>Related To</StyledTableHeadCell>
                          <StyledTableHeadCell>Description</StyledTableHeadCell>
                          <StyledTableHeadCell>Actions</StyledTableHeadCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filterTable(constraints, constraintSearch).map((constraint) => (
                          <TableRow key={constraint.constraint_id}>
                            <StyledTableCell>{constraint.constraint_id}</StyledTableCell>
                            <StyledTableCell>{constraint.constraint_type}</StyledTableCell>
                            <StyledTableCell>{constraint.category}</StyledTableCell>
                            <StyledTableCell>{constraint.related_to}</StyledTableCell>
                            <StyledTableCell>{constraint.description}</StyledTableCell>
                            <StyledTableCell>
                              <ActionButton variant="edit" onClick={() => handleEdit(constraint.constraint_id)}>Edit</ActionButton>
                              <ActionButton variant="delete" onClick={() => handleDelete(constraint.constraint_id, setConstraints, constraints, 'constraints')}>Delete</ActionButton>
                            </StyledTableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </StyledTableContainer>
                </Box>
              </FormContainer>
            </AccordionDetails>
          </StyledAccordion>
        </Content>
      </MainContainer>
    </Box>
  );
};

export default DataInput;