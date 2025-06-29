import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link } from 'react-router-dom';

// Define the header height to match the actual header height
const HEADER_HEIGHT = '84px'; // Matches the header height in your design

// Styled SidebarWrapper with adjusted positioning, width, and scrollbar
const SidebarWrapper = styled(Box)(({ theme }) => ({
  width: '250px', // Wider sidebar as requested
  backgroundColor: '#e8ecef',
  padding: '20px 10px',
  height: 'calc(100vh - 100px)', // Adjusted height to account for increased top offset
  maxHeight: 'calc(100vh - 100px)', // Set max height to enable scrolling
  position: 'fixed', // Fixed to the left
  top: '100px', // Increased from 60px to 100px to reduce height from top
  left: 0, // Align to the left edge
  zIndex: 1000, // Ensure sidebar stays above other content
  boxShadow: '2px 0 5px rgba(0, 0, 0, 0.1)', // Subtle shadow for separation
  overflowY: 'auto', // Enable vertical scrollbar when content overflows
  [theme.breakpoints.down('md')]: {
    width: '100%',
    position: 'relative', // On mobile, remove fixed positioning
    height: 'auto', // On mobile, height adjusts to content
    top: 0, // Reset top on mobile
    maxHeight: 'none', // Reset maxHeight on mobile
    overflowY: 'visible', // Reset overflow on mobile
  },
}));

const Sidebar = ({ activeItem, role }) => {
  // Define menu items for different roles
  const menuItems = {
    admin: [
      { text: 'Dashboard', icon: '📊', path: '/admin?tab=0' },
      { text: 'Timetable', icon: '📅', path: '/admin?tab=1' },
      { text: 'Users', icon: '👥', path: '/admin?tab=4' },
      { text: 'Data Input', icon: '📥', path: '/data-input' },
    ],
    teacher: [
      { text: 'Dashboard', icon: '📊', path: '/teacher' },
      { text: 'Timetable', icon: '📅', path: '/teacher/timetable' },
      { text: 'Courses', icon: '📄', path: '/teacher/courses' },
      { text: 'Profile', icon: '🏫', path: '/teacher/profile' },
    ],
    student: [
      { text: 'Dashboard', icon: '📊', path: '/student' },
      { text: 'Timetable', icon: '📅', path: '/student/timetable' },
      { text: 'Courses', icon: '📄', path: '/student/courses' },
      { text: 'Grades', icon: '📝', path: '/student/grades' },
    ],
  };

  const toolItems = {
    admin: [
      { text: 'Settings', icon: '⚙️', path: '/admin/settings' },
      { text: 'Reports', icon: '📋', path: '/admin/reports' },
    ],
    teacher: [
      { text: 'Settings', icon: '⚙️', path: '/teacher/settings' },
    ],
    student: [
      { text: 'Settings', icon: '⚙️', path: '/student/settings' },
    ],
  };

  // Log to debug role and items
  console.log('Role:', role);
  console.log('Tool Items:', toolItems[role]);

  return (
    <SidebarWrapper>
      <Typography variant="h6" sx={{ marginBottom: '20px', fontWeight: 'bold' }}>
        MAIN
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {menuItems[role].map((item) => (
          <Link key={item.text} to={item.path} style={{ textDecoration: 'none' }}>
            <Button
              variant="text"
              startIcon={<Box component="span" sx={{ fontSize: '18px' }}>{item.icon}</Box>}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: 'black',
                backgroundColor: activeItem === item.text ? '#d3d3d3' : 'transparent',
                padding: '10px 15px',
                '&:hover': {
                  backgroundColor: '#d3d3d3',
                },
              }}
            >
              {item.text}
            </Button>
          </Link>
        ))}
      </Box>
      {toolItems[role] && toolItems[role].length > 0 && ( // Ensure TOOLS renders for non-empty items
        <>
          <Typography variant="h6" sx={{ marginTop: '40px', marginBottom: '20px', fontWeight: 'bold' }}>
            TOOLS
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {toolItems[role].map((item) => (
              <Link key={item.text} to={item.path} style={{ textDecoration: 'none' }}>
                <Button
                  variant="text"
                  startIcon={<Box component="span" sx={{ fontSize: '18px' }}>{item.icon}</Box>}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    color: 'black',
                    backgroundColor: activeItem === item.text ? '#d3d3d3' : 'transparent',
                    padding: '10px 15px',
                    '&:hover': {
                      backgroundColor: '#d3d3d3',
                    },
                  }}
                >
                  {item.text}
                </Button>
              </Link>
            ))}
          </Box>
        </>
      )}
    </SidebarWrapper>
  );
};

export default Sidebar;