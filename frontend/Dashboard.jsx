import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Box, Tabs, Tab, Typography, Button, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Grid, useMediaQuery, useTheme, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import axiosInstance from '../../axiosInstance';
import { useAuth } from '../../context/AuthContext';
import TimetableVisualization from '../../components/TimetableVisualization';
import AlgorithmControl from '../../components/AlgorithmControl';
import ConflictResolution from '../../components/ConflictResolution';

// Define the header height
const HEADER_HEIGHT = '60px';

// Styled components
const MainContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  backgroundColor: '#f5f5f5',
  [theme.breakpoints.down('md')]: {
    flexDirection: 'column',
  },
}));

const HeaderWrapper = styled(Box)({
  width: '100%',
  height: HEADER_HEIGHT,
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

const SidebarWrapper = styled(Box)(({ theme }) => ({
  width: '200px',
  backgroundColor: '#e8ecef',
  padding: '20px 10px',
  marginTop: HEADER_HEIGHT,
  [theme.breakpoints.down('md')]: {
    width: '100%',
  },
}));

const Content = styled(Box)(({ theme }) => ({
  flex: 1,
  padding: '20px',
  marginTop: HEADER_HEIGHT,
}));

const StyledTabs = styled(Tabs)({
  backgroundColor: '#333',
  color: 'white',
  padding: '10px',
  marginBottom: '20px',
  '& .MuiTab-root': {
    padding: '5px 10px',
    color: 'white',
  },
  '& .Mui-selected': {
    backgroundColor: '#555',
  },
});

const DashboardHeader = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px',
});

const Actions = styled(Box)({
  display: 'flex',
  gap: '10px',
});

const StyledButton = styled(Button)(({ variant }) => ({
  padding: '8px 15px',
  borderRadius: '4px',
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
}));

const StyledCard = styled(Card)({
  backgroundColor: 'white',
  borderRadius: '8px',
  marginBottom: '20px',
  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
});

const StyledTableContainer = styled(TableContainer)({
  marginTop: '20px',
});

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  padding: '12px',
  borderBottom: `1px solid ${theme.palette.divider}`,
  '&:first-of-type': {
    textAlign: 'left',
  },
}));

const StyledTableHeadCell = styled(StyledTableCell)({
  backgroundColor: '#2196F3',
  color: 'white',
  padding: '12px',
});

// Enhanced Error Display Component
const ErrorDisplay = ({ error }) => {
  if (!error) return null;

  let errorDetails = error;
  if (error.includes('Failed to load data')) {
    errorDetails = error.replace('Failed to load data: ', '');
    try {
      const parsedError = JSON.parse(errorDetails);
      errorDetails = parsedError.detail || parsedError.message || errorDetails;
    } catch (e) {
      // Not JSON, use as-is
    }
  }

  return (
    <Alert severity="error" sx={{ mb: 3, whiteSpace: 'pre-wrap' }}>
      <Typography variant="body1" fontWeight="bold">Error Loading Data</Typography>
      <Typography variant="body2">{errorDetails}</Typography>
      <Box sx={{ mt: 2 }}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={() => window.location.reload()}
          sx={{ mr: 1 }}
        >
          Retry
        </Button>
        <Button
          variant="text"
          color="inherit"
          onClick={() => console.log('Contact support with error:', errorDetails)}
        >
          Contact Support
        </Button>
      </Box>
    </Alert>
  );
};

const AdminDashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState([]);
  const [timetablesByYear, setTimetablesByYear] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { currentUser, token } = useAuth();

  // Fetch users (runs once when component mounts for admin users)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get('/users/', {
          headers: { Authorization: `Bearer ${token}` },
          params: { skip: 0, limit: 100 },
        });
        const userData = response.data.map(user => ({
          user_id: user.user_id,
          user: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A',
          role: user.role || 'N/A',
          status: user.user_id === currentUser.user_id ? 'Active' : 'Inactive',
          last_login: user.last_login ? new Date(user.last_login).toLocaleString() : 'N/A',
        }));
        setUsers(userData);
      } catch (error) {
        console.error('Error fetching users:', error.response ? error.response.data : error.message);
        const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
        setError(`Failed to load user data: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser && currentUser.role === 'admin') {
      fetchUsers();
    }
  }, [currentUser, token]);

  // Fetch timetable and conflicts (runs once or when triggered by ConflictResolution)
  // Updated fetchTimetable function in Dashboard.jsx
 const fetchTimetable = useCallback(async (updatedData = null, year = null, timetableNumber = null) => {
    try {
      setIsLoading(true);
      setError('');

      const params = { 
        semester: 'Fall',
        skip: 0,
        limit: 1000 // Ensure we get all records
      };
      
      if (year !== null && year !== undefined) params.year = year;
      if (timetableNumber !== null) params.timetable_number = timetableNumber;

      const [timetableRes, conflictsRes] = await Promise.all([
        axiosInstance.get('/timetables/', {
          headers: { Authorization: `Bearer ${token}` },
          params
        }),
        axiosInstance.get('/timetables/conflicts/', {
          headers: { Authorization: `Bearer ${token}` },
          params: { semester: 'Fall', year }
        }),
      ]);

      // Process timetable data
      const organizedTimetables = timetableRes.data.reduce((acc, item) => {
        const key = `${item.year || 'default'}-${item.semester || 'Fall'}`;
        if (!acc[key]) acc[key] = [];
        
        acc[key].push({
          id: item.timeslot_id,
          day: item.day_of_the_week,
          startTime: item.start_time,
          endTime: item.end_time,
          course: item.course_name || `Course-${item.course_id}`,
          room: item.room_name || `Room-${item.room_id}`,
          lecturer: item.lecturer_name || `Lecturer-${item.lecturer_id}`,
          courseType: item.course_name?.toLowerCase().includes('lab') ? 'lab' : 'lecture',
          class: item.year ? `Year ${item.year}` : 'N/A',
          year: item.year || 1,
          semester: item.semester || 'Fall',
        });
        return acc;
      }, {});

      setTimetablesByYear(organizedTimetables);

      // Process conflicts
      const formattedConflicts = conflictsRes.data.conflicts?.map((conflict, index) => ({
        id: `conflict-${index}-${conflict.type}-${Date.now()}`,
        type: conflict.type?.toLowerCase().replace(/_/g, '-') || 'unknown',
        severity: conflict.severity || (conflict.constraint?.startsWith('HC') ? 'hard' : 'soft'),
        description: conflict.description || 'No description provided',
        details: {
          items: conflict.items?.map(item => ({
            courseId: item.course_id,
            courseName: item.course_name || 'Unknown Course',
            lecturerName: item.lecturer_name || 'Unknown Lecturer',
            roomName: item.room_name || 'Unknown Room',
            day: item.day || 'N/A',
            time: item.time || `${item.start_time || 'N/A'}-${item.end_time || 'N/A'}`,
            semester: item.semester || 'Fall',
            year: item.year || 1,
          })) || [],
          constraint: conflict.constraint || 'N/A',
        },
        status: 'unresolved',
      })) || [];

      setConflicts(formattedConflicts);

    } catch (error) {
      console.error('Error fetching data:', error);
      setError(`Failed to load data: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Trigger initial timetable fetch for admin users
  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      fetchTimetable();
    }
  }, [currentUser, fetchTimetable]);

  // Handle tab changes
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Handle new timetable generation
  const handleTimetableGenerated = useCallback((newTimetable, generatedYear, generatedSemester) => {
    const key = `${generatedYear || 'default'}-${generatedSemester || 'default'}`;
    setTimetablesByYear(prev => ({
      ...prev,
      [key]: newTimetable,
    }));
    // Refresh conflicts after new timetable generation
    fetchTimetable();
  }, [fetchTimetable]);

  return (
    <Box>
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
            <Button
              variant="text"
              startIcon={<Box component="span" sx={{ fontSize: '18px' }}>📊</Box>}
              onClick={() => setTabValue(0)}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: 'black',
              }}
            >
              Dashboard
            </Button>
            <Button
              variant="text"
              startIcon={<Box component="span" sx={{ fontSize: '18px' }}>📅</Box>}
              onClick={() => setTabValue(1)}
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
              onClick={() => setTabValue(4)}
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
            <Link to="/data-input" style={{ textDecoration: 'none' }}>
              <Button
                variant="text"
                startIcon={<Box component="span" sx={{ fontSize: '18px' }}>📥</Box>}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  color: 'black',
                }}
              >
                Data Input
              </Button>
            </Link>
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
          <StyledTabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Dashboard" />
            <Tab label="Timetable" />
            <Tab label="Algorithm Control" />
            <Tab label="Conflicts" />
            <Tab label="User Management" />
          </StyledTabs>

          {isLoading && (
            <Typography sx={{ marginBottom: '20px' }}>
              Loading...
            </Typography>
          )}

          <ErrorDisplay error={error} />

          {tabValue === 0 && (
            <>
              <DashboardHeader>
                <Typography variant="h5" color="#333">Admin Dashboard</Typography>
                <Actions>
                  <StyledButton variant="secondary">Export</StyledButton>
                </Actions>
              </DashboardHeader>
              <StyledCard>
                <CardContent>
                  <Typography variant="h6">User Management</Typography>
                  <StyledTableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <StyledTableHeadCell>User</StyledTableHeadCell>
                          <StyledTableHeadCell>Role</StyledTableHeadCell>
                          <StyledTableHeadCell>Status</StyledTableHeadCell>
                          <StyledTableHeadCell>Last Login</StyledTableHeadCell>
                          <StyledTableHeadCell>Actions</StyledTableHeadCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.user_id}>
                            <StyledTableCell>{user.user}</StyledTableCell>
                            <StyledTableCell>{user.role}</StyledTableCell>
                            <StyledTableCell>{user.status}</StyledTableCell>
                            <StyledTableCell>{user.last_login}</StyledTableCell>
                            <StyledTableCell>
                              <Link to={`/users/edit/${user.user_id}`} style={{ textDecoration: 'none' }}>
                                <StyledButton variant="secondary" sx={{ padding: '5px 10px' }}>Edit</StyledButton>
                              </Link>
                            </StyledTableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </StyledTableContainer>
                </CardContent>
              </StyledCard>
              <StyledCard>
                <CardContent>
                  <Typography variant="h6">Generated Timetable</Typography>
                  <TimetableVisualization timetablesByYear={timetablesByYear} conflicts={conflicts} />
                </CardContent>
              </StyledCard>
              <StyledCard>
                <CardContent>
                  <Typography variant="h6">System Statistics</Typography>
                  <Grid container spacing={2} sx={{ marginTop: '15px' }}>
                    <Grid item xs={12} sm={3} sx={{ textAlign: 'center' }}>
                      <Typography variant="h6">Total Users</Typography>
                      <Typography>142</Typography>
                    </Grid>
                    <Grid item xs={12} sm={3} sx={{ textAlign: 'center' }}>
                      <Typography variant="h6">Active Courses</Typography>
                      <Typography>56</Typography>
                    </Grid>
                    <Grid item xs={12} sm={3} sx={{ textAlign: 'center' }}>
                      <Typography variant="h6">Lecturers</Typography>
                      <Typography>38</Typography>
                    </Grid>
                    <Grid item xs={12} sm={3} sx={{ textAlign: 'center' }}>
                      <Typography variant="h6">Students</Typography>
                      <Typography>1,240</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </StyledCard>
              <StyledCard>
                <CardContent>
                  <Typography variant="h6">Recent Updates</Typography>
                  <Box component="ul" sx={{ listStyle: 'none', marginTop: '15px' }}>
                    <Box component="li" sx={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
                      <Typography>System maintenance scheduled for June 20, 2:00 AM - 4:00 AM</Typography>
                    </Box>
                    <Box component="li" sx={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
                      <Typography>New timetable generation feature added</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </StyledCard>
            </>
          )}

          {tabValue === 1 && (
            <TimetableVisualization timetablesByYear={timetablesByYear} conflicts={conflicts} />
          )}

          {tabValue === 2 && (
            <AlgorithmControl onTimetableGenerated={handleTimetableGenerated} />
          )}

          {tabValue === 3 && (
            <ConflictResolution conflicts={conflicts} onResolve={fetchTimetable} />
          )}

          {tabValue === 4 && (
            <StyledCard>
              <CardContent>
                <Typography variant="h6">User Management</Typography>
                <StyledTableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <StyledTableHeadCell>User</StyledTableHeadCell>
                        <StyledTableHeadCell>Role</StyledTableHeadCell>
                        <StyledTableHeadCell>Status</StyledTableHeadCell>
                        <StyledTableHeadCell>Last Login</StyledTableHeadCell>
                        <StyledTableHeadCell>Actions</StyledTableHeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.user_id}>
                          <StyledTableCell>{user.user}</StyledTableCell>
                          <StyledTableCell>{user.role}</StyledTableCell>
                          <StyledTableCell>{user.status}</StyledTableCell>
                          <StyledTableCell>{user.last_login}</StyledTableCell>
                          <StyledTableCell>
                            <Link to={`/users/edit/${user.user_id}`} style={{ textDecoration: 'none' }}>
                              <StyledButton variant="secondary" sx={{ padding: '5px 10px' }}>Edit</StyledButton>
                            </Link>
                          </StyledTableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </StyledTableContainer>
              </CardContent>
            </StyledCard>
          )}
        </Content>
      </MainContainer>
    </Box>
  );
};

export default AdminDashboard;