/**
 * Layout Component
 * Shared layout with navigation for authenticated pages
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, Home, TestTube, Users, Settings, UserCircle2, Mail, Inbox, Check, XCircle, Pencil, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { teamAPI } from '../../services/api';
import WorkspaceSelector from './WorkspaceSelector';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, fetchWorkspaces, updateProfile, uploadAvatar } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Edit name state ──
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // ── Edit username state ──
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameAvail, setUsernameAvail] = useState({ available: null, checking: false });

  // ── Avatar upload state ──
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  // ── Inbox state ──
  const [invitations, setInvitations] = useState([]);
  const [invitationCount, setInvitationCount] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const [respondingId, setRespondingId] = useState(null);

  const fetchInvitations = useCallback(async () => {
    try {
      const data = await teamAPI.getMyInvitations();
      setInvitations(data.invitations || []);
      setInvitationCount(data.count || 0);
    } catch {
      // silent — non-critical
    }
  }, []);

  // Poll invitations on mount and every 30 seconds
  useEffect(() => {
    fetchInvitations();
    const interval = setInterval(fetchInvitations, 30000);
    return () => clearInterval(interval);
  }, [fetchInvitations]);

  const handleRespondInvitation = async (invitationId, action) => {
    setRespondingId(invitationId);
    try {
      await teamAPI.respondToInvitation(invitationId, action);
      toast.success(`Invitation ${action}ed!`);
      await fetchInvitations();
      if (action === 'accept') {
        await fetchWorkspaces();
      }
    } catch {
      toast.error(`Failed to ${action} invitation`);
    } finally {
      setRespondingId(null);
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim() || savingName) return;
    setSavingName(true);
    await updateProfile({ fullName: nameInput.trim() });
    setSavingName(false);
    setEditingName(false);
  };

  // Debounced username availability check (skip if unchanged)
  useEffect(() => {
    const val = usernameInput.trim();
    if (!editingUsername || !val || val.length < 3 || val === user?.username) {
      setUsernameAvail({ available: null, checking: false });
      return;
    }
    setUsernameAvail((p) => ({ ...p, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const res = await fetch(`${API_URL}/auth/check-availability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: val }),
        });
        const data = await res.json();
        setUsernameAvail({ available: data.username_available ?? null, checking: false });
      } catch {
        setUsernameAvail({ available: null, checking: false });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [usernameInput, editingUsername, user?.username]);

  const handleSaveUsername = async () => {
    const val = usernameInput.trim();
    if (!val || savingUsername) return;
    if (usernameAvail.checking) return;
    if (usernameAvail.available === false) return;
    setSavingUsername(true);
    const result = await updateProfile({ username: val });
    setSavingUsername(false);
    if (result.success) setEditingUsername(false);
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return; }
    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      await uploadAvatar(ev.target.result);
      setUploadingAvatar(false);
    };
    reader.readAsDataURL(file);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
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
              <Link to="/dashboard" className="flex items-center gap-2 group">
                <img src="/logo.png" alt="QA Copilot" className="h-8 w-8 object-contain" />
                <h1 className="text-xl font-bold text-primary-900 cursor-pointer group-hover:text-primary-700 transition-colors whitespace-nowrap">
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
              {/* hidden file input for avatar */}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />

              <button
                className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-transparent hover:border-primary-400 transition-colors flex items-center justify-center bg-primary-100 text-primary-700 font-semibold text-sm"
                aria-label="Open profile menu"
                aria-haspopup="menu"
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{(user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}</span>
                )}
                {invitationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                    {invitationCount > 9 ? '9+' : invitationCount}
                  </span>
                )}
              </button>

              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-3 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 transition-all duration-150 z-50">
                {/* User info */}
                <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                  {/* Avatar with camera-on-hover */}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="relative w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-lg shrink-0 group/avatar overflow-hidden"
                    title="Change profile picture"
                  >
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{(user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}</span>
                    )}
                    <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                      {uploadingAvatar
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Camera size={16} className="text-white" />}
                    </span>
                  </button>

                  <div className="min-w-0 flex-1">
                    {/* Editable name row */}
                    {editingName ? (
                      <div className="flex items-center gap-1 mb-0.5">
                        <input
                          autoFocus
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                          className="text-sm font-semibold text-gray-900 border border-primary-400 rounded px-1.5 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-primary-500"
                          maxLength={255}
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={savingName || !nameInput.trim()}
                          className="shrink-0 px-2 py-0.5 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 disabled:opacity-50"
                        >
                          {savingName ? '…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingName(false)}
                          className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group/name mb-0.5">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {user?.full_name || 'No full name set'}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setNameInput(user?.full_name || ''); setEditingName(true); }}
                          className="shrink-0 opacity-0 group-hover/name:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-primary-600"
                          title="Edit name"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                    {/* Editable username row */}
                    {editingUsername ? (
                      <div className="mt-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 shrink-0">@</span>
                          <input
                            autoFocus
                            type="text"
                            value={usernameInput}
                            onChange={(e) => setUsernameInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveUsername(); if (e.key === 'Escape') setEditingUsername(false); }}
                            className={`text-xs text-gray-700 border rounded px-1.5 py-0.5 w-full focus:outline-none focus:ring-1 ${
                              usernameAvail.available === false
                                ? 'border-red-400 focus:ring-red-400'
                                : usernameAvail.available === true
                                  ? 'border-green-400 focus:ring-green-400'
                                  : 'border-primary-400 focus:ring-primary-500'
                            }`}
                            maxLength={100}
                          />
                          <button
                            onClick={handleSaveUsername}
                            disabled={savingUsername || !usernameInput.trim() || usernameAvail.checking || usernameAvail.available === false}
                            className="shrink-0 px-2 py-0.5 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 disabled:opacity-50"
                          >
                            {savingUsername ? '…' : 'Save'}
                          </button>
                          <button onClick={() => setEditingUsername(false)} className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600">
                            <X size={14} />
                          </button>
                        </div>
                        {usernameAvail.checking && (
                          <p className="text-[10px] text-gray-400 mt-0.5 ml-3">Checking…</p>
                        )}
                        {!usernameAvail.checking && usernameAvail.available === false && (
                          <p className="text-[10px] text-red-500 mt-0.5 ml-3">Username already taken</p>
                        )}
                        {!usernameAvail.checking && usernameAvail.available === true && (
                          <p className="text-[10px] text-green-600 mt-0.5 ml-3">Username available</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group/uname mt-0.5">
                        <span className="text-xs text-gray-600 truncate">@{user?.username}</span>
                        <button
                          type="button"
                          onClick={() => { setUsernameInput(user?.username || ''); setEditingUsername(true); }}
                          className="shrink-0 opacity-0 group-hover/uname:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-primary-600"
                          title="Edit username"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      ID: {user?.user_id || user?.id || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-600 truncate flex items-center gap-1.5 mt-1">
                      <Mail size={12} />
                      {user?.email}
                    </div>
                  </div>
                </div>

                {/* Inbox section */}
                <div className="py-2 border-b border-gray-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowInbox(!showInbox); }}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Inbox size={16} />
                      Inbox
                    </span>
                    {invitationCount > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                        {invitationCount}
                      </span>
                    )}
                  </button>

                  {showInbox && (
                    <div className="mt-1 max-h-60 overflow-y-auto space-y-2">
                      {invitations.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3">No pending invitations</p>
                      ) : (
                        invitations.map((inv) => (
                          <div key={inv.id} className="p-2.5 bg-purple-50 border border-purple-100 rounded-lg">
                            <div className="text-sm font-medium text-gray-900">{inv.team_name}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              Invited by <span className="font-medium text-gray-700">{inv.invited_by_full_name || inv.invited_by_username}</span> as{' '}
                              <span className="font-medium capitalize">{inv.role.replace('_', ' ')}</span>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRespondInvitation(inv.id, 'accept'); }}
                                disabled={respondingId === inv.id}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
                              >
                                <Check size={12} /> Accept
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRespondInvitation(inv.id, 'reject'); }}
                                disabled={respondingId === inv.id}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-md transition-colors disabled:opacity-50"
                              >
                                <XCircle size={12} /> Decline
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogOut size={16} />
                  {loggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              {invitationCount > 0 && !mobileMenuOpen && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {invitationCount > 9 ? '9+' : invitationCount}
                </span>
              )}
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

              {/* Mobile Inbox */}
              {invitations.length > 0 && (
                <div className="px-2 pt-2 border-t border-gray-200 mt-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2 flex items-center gap-2">
                    <Inbox size={14} /> Inbox
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">{invitationCount}</span>
                  </p>
                  <div className="space-y-2">
                    {invitations.map((inv) => (
                      <div key={inv.id} className="p-3 bg-purple-50 border border-purple-100 rounded-lg mx-2">
                        <div className="text-sm font-medium text-gray-900">{inv.team_name}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          From {inv.invited_by_full_name || inv.invited_by_username} &middot; {inv.role.replace('_', ' ')}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleRespondInvitation(inv.id, 'accept')}
                            disabled={respondingId === inv.id}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md disabled:opacity-50"
                          >
                            <Check size={12} /> Accept
                          </button>
                          <button
                            onClick={() => handleRespondInvitation(inv.id, 'reject')}
                            disabled={respondingId === inv.id}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-md disabled:opacity-50"
                          >
                            <XCircle size={12} /> Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
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
                disabled={loggingOut}
                className="mx-2 w-[calc(100%-1rem)] flex items-center gap-2 px-4 py-2 text-sm text-red-700 bg-red-50 hover:bg-red-100  rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut size={16} />
                {loggingOut ? 'Logging out...' : 'Logout'}
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
