/**
 * Test Generation Component
 * Two-tab interface: Custom Input + Live Integration
 */
import { useState, useEffect } from 'react';
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
  ExternalLink,
  UploadCloud
} from 'lucide-react';
import { testGenAPI, integrationAPI } from '../services/api';
import toast from 'react-hot-toast';

const TestGeneration = () => {
  // ── Shared state ──
  const [generations, setGenerations] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [activeTab, setActiveTab] = useState('custom'); // 'custom' | 'integration'

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

  // ── Live Integration tab state ──
  const [integrationType, setIntegrationType] = useState('jira');
  const [integrationTicketId, setIntegrationTicketId] = useState('');
  const [fetchedTicket, setFetchedTicket] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [integrationConfigs, setIntegrationConfigs] = useState([]);
  const [showIntegrationSetup, setShowIntegrationSetup] = useState(false);

  // ── Integration setup form state ──
  const [setupForm, setSetupForm] = useState({
    jira: { url: '', email: '', api_token: '' },
    azure_devops: { organization_url: '', project: '', personal_access_token: '' },
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Load on mount
  useEffect(() => {
    loadGenerations();
    loadStatistics();
    loadIntegrationConfigs();
  }, []);

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

  const handleCustomGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const cleanedData = {
        ...customForm,
        acceptance_criteria: customForm.acceptance_criteria.filter((ac) => ac.trim() !== ''),
      };

      const result = await testGenAPI.generate(cleanedData);
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
      // Error handled by interceptor
    } finally {
      setGenerating(false);
    }
  };

  // ── Integration handlers ──
  const handleFetchTicket = async () => {
    if (!integrationTicketId.trim()) {
      toast.error('Please enter a ticket ID');
      return;
    }

    if (!isIntegrationConfigured(integrationType)) {
      toast.error(`${integrationType === 'jira' ? 'Jira' : 'Azure DevOps'} is not configured. Click "Configure" to set it up.`);
      setShowIntegrationSetup(true);
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
      };

      const result = await testGenAPI.generate(ticketData);
      toast.success(`Generated ${result.total_test_cases} test cases!`);

      setFetchedTicket(null);
      setIntegrationTicketId('');
      setShowNewForm(false);

      loadGenerations();
      loadStatistics();

      setTimeout(() => viewGeneration(result.generation_id), 800);
    } catch (err) {
      // Error handled by interceptor
    } finally {
      setGenerating(false);
    }
  };

  // ── Integration config handlers ──
  const handleTestConnection = async () => {
    const formData = setupForm[integrationType];
    setTestingConnection(true);

    try {
      let credentials, config;

      if (integrationType === 'jira') {
        credentials = { api_token: formData.api_token };
        config = { url: formData.url, email: formData.email };
      } else {
        credentials = { personal_access_token: formData.personal_access_token };
        config = { organization_url: formData.organization_url, project: formData.project };
      }

      const result = await integrationAPI.testConnection(integrationType, credentials, config);
      toast.success(result.message || 'Connection successful!');
    } catch (err) {
      // Error handled by interceptor
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfig = async () => {
    const formData = setupForm[integrationType];
    setSavingConfig(true);

    try {
      let credentials, config;

      if (integrationType === 'jira') {
        if (!formData.url || !formData.email || !formData.api_token) {
          toast.error('Please fill in all Jira fields');
          setSavingConfig(false);
          return;
        }
        credentials = { api_token: formData.api_token };
        config = { url: formData.url, email: formData.email };
      } else {
        if (!formData.organization_url || !formData.personal_access_token || !formData.project) {
          toast.error('Please fill in all Azure DevOps fields');
          setSavingConfig(false);
          return;
        }
        credentials = { personal_access_token: formData.personal_access_token };
        config = {
          organization_url: formData.organization_url,
          project: formData.project,
        };
      }

      await integrationAPI.saveConfig(integrationType, credentials, config);
      toast.success('Configuration saved!');
      setShowIntegrationSetup(false);
      loadIntegrationConfigs();
    } catch (err) {
      // Error handled by interceptor
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!confirm('Remove this integration configuration?')) return;
    try {
      await integrationAPI.deleteConfig(integrationType);
      toast.success('Configuration removed');
      loadIntegrationConfigs();
      setSetupForm((prev) => ({
        ...prev,
        [integrationType]:
          integrationType === 'jira'
            ? { url: '', email: '', api_token: '' }
            : { organization_url: '', project: '', personal_access_token: '' },
      }));
    } catch (err) {
      // Error handled by interceptor
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
              {!isIntegrationConfigured(integrationType) && !showIntegrationSetup && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">
                      {integrationType === 'jira' ? 'Jira' : 'Azure DevOps'} is not configured
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Set up your credentials to fetch tickets directly.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowIntegrationSetup(true)}
                    className="btn-primary text-sm flex items-center gap-1"
                  >
                    <Settings size={14} />
                    Configure
                  </button>
                </div>
              )}

              {/* Inline Integration Setup */}
              {showIntegrationSetup && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">
                      {integrationType === 'jira' ? 'Jira' : 'Azure DevOps'} Configuration
                    </h4>
                    <button
                      onClick={() => setShowIntegrationSetup(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {integrationType === 'jira' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="input-label">
                          Jira URL
                        </label>
                        <input
                          type="url"
                          value={setupForm.jira.url}
                          onChange={(e) =>
                            setSetupForm((prev) => ({
                              ...prev,
                              jira: { ...prev.jira, url: e.target.value },
                            }))
                          }
                          className="input"
                          placeholder="https://your-org.atlassian.net"
                        />
                      </div>
                      <div>
                        <label className="input-label">
                          Email
                        </label>
                        <input
                          type="email"
                          value={setupForm.jira.email}
                          onChange={(e) =>
                            setSetupForm((prev) => ({
                              ...prev,
                              jira: { ...prev.jira, email: e.target.value },
                            }))
                          }
                          className="input"
                          placeholder="your-email@company.com"
                        />
                      </div>
                      <div>
                        <label className="input-label">
                          API Token
                        </label>
                        <input
                          type="password"
                          value={setupForm.jira.api_token}
                          onChange={(e) =>
                            setSetupForm((prev) => ({
                              ...prev,
                              jira: { ...prev.jira, api_token: e.target.value },
                            }))
                          }
                          className="input"
                          placeholder="Your Jira API token"
                        />
                        <p className="input-hint">
                          <a
                            href="https://id.atlassian.com/manage-profile/security/api-tokens"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:underline inline-flex items-center gap-1"
                          >
                            Generate API token <ExternalLink size={10} />
                          </a>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="input-label">
                          Organization URL
                        </label>
                        <input
                          type="url"
                          value={setupForm.azure_devops.organization_url}
                          onChange={(e) =>
                            setSetupForm((prev) => ({
                              ...prev,
                              azure_devops: {
                                ...prev.azure_devops,
                                organization_url: e.target.value,
                              },
                            }))
                          }
                          className="input"
                          placeholder="https://dev.azure.com/your-org"
                        />
                      </div>
                      <div>
                        <label className="input-label">
                          Project Name
                        </label>
                        <input
                          type="text"
                          value={setupForm.azure_devops.project}
                          onChange={(e) =>
                            setSetupForm((prev) => ({
                              ...prev,
                              azure_devops: { ...prev.azure_devops, project: e.target.value },
                            }))
                          }
                          className="input"
                          placeholder="Your project name"
                        />
                      </div>
                      <div>
                        <label className="input-label">
                          Personal Access Token (PAT)
                        </label>
                        <input
                          type="password"
                          value={setupForm.azure_devops.personal_access_token}
                          onChange={(e) =>
                            setSetupForm((prev) => ({
                              ...prev,
                              azure_devops: {
                                ...prev.azure_devops,
                                personal_access_token: e.target.value,
                              },
                            }))
                          }
                          className="input"
                          placeholder="Your PAT"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleTestConnection}
                      disabled={testingConnection}
                      className="btn-secondary flex items-center gap-2 text-sm"
                    >
                      {testingConnection ? (
                        <Loader size={14} className="animate-spin" />
                      ) : (
                        <Link2 size={14} />
                      )}
                      Test Connection
                    </button>
                    <button
                      onClick={handleSaveConfig}
                      disabled={savingConfig}
                      className="btn-primary flex items-center gap-2 text-sm"
                    >
                      {savingConfig ? (
                        <Loader size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle size={14} />
                      )}
                      Save Configuration
                    </button>
                    {isIntegrationConfigured(integrationType) && (
                      <button
                        onClick={handleDeleteConfig}
                        className="btn-secondary text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Ticket Fetch */}
              <div>
                <label className="input-label">
                  Ticket ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={integrationTicketId}
                    onChange={(e) => setIntegrationTicketId(e.target.value)}
                    className="input flex-1"
                    placeholder={
                      integrationType === 'jira' ? 'e.g., PROJ-123' : 'e.g., 12345'
                    }
                    onKeyDown={(e) => e.key === 'Enter' && handleFetchTicket()}
                  />
                  <button
                    onClick={handleFetchTicket}
                    disabled={fetching || !integrationTicketId.trim()}
                    className="btn-primary flex items-center gap-2"
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
                  {isIntegrationConfigured(integrationType) && (
                    <button
                      onClick={() => setShowIntegrationSetup(!showIntegrationSetup)}
                      className="btn-secondary px-3"
                      title="Integration Settings"
                    >
                      <Settings size={16} />
                    </button>
                  )}
                </div>
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
                      <div className="space-y-1 bg-gray-50 p-3 rounded-lg max-h-32 overflow-y-auto">
                        {fetchedTicket.comments.map((comment, i) => (
                          <p key={i} className="text-sm text-gray-600">
                            &bull; {comment}
                          </p>
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
      {/*  GENERATIONS LIST                            */}
      {/* ════════════════════════════════════════════ */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Recent Generations</h3>

        {loading && !showDetails ? (
          <div className="flex items-center justify-center py-12">
            <Loader size={32} className="animate-spin text-primary-600" />
          </div>
        ) : generations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText size={48} className="mx-auto mb-3 opacity-50" />
            <p>No test generations yet</p>
            <p className="text-sm">Click &quot;New Generation&quot; to create your first test suite</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {generations.map((gen) => (
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
      </div>

      {/* ════════════════════════════════════════════ */}
      {/*  GENERATION DETAILS MODAL                    */}
      {/* ════════════════════════════════════════════ */}
      {showDetails && selectedGeneration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">
                Test Cases for {selectedGeneration.generation.ticket_id}
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card bg-blue-50">
                  <div className="text-sm text-gray-600">Total Test Cases</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {selectedGeneration.test_cases.length}
                  </div>
                </div>
                <div className="card bg-green-50">
                  <div className="text-sm text-gray-600">Coverage Gaps</div>
                  <div className="text-2xl font-bold text-green-900">
                    {selectedGeneration.coverage_gaps.length}
                  </div>
                </div>
                <div className="card bg-purple-50">
                  <div className="text-sm text-gray-600">Generated</div>
                  <div className="text-lg font-bold text-purple-900">
                    {new Date(selectedGeneration.generation.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Test Cases */}
              <div>
                <h4 className="text-lg font-semibold mb-3">Test Cases</h4>
                <div className="space-y-3">
                  {selectedGeneration.test_cases.map((tc, index) => (
                    <div key={tc.id} className="card border-l-4 border-l-blue-500">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-gray-900">
                          {index + 1}. {tc.title}
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            tc.priority === 'P0'
                              ? 'bg-red-100 text-red-800'
                              : tc.priority === 'P1'
                                ? 'bg-orange-100 text-orange-800'
                                : tc.priority === 'P2'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {tc.priority}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <strong>Category:</strong> {tc.category}
                      </div>
                      {tc.preconditions && (
                        <div className="text-sm mb-2">
                          <strong>Preconditions:</strong> {tc.preconditions}
                        </div>
                      )}
                      <div className="text-sm mb-2">
                        <strong>Steps:</strong>
                        <ol className="list-decimal list-inside mt-1 space-y-1">
                          {tc.test_steps.map((step, i) => (
                            <li key={i} className="text-gray-700">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="text-sm">
                        <strong>Expected Result:</strong> {tc.expected_result}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coverage Gaps */}
              {selectedGeneration.coverage_gaps.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-3">Coverage Gaps</h4>
                  <div className="space-y-2">
                    {selectedGeneration.coverage_gaps.map((gap, index) => (
                      <div
                        key={index}
                        className="card bg-yellow-50 border-l-4 border-l-yellow-500"
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle size={16} className="text-yellow-600 mt-0.5" />
                          <span className="text-sm text-gray-700">{gap}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                {selectedGeneration.generation.excel_file_path && (
                  <button
                    onClick={() => downloadExcel(selectedGeneration.generation.id)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Download size={16} />
                    Download Excel
                  </button>
                )}
                <button onClick={() => setShowDetails(false)} className="btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestGeneration;
