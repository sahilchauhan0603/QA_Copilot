/**
 * Test Generation Component
 * Handles AI-powered test case generation from tickets
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
  BarChart,
  ListChecks,
  Plus,
  Search,
  X
} from 'lucide-react';
import api from '../services/api';

const TestGeneration = () => {
  const [generations, setGenerations] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    ticket_id: '',
    title: '',
    description: '',
    ticket_type: 'story',
    priority: 'P2',
    acceptance_criteria: ['']
  });

  // Load data on mount
  useEffect(() => {
    loadGenerations();
    loadStatistics();
  }, []);

  const loadGenerations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/test-generation/generations');
      setGenerations(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load generations');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await api.get('/test-generation/statistics');
      setStatistics(response.data);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAcceptanceCriteriaChange = (index, value) => {
    const newCriteria = [...formData.acceptance_criteria];
    newCriteria[index] = value;
    setFormData(prev => ({ ...prev, acceptance_criteria: newCriteria }));
  };

  const addAcceptanceCriteria = () => {
    setFormData(prev => ({
      ...prev,
      acceptance_criteria: [...prev.acceptance_criteria, '']
    }));
  };

  const removeAcceptanceCriteria = (index) => {
    const newCriteria = formData.acceptance_criteria.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      acceptance_criteria: newCriteria.length > 0 ? newCriteria : ['']
    }));
  };

  const handleGenerateTests = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      // Filter out empty acceptance criteria
      const cleanedData = {
        ...formData,
        acceptance_criteria: formData.acceptance_criteria.filter(ac => ac.trim() !== '')
      };

      const response = await api.post('/test-generation/generate', cleanedData);
      
      setSuccess(`✅ Generated ${response.data.total_test_cases} test cases successfully!`);
      
      // Reset form
      setFormData({
        ticket_id: '',
        title: '',
        description: '',
        ticket_type: 'story',
        priority: 'P2',
        acceptance_criteria: ['']
      });
      setShowNewForm(false);
      
      // Reload data
      loadGenerations();
      loadStatistics();
      
      // Show the generated tests after a short delay
      setTimeout(() => {
        viewGeneration(response.data.generation_id);
      }, 1000);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate test cases');
    } finally {
      setGenerating(false);
    }
  };

  const viewGeneration = async (generationId) => {
    try {
      setLoading(true);
      const response = await api.get(`/test-generation/generations/${generationId}`);
      setSelectedGeneration(response.data);
      setShowDetails(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load generation details');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async (generationId) => {
    try {
      const response = await api.get(`/test-generation/download/${generationId}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `test_cases_${generationId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setSuccess('Excel file downloaded successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download Excel file');
    }
  };

  const deleteGeneration = async (generationId) => {
    if (!confirm('Are you sure you want to delete this generation?')) {
      return;
    }

    try {
      await api.delete(`/test-generation/generations/${generationId}`);
      setSuccess('Generation deleted successfully');
      loadGenerations();
      loadStatistics();
      if (selectedGeneration?.generation?.id === generationId) {
        setShowDetails(false);
        setSelectedGeneration(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete generation');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="btn-primary flex items-center gap-2 ml-auto"
        >
          {showNewForm ? <X size={20} /> : <Plus size={20} />}
          {showNewForm ? 'Cancel' : 'New Generation'}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-lg">
                <FileText size={24} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-900">{statistics.total_generations || 0}</div>
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
                <div className="text-2xl font-bold text-green-900">{statistics.total_test_cases || 0}</div>
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

      {/* New Generation Form */}
      {showNewForm && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Generate Test Cases</h3>
          <form onSubmit={handleGenerateTests} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticket ID *</label>
                <input
                  type="text"
                  name="ticket_id"
                  value={formData.ticket_id}
                  onChange={handleInputChange}
                  required
                  className="input"
                  placeholder="e.g., JIRA-123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  name="ticket_type"
                  value={formData.ticket_type}
                  onChange={handleInputChange}
                  className="input"
                >
                  <option value="story">Story</option>
                  <option value="bug">Bug</option>
                  <option value="task">Task</option>
                  <option value="feature">Feature</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="input"
                placeholder="Brief description of the ticket"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={4}
                className="input"
                placeholder="Detailed ticket description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Acceptance Criteria
              </label>
              <div className="space-y-2">
                {formData.acceptance_criteria.map((criteria, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={criteria}
                      onChange={(e) => handleAcceptanceCriteriaChange(index, e.target.value)}
                      className="input flex-1"
                      placeholder={`Acceptance criteria ${index + 1}`}
                    />
                    {formData.acceptance_criteria.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAcceptanceCriteria(index)}
                        className="btn-secondary px-3"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAcceptanceCriteria}
                  className="btn-secondary text-sm"
                >
                  + Add Criteria
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={generating}
                className="btn-primary flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Generating...
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
        </div>
      )}

      {/* Generations List */}
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
            <p className="text-sm">Click "New Generation" to create your first test suite</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test Cases</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {generations.map((gen) => (
                  <tr key={gen.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{gen.ticket_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{gen.ticket_title}</td>
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

      {/* Generation Details Modal */}
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
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tc.priority === 'P0' ? 'bg-red-100 text-red-800' :
                          tc.priority === 'P1' ? 'bg-orange-100 text-orange-800' :
                          tc.priority === 'P2' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
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
                            <li key={i} className="text-gray-700">{step}</li>
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
                      <div key={index} className="card bg-yellow-50 border-l-4 border-l-yellow-500">
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
                <button
                  onClick={() => setShowDetails(false)}
                  className="btn-secondary"
                >
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
