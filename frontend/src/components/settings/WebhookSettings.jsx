/**
 * WebhookSettings Component
 * Manages webhook subscriptions for auto-regeneration on ticket updates
 */
import { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  Trash2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  Radio,
  Loader,
  ToggleLeft,
  ToggleRight,
  Info,
  Copy,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { webhookAPI } from '../../services/api';
import toast from 'react-hot-toast';

const WebhookSettings = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [activeGuide, setActiveGuide] = useState('jira');
  const [setupOpen, setSetupOpen] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await webhookAPI.getSubscriptions();
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
      toast.error('Failed to load webhook subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (sub) => {
    try {
      setTogglingId(sub.id);
      const data = await webhookAPI.updateSubscription(sub.id, {
        is_active: !sub.is_active,
      });
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === sub.id ? data.subscription : s))
      );
      toast.success(
        data.subscription.is_active
          ? `Monitoring enabled for ${sub.ticket_id}`
          : `Monitoring paused for ${sub.ticket_id}`
      );
    } catch (err) {
      toast.error('Failed to update subscription');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (sub) => {
    try {
      setDeletingId(sub.id);
      await webhookAPI.deleteSubscription(sub.id);
      setSubscriptions((prev) => prev.filter((s) => s.id !== sub.id));
      toast.success(`Stopped monitoring ${sub.ticket_id}`);
    } catch (err) {
      toast.error('Failed to delete subscription');
    } finally {
      setDeletingId(null);
    }
  };

  const integrationLabel = (type) => {
    switch (type) {
      case 'jira':
        return 'Jira';
      case 'azure_devops':
        return 'Azure DevOps';
      default:
        return type;
    }
  };

  const integrationColor = (type) => {
    switch (type) {
      case 'jira':
        return 'bg-blue-100 text-blue-700';
      case 'azure_devops':
        return 'bg-cyan-100 text-cyan-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="flex items-center justify-center gap-3 text-gray-400">
          <Loader size={20} className="animate-spin" />
          <span>Loading webhook subscriptions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
            <Radio size={18} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-indigo-900">
              How Webhook Monitoring Works
            </h3>
            <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
              When you enable monitoring for a ticket, QA Copilot listens for updates from
              Jira or Azure DevOps. When a significant change is detected (title, description,
              or acceptance criteria), test cases are automatically regenerated and you receive
              an email notification with the results.
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-indigo-600">
              <Info size={12} />
              <span>
                Configure your webhook URL in Jira/Azure DevOps to point to your server's webhook endpoint.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={() => setSetupOpen((o) => !o)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <ExternalLink size={14} />
            Webhook Setup Guide
          </h4>
          {setupOpen ? (
            <ChevronDown size={14} className="text-gray-400" />
          ) : (
            <ChevronRight size={14} className="text-gray-400" />
          )}
        </button>

        {setupOpen && (
          <div className="border-t border-gray-100">
            {/* Tab switcher */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveGuide('jira')}
                className={`flex-1 px-4 py-2 text-xs font-semibold transition-colors ${
                  activeGuide === 'jira'
                    ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/40'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Jira
              </button>
              <button
                onClick={() => setActiveGuide('azure_devops')}
                className={`flex-1 px-4 py-2 text-xs font-semibold transition-colors ${
                  activeGuide === 'azure_devops'
                    ? 'text-cyan-700 border-b-2 border-cyan-600 bg-cyan-50/40'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Azure DevOps
              </button>
            </div>

            {activeGuide === 'jira' && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-gray-500">
                  In your Jira instance, navigate to:
                  <span className="ml-1 font-medium text-gray-700">
                    Settings → System → WebHooks → Create WebHook
                  </span>
                </p>
                <ol className="space-y-3 text-xs text-gray-700">
                  <li className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">1</span>
                    <div>
                      <p className="font-medium">Set the Webhook URL</p>
                      <div className="mt-1 flex items-center gap-1 bg-gray-100 rounded px-2 py-1">
                        <code className="flex-1 text-gray-600 break-all">{`${window.location.origin}/api/webhooks/jira`}</code>
                        <button
                          onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/jira`)}
                          className="shrink-0 text-gray-400 hover:text-gray-600"
                          title="Copy"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">2</span>
                    <div>
                      <p className="font-medium">Set the Secret</p>
                      <p className="text-gray-500 mt-0.5">Paste the value of <code className="bg-gray-100 px-1 rounded">JIRA_WEBHOOK_SECRET</code> from your server's <code className="bg-gray-100 px-1 rounded">.env</code> file. Leave blank if you haven't set one.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">3</span>
                    <div>
                      <p className="font-medium">Select Events</p>
                      <p className="text-gray-500 mt-0.5">Under <span className="font-medium text-gray-700">Issue</span>, tick <span className="font-medium text-gray-700">updated</span>. No other events are needed.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">4</span>
                    <div>
                      <p className="font-medium">Save & Test</p>
                      <p className="text-gray-500 mt-0.5">Click <span className="font-medium text-gray-700">Create</span>. Update a monitored ticket in Jira — test cases will regenerate automatically.</p>
                    </div>
                  </li>
                </ol>
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-1">
                  <Info size={12} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">The server must be publicly accessible (e.g. deployed to Render). For local testing, expose port 5000 with <code className="bg-amber-100 px-1 rounded">ngrok http 5000</code> and use the ngrok URL above.</p>
                </div>
              </div>
            )}

            {activeGuide === 'azure_devops' && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-gray-500">
                  In your Azure DevOps project, navigate to:
                  <span className="ml-1 font-medium text-gray-700">
                    Project Settings → Service Hooks → + → Web Hooks
                  </span>
                </p>
                <ol className="space-y-3 text-xs text-gray-700">
                  <li className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-[10px]">1</span>
                    <div>
                      <p className="font-medium">Select Trigger</p>
                      <p className="text-gray-500 mt-0.5">Choose <span className="font-medium text-gray-700">Work item updated</span> as the trigger event.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-[10px]">2</span>
                    <div>
                      <p className="font-medium">Set the Action URL</p>
                      <div className="mt-1 flex items-center gap-1 bg-gray-100 rounded px-2 py-1">
                        <code className="flex-1 text-gray-600 break-all">{`${window.location.origin}/api/webhooks/azure-devops`}</code>
                        <button
                          onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/azure-devops`)}
                          className="shrink-0 text-gray-400 hover:text-gray-600"
                          title="Copy"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-[10px]">3</span>
                    <div>
                      <p className="font-medium">Configure Basic Authentication</p>
                      <p className="text-gray-500 mt-0.5">Set <span className="font-medium text-gray-700">Username</span> to anything (e.g. <code className="bg-gray-100 px-1 rounded">qa-copilot</code>). Set <span className="font-medium text-gray-700">Password</span> to the value of <code className="bg-gray-100 px-1 rounded">ADO_WEBHOOK_SECRET</code> from your <code className="bg-gray-100 px-1 rounded">.env</code> file.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center text-[10px]">4</span>
                    <div>
                      <p className="font-medium">Finish & Test</p>
                      <p className="text-gray-500 mt-0.5">Click <span className="font-medium text-gray-700">Finish</span>. Update a monitored work item — test cases will regenerate automatically.</p>
                    </div>
                  </li>
                </ol>
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-1">
                  <Info size={12} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">The server must be publicly accessible (e.g. deployed to Render). For local testing, expose port 5000 with <code className="bg-amber-100 px-1 rounded">ngrok http 5000</code> and use the ngrok URL above.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subscriptions List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Bell size={14} />
            Monitored Tickets
            {subscriptions.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {subscriptions.length}
              </span>
            )}
          </h4>
          <button
            onClick={loadSubscriptions}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {subscriptions.length === 0 ? (
          <div className="p-8 text-center">
            <BellOff size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 font-medium">
              No tickets being monitored
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Enable monitoring from the test generation results to auto-regenerate
              tests when tickets are updated.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className={`px-4 py-3 flex items-center gap-3 transition-colors ${
                  sub.is_active
                    ? 'bg-white hover:bg-gray-50'
                    : 'bg-gray-50/50'
                }`}
              >
                {/* Status Indicator */}
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    sub.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                  }`}
                />

                {/* Ticket Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 font-mono">
                      {sub.ticket_id}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${integrationColor(
                        sub.integration_type
                      )}`}
                    >
                      {integrationLabel(sub.integration_type)}
                    </span>
                    {sub.is_active ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium flex items-center gap-1">
                        <CheckCircle size={10} />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium flex items-center gap-1">
                        <AlertCircle size={10} />
                        Paused
                      </span>
                    )}
                  </div>
                  {sub.ticket_title && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {sub.ticket_title}
                    </p>
                  )}
                  {sub.last_triggered_at && (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock size={10} />
                      Last triggered:{' '}
                      {new Date(sub.last_triggered_at).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(sub)}
                    disabled={togglingId === sub.id}
                    className={`p-1.5 rounded-lg transition-colors ${
                      sub.is_active
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    title={sub.is_active ? 'Pause monitoring' : 'Resume monitoring'}
                  >
                    {togglingId === sub.id ? (
                      <Loader size={16} className="animate-spin" />
                    ) : sub.is_active ? (
                      <ToggleRight size={20} />
                    ) : (
                      <ToggleLeft size={20} />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(sub)}
                    disabled={deletingId === sub.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove subscription"
                  >
                    {deletingId === sub.id ? (
                      <Loader size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebhookSettings;
