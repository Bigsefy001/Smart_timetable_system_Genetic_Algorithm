import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Configure axios base URL
axios.defaults.baseURL = 'http://localhost:8000'; // Adjust if backend runs on a different port/domain

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('aiuUser');

        if (token && storedUser) {
          console.log('Checking auth status with stored token');
          try {
            let parsedUser = JSON.parse(storedUser);
            if (parsedUser.role === 'lecturer') {
              parsedUser = {
                ...parsedUser,
                lecturer_name: `${parsedUser.first_name} ${parsedUser.last_name}`,
              };
            }
            setCurrentUser(parsedUser);

            const response = await axios.get('/users/me/', {
              headers: { Authorization: `Bearer ${token}` },
            });

            console.log('User verified:', response.data);
            const updatedUser = {
              ...response.data,
              lecturer_name: response.data.role === 'lecturer' 
                ? `${response.data.first_name} ${response.data.last_name}` 
                : null,
            };
            if (JSON.stringify(parsedUser) !== JSON.stringify(updatedUser)) {
              setCurrentUser(updatedUser);
              localStorage.setItem('aiuUser', JSON.stringify(updatedUser));
            }
          } catch (parseError) {
            console.warn('Stored user data invalid, fetching fresh data');
            const response = await axios.get('/users/me/', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const updatedUser = {
              ...response.data,
              lecturer_name: response.data.role === 'lecturer' 
                ? `${response.data.first_name} ${response.data.last_name}` 
                : null,
            };
            setCurrentUser(updatedUser);
            localStorage.setItem('aiuUser', JSON.stringify(updatedUser));
          }
        } else if (token) {
          console.log('Token found but no stored user, fetching user data');
          const response = await axios.get('/users/me/', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const updatedUser = {
            ...response.data,
            lecturer_name: response.data.role === 'lecturer' 
              ? `${response.data.first_name} ${response.data.last_name}` 
              : null,
          };
          setCurrentUser(updatedUser);
          localStorage.setItem('aiuUser', JSON.stringify(updatedUser));
        } else {
          setCurrentUser(null);
          localStorage.removeItem('aiuUser');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('aiuUser');
        setCurrentUser(null);
        setAuthError(error.response?.data?.detail || 'Authentication check failed');
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const signup = async (formData) => {
    setAuthError(null);
    setLoading(true);

    console.log('Attempting signup with:', formData);

    try {
      const userData = {
        user_id: Math.random().toString(36).substr(2, 20),
        first_name: formData.firstName?.trim() || '',
        last_name: formData.lastName?.trim() || '',
        email: formData.email?.trim() || '',
        username: formData.username?.trim() || '',
        password: formData.password?.trim() || '',
        role: formData.role?.toLowerCase() || '',
        phone_number: formData.phone?.trim() || null,
        dob: formData.dob || null,
        student_id: formData.studentId?.trim() || null,
        program: formData.program?.trim() || null,
        year_of_study: formData.yearOfStudy || null,
        department_id: formData.department || null,
        address: null,
        room_id: null,
      };

      console.log('Sending user data to backend:', userData);

      // Create user
      await axios.post('/signup/', userData, {
        headers: { 'Content-Type': 'application/json' },
      });

      console.log('Signup successful, attempting auto-login');

      // Auto-login to obtain token
      const loginResponse = await axios.post(
        '/token',
        new URLSearchParams({
          username: formData.email,
          password: formData.password,
          scope: formData.role.toLowerCase(),
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const { access_token } = loginResponse.data;
      localStorage.setItem('token', access_token);

      // Fetch user data
      const userResponse = await axios.get('/users/me/', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const updatedUser = {
        ...userResponse.data,
        lecturer_name: userResponse.data.role === 'lecturer' 
          ? `${userResponse.data.first_name} ${userResponse.data.last_name}` 
          : null,
      };

      console.log('User data fetched after signup:', updatedUser);
      setCurrentUser(updatedUser);
      localStorage.setItem('aiuUser', JSON.stringify(updatedUser));

      return updatedUser;
    } catch (error) {
      console.error('Signup error:', error);
      const errorMessage = error.response?.data?.detail || 'Registration failed';
      setAuthError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password, role) => {
    setAuthError(null);
    setLoading(true);

    console.log('Attempting login with:', { username, role });

    try {
      const response = await axios.post(
        '/token',
        new URLSearchParams({
          username,
          password,
          scope: role.toLowerCase(),
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      console.log('Login successful:', response.data);

      const { access_token } = response.data;
      localStorage.setItem('token', access_token);

      const userResponse = await axios.get('/users/me/', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const updatedUser = {
        ...userResponse.data,
        lecturer_name: userResponse.data.role === 'lecturer' 
          ? `${userResponse.data.first_name} ${userResponse.data.last_name}` 
          : null,
      };

      console.log('User fetched after login:', updatedUser);
      setCurrentUser(updatedUser);
      localStorage.setItem('aiuUser', JSON.stringify(updatedUser));

      return response.data;
    } catch (error) {
      console.error('Login error for role', role, ':', error);
      localStorage.removeItem('token');
      localStorage.removeItem('aiuUser');
      setCurrentUser(null);
      const errorMessage = error.response?.data?.detail || 'Login failed';
      setAuthError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    console.log('Logging out...');
    localStorage.removeItem('token');
    localStorage.removeItem('aiuUser');
    setCurrentUser(null);
    setAuthError(null);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const value = {
    currentUser,
    signup,
    login,
    logout,
    loading,
    authError,
    clearAuthError,
    token: localStorage.getItem('token'),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};