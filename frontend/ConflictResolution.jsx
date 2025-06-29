import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Button, Divider, 
  List, ListItem, ListItemText, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, TextField,
  Alert, Snackbar, Tab, Tabs, CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import axiosInstance from '../axiosInstance';
import { useAuth } from '../context/AuthContext';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: '8px',
  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
}));

const ConflictItem = styled(ListItem)(({ theme, severity }) => ({
  borderLeft: `4px solid ${severity === 'hard' ? '#f44336' : '#ff9800'}`,
  backgroundColor: severity === 'hard' ? '#ffebee' : '#fff8e1',
  borderRadius: '4px',
  marginBottom: theme.spacing(1),
}));

const ConflictIcon = ({ severity }) => {
  return severity === 'hard' ? 
    <ErrorIcon color="error" /> : 
    <WarningIcon color="warning" />;
};

const ResolutionStatus = styled(Box)(({ theme, status }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(1),
  backgroundColor: status === 'resolved' ? '#e8f5e9' : '#f5f5f5',
  borderRadius: '4px',
  marginTop: theme.spacing(1),
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  '& .MuiTab-root': {
    minWidth: 100,
  },
}));

const ConflictResolution = ({ conflicts = [], onResolve }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [resolutionOption, setResolutionOption] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [availableTimeslots, setAvailableTimeslots] = useState([]);
  const [availableLecturers, setAvailableLecturers] = useState([]);
  const [selectionData, setSelectionData] = useState('');

  // Helper function to generate unique IDs
  const generateUniqueId = (prefix = 'id') => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Helper function to safely extract semester/year pairs
  const extractSemesterYearPairs = (conflicts) => {
    const pairs = new Map();
    
    conflicts.forEach(conflict => {
      if (!conflict?.details?.items?.length) return;
      
      conflict.details.items.forEach(item => {
        const semester = item.semester || 'Fall';
        const year = item.year ? parseInt(item.year) : 1;
        const key = `${semester}-${year}`;
        
        if (!pairs.has(key)) {
          pairs.set(key, { semester, year, key });
        }
      });
    });
    
    return Array.from(pairs.values());
  };

  // Fetch available resources for resolution
  const fetchAvailableResources = async () => {
    try {
      const [roomsRes, timeslotsRes, lecturersRes] = await Promise.all([
        axiosInstance.get('/rooms/', { headers: { Authorization: `Bearer ${token}` } }),
        axiosInstance.get('/timeslots/', { headers: { Authorization: `Bearer ${token}` } }),
        axiosInstance.get('/lecturers/', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setAvailableRooms(roomsRes.data || []);
      setAvailableTimeslots(timeslotsRes.data || []);
      setAvailableLecturers(lecturersRes.data || []);
    } catch (err) {
      console.error('Error fetching resources:', err);
      setError('Failed to fetch available resources');
    }
  };

  // Generate possible resolutions based on conflict type
  const generatePossibleResolutions = (conflict) => {
    const resolutions = [];
    const conflictType = conflict.type.toLowerCase();
    
    const commonOptions = {
      moveCourse: (course) => ({
        id: `move-${course.courseId}`,
        action: 'move-course',
        course: course.courseId,
        target: 'room',
        description: `Move ${course.courseName} to different room`,
        requiresSelection: true,
        selectionType: 'room',
        selectionLabel: 'Select new room'
      }),
      reschedule: (course) => ({
        id: `reschedule-${course.courseId}`,
        action: 'reschedule',
        course: course.courseId,
        target: 'time',
        description: `Reschedule ${course.courseName} to different time`,
        requiresSelection: true,
        selectionType: 'timeslot',
        selectionLabel: 'Select new time slot'
      }),
      cancel: (course) => ({
        id: `cancel-${course.courseId}`,
        action: 'cancel',
        course: course.courseId,
        description: `Cancel ${course.courseName} for this semester`
      })
    };
    
    switch(conflictType) {
      case 'room_overlap':
        conflict.details.items.forEach(item => {
          resolutions.push(commonOptions.moveCourse(item));
          resolutions.push(commonOptions.reschedule(item));
        });
        break;
        
      case 'lecturer_overlap':
        conflict.details.items.forEach(item => {
          resolutions.push(commonOptions.reschedule(item));
          resolutions.push({
            id: `reassign-${item.courseId}`,
            action: 'reassign-lecturer',
            course: item.courseId,
            target: 'lecturer',
            description: `Reassign ${item.courseName} to different lecturer`,
            requiresSelection: true,
            selectionType: 'lecturer',
            selectionLabel: 'Select new lecturer'
          });
        });
        break;
        
      case 'student_overlap':
        conflict.details.items.forEach(item => {
          resolutions.push(commonOptions.reschedule(item));
          resolutions.push(commonOptions.moveCourse(item));
        });
        break;
        
      case 'room_capacity':
        conflict.details.items.forEach(item => {
          resolutions.push(commonOptions.moveCourse(item));
          resolutions.push({
            id: `split-${item.courseId}`,
            action: 'split-course',
            course: item.courseId,
            description: `Split ${item.courseName} into multiple sections`
          });
        });
        break;
        
      default:
        resolutions.push({
          id: 'manual',
          action: 'manual',
          description: 'Requires manual resolution'
        });
    }
    
    return resolutions;
  };

  useEffect(() => {
    fetchAvailableResources();
  }, []);

  const handleResolveClick = (conflict) => {
    const conflictWithResolutions = {
      ...conflict,
      possibleResolutions: generatePossibleResolutions(conflict)
    };
    setSelectedConflict(conflictWithResolutions);
    setResolutionDialogOpen(true);
    setResolutionOption('');
    setResolutionNotes('');
    setSelectionData('');
  };

  const handleCloseDialog = () => {
    setResolutionDialogOpen(false);
    setSelectedConflict(null);
  };

  const handleResolutionChange = (event) => {
    setResolutionOption(event.target.value);
    setSelectionData('');
  };

  const handleNotesChange = (event) => {
    setResolutionNotes(event.target.value);
  };

  // Enhanced manual resolution handler with full refresh
  const handleApplyResolution = async () => {
    if (!resolutionOption || !selectedConflict) return;
    
    try {
      setLoading(true);
      
      const resolution = selectedConflict.possibleResolutions.find(
        res => res.id === resolutionOption
      );
      
      if (!resolution) {
        throw new Error('Selected resolution not found');
      }
      
      const resolutionData = {
        conflictId: selectedConflict.id,
        resolution: { 
          action: resolution.action, 
          course: selectedConflict.details.items[0]?.courseId 
        },
        semester: selectedConflict.details.items[0]?.semester || 'Fall',
        year: selectedConflict.details.items[0]?.year || new Date().getFullYear(),
        notes: resolutionNotes,
        selectionData: selectionData || null
      };
      
      // Apply resolution
      const response = await axiosInstance.post('/timetables/resolve-conflict/', resolutionData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setResolutionDialogOpen(false);
      setSuccessMessage(`Conflict resolved: ${selectedConflict.description}`);
      
      // Trigger full refresh with updated data
      if (typeof onResolve === 'function') {
        // Pass updated data if available in response
        const refreshData = response.data?.updated_data ? {
          timetablesByYear: response.data.updated_data.timetables,
          conflicts: response.data.updated_data.conflicts
        } : null;
        
        onResolve(refreshData);
      }
      
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to apply resolution';
      setError(errorMessage);
      console.error('Error applying resolution:', err);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced auto-resolve function with comprehensive refresh
  // In ConflictResolution.jsx, update the handleAutoResolve function
  const handleAutoResolve = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');

      // Get all years with conflicts
      const yearsWithConflicts = [...new Set(conflicts.map(c => 
        c.details.items[0]?.year || 1
      ))].filter(y => y);

      // Try to resolve for all years, prioritizing Year 2
      const response = await axiosInstance.post('/timetables/auto-resolve/', {
        semester: conflicts[0]?.details.items[0]?.semester || 'Fall',
        prioritizeYear: 2, // Explicitly prioritize Year 2
        maxAttempts: 100,  // Increased attempts for complex cases
        allowResourceExpansion: true // Allow using more resources if needed
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120000, // Longer timeout
      });

      if (response.data.success) {
        let successMsg = '';
        if (response.data.resolved === 0) {
          successMsg = response.data.message || 'No conflicts were resolved.';
        } else {
          successMsg = `Successfully resolved ${response.data.resolved} conflicts! ${response.data.message || ''}`;
          
          // Highlight Year 2 specific resolutions
          const year2Resolutions = response.data.resolutionsByYear?.find(y => y.year === 2);
          if (year2Resolutions) {
            successMsg += `\nYear 2: ${year2Resolutions.resolved}/${year2Resolutions.total} conflicts resolved.`;
          }
        }

        setSuccessMessage(successMsg);

        // Trigger full refresh with updated data
        if (typeof onResolve === 'function') {
          onResolve(response.data.updated_data);
        }
      } else {
        throw new Error(response.data.message || 'Auto-resolution failed');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Auto-resolution failed';
      console.error('Auto-resolve error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  const handleCloseSnackbar = () => {
    setSuccessMessage('');
    setError(null);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleRefresh = () => {
  setLoading(true);
  setError(null);
  setSuccessMessage('');

  if (typeof onResolve === 'function') {
    onResolve(); // Triggers parent component to refresh data
  }

  setLoading(false);
  };

  const filteredConflicts = conflicts.filter(conflict => {
    if (tabValue === 0) return true; // All conflicts
    if (tabValue === 1) return conflict.severity === 'hard'; // Hard constraints
    if (tabValue === 2) return conflict.severity === 'soft'; // Soft constraints
    if (tabValue === 3) return conflict.status === 'resolved'; // Resolved conflicts
    if (tabValue === 4) return conflict.status === 'unresolved'; // Unresolved conflicts
    return true;
  });

  // In ConflictResolution.jsx, update the conflict rendering
  const renderConflictDetails = (conflict) => {
    return (
      <Box sx={{ p: 2, backgroundColor: conflict.severity === 'hard' ? '#ffebee' : '#fff8e1' }}>
        <Typography variant="subtitle2" gutterBottom>
          {conflict.description}
        </Typography>
        <Grid container spacing={2}>
          {conflict.details.items.map((item, index) => (
            <React.Fragment key={index}>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2"><strong>Course:</strong> {item.course_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2"><strong>Lecturer:</strong> {item.lecturer_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2"><strong>Room:</strong> {item.room_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2"><strong>Time:</strong> {item.day} {item.time}</Typography>
              </Grid>
              {item.year && (
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="body2"><strong>Year:</strong> {item.year}</Typography>
                </Grid>
              )}
              {item.semester && (
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="body2"><strong>Semester:</strong> {item.semester}</Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>
            </React.Fragment>
          ))}
        </Grid>
        {conflict.details.constraint && (
          <Chip 
            label={`Constraint: ${conflict.details.constraint}`} 
            color={conflict.severity === 'hard' ? 'error' : 'warning'}
            size="small"
            sx={{ mt: 1 }}
          />
        )}
      </Box>
    );
  };
  const renderSelectionField = (resolution) => {
    if (!resolution.requiresSelection) return null;
    
    switch(resolution.selectionType) {
      case 'room':
        return (
          <FormControl fullWidth margin="normal">
            <InputLabel id="resolution-selection-label">{resolution.selectionLabel}</InputLabel>
            <Select
              labelId="resolution-selection-label"
              value={selectionData}
              onChange={(e) => setSelectionData(e.target.value)}
              label={resolution.selectionLabel}
            >
              {availableRooms.map(room => (
                <MenuItem key={room.room_id} value={room.room_id}>
                  {room.room_name} (Capacity: {room.capacity})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      
      case 'timeslot':
        return (
          <FormControl fullWidth margin="normal">
            <InputLabel id="resolution-selection-label">{resolution.selectionLabel}</InputLabel>
            <Select
              labelId="resolution-selection-label"
              value={selectionData}
              onChange={(e) => setSelectionData(e.target.value)}
              label={resolution.selectionLabel}
            >
              {availableTimeslots.map(slot => (
                <MenuItem key={slot.timeslot_id} value={slot.timeslot_id}>
                  {slot.day_of_the_week} {slot.start_time}-{slot.end_time}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      
      case 'lecturer':
        return (
          <FormControl fullWidth margin="normal">
            <InputLabel id="resolution-selection-label">{resolution.selectionLabel}</InputLabel>
            <Select
              labelId="resolution-selection-label"
              value={selectionData}
              onChange={(e) => setSelectionData(e.target.value)}
              label={resolution.selectionLabel}
            >
              {availableLecturers.map(lecturer => (
                <MenuItem key={lecturer.lecturer_id} value={lecturer.lecturer_id}>
                  {lecturer.lecturer_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      
      default:
        return null;
    }
  };

  return (
    <Box>
      <StyledPaper>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5">Timetable Conflicts</Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <Button 
              variant="outlined" 
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={loading ? <CircularProgress size={20} /> : <AutoFixHighIcon />}
              onClick={handleAutoResolve}
              disabled={loading || !conflicts.length}
            >
              {loading ? 'Auto-resolving...' : 'Auto-resolve Conflicts'}
            </Button>
          </Box>
        </Box>
        
        <StyledTabs value={tabValue} onChange={handleTabChange}>
          <Tab label="All" />
          <Tab label="Hard Constraints" />
          <Tab label="Soft Constraints" />
          <Tab label="Resolved" />
          <Tab label="Unresolved" />
        </StyledTabs>
        
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Processing conflicts...
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
            {error}
            <Box sx={{ mt: 1 }}>
              <Button onClick={() => setError(null)} color="inherit" size="small" sx={{ mr: 1 }}>
                Dismiss
              </Button>
              <Button onClick={handleRefresh} color="inherit" size="small">
                Retry
              </Button>
            </Box>
          </Alert>
        ) : filteredConflicts.length === 0 ? (
          <Alert severity="info">
            {conflicts.length === 0 ? 'No conflicts found' : 'No conflicts found for the selected criteria'}
          </Alert>
        ) : (
          <List>
            {filteredConflicts.map((conflict) => (
              <ConflictItem key={conflict.id} severity={conflict.severity}>
                <Box display="flex" alignItems="flex-start" width="100%">
                  <ConflictIcon severity={conflict.severity} />
                  <Box ml={2} flex={1}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle1">{conflict.description}</Typography>
                      <Chip 
                        label={conflict.severity === 'hard' ? 'Hard Constraint' : 'Soft Constraint'} 
                        color={conflict.severity === 'hard' ? 'error' : 'warning'} 
                        size="small"
                      />
                    </Box>
                    
                    <Box mt={1}>
                      {renderConflictDetails(conflict)}
                    </Box>
                    
                    {conflict.status === 'resolved' ? (
                      <ResolutionStatus status="resolved">
                        <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                        <Typography variant="body2">
                          Resolved: {conflict.appliedResolution?.description || 'Resolution applied'}
                        </Typography>
                      </ResolutionStatus>
                    ) : (
                      <Box mt={1} display="flex" justifyContent="flex-end">
                        <Button 
                          variant="outlined" 
                          size="small" 
                          startIcon={<EditIcon />}
                          onClick={() => handleResolveClick(conflict)}
                        >
                          Resolve
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Box>
              </ConflictItem>
            ))}
          </List>
        )}
      </StyledPaper>
      
      {/* Resolution Dialog */}
      <Dialog 
        open={resolutionDialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            Resolve Conflict
            <IconButton onClick={handleCloseDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedConflict && (
            <>
              <Typography variant="subtitle1" gutterBottom>{selectedConflict.description}</Typography>
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" gutterBottom>Conflict Details:</Typography>
              {renderConflictDetails(selectedConflict)}
              
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>Choose a resolution:</Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel id="resolution-label">Available Resolutions</InputLabel>
                <Select
                  labelId="resolution-label"
                  value={resolutionOption}
                  onChange={handleResolutionChange}
                  label="Available Resolutions"
                >
                  <MenuItem value="">Select a resolution</MenuItem>
                  {selectedConflict.possibleResolutions?.map((resolution) => (
                    <MenuItem key={resolution.id} value={resolution.id}>
                      {resolution.description}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {resolutionOption && selectedConflict.possibleResolutions?.find(r => r.id === resolutionOption)?.requiresSelection && (
                renderSelectionField(selectedConflict.possibleResolutions.find(r => r.id === resolutionOption))
              )}
              
              <Typography variant="subtitle2" gutterBottom mt={3}>Notes:</Typography>
              <TextField
                label="Resolution notes"
                multiline
                rows={3}
                fullWidth
                variant="outlined"
                placeholder="Add any additional notes about this resolution..."
                value={resolutionNotes}
                onChange={handleNotesChange}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleApplyResolution}
            variant="contained"
            color="primary"
            disabled={!resolutionOption || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Apply Resolution'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Success/Error Messages */}
      <Snackbar
        open={!!successMessage || !!error}
        autoHideDuration={8000}
        onClose={handleCloseSnackbar}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={error ? "error" : "success"} 
          sx={{ width: '100%', whiteSpace: 'pre-line' }}
        >
          {error || successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ConflictResolution;