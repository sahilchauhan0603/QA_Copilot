/**
 * Workspace Selector Component
 * Dropdown to switch between personal workspace and team workspaces
 */
import { useState, useEffect } from 'react';
import { Users, User, ChevronDown, Check } from 'lucide-react';
import useAuthStore from '../store/authStore';

const WorkspaceSelector = () => {
  const { workspaces, activeWorkspace, switchWorkspace, fetchWorkspaces, getActiveWorkspaceDetails } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  
  const activeWorkspaceDetails = getActiveWorkspaceDetails();

  // Fetch workspaces on mount
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleWorkspaceSwitch = async (workspaceId) => {
    setSwitching(true);
    await switchWorkspace(workspaceId);
    // Reload page to refresh all data for new workspace context
    window.location.reload();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.workspace-selector')) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="workspace-selector relative w-full md:w-auto">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors w-full md:min-w-[200px]"
      >
        {activeWorkspaceDetails?.type === 'personal' ? (
          <User size={18} className="text-primary-600" />
        ) : (
          <Users size={18} className="text-primary-600" />
        )}
        <span className="flex-1 text-left font-medium text-gray-900 truncate text-sm sm:text-base">
          {activeWorkspaceDetails?.name || 'Select Workspace'}
        </span>
        <ChevronDown size={18} className={`text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full md:min-w-[280px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {/* Personal Workspace */}
            <button
              onClick={() => handleWorkspaceSwitch(null)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                activeWorkspace === null ? 'bg-primary-50' : ''
              }`}
            >
              <User size={18} className="text-primary-600" />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900">Personal Workspace</div>
                <div className="text-xs text-gray-500">Your private workspace</div>
              </div>
              {activeWorkspace === null && (
                <Check size={18} className="text-primary-600" />
              )}
            </button>

            {/* Team Workspaces */}
            {workspaces.filter(w => w.type === 'team').length > 0 && (
              <>
                <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
                  <span className="text-xs font-semibold text-gray-700 uppercase">Teams</span>
                </div>
                {workspaces
                  .filter(workspace => workspace.type === 'team')
                  .map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => handleWorkspaceSwitch(workspace.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                        activeWorkspace === workspace.id ? 'bg-primary-50' : ''
                      }`}
                    >
                      <Users size={18} className="text-primary-600" />
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">{workspace.name}</div>
                        <div className="text-xs text-gray-500">
                          Role: <span className="capitalize">{workspace.role?.replace('_', ' ')}</span>
                        </div>
                      </div>
                      {activeWorkspace === workspace.id && (
                        <Check size={18} className="text-primary-600" />
                      )}
                    </button>
                  ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSelector;
