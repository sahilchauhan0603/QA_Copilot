/**
 * Settings Page
 * Integration configuration for Jira & Azure DevOps
 */
import { Settings } from 'lucide-react';
import IntegrationSettings from '../components/settings/IntegrationSettings';

const SettingsPage = () => {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Settings size={28} className="text-primary-600" />
          Integration Settings
        </h1>
        <p className="text-gray-600 mt-1">
          Configure your Jira and Azure DevOps integrations to fetch tickets directly.
        </p>
      </div>
      <IntegrationSettings />
    </div>
  );
};

export default SettingsPage;
