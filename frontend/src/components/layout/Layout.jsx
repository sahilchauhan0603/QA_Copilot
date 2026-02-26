/**
 * Layout Component
 * Shared layout with navigation for authenticated pages
 */
import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, Home, TestTube, Users, Settings, UserCircle2, Mail } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import WorkspaceSelector from './WorkspaceSelector';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/dashboard', label: 'Home', icon: Home },
    { path: '/test-generation', label: 'Test Generation', icon: TestTube },
    { path: '/teams', label: 'Teams', icon: Users },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Desktop Navigation */}
            <div className="flex items-center gap-6 flex-1">
              <Link to="/dashboard">
                <h1 className="text-xl font-bold text-primary-900 cursor-pointer hover:text-primary-700 transition-colors whitespace-nowrap">
                  QA Copilot
                </h1>
              </Link>
              
              {/* Desktop Navigation Links */}
              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.path)
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <Icon size={18} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            
            {/* Desktop Workspace Selector */}
            <div className="hidden lg:block mr-4">
              <WorkspaceSelector />
            </div>
            
            {/* Desktop User Menu */}
            <div className="hidden md:block relative group">    
              <button
                className="w-8 h-8 rounded-full bg-white text-gray-600 hover:bg-blue-50 transition-colors flex items-center justify-center"
                aria-label="Open profile menu"
                aria-haspopup="menu"
              >
                <UserCircle2 size={30} />
              </button>

              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 transition-all duration-150 z-50">
                <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">
                    {(user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {user?.full_name || 'No full name set'}
                    </div>
                    <div className="text-xs text-gray-600 truncate mt-0.5">
                      @{user?.username}
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      ID: {user?.user_id || user?.id || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-600 truncate flex items-center gap-1.5 mt-1">
                      <Mail size={12} />
                      {user?.email}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
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
            <div className="md:hidden border-t border-gray-200 py-4 space-y-2">
              {/* Mobile Navigation Links */}
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors mx-2 ${
                      isActive(item.path)
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                );
              })}
              
              {/* Mobile Workspace Selector */}
              <div className="px-2 pt-2 border-t border-gray-200 mt-2">
                <WorkspaceSelector />
              </div>
              
              {/* Mobile User Info */}
              <div className="px-4 py-3 bg-gray-50 rounded-lg mx-2">
                <div className="text-sm font-medium text-gray-900">{user?.full_name || user?.username}</div>
                <div className="text-xs text-gray-500">ID: {user?.user_id || user?.id || 'N/A'}</div>
                <div className="text-xs text-gray-600">{user?.email}</div>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
