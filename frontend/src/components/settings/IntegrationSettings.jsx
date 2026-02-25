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
  EyeOff,
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
  const [jiraTesting, setJiraTesting] = useState(false);
  const [jiraSaving, setJiraSaving] = useState(false);

  // Azure DevOps form
  const [adoForm, setAdoForm] = useState({
    organization_url: '',
    project: '',
    personal_access_token: '',
  });
  const [adoTesting, setAdoTesting] = useState(false);
  const [adoSaving, setAdoSaving] = useState(false);

  // Xray form (uses Jira credentials)
  const [xrayForm, setXrayForm] = useState({ project_key: '' });
  const [xrayTesting, setXrayTesting] = useState(false);
  const [xraySaving, setXraySaving] = useState(false);

  // Zephyr form (uses Jira credentials + optional Zephyr token)
  const [zephyrForm, setZephyrForm] = useState({ zephyr_token: '', project_key: '' });
  const [zephyrTesting, setZephyrTesting] = useState(false);
  const [zephyrSaving, setZephyrSaving] = useState(false);

  // TestRail form
  const [testrailForm, setTestrailForm] = useState({ url: '', email: '', api_key: '', project_id: '' });
  const [testrailTesting, setTestrailTesting] = useState(false);
  const [testrailSaving, setTestrailSaving] = useState(false);

  // Password modal for viewing credentials
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [viewIntegrationType, setViewIntegrationType] = useState(null);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [revealedToken, setRevealedToken] = useState(null);

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
        setJiraForm((prev) => ({
          ...prev,
          url: jiraConfig.config.url || '',
          email: jiraConfig.config.email || '',
        }));
      }

      const adoConfig = (data.integrations || []).find(
        (c) => c.integration_type === 'azure_devops'
      );
      if (adoConfig?.config) {
        setAdoForm((prev) => ({
          ...prev,
          organization_url: adoConfig.config.organization_url || '',
          project: adoConfig.config.project || '',
        }));
      }

      // Pre-fill test management tools
      const xrayConfig = (data.integrations || []).find(
        (c) => c.integration_type === 'xray'
      );
      if (xrayConfig?.config) {
        setXrayForm((prev) => ({
          ...prev,
          project_key: xrayConfig.config.project_key || '',
        }));
      }

      const zephyrConfig = (data.integrations || []).find(
        (c) => c.integration_type === 'zephyr'
      );
      if (zephyrConfig?.config) {
        setZephyrForm((prev) => ({
          ...prev,
          project_key: zephyrConfig.config.project_key || '',
        }));
      }

      const testrailConfig = (data.integrations || []).find(
        (c) => c.integration_type === 'testrail'
      );
      if (testrailConfig?.config) {
        setTestrailForm((prev) => ({
          ...prev,
          url: testrailConfig.config.url || '',
          email: testrailConfig.config.email || '',
          project_id: testrailConfig.config.project_id || '',
        }));
      }
    } catch (err) {
      console.error('Failed to load configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = (type) =>
    integrationConfigs.some((c) => c.integration_type === type && c.configured);

  const getLastUpdated = (type) => {
    const config = integrationConfigs.find((c) => c.integration_type === type);
    return config?.updated_at
      ? new Date(config.updated_at).toLocaleString()
      : null;
  };

  // ── Jira handlers ──
  const handleJiraTest = async () => {
    if (!jiraForm.url || !jiraForm.email || !jiraForm.api_token) {
      toast.error('Please fill in all Jira fields');
      return;
    }
    setJiraTesting(true);
    try {
      const result = await integrationAPI.testConnection(
        'jira',
        { api_token: jiraForm.api_token },
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
    if (!jiraForm.url || !jiraForm.email || !jiraForm.api_token) {
      toast.error('Please fill in all Jira fields');
      return;
    }
    setJiraSaving(true);
    try {
      await integrationAPI.saveConfig(
        'jira',
        { api_token: jiraForm.api_token },
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

  const handleJiraDelete = async () => {
    if (!confirm('Remove Jira configuration?')) return;
    try {
      await integrationAPI.deleteConfig('jira');
      toast.success('Jira configuration removed');
      setJiraForm({ url: '', email: '', api_token: '' });
      loadConfigs();
    } catch (err) {
      // handled by interceptor
    }
  };

  // ── Azure DevOps handlers ──
  const handleAdoTest = async () => {
    if (!adoForm.organization_url || !adoForm.personal_access_token || !adoForm.project) {
      toast.error('Please fill in all Azure DevOps fields');
      return;
    }
    setAdoTesting(true);
    try {
      const result = await integrationAPI.testConnection(
        'azure_devops',
        { personal_access_token: adoForm.personal_access_token },
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
    if (!adoForm.organization_url || !adoForm.personal_access_token || !adoForm.project) {
      toast.error('Please fill in all Azure DevOps fields');
      return;
    }
    setAdoSaving(true);
    try {
      await integrationAPI.saveConfig(
        'azure_devops',
        { personal_access_token: adoForm.personal_access_token },
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

  const handleAdoDelete = async () => {
    if (!confirm('Remove Azure DevOps configuration?')) return;
    try {
      await integrationAPI.deleteConfig('azure_devops');
      toast.success('Azure DevOps configuration removed');
      setAdoForm({ organization_url: '', project: '', personal_access_token: '' });
      loadConfigs();
    } catch (err) {
      // handled by interceptor
    }
  };

  // ── Xray handlers ──
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

  const handleXrayDelete = async () => {
    if (!confirm('Remove Xray configuration?')) return;
    try {
      await integrationAPI.deleteConfig('xray');
      toast.success('Xray configuration removed');
      setXrayForm({ project_key: '' });
      loadConfigs();
    } catch (err) {
      // handled by interceptor
    }
  };

  // ── Zephyr handlers ──
  const handleZephyrSave = async () => {
    if (!zephyrForm.project_key) {
      toast.error('Please enter Zephyr project key');
      return;
    }
    if (!isConfigured('jira')) {
      toast.error('Jira must be configured first (Zephyr uses Jira credentials)');
      return;
    }
    if (!zephyrForm.zephyr_token?.trim()) {
      toast.error('Zephyr API token is required');
      return;
    }
    setZephyrSaving(true);
    try {
      await integrationAPI.saveConfig(
        'zephyr',
        {
          zephyr_token: zephyrForm.zephyr_token.trim()
        },
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

  const handleZephyrDelete = async () => {
    if (!confirm('Remove Zephyr configuration?')) return;
    try {
      await integrationAPI.deleteConfig('zephyr');
      toast.success('Zephyr configuration removed');
      setZephyrForm({ zephyr_token: '', project_key: '' });
      loadConfigs();
    } catch (err) {
      // handled by interceptor
    }
  };

  // ── TestRail handlers ──
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
    if (!testrailForm.url || !testrailForm.email || !testrailForm.api_key) {
      toast.error('Please fill in all TestRail fields');
      return;
    }
    setTestrailSaving(true);
    try {
      await integrationAPI.saveConfig(
        'testrail',
        { api_key: testrailForm.api_key },
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

  const handleTestrailDelete = async () => {
    if (!confirm('Remove TestRail configuration?')) return;
    try {
      await integrationAPI.deleteConfig('testrail');
      toast.success('TestRail configuration removed');
      setTestrailForm({ url: '', email: '', api_key: '', project_id: '' });
      loadConfigs();
    } catch (err) {
      // handled by interceptor
    }
  };

  // ── View credentials handlers ──
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
        : result.credentials?.personal_access_token;
      setRevealedToken(token || 'No token found');
      toast.success('Token revealed');
      // If modal was triggered for dependent integration, auto-fill token and retry save
      if (viewIntegrationType === 'jira' && !jiraForm.api_token && token) {
        setJiraForm((prev) => ({ ...prev, api_token: token }));
        setShowPasswordModal(false);
        setVerifyPassword('');
        setRevealedToken(null);
        setViewIntegrationType(null);
        // Optionally, retry the last save (Xray/Zephyr)
        if (xraySaving) handleXraySave();
        if (zephyrSaving) handleZephyrSave();
      }
    } catch (err) {
      // Error handled by interceptor
      setRevealedToken(null);
    } finally {
      setVerifying(false);
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

      {/* ── Jira Integration ── */}
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
              <label className="input-label">Jira URL</label>
              <input
                type="url"
                value={jiraForm.url}
                onChange={(e) => setJiraForm((p) => ({ ...p, url: e.target.value }))}
                className="input"
                placeholder="https://your-org.atlassian.net"
              />
            </div>
            <div>
              <label className="input-label">Email</label>
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
                  placeholder={isConfigured('jira') ? '••••••••••••••••' : 'Your Jira API token'}
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
                disabled={jiraSaving}
                className="btn-primary flex items-center gap-2 text-sm"
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

      {/* ── Azure DevOps Integration ── */}
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
                Organization URL
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
                Project Name
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
                  placeholder={isConfigured('azure_devops') ? '••••••••••••••••' : 'Your PAT'}
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
                disabled={adoSaving}
                className="btn-primary flex items-center gap-2 text-sm"
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

      {/* ── Xray Integration ── */}
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
              <label className="input-label">Jira Project Key</label>
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
                disabled={xraySaving || !isConfigured('jira')}
                className="btn-primary flex items-center gap-2 text-sm"
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

      {/* ── Zephyr Scale Integration ── */}
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
              <label className="input-label">Jira Project Key</label>
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
              <label className="input-label">Zephyr API Token</label>
              <div className="relative">
                <input
                  type="password"
                  value={zephyrForm.zephyr_token}
                  onChange={(e) => setZephyrForm((p) => ({ ...p, zephyr_token: e.target.value }))}
                  className="input"
                  placeholder={isConfigured('zephyr') ? '••••••••••••••••' : 'Enter Zephyr Scale API token'}
                />
              </div>
              <p className="input-hint">
                Required for Zephyr Scale cloud exports.
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
                disabled={zephyrSaving || !isConfigured('jira')}
                className="btn-primary flex items-center gap-2 text-sm"
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

      {/* ── TestRail Integration ── */}
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
              <label className="input-label">TestRail URL</label>
              <input
                type="url"
                value={testrailForm.url}
                onChange={(e) => setTestrailForm((p) => ({ ...p, url: e.target.value }))}
                className="input"
                placeholder="https://your-org.testrail.io"
              />
            </div>
            <div>
              <label className="input-label">Email</label>
              <input
                type="email"
                value={testrailForm.email}
                onChange={(e) => setTestrailForm((p) => ({ ...p, email: e.target.value }))}
                className="input"
                placeholder="your-email@company.com"
              />
            </div>
            <div>
              <label className="input-label">API Key</label>
              <div className="relative">
                <input
                  type="password"
                  value={testrailForm.api_key}
                  onChange={(e) => setTestrailForm((p) => ({ ...p, api_key: e.target.value }))}
                  className="input pr-10"
                  placeholder={isConfigured('testrail') ? '••••••••••••••••' : 'Your TestRail API key'}
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
                disabled={testrailSaving}
                className="btn-primary flex items-center gap-2 text-sm"
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

      {/* ── Password Verification Modal ── */}
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
                    Click to select all • Keep this token secure
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
