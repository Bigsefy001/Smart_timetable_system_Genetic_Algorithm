import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  useMediaQuery,
  Alert,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { Visibility, VisibilityOff } from '@mui/icons-material';

// Custom styled components
const MainContainer = styled(Paper)(({ theme }) => ({
  display: 'flex',
  borderRadius: '10px',
  overflow: 'hidden',
  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
  width: '100%',
  maxWidth: '800px',
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
}));

const WelcomeSection = styled(Box)(({ theme }) => ({
  background: 'rgba(0, 0, 0, 0.5)',
  color: 'white',
  padding: '30px',
  width: '35%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  backdropFilter: 'blur(5px)',
  [theme.breakpoints.down('md')]: {
    width: '100%',
    background: 'rgba(0, 0, 0, 0.7)',
    padding: '20px',
  },
}));

const SignupSection = styled(Box)(({ theme }) => ({
  padding: '30px',
  width: '65%',
  background: 'rgba(255, 255, 255, 0.8)',
  overflowY: 'auto',
  maxHeight: '80vh',
  [theme.breakpoints.down('md')]: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.9)',
    padding: '20px',
  },
}));

const FeatureList = styled('ul')({
  listStyle: 'none',
  padding: 0,
  margin: '25px 0',
});

const FeatureItem = styled('li')({
  marginBottom: '15px',
  paddingLeft: '20px',
  position: 'relative',
  '&::before': {
    content: '"•"',
    position: 'absolute',
    left: 0,
    color: '#007bff',
    fontWeight: 'bold',
  },
});

const Tagline = styled(Typography)({
  fontStyle: 'italic',
  color: '#ccc',
  marginTop: '25px',
});

const SignupButton = styled(Button)(({ theme }) => ({
  marginTop: '20px',
  padding: '12px',
  background: '#007bff',
  '&:hover': {
    background: '#0069d9',
  },
}));

const FormSectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.1rem',
  color: '#007bff',
  marginBottom: '15px',
}));

const FormSection = styled(Box)(({ theme }) => ({
  borderBottom: '1px solid #ddd',
  paddingBottom: '15px',
  marginBottom: '20px',
  '&:last-child': {
    borderBottom: 'none',
  },
}));

const SignupPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { signup, authError } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: '',
    phone: '',
    dob: '',
    studentId: '',
    program: '',
    yearOfStudy: '',
    department: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const calculateAge = (dateOfBirth) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for date of birth to validate age in real-time
    if (name === 'dob') {
      setFormData({ ...formData, [name]: value });
      
      // Clear any existing age-related errors when user starts typing
      if (error && error.includes('age')) {
        setError('');
      }
      
      // Validate age if a valid date is entered
      if (value) {
        const age = calculateAge(value);
        if (age < 15) {
          setError('You must be at least 15 years old to register');
        }
      }
    } else {
      setFormData({ ...formData, [name]: value.trim() });
    }
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleClickShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.email.trim() || !formData.email.includes('@')) errors.email = 'Invalid email address';
    if (formData.password.trim().length < 8) errors.password = 'Password must be at least 8 characters';
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!formData.username.trim()) errors.username = 'Username is required';
    if (!formData.role) errors.role = 'Role is required';
    if (formData.role === 'student' && !formData.yearOfStudy) errors.yearOfStudy = 'Year of study is required for students';
    if (formData.role === 'student' && !['1', '2', '3', '4', 'pg', 'na'].includes(formData.yearOfStudy))
      errors.yearOfStudy = 'Invalid year of study';
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    
    // Age validation
    if (formData.dob) {
      const age = calculateAge(formData.dob);
      if (age < 15) {
        errors.dob = 'You must be at least 15 years old to register';
      }
    }
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setError(Object.values(errors)[0]);
      setLoading(false);
      return;
    }

    // Prepare trimmed payload
    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      username: formData.username.trim(),
      password: formData.password.trim(),
      role: formData.role,
      phone: formData.phone.trim() || null,
      dob: formData.dob || null,
      studentId: formData.studentId.trim() || null,
      program: formData.program.trim() || null,
      yearOfStudy: formData.yearOfStudy || null,
      department: formData.department || null,
    };
    console.log('Sending signup payload:', payload);

    try {
      await signup(payload);
      navigate(formData.role === 'lecturer' ? '/teacher/dashboard' : formData.role === 'student' ? '/student/dashboard' : '/dashboard');
    } catch (error) {
      const errorMessage = error.message || authError || 'Registration failed';
      if (errorMessage.includes('No matching lecturer found')) {
        setError('No lecturer found with this name. Please contact the admin to add your lecturer record.');
      } else {
        setError(errorMessage);
      }
      console.error('Signup failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundImage: `url('https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgAWavSIBsOnTpuzjy4mUfzqk2WFyeXcz4EY4kYKqbmbJTmz7hEoC5JH6rQ6cNFQIxpWdUmIbkoDjuUwSKl6salNslVeIVSp-VTZN2phggEBPP1Fxlm5PoEdjwibUosTrEmBWG3-Vae4Sk/s1600/Admin+Building+Edited.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.3)',
          zIndex: -1,
        },
      }}
    >
      <Container
        maxWidth="lg"
        sx={{
          zIndex: 1,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <MainContainer>
          {(!isMobile || (isMobile && false)) && (
            <WelcomeSection>
              <Typography variant="h5" component="h2" gutterBottom>
                Join AIU Timetable Hub!
              </Typography>
              <Typography variant="body1">
                Create your account to access all features:
              </Typography>
              <FeatureList>
                <FeatureItem>Course Management</FeatureItem>
                <FeatureItem>Class Scheduling</FeatureItem>
                <FeatureItem>Resource Allocation</FeatureItem>
              </FeatureList>
              <Tagline variant="body2">Your academic journey starts here</Tagline>
            </WelcomeSection>
          )}

          <SignupSection>
            <Typography variant="h5" component="h1" gutterBottom>
              Create Your Account
            </Typography>
            {(error || authError) && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error || authError}
              </Alert>
            )}
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <FormSection>
                <FormSectionTitle>Personal Information</FormSectionTitle>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      required
                      fullWidth
                      label="First Name"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      margin="normal"
                      error={!!error && error.includes('First name')}
                      helperText={error && error.includes('First name') ? error : ''}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      required
                      fullWidth
                      label="Last Name"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      margin="normal"
                      error={!!error && error.includes('Last name')}
                      helperText={error && error.includes('Last name') ? error : ''}
                    />
                  </Grid>
                </Grid>
                <TextField
                  required
                  fullWidth
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  margin="normal"
                  error={!!error && error.includes('email')}
                  helperText={error && error.includes('email') ? error : ''}
                />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Date of Birth"
                      name="dob"
                      type="date"
                      value={formData.dob}
                      onChange={handleChange}
                      margin="normal"
                      InputLabelProps={{ shrink: true }}
                      error={!!error && error.includes('age')}
                      helperText={
                        error && error.includes('age') 
                          ? error 
                          : 'You must be at least 15 years old'
                      }
                    />
                  </Grid>
                </Grid>
              </FormSection>

              <FormSection>
                <FormSectionTitle>Account Information</FormSectionTitle>
                <TextField
                  required
                  fullWidth
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  margin="normal"
                  error={!!error && error.includes('Username')}
                  helperText={error && error.includes('Username') ? error : ''}
                />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      required
                      fullWidth
                      label="Password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      margin="normal"
                      error={!!error && error.includes('Password')}
                      helperText={error && error.includes('Password') ? error : ''}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="toggle password visibility"
                              onClick={handleClickShowPassword}
                              edge="end"
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={showPassword}
                          onChange={handleClickShowPassword}
                          color="primary"
                          size="small"
                        />
                      }
                      label="Show password"
                      sx={{ mt: 0.5, mb: 1 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      required
                      fullWidth
                      label="Confirm Password"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      margin="normal"
                      error={!!error && error.includes('Passwords do not match')}
                      helperText={error && error.includes('Passwords do not match') ? error : ''}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="toggle confirm password visibility"
                              onClick={handleClickShowConfirmPassword}
                              edge="end"
                            >
                              {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={showConfirmPassword}
                          onChange={handleClickShowConfirmPassword}
                          color="primary"
                          size="small"
                        />
                      }
                      label="Show password"
                      sx={{ mt: 0.5, mb: 1 }}
                    />
                  </Grid>
                </Grid>
                <FormControl fullWidth margin="normal" required>
                  <InputLabel id="role-label">Select Role</InputLabel>
                  <Select
                    labelId="role-label"
                    name="role"
                    value={formData.role}
                    label="Select Role"
                    onChange={handleChange}
                    error={!!error && error.includes('Role')}
                  >
                    <MenuItem value="">Choose Role</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="lecturer">Lecturer</MenuItem>
                    <MenuItem value="student">Student</MenuItem>
                  </Select>
                </FormControl>
              </FormSection>

              <FormSection>
                <FormSectionTitle>Academic Information</FormSectionTitle>
                <TextField
                  fullWidth
                  label="Student/Staff ID"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  margin="normal"
                />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth margin="normal">
                      <InputLabel id="department-label">Department</InputLabel>
                      <Select
                        labelId="department-label"
                        name="department"
                        value={formData.department}
                        label="Department"
                        onChange={handleChange}
                      >
                        <MenuItem value="">Select Department</MenuItem>
                        <MenuItem value="CS">Computer Science</MenuItem>
                        <MenuItem value="BA">Business Administration</MenuItem>
                        <MenuItem value="ENG">Engineering</MenuItem>
                        <MenuItem value="MED">Medicine</MenuItem>
                        <MenuItem value="AH">Arts & Humanities</MenuItem>
                        <MenuItem value="SS">Social Sciences</MenuItem>
                        <MenuItem value="OTH">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Program"
                      name="program"
                      value={formData.program}
                      onChange={handleChange}
                      margin="normal"
                    />
                  </Grid>
                </Grid>
                <FormControl fullWidth margin="normal" required={formData.role === 'student'}>
                  <InputLabel id="year-label">Year of Study</InputLabel>
                  <Select
                    labelId="year-label"
                    name="yearOfStudy"
                    value={formData.yearOfStudy}
                    label="Year of Study"
                    onChange={handleChange}
                    error={!!error && error.includes('year of study')}
                  >
                    <MenuItem value="">Select Year</MenuItem>
                    <MenuItem value="4">Foundation</MenuItem>
                    <MenuItem value="1">1st Year</MenuItem>
                    <MenuItem value="2">2nd Year</MenuItem>
                    <MenuItem value="3">3rd Year</MenuItem>
                    <MenuItem value="pg">Postgraduate</MenuItem>
                    <MenuItem value="na">Not Applicable</MenuItem>
                  </Select>
                </FormControl>
              </FormSection>

              <SignupButton
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Create Account'}
              </SignupButton>
            </Box>
          </SignupSection>
        </MainContainer>
      </Container>
    </Box>
  );
};

export default SignupPage;