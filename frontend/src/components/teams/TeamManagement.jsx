/**
 * Team Management Component
 * Create teams, manage members, and assign roles
 */
import { useState } from 'react';
import { Users, Plus, UserPlus, Trash2, Shield, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { teamAPI } from '../../services/api';
import useAuthStore from '../../store/authStore';

const TeamManagement = ({ onCancel }) => {
  const { fetchWorkspaces, getActiveWorkspaceDetails, workspaces, switchWorkspace } = useAuthStore();
  const activeWorkspace = getActiveWorkspaceDetails();
  
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState(false);
  const [roleChangeData, setRoleChangeData] = useState(null);
  const [showDeleteTeamModal, setShowDeleteTeamModal] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('qa_member');
  const [isLoading, setIsLoading] = useState(false);

  // Get teams where user is admin
  const adminTeams = workspaces.filter(w => w.type === 'team' && w.role === 'admin');

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Validation
    if (newTeamName.trim().length < 3) {
      toast.error('Team name must be at least 3 characters long');
      setIsLoading(false);
      return;
    }
    
    if (newTeamName.trim().length > 100) {
      toast.error('Team name must be less than 100 characters');
      setIsLoading(false);
      return;
    }
    
    try {
      await teamAPI.createTeam(newTeamName.trim(), newTeamDesc.trim());
      setShowCreateModal(false);
      setNewTeamName('');
      setNewTeamDesc('');
      toast.success(`Team "${newTeamName}" created successfully!`, { duration: 3000 });
      
      // Small delay to ensure database commit completes
      await new Promise(resolve => setTimeout(resolve, 200));
      await fetchWorkspaces();
      
      // If onCancel is provided (inline form), close the form
      if (onCancel) {
        onCancel();
      }
    } catch (err) {
      toast.error('Failed to create team. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeamMembers = async (teamId) => {
    setIsLoading(true);
    try {
      const data = await teamAPI.getTeam(teamId);
      setTeamMembers(data.members || []);
      setCurrentUserRole(data.your_role);
      setSelectedTeam(teamId);
    } catch (err) {
      toast.error('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Validation
    const userId = parseInt(newMemberUserId);
    if (!userId || userId <= 0) {
      toast.error('Please enter a valid User ID');
      setIsLoading(false);
      return;
    }
    
    // Check if user is already a member
    if (teamMembers.some(m => m.user_id === userId)) {
      toast.error('This user is already a member of the team');
      setIsLoading(false);
      return;
    }
    
    try {
      await teamAPI.addMember(selectedTeam, userId, newMemberRole);
      setShowAddMemberModal(false);
      setNewMemberUserId('');
      setNewMemberRole('qa_member');
      toast.success(`User added as ${newMemberRole.replace('_', ' ')} successfully!`);
      await loadTeamMembers(selectedTeam);
    } catch (err) {
      toast.error('Failed to add member. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    const member = teamMembers.find(m => m.user_id === userId);
    setMemberToRemove(member);
    setShowRemoveConfirm(true);
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    
    setIsLoading(true);
    try {
      await teamAPI.removeMember(selectedTeam, memberToRemove.user_id);
      toast.success(`${memberToRemove.full_name || memberToRemove.username || 'Member'} removed from team`);
      setShowRemoveConfirm(false);
      setMemberToRemove(null);
      await loadTeamMembers(selectedTeam);
    } catch (err) {
      // Error toast already shown by API interceptor
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    const member = teamMembers.find(m => m.user_id === userId);
    const oldRole = member?.role;
    
    // Skip if role hasn't changed
    if (oldRole === newRole) return;
    
    // Confirm role change, especially for admin demotion
    if (oldRole === 'admin') {
      setRoleChangeData({ userId, newRole, member, oldRole });
      setShowRoleChangeConfirm(true);
    } else {
      await executeRoleChange(userId, newRole, member, oldRole);
    }
  };

  const executeRoleChange = async (userId, newRole, member, oldRole) => {
    setIsLoading(true);
    try {
      await teamAPI.updateMemberRole(selectedTeam, userId, newRole);
      const memberName = member?.full_name || member?.username || 'Member';
      toast.success(`${memberName}'s role changed from ${oldRole.replace('_', ' ')} to ${newRole.replace('_', ' ')}`);
      await loadTeamMembers(selectedTeam);
    } catch (err) {
      // Error toast already shown by API interceptor
      // Reload to revert the dropdown
      await loadTeamMembers(selectedTeam);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmRoleChange = async () => {
    if (!roleChangeData) return;
    await executeRoleChange(
      roleChangeData.userId,
      roleChangeData.newRole,
      roleChangeData.member,
      roleChangeData.oldRole
    );
    setShowRoleChangeConfirm(false);
    setRoleChangeData(null);
  };

  const handleDeleteTeam = async () => {
    if (!teamToDelete) {
      toast.error('Please select a team to delete');
      return;
    }

    setIsLoading(true);
    try {
      const teamName = adminTeams.find(t => t.id === parseInt(teamToDelete))?.name;
      await teamAPI.deleteTeam(parseInt(teamToDelete));
      
      toast.success(`Team "${teamName}" deleted successfully!`, { duration: 2500 });
      setShowDeleteTeamModal(false);
      setTeamToDelete('');
      
      // Switch to personal workspace if deleted team was active
      if (activeWorkspace?.id === parseInt(teamToDelete)) {
        await switchWorkspace(null);
        // Delay reload to allow toasts to be visible
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        // Refresh workspaces
        await fetchWorkspaces();
      }
    } catch (err) {
      toast.error('Failed to delete team. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = currentUserRole === 'admin';

  // Show create form if in personal workspace
  const isPersonalWorkspace = activeWorkspace?.type === 'personal';
  const showingCreateForm = isPersonalWorkspace && onCancel;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - only show when in team workspace */}
      {!showingCreateForm && (
        <div className="flex items-center justify-end gap-4">
          {activeWorkspace?.type === 'team' ? (
            <button
              onClick={() => setShowDeleteTeamModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 shadow-md transition-all text-sm sm:text-base w-full sm:w-auto"
              disabled={adminTeams.length === 0}
            >
              <Trash2 size={18} />
              <span>Delete Team</span>
            </button>
          ) : null}
        </div>
      )}

      {/* Create Team Form - shown in personal workspace */}
      {showingCreateForm && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Create New Team</h3>
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              <X size={24} />
            </button>
          </div>
          
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="input"
                placeholder="e.g., QA Team Alpha"
                required
                minLength={3}
                maxLength={100}
              />
              <p className="text-xs text-gray-500 mt-1">3-100 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={newTeamDesc}
                onChange={(e) => setNewTeamDesc(e.target.value)}
                className="input"
                rows={3}
                placeholder="Brief description of the team's purpose..."
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">Max 500 characters</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading || !newTeamName.trim()}
                className="btn-primary flex-1"
              >
                {isLoading ? 'Creating...' : 'Create Team'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Team Management - shown only in team workspace */}
      {!showingCreateForm && activeWorkspace?.type === 'team' && (
        <div className="card bg-primary-50 border border-primary-200">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Users size={24} className="text-primary-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-primary-900 text-base sm:text-lg">{activeWorkspace.name}</h3>
              <p className="text-xs sm:text-sm text-primary-700">
                Current Team Workspace · Role: <span className="capitalize">{activeWorkspace.role?.replace('_', ' ')}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => loadTeamMembers(activeWorkspace.id)}
            className="mt-4 btn-primary text-sm flex items-center justify-center gap-2 w-full sm:w-auto"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Loading...
              </>
            ) : (
              <>
                <Users size={16} />
                View Team Members
              </>
            )}          
          </button>
        </div>
      )}

      {/* Team Members View */}
      {selectedTeam && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Team Members ({teamMembers.length})</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              {isAdmin && (
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="btn-primary text-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <UserPlus size={16} />
                  <span>Add Member</span>
                </button>
              )}
              <button
                onClick={() => setSelectedTeam(null)}
                className="btn-secondary text-sm w-full sm:w-auto"
              >
                Close
              </button>
            </div>
          </div>
          {teamMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users size={48} className="mx-auto mb-3 opacity-50" />
              <p>No members found in this team</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => (
              <div
                key={member.user_id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">{member.full_name || member.username}</div>
                  <div className="text-sm text-gray-600 truncate">{member.email}</div>
                  <div className="text-xs text-gray-500 mt-1">User ID: {member.user_id}</div>
                </div>
                <div className="flex items-center gap-3 sm:flex-shrink-0">
                  {isAdmin ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.user_id, e.target.value)}
                      className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full sm:w-auto"
                    >
                      <option value="admin">Admin</option>
                      <option value="qa_lead">QA Lead</option>
                      <option value="qa_member">QA Member</option>
                    </select>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      member.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      member.role === 'qa_lead' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      <Shield size={12} className="inline mr-1" />
                      {member.role.replace('_', ' ').toUpperCase()}
                    </span>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      title="Remove member"
                      aria-label="Remove member"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Modals - only show when not in create form mode */}
      {!showingCreateForm && (
        <>
      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  id="teamName"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="input-field"
                  placeholder="e.g., QA Team Alpha"
                  minLength={3}
                  maxLength={100}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Team name must be 3-100 characters
                </p>
              </div>
              <div>
                <label htmlFor="teamDesc" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="teamDesc"
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  className="input-field"
                  rows="3"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTeamName('');
                    setNewTeamDesc('');

                  }}
                  className="btn-secondary w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full sm:w-auto"
                >
                  {isLoading ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Team Member</h3>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
                  User ID *
                </label>
                <input
                  type="number"
                  id="userId"
                  value={newMemberUserId}
                  onChange={(e) => setNewMemberUserId(e.target.value)}
                  className="input-field"
                  placeholder="Enter user ID (e.g., 2)"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  You need the User ID of the person to add. Users can see their ID in the top right corner.
                </p>
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  id="role"
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="input-field"
                >
                  <option value="qa_member">QA Member - Can generate tests, view team data</option>
                  <option value="qa_lead">QA Lead - Can generate tests, view all team data</option>
                  <option value="admin">Admin - Full team management access</option>
                </select>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setNewMemberUserId('');
                    setNewMemberRole('qa_member');

                  }}
                  className="btn-secondary w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {isLoading ? 'Adding...' : (
                    <>
                      <UserPlus size={16} />
                      Add Member
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      {showRemoveConfirm && memberToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-red-600">Remove Team Member</h3>
              <button
                onClick={() => {
                  setShowRemoveConfirm(false);
                  setMemberToRemove(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to remove the following member from the team?
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="font-semibold text-gray-900">
                  {memberToRemove.full_name || memberToRemove.username}
                </div>
                <div className="text-sm text-gray-600">{memberToRemove.email}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Role: <span className="capitalize">{memberToRemove.role?.replace('_', ' ')}</span>
                </div>
              </div>
              <p className="text-sm text-red-600">
                ⚠️ This action cannot be undone. The member will lose access to all team data.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowRemoveConfirm(false);
                    setMemberToRemove(null);
                  }}
                  className="btn-secondary w-full sm:w-auto"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveMember}
                  disabled={isLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Remove Member
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Confirmation Modal */}
      {showRoleChangeConfirm && roleChangeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-orange-600">Confirm Role Change</h3>
              <button
                onClick={() => {
                  setShowRoleChangeConfirm(false);
                  setRoleChangeData(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-gray-700">
                You are about to change the role for:
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="font-semibold text-gray-900">
                  {roleChangeData.member?.full_name || roleChangeData.member?.username}
                </div>
                <div className="text-sm text-gray-600">{roleChangeData.member?.email}</div>
                <div className="text-sm mt-2 flex items-center gap-2">
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium capitalize">
                    {roleChangeData.oldRole?.replace('_', ' ')}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium capitalize">
                    {roleChangeData.newRole?.replace('_', ' ')}
                  </span>
                </div>
              </div>
              {roleChangeData.oldRole === 'admin' && (
                <p className="text-sm text-orange-600">
                  ⚠️ This will remove admin privileges. The member will no longer be able to manage team members.
                </p>
              )}
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowRoleChangeConfirm(false);
                    setRoleChangeData(null);
                    // Reload to revert dropdown
                    loadTeamMembers(selectedTeam);
                  }}
                  className="btn-secondary w-full sm:w-auto"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRoleChange}
                  disabled={isLoading}
                  className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Shield size={16} />
                      Confirm Change
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Team Modal */}
      {showDeleteTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-red-600">Delete Team</h3>
              <button
                onClick={() => {
                  setShowDeleteTeamModal(false);
                  setTeamToDelete('');

                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-gray-700">
                Select a team to permanently delete:
              </p>
              <div>
                <label htmlFor="teamSelect" className="block text-sm font-medium text-gray-700 mb-2">
                  Team to Delete *
                </label>
                <select
                  id="teamSelect"
                  value={teamToDelete}
                  onChange={(e) => setTeamToDelete(e.target.value)}
                  className="input-field"
                  disabled={adminTeams.length === 0}
                >
                  <option value="">-- Select a team --</option>
                  {adminTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                {adminTeams.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    You don't have admin access to any teams.
                  </p>
                )}
              </div>
              {teamToDelete && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-red-600 mt-0.5">⚠️</div>
                    <div className="text-sm text-red-800">
                      <p className="font-semibold mb-2">Warning: This action cannot be undone!</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>All team members will lose access</li>
                        <li>Team data and history will be permanently deleted</li>
                        <li>Integration credentials will be removed</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteTeamModal(false);
                    setTeamToDelete('');
                  }}
                  className="btn-secondary w-full sm:w-auto"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTeam}
                  disabled={isLoading || !teamToDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete Team Permanently
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default TeamManagement;
