/**
 * Dashboard Component
 * Main workspace view with navigation and content
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, Home, FileText, Menu, X, Users, TestTube } from 'lucide-react';
import useAuthStore from '../store/authStore';
import WorkspaceSelector from './WorkspaceSelector';
import TeamManagement from './TeamManagement';
import TestGeneration from './TestGeneration';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, getActiveWorkspaceDetails } = useAuthStore();
  const activeWorkspace = getActiveWorkspaceDetails();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('test-generation'); // 'test-generation' or 'team-management'

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Desktop Workspace Selector */}
            <div className="flex items-center gap-3 sm:gap-6 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-primary-900 whitespace-nowrap">
                QA Copilot
              </h1>
              <div className="hidden md:block">
                <WorkspaceSelector />
              </div>
            </div>
            
            {/* Desktop User Menu */}
            <div className="hidden md:flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">{user?.full_name || user?.username}</div>
                <div className="text-xs text-gray-600">{user?.email} · ID: {user?.id}</div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border-2 border-gray-200"
              >
                <LogOut size={16} />
                <span className="hidden lg:inline">Logout</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 pb-4">
              {/* Mobile Workspace Selector */}
              <div className="px-2 py-3">
                <WorkspaceSelector />
              </div>
              
              {/* Mobile User Info */}
              <div className="px-4 py-3 bg-gray-50 rounded-lg mx-2 mb-2">
                <div className="text-sm font-medium text-gray-900">{user?.full_name || user?.username}</div>
                <div className="text-xs text-gray-600">{user?.email}</div>
                <div className="text-xs text-gray-500 mt-1">ID: {user?.id}</div>
              </div>

              {/* Mobile Logout Button */}
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="mx-2 w-[calc(100%-1rem)] flex items-center gap-2 px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {user?.username}! 👋
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
            Current workspace: <span className="font-semibold text-primary-600">{activeWorkspace?.name}</span>
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-lg">
                <FileText size={24} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-900">0</div>
                <div className="text-sm text-blue-700">Test Cases Generated</div>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-600 rounded-lg">
                <Home size={24} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-900">
                  {activeWorkspace?.type === 'personal' ? 'Personal' : 'Team'}
                </div>
                <div className="text-sm text-green-700">Workspace Type</div>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-600 rounded-lg">
                <Settings size={24} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-900">
                  {activeWorkspace?.role ? activeWorkspace.role.replace('_', ' ').toUpperCase() : 'Owner'}
                </div>
                <div className="text-sm text-purple-700">Your Role</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('test-generation')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'test-generation'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TestTube size={16} />
              <span>Test Generation</span>
            </button>
            <button
              onClick={() => setActiveTab('team-management')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'team-management'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users size={16} />
              <span>Team Management</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'test-generation' && <TestGeneration />}
        {activeTab === 'team-management' && <TeamManagement />}

        {/* Information Card - Only show on team management tab */}
        {activeTab === 'team-management' && (
          <div className="card mt-8 bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200">
            <h3 className="text-lg font-semibold text-primary-900 mb-2">
              🚀 Getting Started
            </h3>
            <p className="text-primary-800 mb-4">
              Welcome to QA Copilot! Here's what you can do:
            </p>
            <ul className="space-y-2 text-primary-700">
              <li className="flex items-start gap-2">
                <span className="font-bold">✓</span>
                <span>Create teams and invite collaborators</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">✓</span>
                <span>Switch between personal and team workspaces</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">✓</span>
                <span>Generate test cases from Jira/Azure DevOps tickets</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">✓</span>
                <span>Collaborate with your team on test case reviews</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
