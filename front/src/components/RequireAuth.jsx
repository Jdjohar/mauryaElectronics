// src/components/RequireAuth.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function RequireAuth({ children }) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const location = useLocation();
  if (!token) {
    // redirect to login and preserve attempted path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
