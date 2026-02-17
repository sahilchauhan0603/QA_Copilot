/**
 * TestGeneration Component (Orchestrator)
 * Main container that manages state and coordinates sub-components:
 *   - StatisticsCards, GenerationProgress, CustomInputTab,
 *   - IntegrationTab, GenerationHistory, DetailViewModal
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { testGenAPI, integrationAPI } from '../../services/api';

import StatisticsCards from './StatisticsCards';
import GenerationProgress from './GenerationProgress';
import CustomInputTab from './CustomInputTab';
import IntegrationTab from './IntegrationTab';
import GenerationHistory from './GenerationHistory';
import DetailViewModal from './DetailViewModal';

const TestGeneration = () => {
  // ──── Shared State ────
  const [generations, setGenerations] = useState([]);
  const [filteredGenerations, setFilteredGenerations] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [activeTab, setActiveTab] = useState('custom');

  // ──── History Filters ────
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  // ──── Generation Progress ────
  const [generationProgress, setGenerationProgress] = useState({
    progress: 0,
    currentLabel: '',
    steps: {},
  });

  // ──── Integration Config ────
  const [integrationConfigs, setIntegrationConfigs] = useState([]);

  // ──── Delete Confirmation ────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [generationToDelete, setGenerationToDelete] = useState(null);

  // ──── Cancellation ────
  const [currentCancelFn, setCurrentCancelFn] = useState(null);

  // ──── Filters ────
  const applyFilters = useCallback(() => {
    let filtered = [...generations];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.ticket_id?.toLowerCase().includes(q) ||
          g.ticket_title?.toLowerCase().includes(q)
      );
    }
    if (filterType !== 'all') {
      filtered = filtered.filter((g) => g.ticket_type === filterType);
    }
    setFilteredGenerations(filtered);
  }, [generations, searchQuery, filterType]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // ──── Data Loaders ────
  const loadGenerations = useCallback(async () => {
    try {
      const data = await testGenAPI.getGenerations();
      setGenerations(data.generations || []);
    } catch {
      // toast handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStatistics = useCallback(async () => {
    try {
      const data = await testGenAPI.getStatistics();
      setStatistics(data);
    } catch {
      // silent
    }
  }, []);

  const loadIntegrationConfigs = useCallback(async () => {
    try {
      const data = await integrationAPI.getConfigs();
      setIntegrationConfigs(data.integrations || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadGenerations();
    loadStatistics();
    loadIntegrationConfigs();
  }, [loadGenerations, loadStatistics, loadIntegrationConfigs]);

  // Expose refresh function for refine agent
  useEffect(() => {
    window.refreshGenerations = () => {
      loadGenerations();
      loadStatistics();
    };
    return () => {
      delete window.refreshGenerations;
    };
  }, [loadGenerations, loadStatistics]);

  // ──── Progress Handling ────
  const handleProgressUpdate = (data) => {
    if (data.type === 'complete') {
      setGenerationProgress({ progress: 100, currentLabel: 'Complete!', steps: {} });
      return;
    }
    setGenerationProgress((prev) => ({
      progress: data.progress || prev.progress,
      currentLabel: data.label || prev.currentLabel,
      steps: {
        ...prev.steps,
        [data.agent]: { status: data.status, label: data.label },
      },
    }));
  };

  const resetProgress = () => {
    setGenerationProgress({ progress: 0, currentLabel: '', steps: {} });
  };

  // ──── Generate Test Cases (shared by both tabs) ────
  const handleGenerate = async (ticketData) => {
    setGenerating(true);
    // Initialize progress immediately for visibility
    setGenerationProgress({ progress: 5, currentLabel: 'Starting generation...', steps: {} });
    
    try {
      const { promise, cancel } = testGenAPI.generate(ticketData, handleProgressUpdate);
      setCurrentCancelFn(() => cancel);
      await promise;
      
      // Show completion state before closing
      setGenerationProgress({ progress: 100, currentLabel: 'Generation complete!', steps: {} });
      toast.success('Test cases generated successfully!', { duration: 3000 });
      
      // Delay before closing form to show success
      await new Promise(resolve => setTimeout(resolve, 1500));
      setShowNewForm(false);
      
      await loadGenerations();
      await loadStatistics();
    } catch (err) {
      if (!err.message?.includes('cancelled')) {
        toast.error('Test generation failed. Please try again.');
      }
    } finally {
      setGenerating(false);
      setCurrentCancelFn(null);
      setTimeout(resetProgress, 500);
    }
  };

  const handleCancelGeneration = async () => {
    if (currentCancelFn) {
      try {
        await currentCancelFn();
        toast.success('Generation cancelled');
      } catch (err) {
        toast.error('Failed to cancel');
      }
    }
  };

  // ──── Shared Actions ────
  const viewGeneration = async (id) => {
    try {
      const data = await testGenAPI.getGeneration(id);
      setSelectedGeneration(data);
      setShowDetails(true);
    } catch {
      toast.error('Failed to load generation details');
    }
  };

  const downloadExcel = async (id) => {
    try {
      const response = await testGenAPI.downloadExcel(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const disposition = response.headers['content-disposition'];
      const filename = disposition
        ? disposition.split('filename=')[1]?.replace(/"/g, '')
        : `test_cases_${id}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch {
      toast.error('Download failed');
    }
  };

  const deleteGeneration = (id) => {
    const gen = generations.find(g => g.id === id);
    setGenerationToDelete(gen || { id, ticket_id: 'Unknown' });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!generationToDelete) return;
    try {
      await testGenAPI.deleteGeneration(generationToDelete.id);
      toast.success('Generation deleted');
      await loadGenerations();
      await loadStatistics();
    } catch {
      toast.error('Delete failed');
    } finally {
      setShowDeleteConfirm(false);
      setGenerationToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Statistics ─── */}
      <StatisticsCards statistics={statistics} />

      {/* ─── Generation Progress ─── */}
      {generating && <GenerationProgress generationProgress={generationProgress} onCancel={handleCancelGeneration} />}

      {/* ─── New Generation Form ─── */}
      {!showNewForm ? (
        <button
          onClick={() => setShowNewForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          New Generation
        </button>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold">New Test Generation</h3>
            <button
              onClick={() => setShowNewForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5">
            <button
              onClick={() => setActiveTab('custom')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'custom'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Custom Input
            </button>
            <button
              onClick={() => setActiveTab('integration')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'integration'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Live Integration
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'custom' && (
            <CustomInputTab onGenerate={handleGenerate} generating={generating} />
          )}
          {activeTab === 'integration' && (
            <IntegrationTab
              integrationConfigs={integrationConfigs}
              onGenerate={handleGenerate}
              generating={generating}
            />
          )}
        </div>
      )}

      {/* ─── Generation History ─── */}
      <GenerationHistory
        generations={generations}
        filteredGenerations={filteredGenerations}
        loading={loading}
        showDetails={showDetails}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterType={filterType}
        setFilterType={setFilterType}
        onView={viewGeneration}
        onDownload={downloadExcel}
        onDelete={deleteGeneration}
      />

      {/* ─── Detail Modal ─── */}
      {showDetails && selectedGeneration && (
        <DetailViewModal
          selectedGeneration={selectedGeneration}
          onClose={() => setShowDetails(false)}
          onDownloadExcel={() => downloadExcel(selectedGeneration.generation.id)}
          integrationConfigs={integrationConfigs}
        />
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {showDeleteConfirm && generationToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
              </div>
              
              <p className="text-gray-600 mb-2">
                Are you sure you want to delete this test generation?
              </p>
              <div className="bg-gray-50 rounded-md p-3 mb-4">
                <p className="text-sm font-medium text-gray-900">Ticket: {generationToDelete.ticket_id}</p>
                {generationToDelete.ticket_title && (
                  <p className="text-sm text-gray-600 mt-1">{generationToDelete.ticket_title}</p>
                )}
              </div>
              <p className="text-sm text-red-600 font-medium">
                This action cannot be undone.
              </p>
            </div>
            
            <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setGenerationToDelete(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete Generation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestGeneration;
