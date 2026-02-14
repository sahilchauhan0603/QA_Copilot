/**
 * Main App Component
 * Routing and app structure
 */
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import TestGenerationPage from './pages/TestGenerationPage';
import TeamsPage from './pages/TeamsPage';
import SettingsPage from './pages/SettingsPage';
import ProtectedRoute from './components/ProtectedRoute';
import useAuthStore from './store/authStore';
import './index.css';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#363636',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} 
        />
        <Route 
          path="/signup" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup />} 
        />
        <Route 
          path="/forgot-password" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} 
        />
        <Route 
          path="/reset-password" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPassword />} 
        />
        
        {/* Protected Routes with Layout */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <HomePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/test-generation"
          element={
            <ProtectedRoute>
              <Layout>
                <TestGenerationPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams"
          element={
            <ProtectedRoute>
              <Layout>
                <TeamsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <SettingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route 
          path="/" 
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
        />
        <Route 
          path="*" 
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
        />
      </Routes>
    </Router>
  );
}

export default App;
