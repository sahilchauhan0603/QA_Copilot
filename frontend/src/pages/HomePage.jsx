/**
 * Home Page Component
 * Main dashboard/homepage for authenticated users
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, TestTube, TrendingUp, ArrowRight, Zap, Shield, Clock } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../services/api';

const HomePage = () => {
  const { user, getActiveWorkspaceDetails } = useAuthStore();
  const activeWorkspace = getActiveWorkspaceDetails();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      const response = await api.get('/test-generation/statistics');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl shadow-lg text-white p-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, {user?.full_name || user?.username}! 👋
            </h1>
            <p className="text-primary-100 text-lg">
              Current workspace: <span className="font-semibold">{activeWorkspace?.name}</span>
            </p>
            <p className="text-primary-200 mt-2">
              {activeWorkspace?.type === 'personal' 
                ? 'Your personal workspace for individual test generations' 
                : `Collaborating with your team`
              }
            </p>
          </div>
          <div className="hidden sm:block">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-4xl">🚀</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-lg">
              <FileText size={24} className="text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-900">
                {loading ? '...' : stats?.total_test_cases || 0}
              </div>
              <div className="text-sm text-blue-700">Test Cases Generated</div>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-600 rounded-lg">
              <TestTube size={24} className="text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-900">
                {loading ? '...' : stats?.total_generations || 0}
              </div>
              <div className="text-sm text-green-700">Total Generations</div>
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
                {loading ? '...' : 
                  stats?.total_test_cases && stats?.total_generations 
                    ? Math.round(stats.total_test_cases / stats.total_generations) 
                    : 0
                }
              </div>
              <div className="text-sm text-purple-700">Avg Tests/Generation</div>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-600 rounded-lg">
              <Users size={24} className="text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-900">
                {activeWorkspace?.type === 'personal' ? 'Personal' : 'Team'}
              </div>
              <div className="text-sm text-orange-700">Workspace Mode</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Link to="/test-generation" className="group">
          <div className="card hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-2 border-transparent hover:border-primary-300">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                <TestTube size={32} className="text-primary-600" />
              </div>
              <ArrowRight size={24} className="text-gray-400 group-hover:text-primary-600 transition-colors" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Generate Test Cases</h3>
            <p className="text-gray-600 mb-4">
              Transform your tickets into comprehensive test cases using AI-powered analysis
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                AI-Powered
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                5-Agent Pipeline
              </span>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                Excel Export
              </span>
            </div>
          </div>
        </Link>

        <Link to="/teams" className="group">
          <div className="card hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-2 border-transparent hover:border-primary-300">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <Users size={32} className="text-green-600" />
              </div>
              <ArrowRight size={24} className="text-gray-400 group-hover:text-primary-600 transition-colors" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Manage Teams</h3>
            <p className="text-gray-600 mb-4">
              Create teams, invite members, and collaborate on test case generation using the power of AI
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                Collaboration
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                Role-Based Access
              </span>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                Workspace Sharing
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Features Overview */}
      <div className="card bg-gradient-to-br from-gray-50 to-gray-100">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Why QA Copilot?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-primary-100 rounded-lg flex-shrink-0">
              <Zap size={24} className="text-primary-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Lightning Fast</h4>
              <p className="text-sm text-gray-600">
                Generate comprehensive test suites in seconds, not hours
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
              <Shield size={24} className="text-green-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Quality Assured</h4>
              <p className="text-sm text-gray-600">
                AI-powered coverage analysis identifies gaps and edge cases
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <Clock size={24} className="text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Save Time</h4>
              <p className="text-sm text-gray-600">
                Reduce manual test writing by 80% with intelligent automation
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Getting Started Guide */}
      {(!stats || stats.total_generations === 0) && (
        <div className="card bg-primary-50 border-2 border-primary-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary-600 rounded-lg flex-shrink-0">
              <FileText size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-primary-900 mb-2">
                🎯 Ready to get started?
              </h3>
              <p className="text-primary-800 mb-4">
                Generate your first test suite in just a few clicks!
              </p>
              <ol className="space-y-2 text-primary-700 mb-4">
                <li className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <span>Click on "Generate Test Cases" or navigate to Test Generation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <span>Enter your ticket details (ID, title, description)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <span>Let AI analyze and generate comprehensive test cases</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">4.</span>
                  <span>Review, download Excel, and start testing!</span>
                </li>
              </ol>
              <Link to="/test-generation" className="btn-primary inline-block">
                Generate Your First Test Suite →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
