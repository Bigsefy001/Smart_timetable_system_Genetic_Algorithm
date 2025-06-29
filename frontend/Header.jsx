import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Box, IconButton, Menu, MenuItem, Avatar } from '@mui/material';
import { styled } from '@mui/material/styles';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HelpIcon from '@mui/icons-material/Help';
import RefreshIcon from '@mui/icons-material/Refresh';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#2196F3',
  padding: '10px 20px',
}));

const LogoContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
});

const CompanyName = styled(Typography)({
  fontSize: '20px',
  marginLeft: '10px',
});

const HeaderRight = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '20px',
});

const NotificationContainer = styled(Box)({
  position: 'relative',
  cursor: 'pointer',
  padding: '5px',
  borderRadius: '50%',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});

const Badge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '-5px',
  right: '-5px',
  backgroundColor: 'red',
  color: 'white',
  borderRadius: '50%',
  width: '18px',
  height: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
}));

const NotificationDropdown = styled(Box)(({ theme }) => ({
  width: '300px',
  maxHeight: '400px',
  overflowY: 'auto',
  backgroundColor: 'white',
  borderRadius: '5px',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
  padding: '10px',
}));

const NotificationItem = styled(MenuItem)({
  padding: '10px',
  borderBottom: '1px solid #eee',
  '&:hover': {
    backgroundColor: '#f5f5f5',
  },
});

const MarkAll = styled(MenuItem)({
  padding: '10px',
  textAlign: 'center',
  color: '#2196F3',
  fontWeight: 'bold',
});

const Header = ({ notifications }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [badgeVisible, setBadgeVisible] = useState(true);

  const handleNotificationClick = (event) => {
    setAnchorEl(event.currentTarget);
    if (badgeVisible && notifications.length > 0) {
      setBadgeVisible(false);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkAll = () => {
    setBadgeVisible(false);
    setAnchorEl(null);
  };

  return (
    <StyledAppBar position="static">
      <Toolbar>
        <LogoContainer>
          <img
            src="https://aiu.edu.my/wp-content/uploads/2023/11/AIU-Official-Logo-01.png"
            alt="University Logo"
            width="50"
            height="50"
          />
          <CompanyName>Albukahary International University</CompanyName>
        </LogoContainer>
        <Box sx={{ flexGrow: 1 }} />
        <HeaderRight>
          <Typography>Help</Typography>
          <NotificationContainer onClick={handleNotificationClick}>
            <NotificationsIcon />
            {badgeVisible && notifications.length > 0 && <Badge>{notifications.length}</Badge>}
          </NotificationContainer>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            PaperProps={{
              style: {
                width: '300px',
                maxHeight: '400px',
                borderRadius: '5px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              },
            }}
          >
            <NotificationDropdown>
              {notifications.map((notification, index) => (
                <NotificationItem key={index}>{notification}</NotificationItem>
              ))}
              <MarkAll onClick={handleMarkAll}>Mark all as read</MarkAll>
            </NotificationDropdown>
          </Menu>
          <IconButton color="inherit">
            <RefreshIcon />
          </IconButton>
          <IconButton color="inherit">
            <QuestionMarkIcon />
          </IconButton>
          <Avatar src="/placeholder.jpg" alt="User" sx={{ width: 30, height: 30 }} />
        </HeaderRight>
      </Toolbar>
    </StyledAppBar>
  );
};

export default Header;