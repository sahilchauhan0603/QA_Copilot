/**
 * SyncMenu Component
 * Dropdown menu for syncing test results to Jira/Azure DevOps tickets
 *
 * The trigger button stays disabled (muted) while a sync is active.
 * Status + cancel are delegated to the footer via OperationStatusBadge.
 */
import { useState } from 'react';
import {
  Send,
  RefreshCw,
  Paperclip,
  MessageSquare,
} from 'lucide-react';

const SyncMenu = ({ 
  sourceIntegration, 
  integrationLabel, 
  canSync, 
  syncing, 
  onSync,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  if (!canSync) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={!!syncing}
        className={`flex items-center gap-2 px-3 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm ${
          syncing
            ? 'bg-blue-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        <Send size={16} />
        Sync to {integrationLabel}
      </button>
      {showMenu && !syncing && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-30">
            <button
              onClick={() => { onSync('full'); setShowMenu(false); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center gap-3 transition-colors"
            >
              <RefreshCw size={15} className="text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">Full Sync</div>
                <div className="text-xs text-gray-500">Excel + Comment</div>
              </div>
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => { onSync('attach'); setShowMenu(false); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 flex items-center gap-3 transition-colors"
            >
              <Paperclip size={15} className="text-green-600" />
              <div>
                <div className="font-medium text-gray-900">Attach Excel</div>
                <div className="text-xs text-gray-500">Upload Excel file to ticket</div>
              </div>
            </button>
            <button
              onClick={() => { onSync('comment'); setShowMenu(false); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 flex items-center gap-3 transition-colors"
            >
              <MessageSquare size={15} className="text-purple-600" />
              <div>
                <div className="font-medium text-gray-900">Add Comment</div>
                <div className="text-xs text-gray-500">Post test summary to ticket</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SyncMenu;
