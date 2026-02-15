/**
 * DetailViewModal Component
 * Full-screen modal showing generation details with test cases,
 * requirements, coverage gaps, sync, export, and refine capabilities
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  FileSpreadsheet,
  Calendar,
  ExternalLink,
  X,
  Loader,
  ClipboardList,
  Target,
  CheckCircle,
  AlertCircle,
  FileWarning,
  Boxes,
  Layers,
  GitBranch,
  BookOpen,
  ListChecks,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import { integrationAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { AccordionSection } from '../common';
import SyncMenu from './SyncMenu';
import ExportMenu from './ExportMenu';
import RefineMenu from './RefineMenu';
import TestCaseList from './TestCaseList';

const DetailViewModal = ({ selectedGeneration, onClose, onDownloadExcel, integrationConfigs = [] }) => {
  const gen = selectedGeneration.generation;
  const testCases = selectedGeneration.test_cases || [];
  const coverageGaps = selectedGeneration.coverage_gaps || [];
  const qaRoadmap = selectedGeneration.qa_roadmap || {};
  const clarificationQuestions = selectedGeneration.clarification_questions || [];
  const riskAreas = selectedGeneration.risk_areas || [];
  const extractedRequirements = selectedGeneration.extracted_requirements || [];
  const acceptanceCriteriaGaps = selectedGeneration.acceptance_criteria_gaps || [];
  const impactedModules = selectedGeneration.impacted_modules || [];
  const dependencies = selectedGeneration.dependencies || [];

  // Source integration from metadata
  const sourceIntegration =
    selectedGeneration.source_integration ||
    gen?.generation_metadata?.source_integration ||
    null;

  // Check if we can sync (integration is configured)
  const canSync =
    sourceIntegration &&
    integrationConfigs.some((c) => c.integration_type === sourceIntegration && c.configured);

  const integrationLabel =
    sourceIntegration === 'jira'
      ? 'Jira'
      : sourceIntegration === 'azure_devops'
        ? 'Azure DevOps'
        : sourceIntegration;

  // Sync state
  const [syncing, setSyncing] = useState(null);

  const handleSync = async (action) => {
    if (!sourceIntegration || !gen?.ticket_id || !gen?.id) return;
    setSyncing(action);
    try {
      if (action === 'attach') {
        await integrationAPI.attachExcel(sourceIntegration, gen.ticket_id, gen.id);
        toast.success(`Excel attached to ${gen.ticket_id}`);
      } else if (action === 'comment') {
        await integrationAPI.addComment(sourceIntegration, gen.ticket_id, gen.id);
        toast.success(`Comment added to ${gen.ticket_id}`);
      } else if (action === 'full') {
        const result = await integrationAPI.fullSync(sourceIntegration, gen.ticket_id, gen.id);
        if (result.results?.errors?.length > 0) {
          toast.success(result.message + ' (with warnings)', { duration: 5000 });
        } else {
          toast.success(`Synced to ${gen.ticket_id} successfully`);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || `Sync failed: ${err.message}`);
    } finally {
      setSyncing(null);
    }
  };

  // Priority breakdown
  const priorityCounts = testCases.reduce((acc, tc) => {
    acc[tc.priority] = (acc[tc.priority] || 0) + 1;
    return acc;
  }, {});

  const priorityBarColors = {
    P0: 'bg-red-500',
    P1: 'bg-orange-500',
    P2: 'bg-yellow-500',
    P3: 'bg-green-500',
    P4: 'bg-blue-400',
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-gray-50 rounded-xl max-w-6xl w-full max-h-[93vh] flex flex-col shadow-2xl">
        {/* ─── Sticky Header ─── */}
        <div className="sticky top-0 bg-white border-b border-gray-200 rounded-t-xl px-4 sm:px-6 py-3 sm:py-4 z-10 shrink-0">
          {/* Top Row: Title and Close Button */}
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white shrink-0">
              <FileText size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                <span className="font-mono">{gen.ticket_id}</span> — {gen.ticket_title || 'Test Generation Results'}
              </h3>
              <div className="flex items-center flex-wrap gap-2 text-xs text-gray-500 mt-1.5">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Calendar size={12} />
                  {new Date(gen.timestamp).toLocaleDateString()}
                </span>
                {gen.ticket_type && (
                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium whitespace-nowrap">
                    {gen.ticket_type}
                  </span>
                )}
                {gen.generation_metadata?.refinement?.is_refined && (
                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium whitespace-nowrap">
                    🔄 {gen.generation_metadata.refinement.refinement_type}
                  </span>
                )}
                {sourceIntegration && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap">
                    <ExternalLink size={10} />
                    {integrationLabel}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onDownloadExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <FileSpreadsheet size={16} />
              <span className="hidden sm:inline">Export Excel</span>
              <span className="sm:hidden">Excel</span>
            </button>
            <ExportMenu generationId={gen.id} ticketId={gen.ticket_id} />
            <SyncMenu
              sourceIntegration={sourceIntegration}
              integrationLabel={integrationLabel}
              canSync={canSync}
              syncing={syncing}
              onSync={handleSync}
            />
            <RefineMenu generationId={gen.id} onClose={onClose} />
          </div>
        </div>

        {/* ─── Scrollable Content ─── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* ─── Summary Stats Bar ─── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{testCases.length}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Test Cases</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-green-600">{extractedRequirements.length}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Requirements</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{coverageGaps.length}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Coverage Gaps</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-red-600">{riskAreas.length}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Risk Areas</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-purple-600">{clarificationQuestions.length}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Questions</div>
            </div>
          </div>

          {/* ─── Priority Breakdown Bar ─── */}
          {testCases.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Priority Distribution
                </span>
                <div className="flex gap-3">
                  {Object.entries(priorityCounts)
                    .sort()
                    .map(([p, count]) => (
                      <span key={p} className="text-xs text-gray-500">
                        <span
                          className={`inline-block w-2 h-2 rounded-full mr-1 ${priorityBarColors[p] || 'bg-gray-400'}`}
                        ></span>
                        {p}: {count}
                      </span>
                    ))}
                </div>
              </div>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
                {Object.entries(priorityCounts)
                  .sort()
                  .map(([p, count]) => (
                    <div
                      key={p}
                      className={`${priorityBarColors[p] || 'bg-gray-400'} transition-all`}
                      style={{ width: `${(count / testCases.length) * 100}%` }}
                      title={`${p}: ${count} test cases`}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* ─── 1. Ticket Overview ─── */}
          {(gen.ticket_description || gen.ticket_acceptance_criteria) && (
            <AccordionSection
              icon={ClipboardList}
              title="Ticket Overview"
              color="slate"
              defaultOpen={false}
            >
              <div className="space-y-3">
                {gen.ticket_description && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Description
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {gen.ticket_description}
                    </p>
                  </div>
                )}
                {gen.ticket_acceptance_criteria && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Acceptance Criteria
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {gen.ticket_acceptance_criteria}
                    </p>
                  </div>
                )}
              </div>
            </AccordionSection>
          )}

          {/* ─── 2. Extracted Requirements ─── */}
          {extractedRequirements.length > 0 && (
            <AccordionSection
              icon={Target}
              title="Extracted Requirements"
              count={extractedRequirements.length}
              color="green"
              defaultOpen={true}
            >
              <div className="space-y-1.5">
                {extractedRequirements.map((req, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{req}</span>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* ─── 3. Acceptance Criteria Gaps ─── */}
          {acceptanceCriteriaGaps.length > 0 && (
            <AccordionSection
              icon={FileWarning}
              title="Acceptance Criteria Gaps"
              count={acceptanceCriteriaGaps.length}
              color="orange"
              defaultOpen={true}
            >
              <div className="space-y-1.5">
                {acceptanceCriteriaGaps.map((gap, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertCircle size={14} className="text-orange-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{gap}</span>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* ─── 4. Impacted Modules & Dependencies ─── */}
          {(impactedModules.length > 0 || dependencies.length > 0) && (
            <AccordionSection
              icon={Boxes}
              title="Modules & Dependencies"
              count={(impactedModules.length || 0) + (dependencies.length || 0)}
              color="indigo"
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {impactedModules.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Layers size={12} />
                      Impacted Modules
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {impactedModules.map((mod, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium border border-indigo-100"
                        >
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {dependencies.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <GitBranch size={12} />
                      Dependencies
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dependencies.map((dep, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium border border-purple-100"
                        >
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AccordionSection>
          )}

          {/* ─── 5. QA Roadmap / Test Strategy ─── */}
          {Object.keys(qaRoadmap).length > 0 && (
            <AccordionSection
              icon={BookOpen}
              title="QA Roadmap / Test Strategy"
              count={Object.keys(qaRoadmap).length + ' categories'}
              color="purple"
              defaultOpen={false}
            >
              <div className="space-y-3">
                {Object.entries(qaRoadmap).map(([category, scenarios]) => (
                  <div key={category}>
                    <div className="text-sm font-semibold text-purple-800 mb-1.5">{category}</div>
                    <div className="space-y-1 pl-3 border-l-2 border-purple-200">
                      {Array.isArray(scenarios) ? (
                        scenarios.map((s, i) => (
                          <div key={i} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-purple-400 mt-0.5">&bull;</span>
                            <span>{s}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-700">{String(scenarios)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* ─── 6. Test Cases (with filters) ─── */}
          <AccordionSection
            icon={ListChecks}
            title="Test Cases"
            count={testCases.length}
            color="blue"
            defaultOpen={true}
          >
            <TestCaseList testCases={testCases} />
          </AccordionSection>

          {/* ─── 7. Coverage Gaps ─── */}
          {coverageGaps.length > 0 && (
            <AccordionSection
              icon={ShieldAlert}
              title="Coverage Gaps"
              count={coverageGaps.length}
              color="yellow"
              defaultOpen={true}
            >
              <div className="space-y-1.5">
                {coverageGaps.map((gap, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertCircle size={14} className="text-yellow-600 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{gap}</span>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* ─── 8. Risk Areas ─── */}
          {riskAreas.length > 0 && (
            <AccordionSection
              icon={ShieldAlert}
              title="Risk Areas"
              count={riskAreas.length}
              color="red"
              defaultOpen={false}
            >
              <div className="space-y-1.5">
                {riskAreas.map((risk, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{risk}</span>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {/* ─── 9. Clarification Questions ─── */}
          {clarificationQuestions.length > 0 && (
            <AccordionSection
              icon={HelpCircle}
              title="Clarification Questions"
              count={clarificationQuestions.length}
              color="cyan"
              defaultOpen={true}
            >
              <div className="space-y-1.5">
                {clarificationQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <HelpCircle size={14} className="text-cyan-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{q}</span>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}
        </div>

        {/* ─── Sticky Footer ─── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 rounded-b-xl px-6 py-3 flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-400">
            {testCases.length} test cases &middot; {Object.keys(qaRoadmap).length} strategy
            categories &middot; {coverageGaps.length} gaps identified
            {syncing && (
              <span className="ml-3 text-blue-600 font-medium inline-flex items-center gap-1">
                <Loader size={12} className="animate-spin" />
                {syncing === 'full'
                  ? 'Syncing to ticket...'
                  : syncing === 'attach'
                    ? 'Attaching Excel...'
                    : 'Adding comment...'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DetailViewModal;
