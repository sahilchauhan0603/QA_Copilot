/**
 * CustomInputTab Component
 * Manual ticket input form with AI-powered description generation
 */
import { useState } from 'react';
import {
  FileText,
  Sparkles,
  Loader,
  X,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { testGenAPI } from '../../services/api';

const CustomInputTab = ({ onGenerate, generating }) => {
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
  const [abortController, setAbortController] = useState(null);

  const handleCustomChange = (field, value) => {
    setCustomForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleACChange = (index, value) => {
    const newAC = [...customForm.acceptance_criteria];
    newAC[index] = value;
    setCustomForm((prev) => ({ ...prev, acceptance_criteria: newAC }));
  };

  const addAC = () => {
    setCustomForm((prev) => ({
      ...prev,
      acceptance_criteria: [...prev.acceptance_criteria, ''],
    }));
  };

  const removeAC = (index) => {
    setCustomForm((prev) => ({
      ...prev,
      acceptance_criteria: prev.acceptance_criteria.filter((_, i) => i !== index),
    }));
  };

  const handleAIGenerate = async () => {
    if (!customForm.title.trim()) {
      toast.error('Enter a title first');
      return;
    }
    
    const controller = new AbortController();
    setAbortController(controller);
    setAiGenerating(true);
    
    try {
      const result = await testGenAPI.aiDescribe(
        customForm.title,
        customForm.ticket_type,
        customForm.priority,
        controller.signal
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
    } catch (error) {
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        toast.error('AI generation cancelled');
      } else {
        toast.error('AI generation failed');
      }
    } finally {
      setAiGenerating(false);
      setAbortController(null);
    }
  };

  const handleCancelAI = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setAiGenerating(false);
    }
  };

  const handleCustomGenerate = async (e) => {
    e.preventDefault();
    if (!customForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    const ticketData = {
      ...customForm,
      acceptance_criteria: customForm.acceptance_criteria.filter((ac) => ac.trim()),
    };
    onGenerate(ticketData);
  };

  return (
    <form onSubmit={handleCustomGenerate} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ticket ID */}
        <div>
          <label className="input-label">Ticket ID (optional)</label>
          <input
            type="text"
            value={customForm.ticket_id}
            onChange={(e) => handleCustomChange('ticket_id', e.target.value)}
            className="input"
            placeholder="e.g., PROJ-123"
          />
        </div>

        {/* Ticket Type */}
        <div>
          <label className="input-label">Ticket Type</label>
          <select
            value={customForm.ticket_type}
            onChange={(e) => handleCustomChange('ticket_type', e.target.value)}
            className="select"
          >
            <option value="story">Story</option>
            <option value="bug">Bug</option>
            <option value="task">Task</option>
            <option value="feature">Feature</option>
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="input-label">Priority</label>
          <select
            value={customForm.priority}
            onChange={(e) => handleCustomChange('priority', e.target.value)}
            className="select"
          >
            <option value="P0">P0 - Critical</option>
            <option value="P1">P1 - High</option>
            <option value="P2">P2 - Medium</option>
            <option value="P3">P3 - Low</option>
          </select>
        </div>
      </div>

      {/* Title with AI Button */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="input-label mb-0">Title *</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={aiGenerating || !customForm.title.trim()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                aiGenerated
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50'
              }`}
            >
              {aiGenerating ? (
                <>
                  <Loader size={12} className="animate-spin" />
                  Generating...
                </>
              ) : aiGenerated ? (
                <>
                  <CheckCircle size={12} />
                  AI Applied
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  AI Generate Details
                </>
              )}
            </button>
            {aiGenerating && (
              <button
                type="button"
                onClick={handleCancelAI}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-all"
              >
                <X size={12} />
                Cancel
              </button>
            )}
          </div>
        </div>
        <input
          type="text"
          value={customForm.title}
          onChange={(e) => {
            handleCustomChange('title', e.target.value);
            setAiGenerated(false);
          }}
          className="input"
          placeholder="Enter ticket title..."
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="input-label">Description</label>
        <textarea
          value={customForm.description}
          onChange={(e) => handleCustomChange('description', e.target.value)}
          className="input min-h-[120px]"
          placeholder="Describe the feature or issue..."
          rows={5}
        />
      </div>

      {/* Acceptance Criteria */}
      <div>
        <label className="input-label">Acceptance Criteria</label>
        <div className="space-y-2">
          {customForm.acceptance_criteria.map((ac, index) => (
            <div key={index} className="flex items-center gap-2">
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
      </div>
    </form>
  );
};

export default CustomInputTab;
