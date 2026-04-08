import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { ROUTES } from '../routes/constants';

export default function ProtectedRoute() {
  const { user } = useAuth();
  
  if (!user || !localStorage.getItem('access')) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
}
