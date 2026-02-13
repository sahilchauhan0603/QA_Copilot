/**
 * My Teams Component
 * Read-only view of teams user is part of (for personal workspace)
 */
import { Users, Crown, Shield, ChevronRight } from 'lucide-react';
import useAuthStore from '../store/authStore';

const MyTeams = ({ onCreateTeam }) => {
  const { workspaces, switchWorkspace } = useAuthStore();

  // Get all team workspaces (filter out personal workspace)
  const myTeams = workspaces.filter(w => w.type === 'team');

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Crown size={16} className="text-yellow-600" />;
      case 'qa_lead':
        return <Shield size={16} className="text-blue-600" />;
      default:
        return <Users size={16} className="text-gray-600" />;
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'qa_lead':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleSwitchToTeam = async (teamId) => {
    try {
      await switchWorkspace(teamId);
      // Page will automatically update due to auth store change
    } catch (err) {
      console.error('Failed to switch workspace:', err);
    }
  };

  if (myTeams.length === 0) {
    return (
      <div className="card text-center py-12">
        <Users size={64} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Teams Yet</h3>
        <p className="text-gray-600 mb-6">
          You're not a member of any teams yet. Create a team to start collaborating!
        </p>
        {onCreateTeam && (
          <button
            onClick={onCreateTeam}
            className="btn-primary mx-auto mb-6"
          >
            Create Your First Team
          </button>
        )}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto text-left">
          <p className="text-sm text-blue-900 font-medium mb-2">💡 How to create a team:</p>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Click "Create Your First Team" or the button above</li>
            <li>Add team members by their User ID</li>
            <li>Assign roles (Admin, QA Lead, or Member)</li>
            <li>Switch to team workspace to collaborate</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Users className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Your Teams</h3>
            <p className="text-sm text-blue-800">
              You are a member of {myTeams.length} team{myTeams.length !== 1 ? 's' : ''}. 
              Click on a team to switch to that workspace and manage it.
            </p>
          </div>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {myTeams.map((team) => (
          <div
            key={team.id}
            onClick={() => handleSwitchToTeam(team.id)}
            className="card hover:shadow-lg transition-all duration-200 cursor-pointer group border-2 border-transparent hover:border-primary-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                  <Users size={24} className="text-primary-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{team.name}</h3>
                  {team.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{team.description}</p>
                  )}
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0" />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                {getRoleIcon(team.role)}
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(team.role)}`}>
                  {team.role === 'admin' ? 'Admin' : 
                   team.role === 'qa_lead' ? 'QA Lead' : 
                   'Member'}
                </span>
              </div>
              <button className="text-sm text-primary-600 hover:text-primary-700 font-medium group-hover:underline">
                Switch to Team →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Role Explanation */}
      <div className="card bg-gray-50">
        <h4 className="font-semibold text-gray-900 mb-3">Team Roles</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Crown size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium text-gray-900">Admin:</span>
              <span className="text-gray-700 ml-1">Full control - manage members, delete team, and all team settings</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Shield size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium text-gray-900">QA Lead:</span>
              <span className="text-gray-700 ml-1">Can view members and generate test cases for the team</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Users size={16} className="text-gray-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium text-gray-900">Member:</span>
              <span className="text-gray-700 ml-1">Can generate test cases and view team content</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyTeams;
