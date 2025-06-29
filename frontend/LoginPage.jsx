import React, { useState, useContext } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Link,
  Paper,
  useMediaQuery,
  Alert,
  TextField,
  MenuItem,
  Button,
  InputAdornment,
  IconButton,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { AuthContext } from '../../context/AuthContext';

// Custom styled components
const MainContainer = styled(Paper)(({ theme }) => ({
  display: 'flex',
  borderRadius: '10px',
  overflow: 'hidden',
  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
  width: '100%',
  maxWidth: '600px',
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
}));

const WelcomeSection = styled(Box)(({ theme }) => ({
  background: 'rgba(0, 0, 0, 0.5)',
  color: 'white',
  padding: '30px',
  width: '45%',
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

const LoginSection = styled(Box)(({ theme }) => ({
  padding: '30px',
  width: '55%',
  background: 'rgba(255, 255, 255, 0.8)',
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

const FooterLinks = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  textAlign: 'center',
}));

const StyledLink = styled(Link)(({ theme }) => ({
  color: theme.palette.primary.main,
  '&:hover': {
    textDecoration: 'underline',
  },
}));

const LoginPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, currentUser, authError } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.username || !formData.password || !formData.role) {
        throw new Error('Please fill in all required fields');
      }

      await login(formData.username, formData.password, formData.role);
      const roleToUse = currentUser?.role?.toLowerCase() || formData.role.toLowerCase();

      switch (roleToUse) {
        case 'admin':
          navigate('/admin/dashboard');
          break;
        case 'lecturer':
          navigate('/teacher/dashboard');
          break;
        case 'student':
          navigate('/student/dashboard');
          break;
        default:
          navigate('/');
      }
    } catch (err) {
      setError(authError || err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { value: 'student', label: 'Student' },
    { value: 'lecturer', label: 'Lecturer' },
    { value: 'admin', label: 'Admin' },
  ];

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
                Welcome to AIU Timetable Hub!
              </Typography>
              <Typography variant="body1">
                Unlock the power of your day at AIU with a timetable that fits your unique academic journey:
              </Typography>
              <FeatureList>
                <FeatureItem>Course Management</FeatureItem>
                <FeatureItem>Class Scheduling</FeatureItem>
                <FeatureItem>Resource Allocation</FeatureItem>
              </FeatureList>
              <Tagline variant="body2"></Tagline>
            </WelcomeSection>
          )}

          <LoginSection>
            <Typography variant="h5" component="h1" gutterBottom>
              AIU Timetable Hub
            </Typography>

            {(error || authError) && <Alert severity="error" sx={{ mb: 2 }}>{error || authError}</Alert>}

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                autoComplete="username"
                autoFocus
                value={formData.username}
                onChange={handleChange}
                disabled={loading}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
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
                    onChange={(e) => setShowPassword(e.target.checked)}
                    name="showPassword"
                    color="primary"
                  />
                }
                label="Show password"
                sx={{ mt: 1, mb: 1 }}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                select
                id="role"
                label="Select Role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                disabled={loading}
              >
                {roles.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'LOGIN'}
              </Button>
            </Box>

            <FooterLinks>
              <StyledLink component={RouterLink} to="/forgot-password" variant="body2">
                Forgot Password?
              </StyledLink>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" display="inline" sx={{ mr: 1 }}>
                  No account?{' '}
                </Typography>
                <StyledLink component={RouterLink} to="/signup" variant="body2">
                  Signup
                </StyledLink>
              </Box>
            </FooterLinks>
          </LoginSection>
        </MainContainer>
      </Container>
    </Box>
  );
};

export default LoginPage;