/**
 * Teams Page
 * Shows different views based on workspace type:
 * - Personal workspace: Read-only list of teams user is part of
 * - Team workspace: Full team management with CRUD operations
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import TeamManagement from '../components/teams/TeamManagement';
import MyTeams from '../components/teams/MyTeams';
import useAuthStore from '../store/authStore';
import { teamAPI } from '../services/api';
import toast from 'react-hot-toast';

const TeamsPage = () => {
  const { getActiveWorkspaceDetails, fetchWorkspaces } = useAuthStore();
  const activeWorkspace = getActiveWorkspaceDetails();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const isPersonalWorkspace = activeWorkspace?.type === 'personal';

  const openModal = () => {
    setTeamName('');
    setTeamDesc('');
    setShowCreateModal(true);
  };

  const closeModal = () => {
    if (isCreating) return;
    setShowCreateModal(false);
    setTeamName('');
    setTeamDesc('');
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await teamAPI.createTeam(teamName.trim(), teamDesc.trim());
      setShowCreateModal(false);
      toast.success(`Team "${teamName.trim()}" created successfully!`, { duration: 3000 });
      await new Promise((r) => setTimeout(r, 200));
      await fetchWorkspaces();
    } catch {
      toast.error('Failed to create team. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isPersonalWorkspace ? 'My Teams' : 'Team Management'}
          </h1>
          <p className="text-gray-600 mt-2">
            {isPersonalWorkspace
              ? "View all teams you're part of and switch between them"
              : 'Manage your team members, roles, and settings'}
          </p>
        </div>

        {/* Show Create Team button only in personal workspace */}
        {isPersonalWorkspace && (
          <button onClick={openModal} className="btn-primary flex items-center gap-2">
            <Plus size={20} />
            Create New Team
          </button>
        )}
        {!isPersonalWorkspace && (
          <p className="text-sm text-gray-500 italic text-right max-w-xs">
            To create a new team, switch to your personal workspace first.
          </p>
        )}
      </div>

      {/* Main content */}
      {isPersonalWorkspace ? (
        <MyTeams onCreateTeam={openModal} />
      ) : (
        <TeamManagement />
      )}

      {/* Create Team Modal Overlay */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">Create New Team</h2>
              <button
                onClick={closeModal}
                disabled={isCreating}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <X size={22} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="teamName"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="input-field"
                  placeholder="e.g., QA Team Alpha"
                  minLength={3}
                  maxLength={100}
                  required
                  autoFocus
                  disabled={isCreating}
                />
                <p className="text-xs text-gray-500 mt-1">3–100 characters</p>
              </div>

              <div>
                <label htmlFor="teamDesc" className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="teamDesc"
                  value={teamDesc}
                  onChange={(e) => setTeamDesc(e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="What does this team work on?"
                  disabled={isCreating}
                />
              </div>

              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isCreating}
                  className="btn-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || teamName.trim().length < 3}
                  className={`font-medium py-2 px-4 rounded-lg transition-all duration-200 shadow-sm ${
                    isCreating || teamName.trim().length < 3
                      ? 'bg-primary-200 text-white cursor-not-allowed'
                      : 'bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white hover:shadow-md cursor-pointer'
                  }`}
                >
                  {isCreating ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsPage;
