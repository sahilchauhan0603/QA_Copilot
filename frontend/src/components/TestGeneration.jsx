/**
 * Test Generation Component
 * Two-tab interface: Custom Input + Live Integration
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Download,
  Trash2,
  Eye,
  Loader,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  ListChecks,
  Plus,
  X,
  Sparkles,
  Link2,
  PenLine,
  Settings,
  UploadCloud,
  Search,
  Filter,
  Calendar,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  ShieldAlert,
  FileWarning,
  HelpCircle,
  Layers,
  Target,
  BookOpen,
  Boxes,
  GitBranch,
  ClipboardList,
  RefreshCw,
  MessageSquare,
  Send,
  Paperclip,
  ExternalLink
} from 'lucide-react';
import { testGenAPI, integrationAPI } from '../services/api';
import toast from 'react-hot-toast';

const TestGeneration = () => {
  const navigate = useNavigate();
  // ── Shared state ──
  const [generations, setGenerations] = useState([]);
  const [filteredGenerations, setFilteredGenerations] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [activeTab, setActiveTab] = useState('custom'); // 'custom' | 'integration'

  // ── History view state ──
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // ── Custom Input tab state ──
  const [customForm, setCustomForm] = useState({
    ticket_id: '',
    title: '',
    description: '',
    ticket_type: 'story',
    priority: 'P2',
    acceptance_criteria: [''],
  });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);

  // ── Generation Progress state ──
  const [generationProgress, setGenerationProgress] = useState({
    progress: 0,
    currentLabel: '',
    steps: [],  // {agent, label, status}
  });

  // ── Live Integration tab state ──
  const [integrationType, setIntegrationType] = useState('jira');
  const [integrationTicketId, setIntegrationTicketId] = useState('');
  const [fetchedTicket, setFetchedTicket] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [integrationConfigs, setIntegrationConfigs] = useState([]);

  // Load on mount
  useEffect(() => {
    loadGenerations();
    loadStatistics();
    loadIntegrationConfigs();
  }, []);

  // Apply filters whenever generations, search, or filter type changes
  useEffect(() => {
    applyFilters();
  }, [generations, searchQuery, filterType]);

  // ── Filter and search logic ──
  const applyFilters = () => {
    let filtered = [...generations];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (gen) =>
          gen.ticket_id.toLowerCase().includes(query) ||
          gen.ticket_title.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((gen) => gen.ticket_type === filterType);
    }

    setFilteredGenerations(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  // ── Data loaders ──
  const loadGenerations = async () => {
    try {
      setLoading(true);
      const data = await testGenAPI.getGenerations();
      setGenerations(data);
    } catch (err) {
      // Error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const data = await testGenAPI.getStatistics();
      setStatistics(data);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  const loadIntegrationConfigs = async () => {
    try {
      const data = await integrationAPI.getConfigs();
      setIntegrationConfigs(data.integrations || []);
    } catch (err) {
      console.error('Failed to load integration configs:', err);
    }
  };

  // ── Helpers ──
  const isIntegrationConfigured = (type) => {
    return integrationConfigs.some((c) => c.integration_type === type && c.configured);
  };

  // ── Custom Input handlers ──
  const handleCustomChange = (e) => {
    const { name, value } = e.target;
    setCustomForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'title') {
      setAiGenerated(false);
    }
  };

  const handleACChange = (index, value) => {
    const updated = [...customForm.acceptance_criteria];
    updated[index] = value;
    setCustomForm((prev) => ({ ...prev, acceptance_criteria: updated }));
  };

  const addAC = () => {
    setCustomForm((prev) => ({
      ...prev,
      acceptance_criteria: [...prev.acceptance_criteria, ''],
    }));
  };

  const removeAC = (index) => {
    const updated = customForm.acceptance_criteria.filter((_, i) => i !== index);
    setCustomForm((prev) => ({
      ...prev,
      acceptance_criteria: updated.length > 0 ? updated : [''],
    }));
  };

  const handleAIGenerate = async () => {
    if (!customForm.title.trim()) {
      toast.error('Please enter a title first');
      return;
    }

    setAiGenerating(true);
    try {
      const result = await testGenAPI.aiDescribe(
        customForm.title,
        customForm.ticket_type,
        customForm.priority
      );

      setCustomForm((prev) => ({
        ...prev,
        description: result.description || prev.description,
        acceptance_criteria:
          result.acceptance_criteria?.length > 0
            ? result.acceptance_criteria
            : prev.acceptance_criteria,
      }));
      setAiGenerated(true);
      toast.success('AI generated description & acceptance criteria');
    } catch (err) {
      toast.error('AI generation failed. You can enter the details manually.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleProgressUpdate = (data) => {
    setGenerationProgress(prev => {
      const newSteps = [...prev.steps];
      
      if (data.type === 'step') {
        // Update or add step
        const existingIdx = newSteps.findIndex(s => s.agent === data.agent && s.status === data.status);
        if (existingIdx === -1) {
          newSteps.push({ agent: data.agent, label: data.label, status: data.status });
        }
        return {
          progress: data.progress || prev.progress,
          currentLabel: data.label || prev.currentLabel,
          steps: newSteps,
        };
      }
      
      if (data.type === 'complete') {
        return { progress: 100, currentLabel: 'Complete!', steps: newSteps };
      }
      
      return prev;
    });
  };

  const resetProgress = () => {
    setGenerationProgress({ progress: 0, currentLabel: '', steps: [] });
  };

  const handleCustomGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    resetProgress();

    try {
      const cleanedData = {
        ...customForm,
        acceptance_criteria: customForm.acceptance_criteria.filter((ac) => ac.trim() !== ''),
      };

      const result = await testGenAPI.generate(cleanedData, handleProgressUpdate);
      toast.success(`Generated ${result.total_test_cases} test cases!`);

      setCustomForm({
        ticket_id: '',
        title: '',
        description: '',
        ticket_type: 'story',
        priority: 'P2',
        acceptance_criteria: [''],
      });
      setAiGenerated(false);
      setShowNewForm(false);

      loadGenerations();
      loadStatistics();

      setTimeout(() => viewGeneration(result.generation_id), 800);
    } catch (err) {
      toast.error(err.message || 'Test generation failed');
    } finally {
      setGenerating(false);
      setTimeout(resetProgress, 1000);
    }
  };

  // ── Integration handlers ──
  const handleFetchTicket = async () => {
    if (!integrationTicketId.trim()) {
      toast.error('Please enter a ticket ID');
      return;
    }

    if (!isIntegrationConfigured(integrationType)) {
      toast.error(`${integrationType === 'jira' ? 'Jira' : 'Azure DevOps'} is not configured. Please configure it in Settings.`);
      navigate('/settings');
      return;
    }

    setFetching(true);
    setFetchedTicket(null);

    try {
      const result = await integrationAPI.fetchTicket(integrationType, integrationTicketId);
      setFetchedTicket(result.ticket);
      toast.success('Ticket fetched successfully');
    } catch (err) {
      // Error handled by interceptor
    } finally {
      setFetching(false);
    }
  };

  const handleIntegrationGenerate = async () => {
    if (!fetchedTicket) return;

    setGenerating(true);
    resetProgress();
    try {
      const ticketData = {
        ticket_id: fetchedTicket.ticket_id || integrationTicketId,
        title: fetchedTicket.title || '',
        description: fetchedTicket.description || '',
        ticket_type: fetchedTicket.ticket_type || 'story',
        priority: fetchedTicket.priority || 'P2',
        acceptance_criteria: fetchedTicket.acceptance_criteria || [],
        comments: fetchedTicket.comments || [],
        linked_tickets: fetchedTicket.linked_tickets || [],
        integration_type: integrationType,  // Track source integration
      };

      const result = await testGenAPI.generate(ticketData, handleProgressUpdate);
      toast.success(`Generated ${result.total_test_cases} test cases!`);

      setFetchedTicket(null);
      setIntegrationTicketId('');
      setShowNewForm(false);

      loadGenerations();
      loadStatistics();

      setTimeout(() => viewGeneration(result.generation_id), 800);
    } catch (err) {
      toast.error(err.message || 'Test generation failed');
    } finally {
      setGenerating(false);
      setTimeout(resetProgress, 1000);
    }
  };

  // ── Shared generation actions ──
  const viewGeneration = async (generationId) => {
    try {
      setLoading(true);
      const data = await testGenAPI.getGeneration(generationId);
      setSelectedGeneration(data);
      setShowDetails(true);
    } catch (err) {
      // Error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async (generationId) => {
    try {
      const response = await testGenAPI.downloadExcel(generationId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `test_cases_${generationId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel downloaded');
    } catch (err) {
      // Error handled by interceptor
    }
  };

  const deleteGeneration = async (generationId) => {
    if (!confirm('Are you sure you want to delete this generation?')) return;
    try {
      await testGenAPI.deleteGeneration(generationId);
      toast.success('Generation deleted');
      loadGenerations();
      loadStatistics();
      if (selectedGeneration?.generation?.id === generationId) {
        setShowDetails(false);
        setSelectedGeneration(null);
      }
    } catch (err) {
      // Error handled by interceptor
    }
  };

  // ════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={() => {
            setShowNewForm(!showNewForm);
            setFetchedTicket(null);
            setAiGenerated(false);
          }}
          className="btn-primary flex items-center gap-2"
        >
          {showNewForm ? <X size={20} /> : <Plus size={20} />}
          {showNewForm ? 'Cancel' : 'New Generation'}
        </button>
      </div>

      {/* ── Statistics Cards ── */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-lg">
                <FileText size={24} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-900">
                  {statistics.total_generations || 0}
                </div>
                <div className="text-sm text-blue-700">Total Generations</div>
              </div>
            </div>
          </div>
          <div className="card bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-600 rounded-lg">
                <ListChecks size={24} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-900">
                  {statistics.total_test_cases || 0}
                </div>
                <div className="text-sm text-green-700">Total Test Cases</div>
              </div>
            </div>
          </div>
          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-600 rounded-lg">
                <TrendingUp size={24} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-900">
                  {statistics.total_test_cases && statistics.total_generations
                    ? Math.round(statistics.total_test_cases / statistics.total_generations)
                    : 0}
                </div>
                <div className="text-sm text-purple-700">Avg Tests/Generation</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  NEW GENERATION FORM WITH TABS               */}
      {/* ════════════════════════════════════════════ */}
      {showNewForm && (
        <div className="card">
          {/* ── Generation Progress Bar ── */}
          {generating && (
            <div className="mb-6 p-5 bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border border-primary-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Loader size={18} className="animate-spin text-primary-600" />
                  <span className="font-semibold text-primary-900">
                    {generationProgress.currentLabel || 'Starting generation...'}
                  </span>
                </div>
                <span className="text-sm font-medium text-primary-700">
                  {generationProgress.progress}%
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-primary-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-blue-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(generationProgress.progress, 2)}%` }}
                />
              </div>
              
              {/* Agent steps */}
              <div className="mt-4 grid grid-cols-5 gap-1">
                {[
                  { agent: 'ticket_reader', label: 'Read Ticket' },
                  { agent: 'context_builder', label: 'Build Context' },
                  { agent: 'test_strategy', label: 'Plan Strategy' },
                  { agent: 'test_generator', label: 'Generate Tests' },
                  { agent: 'coverage_auditor', label: 'Audit Coverage' },
                ].map((step, idx) => {
                  const isCompleted = generationProgress.steps.some(
                    s => s.agent === step.agent && s.status === 'completed'
                  );
                  const isActive = generationProgress.currentLabel
                    && !isCompleted
                    && generationProgress.steps.some(s => s.agent === step.agent);
                  
                  return (
                    <div key={step.agent} className="flex flex-col items-center text-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-all duration-300 ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                            ? 'bg-primary-500 text-white animate-pulse'
                            : 'bg-gray-200 text-gray-500'
                      }`}>
                        {isCompleted ? '✓' : idx + 1}
                      </div>
                      <span className={`text-[10px] leading-tight ${
                        isCompleted ? 'text-green-700 font-medium' : isActive ? 'text-primary-700 font-medium' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Tab Switcher */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('custom')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'custom'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <PenLine size={18} />
              Custom Input
            </button>
            <button
              onClick={() => setActiveTab('integration')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'integration'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Link2 size={18} />
              Live Integration
            </button>
          </div>

          {/* ──────────────────── CUSTOM INPUT TAB ──────────────────── */}
          {activeTab === 'custom' && (
            <form onSubmit={handleCustomGenerate} className="space-y-5">
              {/* Row 1: Ticket ID + Type + Priority */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="input-label">
                    Ticket ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="ticket_id"
                    value={customForm.ticket_id}
                    onChange={handleCustomChange}
                    required
                    className="input"
                    placeholder="e.g., PROJ-123"
                  />
                </div>
                <div>
                  <label className="input-label">Type</label>
                  <select
                    name="ticket_type"
                    value={customForm.ticket_type}
                    onChange={handleCustomChange}
                    className="select"
                  >
                    <option value="story">Story</option>
                    <option value="bug">Bug</option>
                    <option value="task">Task</option>
                    <option value="feature">Feature</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Priority</label>
                  <select
                    name="priority"
                    value={customForm.priority}
                    onChange={handleCustomChange}
                    className="select"
                  >
                    <option value="P0">P0 - Critical</option>
                    <option value="P1">P1 - High</option>
                    <option value="P2">P2 - Medium</option>
                    <option value="P3">P3 - Low</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Title + AI Button */}
              <div>
                <label className="input-label">
                  Title <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="title"
                    value={customForm.title}
                    onChange={handleCustomChange}
                    required
                    className="input flex-1"
                    placeholder="Enter ticket title to enable AI generation"
                  />
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={!customForm.title.trim() || aiGenerating}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      customForm.title.trim() && !aiGenerating
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {aiGenerating ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        AI Generate
                      </>
                    )}
                  </button>
                </div>
                {!aiGenerated && customForm.title.trim() && (
                  <p className="input-hint">
                    Click &quot;AI Generate&quot; to auto-fill description & acceptance criteria from the title
                  </p>
                )}
                {aiGenerated && (
                  <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                    <CheckCircle size={12} />
                    AI-generated content below — feel free to edit
                  </p>
                )}
              </div>

              {/* Row 3: Description */}
              <div>
                <label className="input-label">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={customForm.description}
                  onChange={handleCustomChange}
                  required
                  rows={5}
                  className="textarea"
                  placeholder={
                    aiGenerated
                      ? ''
                      : 'Enter description manually or use AI Generate above...'
                  }
                />
              </div>

              {/* Row 4: Acceptance Criteria */}
              <div>
                <label className="input-label">
                  Acceptance Criteria
                </label>
                <div className="space-y-2">
                  {customForm.acceptance_criteria.map((ac, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="flex items-center justify-center w-6 h-10 text-xs text-gray-400 font-mono">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        value={ac}
                        onChange={(e) => handleACChange(index, e.target.value)}
                        className="input flex-1"
                        placeholder={`Acceptance criteria ${index + 1}`}
                      />
                      {customForm.acceptance_criteria.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAC(index)}
                          className="text-gray-400 hover:text-red-500 transition-colors px-2"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addAC} className="btn-secondary text-sm">
                    + Add Criteria
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={generating}
                  className="btn-primary flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Generating Test Cases...
                    </>
                  ) : (
                    <>
                      <FileText size={16} />
                      Generate Test Cases
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* ──────────────────── LIVE INTEGRATION TAB ──────────────────── */}
          {activeTab === 'integration' && (
            <div className="space-y-5">
              {/* Integration type selector */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIntegrationType('jira');
                    setFetchedTicket(null);
                  }}
                  className={`flex items-center gap-3 px-5 py-3 rounded-lg border-2 transition-all flex-1 ${
                    integrationType === 'jira'
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                    J
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Jira</div>
                    <div className="text-xs text-gray-500">
                      {isIntegrationConfigured('jira') ? (
                        <span className="text-green-600">Configured</span>
                      ) : (
                        'Not configured'
                      )}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIntegrationType('azure_devops');
                    setFetchedTicket(null);
                  }}
                  className={`flex items-center gap-3 px-5 py-3 rounded-lg border-2 transition-all flex-1 ${
                    integrationType === 'azure_devops'
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded bg-sky-600 flex items-center justify-center text-white font-bold text-sm">
                    A
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Azure DevOps</div>
                    <div className="text-xs text-gray-500">
                      {isIntegrationConfigured('azure_devops') ? (
                        <span className="text-green-600">Configured</span>
                      ) : (
                        'Not configured'
                      )}
                    </div>
                  </div>
                </button>
              </div>

              {/* Configuration required banner */}
              {!isIntegrationConfigured(integrationType) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">
                      {integrationType === 'jira' ? 'Jira' : 'Azure DevOps'} is not configured
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Set up your credentials in the Settings page to fetch tickets directly.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/settings')}
                    className="btn-primary text-sm flex items-center gap-1"
                  >
                    <Settings size={14} />
                    Go to Settings
                  </button>
                </div>
              )}

              {/* Ticket Fetch */}
              <div>
                <label className="input-label">
                  Ticket ID
                </label>
                <form onSubmit={(e) => { e.preventDefault(); handleFetchTicket(); }} className="flex gap-2">
                  <input
                    type="text"
                    value={integrationTicketId}
                    onChange={(e) => setIntegrationTicketId(e.target.value)}
                    className="input flex-1"
                    placeholder={
                      integrationType === 'jira' ? 'e.g., PROJ-123' : 'e.g., 12345'
                    }
                    required
                  />
                  <button
                    type="submit"
                    disabled={fetching}
                    className="btn-primary flex items-center gap-2 cursor-pointer"
                  >
                    {fetching ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <UploadCloud size={16} />
                        Fetch Ticket
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Fetched Ticket Preview */}
              {fetchedTicket && (
                <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                          {fetchedTicket.ticket_id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            fetchedTicket.priority === 'P0'
                              ? 'bg-red-100 text-red-800'
                              : fetchedTicket.priority === 'P1'
                                ? 'bg-orange-100 text-orange-800'
                                : fetchedTicket.priority === 'P2'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {fetchedTicket.priority || 'P2'}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {fetchedTicket.ticket_type || 'story'}
                        </span>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {fetchedTicket.title}
                      </h4>
                    </div>
                    <button
                      onClick={() => setFetchedTicket(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {fetchedTicket.description && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Description
                      </label>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                        {fetchedTicket.description}
                      </p>
                    </div>
                  )}

                  {fetchedTicket.acceptance_criteria?.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Acceptance Criteria
                      </label>
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 bg-gray-50 p-3 rounded-lg">
                        {fetchedTicket.acceptance_criteria.map((ac, i) => (
                          <li key={i}>{ac}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {fetchedTicket.comments?.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Comments ({fetchedTicket.comments.length})
                      </label>
                      <div className="space-y-2 bg-gray-50 p-3 rounded-lg max-h-32 overflow-y-auto">
                        {fetchedTicket.comments.map((comment, i) => (
                          <div key={i} className="text-sm text-gray-600">
                            <span className="font-medium text-gray-700">{comment.author || 'Unknown'}</span>
                            <span className="text-gray-400 text-xs ml-2">{comment.created ? new Date(comment.created).toLocaleDateString() : ''}</span>
                            <p className="mt-0.5">{comment.body || (typeof comment === 'string' ? comment : JSON.stringify(comment))}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-gray-100">
                    <button
                      onClick={handleIntegrationGenerate}
                      disabled={generating}
                      className="btn-primary flex items-center gap-2"
                    >
                      {generating ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          Generating Test Cases...
                        </>
                      ) : (
                        <>
                          <FileText size={16} />
                          Generate Test Cases
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  GENERATIONS HISTORY WITH FILTERS            */}
      {/* ════════════════════════════════════════════ */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h3 className="text-lg font-semibold">Generation History</h3>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid size={16} className="inline mr-1" />
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List size={16} className="inline mr-1" />
              Table
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search Box */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ticket ID or title..."
              className="input pl-10"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="select w-full sm:w-auto"
          >
            <option value="all">All Types</option>
            <option value="story">Story</option>
            <option value="bug">Bug</option>
            <option value="task">Task</option>
            <option value="feature">Feature</option>
          </select>
        </div>

        {loading && !showDetails ? (
          <div className="flex items-center justify-center py-12">
            <Loader size={32} className="animate-spin text-primary-600" />
          </div>
        ) : filteredGenerations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText size={48} className="mx-auto mb-3 opacity-50" />
            {searchQuery || filterType !== 'all' ? (
              <>
                <div>No generations match your filters</div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('all');
                  }}
                  className="text-primary-600 hover:text-primary-700 text-sm mt-2"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <div>No test generations yet</div>
                <div className="text-sm">Click &quot;New Generation&quot; to create your first test suite</div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="text-sm text-gray-500 mb-4">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredGenerations.length)}-
              {Math.min(currentPage * itemsPerPage, filteredGenerations.length)} of {filteredGenerations.length} generation{filteredGenerations.length !== 1 ? 's' : ''}
            </div>

            {/* Cards View */}
            {viewMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {filteredGenerations
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((gen) => (
                    <div
                      key={gen.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-mono font-semibold text-primary-600">
                              {gen.ticket_id}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {gen.ticket_type || 'story'}
                            </span>
                          </div>
                          <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
                            {gen.ticket_title}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                        <div className="flex items-center gap-1">
                          <ListChecks size={14} />
                          <span>{gen.total_test_cases} tests</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>{new Date(gen.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => viewGeneration(gen.id)}
                          className="btn-primary text-xs flex-1 flex items-center justify-center gap-1"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        {gen.excel_file_path && (
                          <button
                            onClick={() => downloadExcel(gen.id)}
                            className="btn-secondary text-xs px-3"
                            title="Download Excel"
                          >
                            <Download size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteGeneration(gen.id)}
                          className="btn-secondary text-red-600 hover:text-red-700 text-xs px-3"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              /* Table View */
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ticket
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Test Cases
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredGenerations
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((gen) => (
                        <tr key={gen.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {gen.ticket_id}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                            {gen.ticket_title}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                              {gen.ticket_type || 'story'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{gen.total_test_cases}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(gen.timestamp).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => viewGeneration(gen.id)}
                                className="text-blue-600 hover:text-blue-800"
                                title="View Details"
                              >
                                <Eye size={16} />
                              </button>
                              {gen.excel_file_path && (
                                <button
                                  onClick={() => downloadExcel(gen.id)}
                                  className="text-green-600 hover:text-green-800"
                                  title="Download Excel"
                                >
                                  <Download size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => deleteGeneration(gen.id)}
                                className="text-red-600 hover:text-red-800"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {filteredGenerations.length > itemsPerPage && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="text-sm text-gray-500">
                  Page {currentPage} of {Math.ceil(filteredGenerations.length / itemsPerPage)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} className="inline" />
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredGenerations.length / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(filteredGenerations.length / itemsPerPage)}
                    className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight size={16} className="inline" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════ */}
      {/*  GENERATION DETAILS MODAL                    */}
      {/* ════════════════════════════════════════════ */}
      {showDetails && selectedGeneration && (
        <DetailViewModal
          selectedGeneration={selectedGeneration}
          onClose={() => setShowDetails(false)}
          onDownloadExcel={() => downloadExcel(selectedGeneration.generation.id)}
          integrationConfigs={integrationConfigs}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   ACCORDION SECTION COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const AccordionSection = ({ icon: Icon, title, count, color = 'blue', defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-300',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  };
  const badgeColorMap = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    purple: 'bg-purple-100 text-purple-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    orange: 'bg-orange-100 text-orange-800',
    teal: 'bg-teal-100 text-teal-800',
    cyan: 'bg-cyan-100 text-cyan-800',
    slate: 'bg-slate-100 text-slate-800',
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${isOpen ? colorMap[color] : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
          isOpen ? '' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className={isOpen ? '' : 'text-gray-500'} />
          <span className={`font-semibold text-sm ${isOpen ? '' : 'text-gray-800'}`}>{title}</span>
          {count !== undefined && count !== null && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isOpen ? badgeColorMap[color] : 'bg-gray-100 text-gray-600'}`}>
              {count}
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   DETAIL VIEW MODAL COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const DetailViewModal = ({ selectedGeneration, onClose, onDownloadExcel, integrationConfigs = [] }) => {
  const gen = selectedGeneration.generation;
  const testCases = selectedGeneration.test_cases || [];
  const coverageGaps = selectedGeneration.coverage_gaps || [];
  const qaRoadmap = selectedGeneration.qa_roadmap || {};
  const clarificationQuestions = selectedGeneration.clarification_questions || [];
  const riskAreas = selectedGeneration.risk_areas || [];
  const extractedRequirements = selectedGeneration.extracted_requirements || [];
  const acceptanceCriteriaGaps = selectedGeneration.acceptance_criteria_gaps || [];
  const impactedModules = selectedGeneration.impacted_modules || [];
  const dependencies = selectedGeneration.dependencies || [];

  // Source integration from metadata
  const sourceIntegration = selectedGeneration.source_integration || 
    gen?.generation_metadata?.source_integration || null;

  // Check if we can sync (integration is configured)
  const canSync = sourceIntegration && integrationConfigs.some(
    (c) => c.integration_type === sourceIntegration && c.configured
  );

  // Sync state
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const [syncing, setSyncing] = useState(null); // 'attach' | 'comment' | 'full' | null

  const handleSync = async (action) => {
    if (!sourceIntegration || !gen?.ticket_id || !gen?.id) return;
    setSyncing(action);
    setShowSyncMenu(false);
    try {
      if (action === 'attach') {
        await integrationAPI.attachExcel(sourceIntegration, gen.ticket_id, gen.id);
        toast.success(`Excel attached to ${gen.ticket_id}`);
      } else if (action === 'comment') {
        await integrationAPI.addComment(sourceIntegration, gen.ticket_id, gen.id);
        toast.success(`Comment added to ${gen.ticket_id}`);
      } else if (action === 'full') {
        const result = await integrationAPI.fullSync(sourceIntegration, gen.ticket_id, gen.id);
        if (result.results?.errors?.length > 0) {
          toast.success(result.message + ' (with warnings)', { duration: 5000 });
        } else {
          toast.success(`Synced to ${gen.ticket_id} successfully`);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || `Sync failed: ${err.message}`);
    } finally {
      setSyncing(null);
    }
  };

  const integrationLabel = sourceIntegration === 'jira' ? 'Jira' : 
    sourceIntegration === 'azure_devops' ? 'Azure DevOps' : sourceIntegration;

  // Test case filters
  const [tcSearch, setTcSearch] = useState('');
  const [tcPriorityFilter, setTcPriorityFilter] = useState('all');
  const [tcCategoryFilter, setTcCategoryFilter] = useState('all');
  const [expandedTestCase, setExpandedTestCase] = useState(null);

  const priorities = [...new Set(testCases.map((tc) => tc.priority))].sort();
  const categories = [...new Set(testCases.map((tc) => tc.category))].sort();

  const filteredTestCases = testCases.filter((tc) => {
    const matchesSearch =
      tcSearch === '' ||
      tc.title.toLowerCase().includes(tcSearch.toLowerCase()) ||
      tc.category.toLowerCase().includes(tcSearch.toLowerCase());
    const matchesPriority = tcPriorityFilter === 'all' || tc.priority === tcPriorityFilter;
    const matchesCategory = tcCategoryFilter === 'all' || tc.category === tcCategoryFilter;
    return matchesSearch && matchesPriority && matchesCategory;
  });

  // Priority breakdown
  const priorityCounts = testCases.reduce((acc, tc) => {
    acc[tc.priority] = (acc[tc.priority] || 0) + 1;
    return acc;
  }, {});

  const priorityBarColors = {
    P0: 'bg-red-500',
    P1: 'bg-orange-500',
    P2: 'bg-yellow-500',
    P3: 'bg-green-500',
    P4: 'bg-blue-400',
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-gray-50 rounded-xl max-w-6xl w-full max-h-[93vh] flex flex-col shadow-2xl">
        {/* ─── Sticky Header ─── */}
        <div className="sticky top-0 bg-white border-b border-gray-200 rounded-t-xl px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate">
                {gen.ticket_id} — {gen.ticket_title || 'Test Generation Results'}
              </h3>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(gen.timestamp).toLocaleString()}
                </span>
                {gen.ticket_type && (
                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                    {gen.ticket_type}
                  </span>
                )}
                {sourceIntegration && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium flex items-center gap-1">
                    <ExternalLink size={10} />
                    {integrationLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onDownloadExcel}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <FileSpreadsheet size={16} />
              Export Excel
            </button>
            {canSync && (
              <div className="relative">
                <button
                  onClick={() => setShowSyncMenu(!showSyncMenu)}
                  disabled={!!syncing}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  {syncing ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                  Sync to {integrationLabel}
                </button>
                {showSyncMenu && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowSyncMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-30">
                      <button
                        onClick={() => handleSync('full')}
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
                        onClick={() => handleSync('attach')}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 flex items-center gap-3 transition-colors"
                      >
                        <Paperclip size={15} className="text-green-600" />
                        <div>
                          <div className="font-medium text-gray-900">Attach Excel</div>
                          <div className="text-xs text-gray-500">Upload Excel file to ticket</div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleSync('comment')}
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
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─── Scrollable Content ─── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ─── Summary Stats Bar ─── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{testCases.length}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Test Cases</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-green-600">{extractedRequirements.length}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Requirements</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{coverageGaps.length}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Coverage Gaps</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-red-600">{riskAreas.length}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Risk Areas</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-purple-600">{clarificationQuestions.length}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Questions</div>
            </div>
          </div>

          {/* ─── Priority Breakdown Bar ─── */}
          {testCases.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Priority Distribution</span>
                <div className="flex gap-3">
                  {Object.entries(priorityCounts).sort().map(([p, count]) => (
                    <span key={p} className="text-xs text-gray-500">
                      <span className={`inline-block w-2 h-2 rounded-full mr-1 ${priorityBarColors[p] || 'bg-gray-400'}`}></span>
                      {p}: {count}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
                {Object.entries(priorityCounts).sort().map(([p, count]) => (
                  <div
                    key={p}
                    className={`${priorityBarColors[p] || 'bg-gray-400'} transition-all`}
                    style={{ width: `${(count / testCases.length) * 100}%` }}
                    title={`${p}: ${count} test cases`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── 1. Ticket Overview ─── */}
          {(gen.ticket_description || gen.ticket_acceptance_criteria) && (
            <AccordionSection icon={ClipboardList} title="Ticket Overview" color="slate" defaultOpen={false}>
              <div className="space-y-3">
                {gen.ticket_description && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{gen.ticket_description}</p>
                  </div>
                )}
                {gen.ticket_acceptance_criteria && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Acceptance Criteria</div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{gen.ticket_acceptance_criteria}</p>
                  </div>
                )}
              </div>
            </AccordionSection>
          )}

          {/* ─── 2. Extracted Requirements ─── */}
          {extractedRequirements.length > 0 && (
            <AccordionSection icon={Target} title="Extracted Requirements" count={extractedRequirements.length} color="green" defaultOpen={true}>
              <div className="space-y-1.5">
                {extractedRequirements.map((req, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{req}</span>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* ─── 3. Acceptance Criteria Gaps ─── */}
          {acceptanceCriteriaGaps.length > 0 && (
            <AccordionSection icon={FileWarning} title="Acceptance Criteria Gaps" count={acceptanceCriteriaGaps.length} color="orange" defaultOpen={true}>
              <div className="space-y-1.5">
                {acceptanceCriteriaGaps.map((gap, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertCircle size={14} className="text-orange-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{gap}</span>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* ─── 4. Impacted Modules & Dependencies ─── */}
          {(impactedModules.length > 0 || dependencies.length > 0) && (
            <AccordionSection icon={Boxes} title="Modules & Dependencies" count={(impactedModules.length || 0) + (dependencies.length || 0)} color="indigo" defaultOpen={false}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {impactedModules.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Layers size={12} />
                      Impacted Modules
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {impactedModules.map((mod, i) => (
                        <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium border border-indigo-100">
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {dependencies.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <GitBranch size={12} />
                      Dependencies
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dependencies.map((dep, i) => (
                        <span key={i} className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium border border-purple-100">
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AccordionSection>
          )}

          {/* ─── 5. QA Roadmap / Test Strategy ─── */}
          {Object.keys(qaRoadmap).length > 0 && (
            <AccordionSection icon={BookOpen} title="QA Roadmap / Test Strategy" count={Object.keys(qaRoadmap).length + ' categories'} color="purple" defaultOpen={false}>
              <div className="space-y-3">
                {Object.entries(qaRoadmap).map(([category, scenarios]) => (
                  <div key={category}>
                    <div className="text-sm font-semibold text-purple-800 mb-1.5">{category}</div>
                    <div className="space-y-1 pl-3 border-l-2 border-purple-200">
                      {Array.isArray(scenarios) ? scenarios.map((s, i) => (
                        <div key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-purple-400 mt-0.5">•</span>
                          <span>{s}</span>
                        </div>
                      )) : (
                        <div className="text-sm text-gray-700">{String(scenarios)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* ─── 6. Test Cases (with filters) ─── */}
          <AccordionSection icon={ListChecks} title="Test Cases" count={testCases.length} color="blue" defaultOpen={true}>
            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-blue-100">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search test cases..."
                  value={tcSearch}
                  onChange={(e) => setTcSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
              <select
                value={tcPriorityFilter}
                onChange={(e) => setTcPriorityFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="all">All Priorities</option>
                {priorities.map((p) => (
                  <option key={p} value={p}>{p} ({priorityCounts[p]})</option>
                ))}
              </select>
              <select
                value={tcCategoryFilter}
                onChange={(e) => setTcCategoryFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {(tcSearch || tcPriorityFilter !== 'all' || tcCategoryFilter !== 'all') && (
                <button
                  onClick={() => { setTcSearch(''); setTcPriorityFilter('all'); setTcCategoryFilter('all'); }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Clear filters
                </button>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                Showing {filteredTestCases.length} of {testCases.length}
              </span>
            </div>

            {/* Test Case Accordion Items */}
            <div className="space-y-2">
              {filteredTestCases.map((tc, index) => {
                const isExpanded = expandedTestCase === tc.id;
                const globalIndex = testCases.indexOf(tc) + 1;
                return (
                  <div key={tc.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedTestCase(isExpanded ? null : tc.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-xs text-gray-400 font-mono w-6 shrink-0">#{globalIndex}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${
                          tc.priority === 'P0'
                            ? 'bg-red-100 text-red-700'
                            : tc.priority === 'P1'
                              ? 'bg-orange-100 text-orange-700'
                              : tc.priority === 'P2'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {tc.priority}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate flex-1">{tc.title}</span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs shrink-0">{tc.category}</span>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3">
                        {tc.preconditions && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Preconditions</div>
                            <p className="text-sm text-gray-700">{tc.preconditions}</p>
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Test Steps</div>
                          <ol className="list-decimal list-inside space-y-1">
                            {(tc.test_steps || []).map((step, i) => (
                              <li key={i} className="text-sm text-gray-700">{step}</li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Expected Result</div>
                          <p className="text-sm text-gray-700">{tc.expected_result}</p>
                        </div>
                        {tc.test_data && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Test Data</div>
                            <p className="text-sm text-gray-700 bg-gray-50 rounded p-2 font-mono whitespace-pre-wrap">{typeof tc.test_data === 'object' ? JSON.stringify(tc.test_data, null, 2) : tc.test_data}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredTestCases.length === 0 && (
                <div className="text-center text-sm text-gray-400 py-6">No test cases match the current filters.</div>
              )}
            </div>
          </AccordionSection>

          {/* ─── 7. Coverage Gaps ─── */}
          {coverageGaps.length > 0 && (
            <AccordionSection icon={ShieldAlert} title="Coverage Gaps" count={coverageGaps.length} color="yellow" defaultOpen={true}>
              <div className="space-y-1.5">
                {coverageGaps.map((gap, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertCircle size={14} className="text-yellow-600 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{gap}</span>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* ─── 8. Risk Areas ─── */}
          {riskAreas.length > 0 && (
            <AccordionSection icon={ShieldAlert} title="Risk Areas" count={riskAreas.length} color="red" defaultOpen={false}>
              <div className="space-y-1.5">
                {riskAreas.map((risk, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{risk}</span>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* ─── 9. Clarification Questions ─── */}
          {clarificationQuestions.length > 0 && (
            <AccordionSection icon={HelpCircle} title="Clarification Questions" count={clarificationQuestions.length} color="cyan" defaultOpen={true}>
              <div className="space-y-1.5">
                {clarificationQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <HelpCircle size={14} className="text-cyan-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{q}</span>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}
        </div>

        {/* ─── Sticky Footer ─── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 rounded-b-xl px-6 py-3 flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-400">
            {testCases.length} test cases &middot; {Object.keys(qaRoadmap).length} strategy categories &middot; {coverageGaps.length} gaps identified
            {syncing && (
              <span className="ml-3 text-blue-600 font-medium inline-flex items-center gap-1">
                <Loader size={12} className="animate-spin" />
                {syncing === 'full' ? 'Syncing to ticket...' : syncing === 'attach' ? 'Attaching Excel...' : 'Adding comment...'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TestGeneration;
