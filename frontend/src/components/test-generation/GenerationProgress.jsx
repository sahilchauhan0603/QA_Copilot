/**
 * GenerationProgress Component
 * Displays real-time progress bar with 5 agent pipeline steps
 */
import {
  BookOpen,
  Target,
  ListChecks,
  ShieldAlert,
  FileText,
  CheckCircle,
  Loader,
  Clock,
  XCircle,
} from 'lucide-react';

const agentSteps = [
  { key: 'ticket_reader', label: 'Reading Ticket', icon: BookOpen },
  { key: 'context_builder', label: 'Building Context', icon: Target },
  { key: 'test_strategy', label: 'Planning Strategy', icon: ListChecks },
  { key: 'test_generator', label: 'Generating Tests', icon: FileText },
  { key: 'coverage_auditor', label: 'Auditing Coverage', icon: ShieldAlert },
];

const GenerationProgress = ({ generationProgress, onCancel }) => {
  const { progress, currentLabel, steps } = generationProgress;

  if (progress <= 0) return null;

  return (
    <div className="card mb-6 border-l-4 border-l-primary-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Loader size={20} className="animate-spin text-primary-600" />
          Generating Test Cases...
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
            {Math.round(progress)}%
          </span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors text-sm font-medium"
              title="Cancel generation"
            >
              <XCircle size={16} />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
        <div
          className="bg-gradient-to-r from-primary-500 to-accent-500 h-3 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Agent Steps */}
      <div className="grid grid-cols-5 gap-2">
        {agentSteps.map((step) => {
          const StepIcon = step.icon;
          const stepInfo = steps?.[step.key];
          const status = stepInfo?.status || 'pending';

          return (
            <div
              key={step.key}
              className={`flex flex-col items-center p-2 rounded-lg text-center transition-all ${
                status === 'complete'
                  ? 'bg-green-50 text-green-700'
                  : status === 'running'
                    ? 'bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                    : 'bg-gray-50 text-gray-400'
              }`}
            >
              {status === 'complete' ? (
                <CheckCircle size={20} className="mb-1" />
              ) : status === 'running' ? (
                <StepIcon size={20} className="mb-1 animate-pulse" />
              ) : (
                <Clock size={20} className="mb-1" />
              )}
              <span className="text-xs font-medium leading-tight">{step.label}</span>
            </div>
          );
        })}
      </div>

      {currentLabel && (
        <div className="mt-3 text-sm text-gray-600 text-center italic">{currentLabel}</div>
      )}
    </div>
  );
};

export default GenerationProgress;
