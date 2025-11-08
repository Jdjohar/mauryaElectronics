// src/components/RequireRole.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function RequireRole({ allowed = [], children }) {
  const raw = localStorage.getItem('user') || sessionStorage.getItem('user') || '{}';
  const user = JSON.parse(raw);
  const location = useLocation();

  if (!user || !user.role) {
    // not logged in — redirect to login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowed.length > 0 && !allowed.includes(user.role)) {
    // forbidden — redirect to a safe page (login or dashboard)
    return <Navigate to="/" replace />;
  }

  return children;
}
