/**
 * ExportMenu Component
 * Dropdown menu + dialog for exporting to Xray, Zephyr Scale, TestRail
 */
import { useState } from 'react';
import { UploadCloud, Loader } from 'lucide-react';
import { testManagementAPI } from '../../services/api';
import toast from 'react-hot-toast';

const ExportMenu = ({ generationId, ticketId }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [exportSuiteName, setExportSuiteName] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);

  const handleExport = (tool) => {
    if (tool === 'testrail' || !exportSuiteName) {
      setSelectedTool(tool);
      setShowDialog(true);
      setShowMenu(false);
      return;
    }
    performExport(tool, exportSuiteName);
  };

  const performExport = async (tool, suiteName) => {
    setExporting(tool);
    setShowMenu(false);
    setShowDialog(false);
    try {
      let result;
      if (tool === 'xray') {
        result = await testManagementAPI.exportToXray(generationId, suiteName || null, ticketId || null);
        toast.success(`Exported ${result.result.created} test cases to Xray`);
      } else if (tool === 'zephyr') {
        result = await testManagementAPI.exportToZephyr(generationId, suiteName || null, ticketId || null);
        toast.success(`Exported ${result.result.created} test cases to Zephyr Scale`);
      } else if (tool === 'testrail') {
        if (!suiteName) {
          toast.error('Suite name is required for TestRail');
          return;
        }
        result = await testManagementAPI.exportToTestRail(generationId, suiteName, ticketId || null);
        toast.success(`Exported ${result.result.created} test cases to TestRail`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || `Export failed: ${err.message}`);
    } finally {
      setExporting(null);
      setExportSuiteName('');
      setSelectedTool(null);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          disabled={!!exporting}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          {exporting ? <Loader size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          Export to Test Tool
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-30">
              <button
                onClick={() => handleExport('xray')}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 flex items-center gap-3 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <span className="text-purple-600 font-bold text-xs">X</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Xray for Jira</div>
                  <div className="text-xs text-gray-500">Export as Xray test set</div>
                </div>
              </button>
              <button
                onClick={() => handleExport('zephyr')}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center gap-3 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-xs">Z</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Zephyr Scale</div>
                  <div className="text-xs text-gray-500">Export as test cycle</div>
                </div>
              </button>
              <button
                onClick={() => handleExport('testrail')}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 flex items-center gap-3 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <span className="text-green-600 font-bold text-xs">T</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">TestRail</div>
                  <div className="text-xs text-gray-500">Export as test suite</div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Export Dialog */}
      {showDialog && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-xl">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h4 className="text-lg font-bold text-gray-900 mb-4">
              Export to {selectedTool === 'xray' ? 'Xray' : selectedTool === 'zephyr' ? 'Zephyr Scale' : 'TestRail'}
            </h4>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {selectedTool === 'zephyr' ? 'Test Cycle Name' : 'Test Suite Name'}
                {selectedTool === 'testrail' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={exportSuiteName}
                onChange={(e) => setExportSuiteName(e.target.value)}
                placeholder={`Enter ${selectedTool === 'zephyr' ? 'cycle' : 'suite'} name...`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500">
                {selectedTool === 'testrail'
                  ? 'Suite name is required for TestRail exports'
                  : 'Optional. If not provided, a default name will be generated'}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDialog(false);
                  setExportSuiteName('');
                  setSelectedTool(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => performExport(selectedTool, exportSuiteName)}
                disabled={selectedTool === 'testrail' && !exportSuiteName.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExportMenu;
