/**
 * Settings Page
 * Integration configuration & Webhook monitoring
 */
import { useState } from 'react';
import { Settings, Link2, Bell } from 'lucide-react';
import IntegrationSettings from '../components/settings/IntegrationSettings';
import WebhookSettings from '../components/settings/WebhookSettings';

const TABS = [
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'webhooks', label: 'Webhook Monitoring', icon: Bell },
];

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('integrations');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Settings size={28} className="text-primary-600" />
          Settings
        </h1>
        <p className="text-gray-600 mt-1">
          Configure integrations and webhook monitoring for auto-regeneration.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'integrations' && <IntegrationSettings />}
      {activeTab === 'webhooks' && <WebhookSettings />}
    </div>
  );
};

export default SettingsPage;
