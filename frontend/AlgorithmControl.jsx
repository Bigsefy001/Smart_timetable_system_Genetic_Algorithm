import React, { useState } from 'react';
import { 
  Box, Typography, Slider, FormControl, InputLabel, 
  Select, MenuItem, Button, Paper, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails, Divider,
  Alert, Snackbar, TextField, Grid, Switch, FormControlLabel
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneIcon from '@mui/icons-material/Tune';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SaveIcon from '@mui/icons-material/Save';
import axiosInstance from '../axiosInstance'; // Use your axios instance
import { useAuth } from '../context/AuthContext';

const ControlPanel = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: '8px',
  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
}));

const ParameterGroup = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

const RunButton = styled(Button)(({ theme }) => ({
  marginRight: theme.spacing(2),
  backgroundColor: '#4CAF50',
  '&:hover': {
    backgroundColor: '#3e8e41',
  },
}));

const StopButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#f44336',
  '&:hover': {
    backgroundColor: '#d32f2f',
  },
}));

const ProgressContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginTop: theme.spacing(3),
  padding: theme.spacing(2),
  backgroundColor: '#f5f5f5',
  borderRadius: '4px',
}));

const ProgressInfo = styled(Box)(({ theme }) => ({
  marginLeft: theme.spacing(2),
  flex: 1,
}));

