/**
 * RefineMenu Component
 * Dropdown menu + dialog for refining test generation results
 */
import { useState, useRef } from 'react';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  Target,
  ShieldAlert,
  ListChecks,
  FileText,
  Loader,
  XCircle,
  Settings,
} from 'lucide-react';
import { testGenAPI } from '../../services/api';
import toast from 'react-hot-toast';

const RefineMenu = ({ generationId, onClose }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [refinementType, setRefinementType] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [refining, setRefining] = useState(false);
  const cancelFnRef = useRef(null);

  const handleRefineClick = (type) => {
    setRefinementType(type);
    setShowMenu(false);

    if (type === 'focus') {
      setShowDialog(true);
    } else {
      performRefinement(type);
    }
  };

  const performRefinement = async (type, options = {}) => {
    setRefining(true);
    setShowDialog(false);

    try {
      let result;

      if (type === 'regenerate') {
        const { promise, cancel } = testGenAPI.refine(generationId, type, options, (progressData) => {
          if (progressData.type === 'step') {
            toast(`${progressData.label} - ${progressData.status}`, {
              icon: '\u2699\uFE0F',
              duration: 1500,
            });
          }
        });
        cancelFnRef.current = cancel;
        result = await promise;
        toast.success('Test cases regenerated successfully!');
      } else {
        result = await testGenAPI.refine(generationId, type, options);

        const messages = {
          minimize: 'Test cases minimized successfully!',
          focus: `Added focused test cases for: ${options.focus_area}`,
          edge_cases: 'Added edge case scenarios!',
          coverage: 'Added coverage tests for identified gaps!',
          simplify: 'Test cases simplified!',
        };

        toast.success(messages[type] || 'Test cases refined successfully!');
      }

      if (result.generation) {
        toast.success(
          `Refinement complete! ${result.total_test_cases} test cases. Check history for refined version.`,
          { duration: 5000 }
        );

        setTimeout(() => {
          onClose();
          if (window.refreshGenerations) {
            window.refreshGenerations();
          }
        }, 2000);
      }
    } catch (err) {
      // Check if it's a configuration error
      const errorMsg = err.response?.data?.error || err.message || '';
      if (!err.message?.includes('cancelled')) {
        if (errorMsg.includes('not configured')) {
          // Show custom toast with settings button
          toast.error(
            (t) => (
              <div className="flex items-center gap-3">
                <span className="flex-1">{errorMsg}</span>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    window.location.href = '/settings';
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors"
                >
                  <Settings size={14} />
                  Settings
                </button>
              </div>
            ),
            { duration: 6000, id: 'config-error' }
          );
        }
        console.error('Refinement error:', err);
      }
    } finally {
      setRefining(false);
      cancelFnRef.current = null;
      setFocusArea('');
      setRefinementType('');
    }
  };

  const handleCancelRefinement = async () => {
    if (cancelFnRef.current) {
      try {
        await cancelFnRef.current();
        toast.success('Refinement cancelled');
      } catch (err) {
        toast.error('Failed to cancel');
      }
    }
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          disabled={refining}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          {refining ? <Loader size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {refining ? 'Refining...' : 'Refine Results'}
        </button>
        {refining && refinementType === 'regenerate' && (
          <button
            onClick={handleCancelRefinement}
            className="absolute -right-20 top-0 flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
            title="Cancel refinement"
          >
            <XCircle size={16} />
            Cancel
          </button>
        )}
        {showMenu && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-30">
              <button
                onClick={() => handleRefineClick('regenerate')}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 flex items-center gap-3 transition-colors"
              >
                <RefreshCw size={15} className="text-indigo-600" />
                <div>
                  <div className="font-medium text-gray-900">Regenerate Entire</div>
                  <div className="text-xs text-gray-500">Run all agents again</div>
                </div>
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => handleRefineClick('minimize')}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 flex items-center gap-3 transition-colors"
              >
                <TrendingUp size={15} className="text-amber-600 rotate-90" />
                <div>
                  <div className="font-medium text-gray-900">Minimize Test Cases</div>
                  <div className="text-xs text-gray-500">Remove redundant tests</div>
                </div>
              </button>
              <button
                onClick={() => handleRefineClick('focus')}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center gap-3 transition-colors"
              >
                <Target size={15} className="text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">Focus on Area</div>
                  <div className="text-xs text-gray-500">Add tests for specific area</div>
                </div>
              </button>
              <button
                onClick={() => handleRefineClick('edge_cases')}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 flex items-center gap-3 transition-colors"
              >
                <ShieldAlert size={15} className="text-orange-600" />
                <div>
                  <div className="font-medium text-gray-900">Add Edge Cases</div>
                  <div className="text-xs text-gray-500">Boundary & unusual scenarios</div>
                </div>
              </button>
              <button
                onClick={() => handleRefineClick('coverage')}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 flex items-center gap-3 transition-colors"
              >
                <ListChecks size={15} className="text-green-600" />
                <div>
                  <div className="font-medium text-gray-900">Increase Coverage</div>
                  <div className="text-xs text-gray-500">Address identified gaps</div>
                </div>
              </button>
              <button
                onClick={() => handleRefineClick('simplify')}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 flex items-center gap-3 transition-colors"
              >
                <FileText size={15} className="text-purple-600" />
                <div>
                  <div className="font-medium text-gray-900">Simplify Tests</div>
                  <div className="text-xs text-gray-500">Make more concise</div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Focus Area Dialog */}
      {showDialog && refinementType === 'focus' && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-xl">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h4 className="text-lg font-bold text-gray-900 mb-4">Focus on Specific Area</h4>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What area should we focus on?<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                placeholder="e.g., authentication, error handling, API integration..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500">
                The AI will generate 5-10 additional test cases focused specifically on this area
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDialog(false);
                  setFocusArea('');
                  setRefinementType('');
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => performRefinement('focus', { focus_area: focusArea })}
                disabled={!focusArea.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Generate Focused Tests
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refining status indicator (for parent to detect) */}
      {refining && (
        <span className="hidden" data-refining="true" data-type={refinementType} />
      )}
    </>
  );
};

export default RefineMenu;
