/**
 * Integration Settings Component
 * Full-page integration configuration for Jira & Azure DevOps
 */
import { useState, useEffect } from 'react';
import {
  Settings,
  Link2,
  CheckCircle,
  XCircle,
  Loader,
  Trash2,
  ExternalLink,
  Shield,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  Lock,
  X
} from 'lucide-react';
import { integrationAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';

const IntegrationSettings = () => {
  const [integrationConfigs, setIntegrationConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState('jira'); // Track which section is expanded

  // Jira form
  const [jiraForm, setJiraForm] = useState({ url: '', email: '', api_token: '' });
  const [initialJiraForm, setInitialJiraForm] = useState({ url: '', email: '', api_token: '' });
  const [jiraTesting, setJiraTesting] = useState(false);
  const [jiraSaving, setJiraSaving] = useState(false);

  // Azure DevOps form
  const [adoForm, setAdoForm] = useState({
    organization_url: '',
    project: '',
    personal_access_token: '',
  });
  const [initialAdoForm, setInitialAdoForm] = useState({
    organization_url: '',
    project: '',
    personal_access_token: '',
  });
  const [adoTesting, setAdoTesting] = useState(false);
  const [adoSaving, setAdoSaving] = useState(false);

  // Xray form (uses Jira credentials)
  const [xrayForm, setXrayForm] = useState({ project_key: '' });
  const [initialXrayForm, setInitialXrayForm] = useState({ project_key: '' });
  const [xrayTesting, setXrayTesting] = useState(false);
  const [xraySaving, setXraySaving] = useState(false);

  // Zephyr form (uses Jira credentials + required Zephyr token)
  const [zephyrForm, setZephyrForm] = useState({ zephyr_token: '', project_key: '' });
  const [initialZephyrForm, setInitialZephyrForm] = useState({ zephyr_token: '', project_key: '' });
  const [zephyrTesting, setZephyrTesting] = useState(false);
  const [zephyrSaving, setZephyrSaving] = useState(false);

  // TestRail form
  const [testrailForm, setTestrailForm] = useState({ url: '', email: '', api_key: '', project_id: '' });
  const [initialTestrailForm, setInitialTestrailForm] = useState({ url: '', email: '', api_key: '', project_id: '' });
  const [testrailTesting, setTestrailTesting] = useState(false);
  const [testrailSaving, setTestrailSaving] = useState(false);

  // Password modal for viewing credentials
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [viewIntegrationType, setViewIntegrationType] = useState(null);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [revealedToken, setRevealedToken] = useState(null);

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteType, setPendingDeleteType] = useState(null);
  const [deletingIntegration, setDeletingIntegration] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await integrationAPI.getConfigs();
      setIntegrationConfigs(data.integrations || []);

      // Pre-fill forms with existing config (non-sensitive data only)
      const jiraConfig = (data.integrations || []).find(
        (c) => c.integration_type === 'jira'
      );
      if (jiraConfig?.config) {
        const nextJira = {
          url: jiraConfig.config.url || '',
          email: jiraConfig.config.email || '',
          api_token: '',
        };
        setJiraForm(nextJira);
        setInitialJiraForm(nextJira);
      } else {
        const emptyJira = { url: '', email: '', api_token: '' };
        setJiraForm(emptyJira);
        setInitialJiraForm(emptyJira);
      }

      const adoConfig = (data.integrations || []).find(
        (c) => c.integration_type === 'azure_devops'
      );
      if (adoConfig?.config) {
        const nextAdo = {
          organization_url: adoConfig.config.organization_url || '',
          project: adoConfig.config.project || '',
          personal_access_token: '',
        };
        setAdoForm(nextAdo);
        setInitialAdoForm(nextAdo);
      } else {
        const emptyAdo = { organization_url: '', project: '', personal_access_token: '' };
        setAdoForm(emptyAdo);
        setInitialAdoForm(emptyAdo);
      }

      // Pre-fill test management tools
      const xrayConfig = (data.integrations || []).find(
        (c) => c.integration_type === 'xray'
      );
      if (xrayConfig?.config) {
        const nextXray = {
          project_key: xrayConfig.config.project_key || '',
        };
        setXrayForm(nextXray);
        setInitialXrayForm(nextXray);
      } else {
        const emptyXray = { project_key: '' };
        setXrayForm(emptyXray);
        setInitialXrayForm(emptyXray);
      }

      const zephyrConfig = (data.integrations || []).find(
        (c) => c.integration_type === 'zephyr'
      );
      if (zephyrConfig?.config) {
        const nextZephyr = {
          project_key: zephyrConfig.config.project_key || '',
          zephyr_token: '',
        };
        setZephyrForm(nextZephyr);
        setInitialZephyrForm(nextZephyr);
      } else {
        const emptyZephyr = { project_key: '', zephyr_token: '' };
        setZephyrForm(emptyZephyr);
        setInitialZephyrForm(emptyZephyr);
      }

      const testrailConfig = (data.integrations || []).find(
        (c) => c.integration_type === 'testrail'
      );
      if (testrailConfig?.config) {
        const nextTestrail = {
          url: testrailConfig.config.url || '',
          email: testrailConfig.config.email || '',
          project_id: testrailConfig.config.project_id || '',
          api_key: '',
        };
        setTestrailForm(nextTestrail);
        setInitialTestrailForm(nextTestrail);
      } else {
        const emptyTestrail = { url: '', email: '', project_id: '', api_key: '' };
        setTestrailForm(emptyTestrail);
        setInitialTestrailForm(emptyTestrail);
      }
    } catch (err) {
      console.error('Failed to load configs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Checks if all required fields are filled for each integration
  const isConfigured = (type) => {
    const entry = integrationConfigs.find((c) => c.integration_type === type);
    if (!entry || !entry.configured) return false;
    // Sensitive fields (tokens/keys) are NEVER returned by the API — only non-sensitive
    // config fields are available. Access them via the nested `entry.config` object.
    const cfg = entry.config || {};
    switch (type) {
      case 'jira':
        return !!cfg.url && !!cfg.email;
      case 'azure_devops':
        return !!cfg.organization_url && !!cfg.project;
      case 'xray':
        return !!cfg.project_key;
      case 'zephyr':
        return !!cfg.project_key;
      case 'testrail':
        return !!cfg.url && !!cfg.email && !!cfg.project_id;
      default:
        return false;
    }
  };

  const getLastUpdated = (type) => {
    const config = integrationConfigs.find((c) => c.integration_type === type);
    return config?.updated_at
      ? new Date(config.updated_at).toLocaleString()
      : null;
  };

  const jiraHasChanges = (
    jiraForm.url !== initialJiraForm.url ||
    jiraForm.email !== initialJiraForm.email ||
    !!jiraForm.api_token?.trim()
  );

  const adoHasChanges = (
    adoForm.organization_url !== initialAdoForm.organization_url ||
    adoForm.project !== initialAdoForm.project ||
    !!adoForm.personal_access_token?.trim()
  );

  const xrayHasChanges = (
    xrayForm.project_key !== initialXrayForm.project_key
  );

  const zephyrHasChanges = (
    zephyrForm.project_key !== initialZephyrForm.project_key ||
    !!zephyrForm.zephyr_token?.trim()
  );

  const testrailHasChanges = (
    testrailForm.url !== initialTestrailForm.url ||
    testrailForm.email !== initialTestrailForm.email ||
    testrailForm.project_id !== initialTestrailForm.project_id ||
    !!testrailForm.api_key?.trim()
  );

  // Readiness: all required fields filled (token required on first save only)
  const jiraReady = (
    !!jiraForm.url?.trim() &&
    !!jiraForm.email?.trim() &&
    (!!jiraForm.api_token?.trim() || isConfigured('jira'))
  );

  const adoReady = (
    !!adoForm.organization_url?.trim() &&
    !!adoForm.project?.trim() &&
    (!!adoForm.personal_access_token?.trim() || isConfigured('azure_devops'))
  );

  const xrayReady = (
    !!xrayForm.project_key?.trim() &&
    isConfigured('jira')
  );

  const zephyrReady = (
    !!zephyrForm.project_key?.trim() &&
    (!!zephyrForm.zephyr_token?.trim() || isConfigured('zephyr')) &&
    isConfigured('jira')
  );

  const testrailReady = (
    !!testrailForm.url?.trim() &&
    !!testrailForm.email?.trim() &&
    !!testrailForm.project_id?.toString().trim() &&
    (!!testrailForm.api_key?.trim() || isConfigured('testrail'))
  );

  const integrationLabels = {
    jira: 'Jira',
    azure_devops: 'Azure DevOps',
    xray: 'Xray',
    zephyr: 'Zephyr',
    testrail: 'TestRail',
  };

  const openDeleteModal = (integrationType) => {
    setPendingDeleteType(integrationType);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deletingIntegration) return;
    setShowDeleteModal(false);
    setPendingDeleteType(null);
  };

  const confirmDeleteIntegration = async () => {
    if (!pendingDeleteType) return;

    setDeletingIntegration(true);
    try {
      await integrationAPI.deleteConfig(pendingDeleteType);
      toast.success(`${integrationLabels[pendingDeleteType] || 'Integration'} configuration removed`);

      if (pendingDeleteType === 'jira') {
        setJiraForm({ url: '', email: '', api_token: '' });
      } else if (pendingDeleteType === 'azure_devops') {
        setAdoForm({ organization_url: '', project: '', personal_access_token: '' });
      } else if (pendingDeleteType === 'xray') {
        setXrayForm({ project_key: '' });
      } else if (pendingDeleteType === 'zephyr') {
        setZephyrForm({ zephyr_token: '', project_key: '' });
      } else if (pendingDeleteType === 'testrail') {
        setTestrailForm({ url: '', email: '', api_key: '', project_id: '' });
      }

      await loadConfigs();
      closeDeleteModal();
    } catch (err) {
      // handled by interceptor
    } finally {
      setDeletingIntegration(false);
    }
  };
  //  Jira handlers 
  const handleJiraTest = async () => {
    if (!jiraForm.url || !jiraForm.email) {
      toast.error('Please fill in Jira URL and Email');
      return;
    }
    setJiraTesting(true);
    try {
      const result = await integrationAPI.testConnection(
        'jira',
        jiraForm.api_token?.trim()
          ? { api_token: jiraForm.api_token.trim() }
          : { provider: 'jira' },
        { url: jiraForm.url, email: jiraForm.email }
      );
      toast.success(result.message || 'Jira connection successful!');
    } catch (err) {
      // handled by interceptor
    } finally {
      setJiraTesting(false);
    }
  };

  const handleJiraSave = async () => {
    if (!jiraForm.url || !jiraForm.email) {
      toast.error('Please fill in Jira URL and Email');
      return;
    }
    if (!jiraForm.api_token?.trim() && !isConfigured('jira')) {
      toast.error('Please enter your Jira API token');
      return;
    }
    setJiraSaving(true);
    try {
      await integrationAPI.saveConfig(
        'jira',
        jiraForm.api_token?.trim()
          ? { api_token: jiraForm.api_token.trim() }
          : { provider: 'jira' },
        { url: jiraForm.url, email: jiraForm.email }
      );
      toast.success('Jira configuration saved!');
      loadConfigs();
    } catch (err) {
      // handled by interceptor
    } finally {
      setJiraSaving(false);
    }
  };

  const handleJiraDelete = () => {
    openDeleteModal('jira');
  };

  //  Azure DevOps handlers 
  const handleAdoTest = async () => {
    if (!adoForm.organization_url || !adoForm.project) {
      toast.error('Please fill in Azure DevOps Organization URL and Project');
      return;
    }
    setAdoTesting(true);
    try {
      const result = await integrationAPI.testConnection(
        'azure_devops',
        adoForm.personal_access_token?.trim()
          ? { personal_access_token: adoForm.personal_access_token.trim() }
          : { provider: 'azure_devops' },
        { organization_url: adoForm.organization_url, project: adoForm.project }
      );
      toast.success(result.message || 'Azure DevOps connection successful!');
    } catch (err) {
      // handled by interceptor
    } finally {
      setAdoTesting(false);
    }
  };

  const handleAdoSave = async () => {
    if (!adoForm.organization_url || !adoForm.project) {
      toast.error('Please fill in Azure DevOps Organization URL and Project');
      return;
    }
    if (!adoForm.personal_access_token?.trim() && !isConfigured('azure_devops')) {
      toast.error('Please enter your Azure DevOps Personal Access Token');
      return;
    }
    setAdoSaving(true);
    try {
      await integrationAPI.saveConfig(
        'azure_devops',
        adoForm.personal_access_token?.trim()
          ? { personal_access_token: adoForm.personal_access_token.trim() }
          : { provider: 'azure_devops' },
        { organization_url: adoForm.organization_url, project: adoForm.project }
      );
      toast.success('Azure DevOps configuration saved!');
      loadConfigs();
    } catch (err) {
      // handled by interceptor
    } finally {
      setAdoSaving(false);
    }
  };

  const handleAdoDelete = () => {
    openDeleteModal('azure_devops');
  };

  //  Xray handlers 
  const handleXraySave = async () => {
    if (!xrayForm.project_key) {
      toast.error('Please enter Xray project key');
      return;
    }
    if (!isConfigured('jira')) {
      toast.error('Jira must be configured first (Xray uses Jira credentials)');
      return;
    }
    setXraySaving(true);
    try {
      await integrationAPI.saveConfig(
        'xray',
        { provider: 'xray' },
        { project_key: xrayForm.project_key }
      );
      toast.success('Xray configuration saved!');
      loadConfigs();
    } catch (err) {
      // handled by interceptor
    } finally {
      setXraySaving(false);
    }
  };

  const handleXrayDelete = () => {
    openDeleteModal('xray');
  };

  //  Zephyr handlers 
  const handleZephyrSave = async () => {
    if (!zephyrForm.project_key) {
      toast.error('Please enter Zephyr project key');
      return;
    }
    if (!zephyrForm.zephyr_token?.trim() && !isConfigured('zephyr')) {
      toast.error('Please enter Zephyr API token');
      return;
    }
    if (!isConfigured('jira')) {
      toast.error('Jira must be configured first (Zephyr uses Jira credentials)');
      return;
    }
    setZephyrSaving(true);
    try {
      await integrationAPI.saveConfig(
        'zephyr',
        zephyrForm.zephyr_token?.trim()
          ? { zephyr_token: zephyrForm.zephyr_token.trim() }
          : { provider: 'zephyr' },
        { project_key: zephyrForm.project_key }
      );
      toast.success('Zephyr configuration saved!');
      loadConfigs();
    } catch (err) {
      // handled by interceptor
    } finally {
      setZephyrSaving(false);
    }
  };

  const handleZephyrDelete = () => {
    openDeleteModal('zephyr');
  };

  //  TestRail handlers 
  const handleTestrailTest = async () => {
    if (!testrailForm.url || !testrailForm.email || !testrailForm.api_key) {
      toast.error('Please fill in all TestRail fields');
      return;
    }
    setTestrailTesting(true);
    try {
      const result = await integrationAPI.testConnection(
        'testrail',
        { api_key: testrailForm.api_key },
        { url: testrailForm.url, email: testrailForm.email, project_id: testrailForm.project_id }
      );
      toast.success(result.message || 'TestRail connection successful!');
    } catch (err) {
      // handled by interceptor
    } finally {
      setTestrailTesting(false);
    }
  };

  const handleTestrailSave = async () => {
    if (!testrailForm.url || !testrailForm.email || !testrailForm.project_id) {
      toast.error('Please fill in TestRail URL, Email, and Project ID');
      return;
    }
    if (!testrailForm.api_key?.trim() && !isConfigured('testrail')) {
      toast.error('Please enter your TestRail API key');
      return;
    }
    setTestrailSaving(true);
    try {
      await integrationAPI.saveConfig(
        'testrail',
        testrailForm.api_key?.trim()
          ? { api_key: testrailForm.api_key.trim() }
          : { provider: 'testrail' },
        { url: testrailForm.url, email: testrailForm.email, project_id: testrailForm.project_id }
      );
      toast.success('TestRail configuration saved!');
      loadConfigs();
    } catch (err) {
      // handled by interceptor
    } finally {
      setTestrailSaving(false);
    }
  };
  const handleTestrailDelete = () => {
    openDeleteModal('testrail');
  };

  //  View credentials handlers 
  const handleViewToken = (integrationType) => {
    if (!isConfigured(integrationType)) {
      toast.error('Integration not configured');
      return;
    }
    setViewIntegrationType(integrationType);
    setShowPasswordModal(true);
    setVerifyPassword('');
    setRevealedToken(null);
  };

  const handlePasswordVerify = async () => {
    if (!verifyPassword) {
      toast.error('Please enter your password');
      return;
    }
    setVerifying(true);
    try {
      const result = await integrationAPI.viewCredentials(
        viewIntegrationType,
        verifyPassword
      );
      const token = viewIntegrationType === 'jira'
        ? result.credentials?.api_token
        : viewIntegrationType === 'azure_devops'
          ? result.credentials?.personal_access_token
          : result.credentials?.api_key;
      setRevealedToken(token || 'No token found');
      toast.success('Token revealed');

      // Optionally, retry the last save (Xray/Zephyr)
      if (viewIntegrationType === 'jira') {
        if (xraySaving) handleXraySave();
        if (zephyrSaving) handleZephyrSave();
      }
    } catch (err) {
      // Error handled by interceptor
      setRevealedToken(null);
    } finally {
      setVerifying(false);
      setVerifyPassword('');
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setVerifyPassword('');
    setRevealedToken(null);
    setViewIntegrationType(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Shield size={20} className="text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800">
            Your credentials are encrypted and stored securely
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Integration credentials are scoped to your current workspace (personal or team). Configure ticket tracking integrations (Jira, Azure DevOps) and test management tools (Xray, Zephyr, TestRail) to automate your workflow. All API tokens and keys are encrypted at rest using AES-256.
          </p>
        </div>
      </div>

      {/*  Jira Integration  */}
      <div className="card">
        <button
          onClick={() => toggleSection('jira')}
          className="w-full flex items-center justify-between mb-0 focus:outline-none group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              J
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900">Jira</h3>
              <div className="flex items-center gap-2 text-xs">
                {isConfigured('jira') ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle size={12} /> Connected
                  </span>
                ) : (
                  <span className="text-gray-500 flex items-center gap-1">
                    <XCircle size={12} /> Not configured
                  </span>
                )}
                {getLastUpdated('jira') && (
                  <span className="text-gray-400">
                    &bull; Updated {getLastUpdated('jira')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {expandedSection === 'jira' ? (
            <ChevronDown size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          ) : (
            <ChevronRight size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          )}
        </button>

        {expandedSection === 'jira' && (
          <div className="space-y-4 mt-5 pt-5 border-t border-gray-200">
            <div>
              <label className="input-label">Jira URL <span className="text-red-500">*</span></label>
              <input
                type="url"
                value={jiraForm.url}
                onChange={(e) => setJiraForm((p) => ({ ...p, url: e.target.value }))}
                className="input"
                placeholder="https://your-org.atlassian.net"
              />
            </div>
            <div>
              <label className="input-label">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={jiraForm.email}
                onChange={(e) => setJiraForm((p) => ({ ...p, email: e.target.value }))}
                className="input"
                placeholder="your-email@company.com"
              />
            </div>
            <div>
              <label className="input-label">API Token</label>
              <div className="relative">
                <input
                  type="password"
                  value={jiraForm.api_token}
                  onChange={(e) => setJiraForm((p) => ({ ...p, api_token: e.target.value }))}
                  className="input pr-10"
                  placeholder={isConfigured('jira') ? '****************' : 'Your Jira API token'}
                />
                {isConfigured('jira') && (
                  <button
                    type="button"
                    onClick={() => handleViewToken('jira')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="View stored token (requires password)"
                  >
                    <Eye size={18} />
                  </button>
                )}
              </div>
              <p className="input-hint">
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline inline-flex items-center gap-1"
                >
                  Generate API token at Atlassian <ExternalLink size={10} />
                </a>
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleJiraTest}
                disabled={jiraTesting}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {jiraTesting ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <Link2 size={14} />
                )}
                Test Connection
              </button>
              <button
                onClick={handleJiraSave}
                disabled={jiraSaving || !jiraReady || !jiraHasChanges}
                className="btn-primary flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {jiraSaving ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <CheckCircle size={14} />
                )}
                Save
              </button>
              {isConfigured('jira') && (
                <button
                  onClick={handleJiraDelete}
                  className="btn-secondary text-red-600 hover:text-red-700 flex items-center gap-1 text-sm ml-auto"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/*  Azure DevOps Integration  */}
      <div className="card">
        <button
          onClick={() => toggleSection('azure_devops')}
          className="w-full flex items-center justify-between mb-0 focus:outline-none group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold">
              A
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900">Azure DevOps</h3>
              <div className="flex items-center gap-2 text-xs">
                {isConfigured('azure_devops') ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle size={12} /> Connected
                  </span>
                ) : (
                  <span className="text-gray-500 flex items-center gap-1">
                    <XCircle size={12} /> Not configured
                  </span>
                )}
                {getLastUpdated('azure_devops') && (
                  <span className="text-gray-400">
                    &bull; Updated {getLastUpdated('azure_devops')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {expandedSection === 'azure_devops' ? (
            <ChevronDown size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          ) : (
            <ChevronRight size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          )}
        </button>

        {expandedSection === 'azure_devops' && (
          <div className="space-y-4 mt-5 pt-5 border-t border-gray-200">
            <div>
              <label className="input-label">
                Organization URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={adoForm.organization_url}
                onChange={(e) =>
                  setAdoForm((p) => ({ ...p, organization_url: e.target.value }))
                }
                className="input"
                placeholder="https://dev.azure.com/your-org"
              />
            </div>
            <div>
              <label className="input-label">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={adoForm.project}
                onChange={(e) => setAdoForm((p) => ({ ...p, project: e.target.value }))}
                className="input"
                placeholder="Your project name"
              />
            </div>
            <div>
              <label className="input-label">
                Personal Access Token (PAT)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={adoForm.personal_access_token}
                  onChange={(e) =>
                    setAdoForm((p) => ({ ...p, personal_access_token: e.target.value }))
                  }
                  className="input pr-10"
                  placeholder={isConfigured('azure_devops') ? '****************' : 'Your PAT'}
                />
                {isConfigured('azure_devops') && (
                  <button
                    type="button"
                    onClick={() => handleViewToken('azure_devops')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="View stored token (requires password)"
                  >
                    <Eye size={18} />
                  </button>
                )}
              </div>
              <p className="input-hint">
                <a
                  href="https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline inline-flex items-center gap-1"
                >
                  Learn how to create a PAT <ExternalLink size={10} />
                </a>
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAdoTest}
                disabled={adoTesting}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {adoTesting ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <Link2 size={14} />
                )}
                Test Connection
              </button>
              <button
                onClick={handleAdoSave}
                disabled={adoSaving || !adoReady || !adoHasChanges}
                className="btn-primary flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {adoSaving ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <CheckCircle size={14} />
                )}
                Save
              </button>
              {isConfigured('azure_devops') && (
                <button
                  onClick={handleAdoDelete}
                  className="btn-secondary text-red-600 hover:text-red-700 flex items-center gap-1 text-sm ml-auto"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/*  Xray Integration  */}
      <div className="card">
        <button
          onClick={() => toggleSection('xray')}
          className="w-full flex items-center justify-between mb-0 focus:outline-none group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold">
              X
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900">Xray for Jira</h3>
              <div className="flex items-center gap-2 text-xs">
                {isConfigured('xray') ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle size={12} /> Connected
                  </span>
                ) : (
                  <span className="text-gray-500 flex items-center gap-1">
                    <XCircle size={12} /> Not configured
                  </span>
                )}
                {getLastUpdated('xray') && (
                  <span className="text-gray-400">
                    &bull; Updated {getLastUpdated('xray')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {expandedSection === 'xray' ? (
            <ChevronDown size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          ) : (
            <ChevronRight size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          )}
        </button>

        {expandedSection === 'xray' && (
          <div className="space-y-4 mt-5 pt-5 border-t border-gray-200">
            {!isConfigured('jira') && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-sm text-yellow-800">
                  Xray uses your Jira credentials. Please configure Jira first.
                </p>
              </div>
            )}
            <div>
              <label className="input-label">Jira Project Key <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={xrayForm.project_key}
                onChange={(e) => setXrayForm((p) => ({ ...p, project_key: e.target.value }))}
                className="input"
                placeholder="e.g., PROJ"
              />
              <p className="input-hint">
                The project where Xray test cases will be created
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleXraySave}
                disabled={xraySaving || !xrayReady || !xrayHasChanges}
                className="btn-primary flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {xraySaving ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <CheckCircle size={14} />
                )}
                Save
              </button>
              {isConfigured('xray') && (
                <button
                  onClick={handleXrayDelete}
                  className="btn-secondary text-red-600 hover:text-red-700 flex items-center gap-1 text-sm ml-auto"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/*  Zephyr Scale Integration  */}
      <div className="card">
        <button
          onClick={() => toggleSection('zephyr')}
          className="w-full flex items-center justify-between mb-0 focus:outline-none group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold">
              Z
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900">Zephyr Scale</h3>
              <div className="flex items-center gap-2 text-xs">
                {isConfigured('zephyr') ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle size={12} /> Connected
                  </span>
                ) : (
                  <span className="text-gray-500 flex items-center gap-1">
                    <XCircle size={12} /> Not configured
                  </span>
                )}
                {getLastUpdated('zephyr') && (
                  <span className="text-gray-400">
                    &bull; Updated {getLastUpdated('zephyr')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {expandedSection === 'zephyr' ? (
            <ChevronDown size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          ) : (
            <ChevronRight size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          )}
        </button>

        {expandedSection === 'zephyr' && (
          <div className="space-y-4 mt-5 pt-5 border-t border-gray-200">
            {!isConfigured('jira') && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-sm text-yellow-800">
                  Zephyr uses your Jira credentials. Please configure Jira first.
                </p>
              </div>
            )}
            <div>
              <label className="input-label">Jira Project Key <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={zephyrForm.project_key}
                onChange={(e) => setZephyrForm((p) => ({ ...p, project_key: e.target.value }))}
                className="input"
                placeholder="e.g., PROJ"
              />
              <p className="input-hint">
                The project where Zephyr test cases will be created
              </p>
            </div>
            <div>
              <label className="input-label">Zephyr API Token <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type="password"
                  value={zephyrForm.zephyr_token}
                  onChange={(e) => setZephyrForm((p) => ({ ...p, zephyr_token: e.target.value }))}
                  className="input"
                  required
                  placeholder={isConfigured('zephyr') ? '****************' : 'Enter Zephyr Scale API token'}
                />
              </div>
              <p className="input-hint">
                Required for first-time setup. Leave blank only if you already saved a token and are updating other fields.
              </p>
              <p className="input-hint">
                <a
                  href="https://support.smartbear.com/zephyr-scale-cloud/docs/rest-api/generating-api-access-tokens.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline inline-flex items-center gap-1"
                >
                  Learn how to generate Zephyr API token <ExternalLink size={10} />
                </a>
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleZephyrSave}
                disabled={zephyrSaving || !zephyrReady || !zephyrHasChanges}
                className="btn-primary flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {zephyrSaving ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <CheckCircle size={14} />
                )}
                Save
              </button>
              {isConfigured('zephyr') && (
                <button
                  onClick={handleZephyrDelete}
                  className="btn-secondary text-red-600 hover:text-red-700 flex items-center gap-1 text-sm ml-auto"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/*  TestRail Integration  */}
      <div className="card">
        <button
          onClick={() => toggleSection('testrail')}
          className="w-full flex items-center justify-between mb-0 focus:outline-none group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold">
              T
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900">TestRail</h3>
              <div className="flex items-center gap-2 text-xs">
                {isConfigured('testrail') ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle size={12} /> Connected
                  </span>
                ) : (
                  <span className="text-gray-500 flex items-center gap-1">
                    <XCircle size={12} /> Not configured
                  </span>
                )}
                {getLastUpdated('testrail') && (
                  <span className="text-gray-400">
                    &bull; Updated {getLastUpdated('testrail')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {expandedSection === 'testrail' ? (
            <ChevronDown size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          ) : (
            <ChevronRight size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          )}
        </button>

        {expandedSection === 'testrail' && (
          <div className="space-y-4 mt-5 pt-5 border-t border-gray-200">
            <div>
              <label className="input-label">TestRail URL <span className="text-red-500">*</span></label>
              <input
                type="url"
                value={testrailForm.url}
                onChange={(e) => setTestrailForm((p) => ({ ...p, url: e.target.value }))}
                className="input"
                placeholder="https://your-org.testrail.io"
              />
            </div>
            <div>
              <label className="input-label">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={testrailForm.email}
                onChange={(e) => setTestrailForm((p) => ({ ...p, email: e.target.value }))}
                className="input"
                placeholder="your-email@company.com"
              />
            </div>
            <div>
              <label className="input-label">API Key (Optional)</label>
              <div className="relative">
                <input
                  type="password"
                  value={testrailForm.api_key}
                  onChange={(e) => setTestrailForm((p) => ({ ...p, api_key: e.target.value }))}
                  className="input pr-10"
                  placeholder={isConfigured('testrail') ? '****************' : 'Your TestRail API key'}
                />
                {isConfigured('testrail') && (
                  <button
                    type="button"
                    onClick={() => handleViewToken('testrail')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="View stored key (requires password)"
                  >
                    <Eye size={18} />
                  </button>
                )}
              </div>
              <p className="input-hint">
                Optional when already configured. Leave blank to keep your existing saved key.
              </p>
              <p className="input-hint">
                <a
                  href="https://support.testrail.com/hc/en-us/articles/7077039051284-Accessing-the-TestRail-API"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline inline-flex items-center gap-1"
                >
                  Learn how to generate API key <ExternalLink size={10} />
                </a>
              </p>
            </div>
            <div>
              <label className="input-label">Project ID (Optional)</label>
              <input
                type="text"
                value={testrailForm.project_id}
                onChange={(e) => setTestrailForm((p) => ({ ...p, project_id: e.target.value }))}
                className="input"
                placeholder="e.g., 1"
              />
              <p className="input-hint">
                Default project ID for test case exports
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleTestrailTest}
                disabled={testrailTesting}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {testrailTesting ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <Link2 size={14} />
                )}
                Test Connection
              </button>
              <button
                onClick={handleTestrailSave}
                disabled={testrailSaving || !testrailReady || !testrailHasChanges}
                className="btn-primary flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testrailSaving ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <CheckCircle size={14} />
                )}
                Save
              </button>
              {isConfigured('testrail') && (
                <button
                  onClick={handleTestrailDelete}
                  className="btn-secondary text-red-600 hover:text-red-700 flex items-center gap-1 text-sm ml-auto"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle size={20} className="text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Remove Integration</h3>
                    <p className="text-xs text-gray-500">This will delete saved credentials</p>
                  </div>
                </div>
                <button
                  onClick={closeDeleteModal}
                  disabled={deletingIntegration}
                  className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="px-6 py-5">
                <p className="text-sm text-gray-700">
                  Remove <span className="font-semibold">{integrationLabels[pendingDeleteType] || 'this integration'}</span> configuration?
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  You can configure it again anytime.
                </p>
              </div>

              <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-2">
                <button
                  onClick={closeDeleteModal}
                  disabled={deletingIntegration}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteIntegration}
                  disabled={deletingIntegration}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {deletingIntegration ? (
                    <>
                      <Loader size={14} className="animate-spin" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Remove
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }
      {/*  Password Verification Modal  */}
      {showPasswordModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Lock size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">View Stored Token</h3>
                  <p className="text-xs text-gray-500">Password verification required</p>
                </div>
              </div>
              <button
                onClick={closePasswordModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <Shield size={16} className="text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-sm text-yellow-800">
                  Enter your account password to decrypt and view the stored credentials.
                </p>
              </div>

              {!revealedToken ? (
                <div>
                  <label className="input-label">Your Password</label>
                  <input
                    type="password"
                    value={verifyPassword}
                    onChange={(e) => setVerifyPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordVerify()}
                    className="input"
                    placeholder="Enter your password"
                    autoFocus
                  />
                </div>
              ) : (
                <div>
                  <label className="input-label">Decrypted Token</label>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={revealedToken}
                      className="input font-mono text-sm resize-none"
                      rows={4}
                      onClick={(e) => e.target.select()}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Click to select all - Keep this token secure
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-2">
              {!revealedToken ? (
                <>
                  <button
                    onClick={closePasswordModal}
                    className="btn-secondary text-sm"
                    disabled={verifying}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasswordVerify}
                    disabled={verifying || !verifyPassword}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    {verifying ? (
                      <Loader size={14} className="animate-spin" />
                    ) : (
                      <Eye size={14} />
                    )}
                    {verifying ? 'Verifying...' : 'View Token'}
                  </button>
                </>
              ) : (
                <button
                  onClick={closePasswordModal}
                  className="btn-primary text-sm"
                >
                  Close
                </button>
              )}
            </div>
          </div>
          </div>,
          document.body
        )
      }
    </div>
  );
};

export default IntegrationSettings;

























