/**
 * IntegrationTab Component
 * Live ticket fetching from Jira/Azure DevOps with generate action
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  FileText,
  Loader,
  Settings,
  UploadCloud,
  X,
} from 'lucide-react';
import { integrationAPI } from '../../services/api';
import toast from 'react-hot-toast';
import ImageUpload from './ImageUpload';

const IntegrationTab = ({ integrationConfigs, onGenerate, generating }) => {
  const navigate = useNavigate();
  const [integrationType, setIntegrationType] = useState('jira');
  const [integrationTicketId, setIntegrationTicketId] = useState('');
  const [fetchedTicket, setFetchedTicket] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [screenshots, setScreenshots] = useState([]);

  const isIntegrationConfigured = (type) => {
    return integrationConfigs.some((c) => c.integration_type === type && c.configured);
  };

  const handleFetchTicket = async () => {
    if (!integrationTicketId.trim()) {
      toast.error('Enter a ticket ID');
      return;
    }
    setFetching(true);
    try {
      const result = await integrationAPI.fetchTicket(integrationType, integrationTicketId.trim());
      setFetchedTicket(result.ticket);
      toast.success('Ticket fetched successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch ticket');
    } finally {
      setFetching(false);
    }
  };

  const handleIntegrationGenerate = () => {
    if (!fetchedTicket) return;
    const ticketData = {
      ticket_id: fetchedTicket.ticket_id,
      title: fetchedTicket.title,
      description: fetchedTicket.description || '',
      ticket_type: fetchedTicket.ticket_type || 'story',
      priority: fetchedTicket.priority || 'P2',
      acceptance_criteria: fetchedTicket.acceptance_criteria || [],
      integration_type: integrationType, // Backend expects 'integration_type'
      images: screenshots,
    };
    onGenerate(ticketData);
  };

  return (
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
        <label className="input-label">Ticket ID</label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFetchTicket();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={integrationTicketId}
            onChange={(e) => setIntegrationTicketId(e.target.value)}
            className="input flex-1"
            placeholder={integrationType === 'jira' ? 'e.g., PROJ-123' : 'e.g., 12345'}
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
              <h4 className="text-lg font-semibold text-gray-900">{fetchedTicket.title}</h4>
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
                    <span className="font-medium text-gray-700">
                      {comment.author || 'Unknown'}
                    </span>
                    <span className="text-gray-400 text-xs ml-2">
                      {comment.created ? new Date(comment.created).toLocaleDateString() : ''}
                    </span>
                    <p className="mt-0.5">
                      {comment.body ||
                        (typeof comment === 'string' ? comment : JSON.stringify(comment))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-gray-100 space-y-4">
            {/* Screenshots for additional context */}
            <ImageUpload images={screenshots} onChange={setScreenshots} />

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
  );
};

export default IntegrationTab;
