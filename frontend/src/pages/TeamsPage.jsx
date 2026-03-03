/**
 * Teams Page
 * Shows different views based on workspace type:
 * - Personal workspace: Read-only list of teams user is part of
 * - Team workspace: Full team management with CRUD operations
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import TeamManagement from '../components/teams/TeamManagement';
import MyTeams from '../components/teams/MyTeams';
import useAuthStore from '../store/authStore';

const TeamsPage = () => {
  const { getActiveWorkspaceDetails } = useAuthStore();
  const activeWorkspace = getActiveWorkspaceDetails();
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const isPersonalWorkspace = activeWorkspace?.type === 'personal';

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isPersonalWorkspace ? 'My Teams' : 'Team Management'}
          </h1>
          <p className="text-gray-600 mt-2">
            {isPersonalWorkspace 
              ? 'View all teams you\'re part of and switch between them'
              : 'Manage your team members, roles, and settings'
            }
          </p>
        </div>
        
        {/* Show Create Team button only in personal workspace */}
        {isPersonalWorkspace && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary flex items-center gap-2"
          >
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
      
      {/* Conditional rendering based on workspace type and state */}
      {isPersonalWorkspace && !showCreateForm ? (
        <MyTeams onCreateTeam={() => setShowCreateForm(true)} />
      ) : (
        <TeamManagement onCancel={showCreateForm ? () => setShowCreateForm(false) : null} />
      )}
    </div>
  );
};

export default TeamsPage;
