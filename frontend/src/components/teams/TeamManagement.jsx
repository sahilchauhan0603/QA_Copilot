/**
 * Team Management Component
 * Create teams, manage members, and assign roles
 */
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  Plus,
  UserPlus,
  Trash2,
  Shield,
  X,
  ChevronDown,
  Pencil,
  Mail,
  Search,
  LogOut,
} from "lucide-react";
import toast from "react-hot-toast";
import { teamAPI } from "../../services/api";
import useAuthStore from "../../store/authStore";

const TeamManagement = ({ onCancel }) => {
  const {
    fetchWorkspaces,
    getActiveWorkspaceDetails,
    workspaces,
    switchWorkspace,
  } = useAuthStore();
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
  const [teamToDelete, setTeamToDelete] = useState("");
  const [showLeaveTeamModal, setShowLeaveTeamModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamDesc, setEditTeamDesc] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [newMemberIdentifier, setNewMemberIdentifier] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("qa_member");
  const [isLoading, setIsLoading] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState("all");

  // Fetch pending invitations whenever active team workspace changes (admin only)
  useEffect(() => {
    if (
      activeWorkspace?.type === 'team' &&
      activeWorkspace?.role === 'admin' &&
      activeWorkspace?.id
    ) {
      teamAPI.getTeamInvitations(activeWorkspace.id)
        .then(setPendingInvitations)
        .catch(() => setPendingInvitations([]));
    } else {
      setPendingInvitations([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);
  const adminTeams = workspaces.filter(
    (w) => w.type === "team" && w.role === "admin",
  );

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Validation
    if (newTeamName.trim().length < 3) {
      toast.error("Team name must be at least 3 characters long");
      setIsLoading(false);
      return;
    }

    if (newTeamName.trim().length > 100) {
      toast.error("Team name must be less than 100 characters");
      setIsLoading(false);
      return;
    }

    try {
      await teamAPI.createTeam(newTeamName.trim(), newTeamDesc.trim());
      setShowCreateModal(false);
      setNewTeamName("");
      setNewTeamDesc("");
      toast.success(`Team "${newTeamName}" created successfully!`, {
        duration: 3000,
      });

      // Small delay to ensure database commit completes
      await new Promise((resolve) => setTimeout(resolve, 200));
      await fetchWorkspaces();

      // If onCancel is provided (inline form), close the form
      if (onCancel) {
        onCancel();
      }
    } catch (err) {
      toast.error("Failed to create team. Please try again.");
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
      toast.error("Failed to load team members");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (sendingInvite) return;
    setSendingInvite(true);

    const identifier = newMemberIdentifier.trim();
    if (!identifier || identifier.length < 3) {
      toast.error("Please enter a valid email, username, or User ID");
      setSendingInvite(false);
      return;
    }

    try {
      await teamAPI.sendInvitation(selectedTeam, identifier, newMemberRole);
      setShowAddMemberModal(false);
      setNewMemberIdentifier("");
      setNewMemberRole("qa_member");
      toast.success(
        "Invitation sent! The user will see it in their inbox.",
      );
    } catch (err) {
      // error toast already handled by axios interceptor
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    const member = teamMembers.find((m) => m.user_id === userId);
    setMemberToRemove(member);
    setShowRemoveConfirm(true);
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;

    setIsLoading(true);
    try {
      await teamAPI.removeMember(selectedTeam, memberToRemove.user_id);
      toast.success(
        `${memberToRemove.full_name || memberToRemove.username || "Member"} removed from team`,
      );
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
    const member = teamMembers.find((m) => m.user_id === userId);
    const oldRole = member?.role;

    // Skip if role hasn't changed
    if (oldRole === newRole) return;

    // Confirm role change, especially for admin demotion
    if (oldRole === "admin") {
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
      const memberName = member?.full_name || member?.username || "Member";
      toast.success(
        `${memberName}'s role changed from ${oldRole.replace("_", " ")} to ${newRole.replace("_", " ")}`,
      );
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
      roleChangeData.oldRole,
    );
    setShowRoleChangeConfirm(false);
    setRoleChangeData(null);
  };

  const handleOpenEditTeam = () => {
    setEditTeamName(activeWorkspace?.name || "");
    setEditTeamDesc(activeWorkspace?.description || "");
    setShowEditTeamModal(true);
  };

  const handleEditTeam = async (e) => {
    e.preventDefault();
    if (!editTeamName.trim() || editTeamName.trim().length < 3) {
      toast.error("Team name must be at least 3 characters");
      return;
    }
    setIsLoading(true);
    try {
      await teamAPI.updateTeam(activeWorkspace.id, {
        name: editTeamName.trim(),
        description: editTeamDesc.trim(),
      });
      toast.success("Team updated successfully!");
      setShowEditTeamModal(false);
      await fetchWorkspaces();
    } catch (err) {
      toast.error("Failed to update team. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTeam = async () => {    if (!teamToDelete) {
      toast.error("Please select a team to delete");
      return;
    }

    setIsLoading(true);
    try {
      const teamName = adminTeams.find(
        (t) => t.id === parseInt(teamToDelete),
      )?.name;
      await teamAPI.deleteTeam(parseInt(teamToDelete));

      toast.success(`Team "${teamName}" deleted successfully!`, {
        duration: 2500,
      });
      setShowDeleteTeamModal(false);
      setTeamToDelete("");

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
      toast.error("Failed to delete team. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!activeWorkspace?.id) return;
    setIsLoading(true);
    try {
      await teamAPI.leaveTeam(activeWorkspace.id);
      toast.success('You have left the team');
      setShowLeaveTeamModal(false);
      await switchWorkspace(null);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      toast.error('Failed to leave team');
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = currentUserRole === "admin";

  // Show create form if in personal workspace
  const isPersonalWorkspace = activeWorkspace?.type === "personal";
  const showingCreateForm = !!onCancel;
  const shouldRenderPortals = typeof document !== "undefined";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - only show when in team workspace */}
      {!showingCreateForm && (
        <div className="flex items-center justify-end gap-3">
          {activeWorkspace?.type === "team" && activeWorkspace?.role === "admin" && (
            <button
              onClick={handleOpenEditTeam}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2 shadow-md transition-all text-sm sm:text-base w-full sm:w-auto"
            >
              <Pencil size={16} />
              <span>Edit Team</span>
            </button>
          )}
          {activeWorkspace?.type === "team" && activeWorkspace?.role === "admin" ? (
            <button
              onClick={() => setShowDeleteTeamModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 shadow-md transition-all text-sm sm:text-base w-full sm:w-auto"
              disabled={adminTeams.length === 0}
            >
              <Trash2 size={18} />
              <span>Delete Team</span>
            </button>
          ) : activeWorkspace?.type === "team" ? (
            <button
              onClick={() => setShowLeaveTeamModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 shadow-md transition-all text-sm sm:text-base w-full sm:w-auto"
            >
              <LogOut size={18} />
              <span>Leave Team</span>
            </button>
          ) : null}
        </div>
      )}

      {/* Create Team Form - shown in personal workspace */}
      {showingCreateForm && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Create New Team
            </h3>
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
                className="input bg-white"
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
                {isLoading ? "Creating..." : "Create Team"}
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
      {!showingCreateForm && activeWorkspace?.type === "team" && (
        <div className="card bg-primary-50 border border-primary-200">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Left: team info */}
            <div className="flex gap-3 flex-1 min-w-0">
              <Users size={24} className="text-primary-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-primary-900 text-base sm:text-lg">
                  {activeWorkspace.name}
                </h3>
                <p className="text-xs sm:text-sm text-primary-700">
                  Current Team Workspace · Role:{" "}
                  <span className="capitalize font-medium">
                    {activeWorkspace.role?.replace("_", " ")}
                  </span>
                </p>
                {activeWorkspace.description && (
                  <p className="text-sm text-gray-600 mt-1">~ {activeWorkspace.description}</p>
                )}
                {/* Stats row */}
                <div className="flex flex-wrap gap-4 mt-3">
                  {activeWorkspace.member_count != null && (
                    <div className="flex items-center gap-1.5 text-xs text-primary-700">
                      <Users size={13} />
                      <span><span className="font-semibold">{activeWorkspace.member_count}</span> member{activeWorkspace.member_count !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {activeWorkspace.created_at && (
                    <div className="text-xs text-primary-600">
                      Created{" "}
                      <span className="font-semibold">
                        {new Date(activeWorkspace.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  {activeWorkspace.joined_at && (
                    <div className="text-xs text-primary-600">
                      Joined{" "}
                      <span className="font-semibold">
                        {new Date(activeWorkspace.joined_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: pending invitations panel (admin only) */}
            {activeWorkspace.role === "admin" && (
              <div className="shrink-0 sm:w-56 bg-white border border-primary-100 rounded-lg p-3 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <Mail size={14} className="text-primary-500" />
                  <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">
                    Pending Invitations
                  </span>
                  <span className="ml-auto text-xs font-bold bg-primary-100 text-primary-700 rounded-full px-2 py-0.5">
                    {pendingInvitations.length}
                  </span>
                </div>
                {pendingInvitations.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No pending invitations</p>
                ) : (
                  <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                    {pendingInvitations.map((inv) => (
                      <li key={inv.id} className="text-xs text-gray-700 truncate" title={`${inv.invited_full_name || inv.invited_username} — ${inv.invited_email}`}>
                        <span className="font-medium">{inv.invited_full_name || inv.invited_username}</span>
                        <span className="block text-gray-400 truncate">{inv.invited_email}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
            <h3 className="text-lg font-semibold text-gray-900">
              Team Members ({teamMembers.length})
            </h3>
            <div className="flex flex-col sm:flex-row gap-2">
              {isAdmin && (
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="btn-primary text-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <UserPlus size={16} />
                  <span>Invite Member</span>
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
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, email, or ID…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border text-black border-gray-300 rounded-lg focus:ring-2 bg-white focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="relative sm:w-44">
              <select
                value={memberRoleFilter}
                onChange={(e) => setMemberRoleFilter(e.target.value)}
                className="appearance-none w-full pl-3 pr-8 py-2 text-sm border text-black border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="qa_lead">QA Lead</option>
                <option value="qa_member">QA Member</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {(() => {
            const query = memberSearch.trim().toLowerCase();
            const filtered = teamMembers.filter((m) => {
              const matchesSearch =
                !query ||
                (m.full_name || m.username || "").toLowerCase().includes(query) ||
                (m.email || "").toLowerCase().includes(query) ||
                (m.public_user_id || "").toLowerCase().includes(query);
              const matchesRole =
                memberRoleFilter === "all" || m.role === memberRoleFilter;
              return matchesSearch && matchesRole;
            });

            if (teamMembers.length === 0) {
              return (
                <div className="text-center py-8 text-gray-500">
                  <Users size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No members found in this team</p>
                </div>
              );
            }
            if (filtered.length === 0) {
              return (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No members match your search</p>
                </div>
              );
            }
            return (
            <div className="space-y-3">
              {filtered.map((member) => (
                <div
                  key={member.user_id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">
                      {member.full_name || member.username}
                    </div>
                    <div className="text-sm text-gray-600 truncate">
                      {member.email}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      User ID: {member.public_user_id || `USER-${member.user_id}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:flex-shrink-0">
                    {isAdmin ? (
                      <div className="relative w-full sm:w-[170px]">
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleUpdateRole(member.user_id, e.target.value)
                          }
                          className="appearance-none text-black w-full pl-3 pr-9 py-2 rounded-lg text-sm cursor-pointer font-medium border border-gray-300 bg-white shadow-sm hover:border-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                        >
                          <option value="admin">Admin</option>
                          <option value="qa_lead">QA Lead</option>
                          <option value="qa_member">QA Member</option>
                        </select>
                        <ChevronDown
                          size={16}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                        />
                      </div>
                    ) : (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                          member.role === "admin"
                            ? "bg-purple-100 text-purple-800"
                            : member.role === "qa_lead"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        <Shield size={12} className="inline mr-1" />
                        {member.role.replace("_", " ").toUpperCase()}
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
            );
          })()}
        </div>
      )}

      {/* Modals - only show when not in create form mode */}
      {!showingCreateForm &&
        shouldRenderPortals &&
        createPortal(
          <>
            {/* Create Team Modal */}
            {showCreateModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Create New Team
                  </h3>
                  <form onSubmit={handleCreateTeam} className="space-y-4">
                    <div>
                      <label
                        htmlFor="teamName"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
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
                      <label
                        htmlFor="teamDesc"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
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
                          setNewTeamName("");
                          setNewTeamDesc("");
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
                        {isLoading ? "Creating..." : "Create Team"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Invite Member Modal */}
            {showAddMemberModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">
                      Invite Team Member
                    </h3>
                    <button
                      onClick={() => setShowAddMemberModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs text-blue-700">
                      An invitation will be sent to the user. They can accept or decline it from their <strong>Inbox</strong> (profile icon). A notification email will also be sent.
                    </p>
                  </div>
                  <form onSubmit={handleAddMember} className="space-y-4">
                    <div>
                      <label
                        htmlFor="memberIdentifier"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Email, Username, or User ID *
                      </label>
                      <input
                        type="text"
                        id="memberIdentifier"
                        value={newMemberIdentifier}
                        onChange={(e) =>
                          setNewMemberIdentifier(e.target.value.replace(/\s/g, ""))
                        }
                        className="input-field bg-white text-black"
                        placeholder="e.g., john@example.com or QC-AB12CD34"
                        required
                        autoFocus
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the member's email address, username, or User ID (QC-XXXXXXXX).
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor="role"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Role *
                      </label>
                      <div className="relative">
                        <select
                          id="role"
                          value={newMemberRole}
                          onChange={(e) => setNewMemberRole(e.target.value)}
                          className="appearance-none w-full pl-4 pr-10 py-3 rounded-xl text-base text-gray-900 cursor-pointer font-medium border border-gray-300 bg-white shadow-sm hover:border-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                        >
                          <option value="qa_member">
                            QA Member - Can generate tests, view team data
                          </option>
                          <option value="qa_lead">
                            QA Lead - Can generate tests, view all team data
                          </option>
                          <option value="admin">
                            Admin - Full team management access
                          </option>
                        </select>
                        <ChevronDown
                          size={18}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddMemberModal(false);
                          setNewMemberIdentifier("");
                          setNewMemberRole("qa_member");
                        }}
                        className="btn-secondary w-full sm:w-auto"
                        disabled={sendingInvite}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={sendingInvite}
                        className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingInvite ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Sending...
                          </>
                        ) : (
                          <>
                            <UserPlus size={16} />
                            Send Invitation
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
                    <h3 className="text-xl font-bold text-red-600">
                      Remove Team Member
                    </h3>
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
                      Are you sure you want to remove the following member from
                      the team?
                    </p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="font-semibold text-gray-900">
                        {memberToRemove.full_name || memberToRemove.username}
                      </div>
                      <div className="text-sm text-gray-600">
                        {memberToRemove.email}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Role:{" "}
                        <span className="capitalize">
                          {memberToRemove.role?.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-red-600">
                      ⚠️ This action cannot be undone. The member will lose
                      access to all team data.
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
                    <h3 className="text-xl font-bold text-orange-600">
                      Confirm Role Change
                    </h3>
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
                        {roleChangeData.member?.full_name ||
                          roleChangeData.member?.username}
                      </div>
                      <div className="text-sm text-gray-600">
                        {roleChangeData.member?.email}
                      </div>
                      <div className="text-sm mt-2 flex items-center gap-2">
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium capitalize">
                          {roleChangeData.oldRole?.replace("_", " ")}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium capitalize">
                          {roleChangeData.newRole?.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    {roleChangeData.oldRole === "admin" && (
                      <p className="text-sm text-orange-600">
                        ⚠️ This will remove admin privileges. The member will no
                        longer be able to manage team members.
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

            {/* Edit Team Modal */}
            {showEditTeamModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Edit Team</h3>
                    <button
                      onClick={() => setShowEditTeamModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <form onSubmit={handleEditTeam} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Team Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editTeamName}
                        onChange={(e) => setEditTeamName(e.target.value)}
                        className="input"
                        placeholder="e.g., QA Team Alpha"
                        required
                        minLength={3}
                        maxLength={100}
                        autoFocus
                      />
                      <p className="text-xs text-gray-500 mt-1">3–100 characters</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={editTeamDesc}
                        onChange={(e) => setEditTeamDesc(e.target.value)}
                        className="input"
                        rows={3}
                        placeholder="Brief description of the team's purpose..."
                        maxLength={500}
                      />
                      <p className="text-xs text-gray-500 mt-1">Max 500 characters</p>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setShowEditTeamModal(false)}
                        className="btn-secondary w-full sm:w-auto"
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading || !editTeamName.trim()}
                        className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Pencil size={15} />
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Delete Team Modal */}
            {showDeleteTeamModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-red-600">
                      Delete Team
                    </h3>
                    <button
                      onClick={() => {
                        setShowDeleteTeamModal(false);
                        setTeamToDelete("");
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
                      <label
                        htmlFor="teamSelect"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Team to Delete *
                      </label>
                      <div className="relative">
                        <select
                          id="teamSelect"
                          value={teamToDelete}
                          onChange={(e) => setTeamToDelete(e.target.value)}
                          className="appearance-none w-full pl-4 pr-10 py-3 rounded-xl text-base text-gray-900 cursor-pointer font-medium border border-gray-300 bg-white shadow-sm hover:border-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                          disabled={adminTeams.length === 0}
                        >
                          <option value="">-- Select a team --</option>
                          {adminTeams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={18}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                        />
                      </div>
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
                            <p className="font-semibold mb-2">
                              Warning: This action cannot be undone!
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                              <li>All team members will lose access</li>
                              <li>
                                Team data and history will be permanently
                                deleted
                              </li>
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
                          setTeamToDelete("");
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

            {/* Leave Team Confirmation Modal */}
            {showLeaveTeamModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-red-600">
                      Leave Team
                    </h3>
                    <button
                      onClick={() => setShowLeaveTeamModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <p className="text-gray-700">
                      Are you sure you want to leave <strong>{activeWorkspace?.name}</strong>?
                    </p>
                    <p className="text-sm text-red-600">
                      ⚠️ You will lose access to all team data. You'll need a new invitation to rejoin.
                    </p>
                    <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setShowLeaveTeamModal(false)}
                        className="btn-secondary w-full sm:w-auto"
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleLeaveTeam}
                        disabled={isLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Leaving...
                          </>
                        ) : (
                          <>
                            <LogOut size={16} />
                            Leave Team
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body,
        )}
    </div>
  );
};

export default TeamManagement;
