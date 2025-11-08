// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Technicians from './pages/Technicians';
import Complaints from './pages/Complaints';
import Services from './pages/Services';
import Reports from './pages/Reports';
import Login from './pages/Login';
import RequireAuth from './components/RequireAuth';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />

        {/* Protected area */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout>
                <Dashboard />
              </Layout>
            </RequireAuth>
          }
        />

        {/* If you want to protect each page and keep layout consistent: */}
        <Route
          path="/employees"
          element={
            <RequireAuth>
              <Layout>
                <Employees />
              </Layout>
            </RequireAuth>
          }
        />
        <Route
          path="/technicians"
          element={
            <RequireAuth>
              <Layout>
                <Technicians />
              </Layout>
            </RequireAuth>
          }
        />
        <Route
          path="/complaints"
          element={
            <RequireAuth>
              <Layout>
                <Complaints />
              </Layout>
            </RequireAuth>
          }
        />
        <Route
          path="/services"
          element={
            <RequireAuth>
              <Layout>
                <Services />
              </Layout>
            </RequireAuth>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireAuth>
              <Layout>
                <Reports />
              </Layout>
            </RequireAuth>
          }
        />

        {/* Fallback to dashboard for unknown routes (protected) */}
        <Route
          path="*"
          element={
            <RequireAuth>
              <Layout>
                <Dashboard />
              </Layout>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