const AlgorithmControl = ({ onTimetableGenerated }) => {
  const { token } = useAuth();
  const [parameters, setParameters] = useState({
    populationSize: 100,
    generations: 150,
    crossoverRate: 0.8,
    mutationRate: 0.05,
    elitismCount: 5,
    tournamentSize: 3,
  });
  
  const [constraints, setConstraints] = useState({
    hardConstraints: true,
    softConstraints: true,
    weightTeacherPreference: 5,
    weightRoomCapacity: 8,
    weightTimeDistribution: 6,
  });
  
  const [timetableData, setTimetableData] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [fitness, setFitness] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [semester, setSemester] = useState('');
  const [year, setYear] = useState('');

  const handleParameterChange = (name) => (event, newValue) => {
    setParameters({
      ...parameters,
      [name]: newValue || event.target.value,
    });
  };
  
  const handleConstraintChange = (name) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setConstraints({
      ...constraints,
      [name]: value,
    });
  };
  
  const handleRunAlgorithm = async () => {
    if (!semester) {
      setErrorMessage('Please select a semester');
      return;
    }
    
    const yearValue = year ? parseInt(year, 10) : 1;
    
    // Validate that yearValue is a positive integer
    if (!Number.isInteger(yearValue) || yearValue <= 0) {
      setErrorMessage('Please enter a valid positive year value');
      return;
    }

    let adjustedParameters = {...parameters};
  
    if (yearValue === 2) {
      // More aggressive parameters for Year 2
      adjustedParameters = {
        populationSize: 120,
        generations: 200,
        crossoverRate: 0.8,
        mutationRate: 0.05,
        elitismCount: 5,
        tournamentSize: 3
      };
    }

    // Updated parameter validation to match new defaults
    const validatedParameters = {
      populationSize: Number(parameters.populationSize),
      generations: Number(parameters.generations),
      crossoverRate: Number(parameters.crossoverRate),
      mutationRate: Number(parameters.mutationRate),
      elitismCount: Number(parameters.elitismCount),
      tournamentSize: Number(parameters.tournamentSize),
    };

    if (
      validatedParameters.populationSize < 50 || validatedParameters.populationSize > 100 ||
      validatedParameters.generations < 50 || validatedParameters.generations > 200 ||
      validatedParameters.crossoverRate < 0.7 || validatedParameters.crossoverRate > 0.8 ||
      validatedParameters.mutationRate < 0.01 || validatedParameters.mutationRate > 0.05 ||
      validatedParameters.elitismCount < 1 || validatedParameters.elitismCount > 5 ||
      validatedParameters.tournamentSize < 2 || validatedParameters.tournamentSize > 3 ||
      isNaN(validatedParameters.populationSize) ||
      isNaN(validatedParameters.generations) ||
      isNaN(validatedParameters.crossoverRate) ||
      isNaN(validatedParameters.mutationRate) ||
      isNaN(validatedParameters.elitismCount) ||
      isNaN(validatedParameters.tournamentSize)
    ) {
      setErrorMessage('Invalid parameter values. Please check ranges.');
      return;
    }

    setIsRunning(true);
    setErrorMessage('');
    setSuccessMessage('');
    setProgress(0);
    setGeneration(0);
    setFitness(0);

    try {
      // Fetch mapping data once before running the algorithm
      const [coursesRes, roomsRes, lecturersRes] = await Promise.all([
        axiosInstance.get('/courses/', { headers: { Authorization: `Bearer ${token}` } }),
        axiosInstance.get('/rooms/', { headers: { Authorization: `Bearer ${token}` } }),
        axiosInstance.get('/lecturers/', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const courses = coursesRes.data;
      const rooms = roomsRes.data;
      const lecturers = lecturersRes.data;

      // Start the algorithm - ensure yearValue is sent as a number
      await axiosInstance.post(
        '/generate-timetable/',
        {
          semester,
          year: Number(yearValue),
          parameters: validatedParameters,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Poll for timetable results with status check
      let pollAttempts = 0;
      const maxPollAttempts = 80; // 2 minutes / 3 seconds per poll = ~40 attempts
      const pollTimetable = setInterval(async () => {
        pollAttempts++;
        try {
          const statusRes = await axiosInstance.get(`/timetable-status/?semester=${semester}&year=${yearValue}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          // Update progress based on status
          setProgress(Math.min((pollAttempts / maxPollAttempts) * 100, 90));

          if (statusRes.data.status === 'complete' && statusRes.data.timeslot_count > 0) {
            const timetableRes = await axiosInstance.get(`/timetables/?year=${yearValue}&semester=${semester}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (timetableRes.data.length > 0) {
              const formattedTimetable = timetableRes.data.map(item => {
                const course = courses.find(c => c.course_id === item.course_id);
                const room = rooms.find(r => r.room_id === item.room_id);
                const lecturer = lecturers.find(l => l.lecturer_id === item.lecturer_id);

                return {
                  id: item.timeslot_id || item.id,
                  day: item.day_of_the_week,
                  startTime: item.start_time,
                  endTime: item.end_time,
                  course: course?.course_name || item.course_name || `Course-${item.course_id}`,
                  room: room?.room_name || item.room_name || `Room-${item.room_id}`,
                  lecturer: lecturer?.lecturer_name || item.lecturer_name || `Lecturer-${item.lecturer_id}`,
                  courseType: (item.course_name || course?.course_name || '').toLowerCase().includes('lab') ? 'lab' : 'lecture',
                  class: item.year ? `Year ${item.year}` : (course?.year ? `Year ${course.year}` : 'N/A'),
                  year: item.year || course?.year || yearValue,
                  semester: item.semester || semester,
                };
              });

              setProgress(100);
              setTimetableData(formattedTimetable);
              if (onTimetableGenerated) {
                onTimetableGenerated(formattedTimetable, yearValue, semester);
              }
              setSuccessMessage('Timetable generated successfully!');
              setIsRunning(false);
              clearInterval(pollTimetable);
            }
          } else if (statusRes.data.status === 'failed') {
            setErrorMessage('Timetable generation failed on the server.');
            setIsRunning(false);
            clearInterval(pollTimetable);
          }
        } catch (err) {
          setErrorMessage('Failed to fetch timetable status. Please try again.');
          setIsRunning(false);
          clearInterval(pollTimetable);
        }

        if (pollAttempts >= maxPollAttempts) {
          setErrorMessage('Timetable generation timed out. Please try again.');
          setIsRunning(false);
          clearInterval(pollTimetable);
        }
      }, 3000); // Reduced polling interval to 3 seconds

    } catch (error) {
      setErrorMessage(error.response?.data?.detail || 'Failed to generate timetable');
      setIsRunning(false);
      setProgress(0);
    }
  };
    
  const handleStopAlgorithm = async () => {
    // Note: Stopping the algorithm requires backend support (e.g., WebSocket or a cancel endpoint)
    setErrorMessage('Stopping algorithm is not implemented yet.');
    setIsRunning(false);
    setProgress(0);
  };
  
  const handleSaveParameters = () => {
    localStorage.setItem('algorithmParameters', JSON.stringify(parameters));
    localStorage.setItem('algorithmConstraints', JSON.stringify(constraints));
    setSuccessMessage('Algorithm parameters saved successfully!');
  };
  
  const handleCloseSnackbar = () => {
    setSuccessMessage('');
    setErrorMessage('');
  };
  
  return (
    <Box>
      <ControlPanel>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5">Genetic Algorithm Control</Typography>
          <Box>
            <RunButton 
              variant="contained" 
              startIcon={<PlayArrowIcon />}
              disabled={isRunning}
              onClick={handleRunAlgorithm}
            >
              Run Algorithm
            </RunButton>
            <StopButton 
              variant="contained" 
              startIcon={<StopIcon />}
              disabled={!isRunning}
              onClick={handleStopAlgorithm}
            >
              Stop
            </StopButton>
            <Button 
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleSaveParameters}
              sx={{ ml: 2 }}
            >
              Save Parameters
            </Button>
          </Box>
        </Box>
        
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Semester</InputLabel>
              <Select 
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                label="Semester"
              >
                <MenuItem value="">Select Semester</MenuItem>
                <MenuItem value="Fall">Fall</MenuItem>
                <MenuItem value="Spring">Spring</MenuItem>
                <MenuItem value="Summer">Summer</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Year (Optional)"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              fullWidth
            />
          </Grid>
        </Grid>
        
        {isRunning && (
          <ProgressContainer>
            <CircularProgress variant="determinate" value={progress} size={40} />
            <ProgressInfo>
              <Typography variant="body1">Generating timetable...</Typography>
              <Typography variant="body2">Generation: {generation}, Fitness: {fitness}</Typography>
            </ProgressInfo>
          </ProgressContainer>
        )}
        
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <TuneIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Algorithm Parameters</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <ParameterGroup>
                  <Typography gutterBottom>Population Size: {parameters.populationSize}</Typography>
                  <Slider
                    value={parameters.populationSize}
                    onChange={handleParameterChange('populationSize')}
                    step={10}
                    marks={[{ value: 50, label: '50' }, { value: 100, label: '100' }]}
                    min={50}
                    max={100}
                    valueLabelDisplay="auto"
                    disabled={isRunning}
                  />
                </ParameterGroup>
                <ParameterGroup>
                  <Typography gutterBottom>Generations: {parameters.generations}</Typography>
                  <Slider
                    value={parameters.generations}
                    onChange={handleParameterChange('generations')}
                    step={10}
                    marks={[{ value: 50, label: '50' }, { value: 200, label: '200' }]}
                    min={50}
                    max={200}
                    valueLabelDisplay="auto"
                    disabled={isRunning}
                  />
                </ParameterGroup>
                <ParameterGroup>
                  <Typography gutterBottom>Elitism Count: {parameters.elitismCount}</Typography>
                  <Slider
                    value={parameters.elitismCount}
                    onChange={handleParameterChange('elitismCount')}
                    step={1}
                    marks={[{ value: 1, label: '1' }, { value: 5, label: '5' }]}
                    min={1}
                    max={5}
                    valueLabelDisplay="auto"
                    disabled={isRunning}
                  />
                </ParameterGroup>
              </Grid>
              <Grid item xs={12} md={6}>
                <ParameterGroup>
                  <Typography gutterBottom>Crossover Rate: {parameters.crossoverRate}</Typography>
                  <Slider
                    value={parameters.crossoverRate}
                    onChange={handleParameterChange('crossoverRate')}
                    step={0.01}
                    marks={[{ value: 0.7, label: '0.7' }, { value: 0.8, label: '0.8' }]}
                    min={0.7}
                    max={0.8}
                    valueLabelDisplay="auto"
                    disabled={isRunning}
                  />
                </ParameterGroup>
                <ParameterGroup>
                  <Typography gutterBottom>Mutation Rate: {parameters.mutationRate}</Typography>
                  <Slider
                    value={parameters.mutationRate}
                    onChange={handleParameterChange('mutationRate')}
                    step={0.01}
                    marks={[{ value: 0.01, label: '0.01' }, { value: 0.05, label: '0.05' }]}
                    min={0.01}
                    max={0.05}
                    valueLabelDisplay="auto"
                    disabled={isRunning}
                  />
                </ParameterGroup>
                <ParameterGroup>
                  <Typography gutterBottom>Tournament Size: {parameters.tournamentSize}</Typography>
                  <Slider
                    value={parameters.tournamentSize}
                    onChange={handleParameterChange('tournamentSize')}
                    step={1}
                    marks={[{ value: 2, label: '2' }, { value: 3, label: '3' }]}
                    min={2}
                    max={3}
                    valueLabelDisplay="auto"
                    disabled={isRunning}
                  />
                </ParameterGroup>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </ControlPanel>
      
      <Snackbar 
        open={!!successMessage} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
      
      <Snackbar 
        open={!!errorMessage} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AlgorithmControl;