/**
 * DetailViewModal Component
 * Full-screen modal showing generation details with test cases,
 * requirements, coverage gaps, sync, export, and refine capabilities
 */
import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  FileSpreadsheet,
  Calendar,
  ExternalLink,
  X,
  ArrowUp,
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
  Settings,
  Bell,
  BellOff,
  Loader,
} from "lucide-react";
import { integrationAPI, webhookAPI } from "../../services/api";
import toast from "react-hot-toast";
import { AccordionSection, OperationStatusBadge } from "../common";
import SyncMenu from "./SyncMenu";
import ExportMenu from "./ExportMenu";
import RefineMenu from "./RefineMenu";
import TestCaseList from "./TestCaseList";
import CoverageHubPanel from "./CoverageHubPanel";

const DetailViewModal = ({
  selectedGeneration,
  onClose,
  onDownloadExcel,
  integrationConfigs = [],
}) => {
  const gen = selectedGeneration.generation;
  const testCases = selectedGeneration.test_cases || [];
  const coverageGaps = selectedGeneration.coverage_gaps || [];
  const qaRoadmap = selectedGeneration.qa_roadmap || {};
  const coverageHub =
    selectedGeneration.coverage_hub || gen?.metadata?.coverage_hub || null;
  const clarificationQuestions =
    selectedGeneration.clarification_questions || [];
  const riskAreas = selectedGeneration.risk_areas || [];
  const extractedRequirements = selectedGeneration.extracted_requirements || [];
  const acceptanceCriteriaGaps =
    selectedGeneration.acceptance_criteria_gaps || [];
  const impactedModules = selectedGeneration.impacted_modules || [];
  const dependencies = selectedGeneration.dependencies || [];

  // Source integration from metadata
  const sourceIntegration =
    selectedGeneration.source_integration ||
    gen?.metadata?.source_integration ||
    null;

  // Show sync button if source integration exists (even if config is in another workspace)
  const canSync = !!sourceIntegration;

  const integrationLabel =
    sourceIntegration === "jira"
      ? "Jira"
      : sourceIntegration === "azure_devops"
        ? "Azure DevOps"
        : sourceIntegration;

  // Sync state
  const [syncing, setSyncing] = useState(null);
  const [syncCancelFn, setSyncCancelFn] = useState(null);
  const [cancelingSync, setCancelingSync] = useState(false);
  const queuedSyncCancelRef = useRef(false);

  // Footer badges state for refinement/export
  const [refineBadge, setRefineBadge] = useState({ active: false, text: "" });
  const [exportBadge, setExportBadge] = useState({ active: false, text: "" });
  const [showCoverageHub, setShowCoverageHub] = useState(false);
  const sectionRefs = useRef({});
  const contentRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [openSections, setOpenSections] = useState({
    ticketOverview: false,
    extractedRequirements: false,
    acceptanceCriteriaGaps: false,
    impactedModules: false,
    qaRoadmap: false,
    testCases: false,
    coverageGaps: false,
    riskAreas: false,
    clarificationQuestions: false,
  });

  // Webhook monitoring state
  const [monitoring, setMonitoring] = useState(null); // null=unknown, true/false
  const [monitorLoading, setMonitorLoading] = useState(false);

  // Check if ticket is already monitored on mount
  useEffect(() => {
    if (!sourceIntegration || !gen?.ticket_id) return;
    webhookAPI.getSubscriptions().then((data) => {
      const match = (data.subscriptions || []).find(
        (s) =>
          s.ticket_id === gen.ticket_id &&
          s.integration_type === sourceIntegration &&
          s.is_active
      );
      setMonitoring(!!match);
    }).catch(() => setMonitoring(false));
  }, [sourceIntegration, gen?.ticket_id]);

  const handleToggleMonitoring = async () => {
    if (!sourceIntegration || !gen?.ticket_id) return;
    setMonitorLoading(true);
    try {
      if (monitoring) {
        // Find and disable subscription
        const data = await webhookAPI.getSubscriptions();
        const match = (data.subscriptions || []).find(
          (s) =>
            s.ticket_id === gen.ticket_id &&
            s.integration_type === sourceIntegration
        );
        if (match) {
          await webhookAPI.updateSubscription(match.id, { is_active: false });
        }
        setMonitoring(false);
        toast.success(`Stopped monitoring ${gen.ticket_id}`);
      } else {
        await webhookAPI.createSubscription(
          sourceIntegration,
          gen.ticket_id,
          gen.ticket_title,
          gen.id
        );
        setMonitoring(true);
        toast.success(`Now monitoring ${gen.ticket_id} for changes`);
      }
    } catch (err) {
      toast.error('Failed to update monitoring');
    } finally {
      setMonitorLoading(false);
    }
  };

  const handleSync = async (action) => {
    if (!sourceIntegration || !gen?.ticket_id || !gen?.id) return;
    setSyncing(action);
    setCancelingSync(false);
    queuedSyncCancelRef.current = false;
    try {
      // All three actions now go through the job system and are cancellable
      const { promise, cancel } = integrationAPI.getCancelableSync(
        sourceIntegration,
        gen.ticket_id,
        gen.id,
        action,
      );
      setSyncCancelFn(() => cancel);
      if (queuedSyncCancelRef.current) {
        await cancel();
      }
      await promise;
      setSyncCancelFn(null);

      const successMessages = {
        full:    `Synced to ${gen.ticket_id} successfully`,
        attach:  `Excel attached to ${gen.ticket_id}`,
        comment: `Comment added to ${gen.ticket_id}`,
      };
      toast.success(successMessages[action] ?? `Synced to ${gen.ticket_id} successfully`);

      // Close modal after successful sync
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      // Check if it's a configuration error
      const errorMsg = err.response?.data?.error || "";
      if (errorMsg.includes("not configured")) {
        // Show custom toast with settings button
        toast.error(
          (t) => (
            <div className="flex items-center gap-3">
              <span className="flex-1">{errorMsg}</span>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  window.location.href = "/settings";
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors"
              >
                <Settings size={14} />
                Settings
              </button>
            </div>
          ),
          { duration: 6000, id: "config-error" },
        );
      }
      if (err.message === "sync_cancelled") {
        toast.success("Sync cancelled");
        setSyncCancelFn(null);
      } else {
        console.error("Sync error:", err);
      }
      // Don't close modal on error
    } finally {
      setSyncing(null);
      setSyncCancelFn(null);
      setCancelingSync(false);
      queuedSyncCancelRef.current = false;
    }
  };

  const handleCancelSync = async () => {
    if (!syncing || cancelingSync) return;
    if (!syncCancelFn) {
      // Cancel requested before cancel function is ready (early click right after start)
      setCancelingSync(true);
      queuedSyncCancelRef.current = true;
      return;
    }
    if (syncCancelFn) {
      setCancelingSync(true);
      try {
        await syncCancelFn();
      } catch (err) {
        toast.error("Failed to cancel sync");
        setCancelingSync(false);
      }
    }
  };

  // Priority breakdown
  const priorityCounts = testCases.reduce((acc, tc) => {
    acc[tc.priority] = (acc[tc.priority] || 0) + 1;
    return acc;
  }, {});

  const coverageSummary = coverageHub?.summary || {};

  const sectionStats = [
    {
      id: 'ticketOverview',
      title: 'Ticket Overview',
      value: (gen.ticket_description || gen.ticket_acceptance_criteria) ? 1 : 0,
      detail: (gen.ticket_description || gen.ticket_acceptance_criteria) ? 'Open ticket context' : 'No ticket details',
      color: 'slate',
      icon: ClipboardList,
      active: !!(gen.ticket_description || gen.ticket_acceptance_criteria),
    },
    {
      id: 'testCases',
      title: 'Test Cases',
      value: testCases.length,
      detail: 'Generated cases',
      color: 'blue',
      icon: ListChecks,
      active: testCases.length > 0,
    },
    {
      id: 'extractedRequirements',
      title: 'Requirements',
      value: extractedRequirements.length,
      detail: 'Extracted from ticket',
      color: 'green',
      icon: Target,
      active: extractedRequirements.length > 0,
    },
    {
      id: 'coverageGaps',
      title: 'Coverage Gaps',
      value: coverageGaps.length,
      detail: 'Missing coverage',
      color: 'yellow',
      icon: ShieldAlert,
      active: coverageGaps.length > 0,
    },
    {
      id: 'riskAreas',
      title: 'Risk Areas',
      value: riskAreas.length,
      detail: 'High-risk items',
      color: 'red',
      icon: ShieldAlert,
      active: riskAreas.length > 0,
    },
    {
      id: 'clarificationQuestions',
      title: 'Questions',
      value: clarificationQuestions.length,
      detail: 'Open questions',
      color: 'purple',
      icon: HelpCircle,
      active: clarificationQuestions.length > 0,
    },
    {
      id: 'acceptanceCriteriaGaps',
      title: 'AC Gaps',
      value: acceptanceCriteriaGaps.length,
      detail: 'Criteria missing',
      color: 'orange',
      icon: FileWarning,
      active: acceptanceCriteriaGaps.length > 0,
    },
    {
      id: 'impactedModules',
      title: 'Modules & Dependencies',
      value: (impactedModules.length || 0) + (dependencies.length || 0),
      detail: 'Impacted areas',
      color: 'indigo',
      icon: Boxes,
      active: impactedModules.length > 0 || dependencies.length > 0,
    },
    {
      id: 'qaRoadmap',
      title: 'QA Strategy',
      value: Object.keys(qaRoadmap).length,
      detail: 'Strategy groups',
      color: 'purple',
      icon: BookOpen,
      active: Object.keys(qaRoadmap).length > 0,
    },
  ];

  const scrollToSection = (sectionId) => {
    if (sectionId === 'coverageHub') {
      setShowCoverageHub(true);
    }

    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: true,
    }));

    window.setTimeout(() => {
      sectionRefs.current[sectionId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  };

  const updateSectionOpen = (sectionId, nextOpen) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: nextOpen,
    }));
  };

  const scrollToTop = () => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContentScroll = () => {
    const scrollTop = contentRef.current?.scrollTop || 0;
    setShowScrollTop(scrollTop > 24);
  };

  const priorityBarColors = {
    P0: "bg-red-500",
    P1: "bg-orange-500",
    P2: "bg-yellow-500",
    P3: "bg-green-500",
    P4: "bg-blue-400",
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-gray-50 rounded-xl max-w-6xl w-full max-h-[93vh] flex flex-col shadow-2xl relative">
        {/* ─── Sticky Header ─── */}
        <div className="sticky top-0 bg-white border-b border-gray-200 rounded-t-xl px-4 sm:px-6 py-3 sm:py-4 z-10 shrink-0">
          {/* Top Row: Title and Close Button */}
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white shrink-0">
              <FileText size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                <span className="font-mono">{gen.ticket_id}</span> —{" "}
                {gen.ticket_title || "Test Generation Results"}
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
                {gen.metadata?.refinement?.is_refined && (
                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium whitespace-nowrap">
                    ✨ Refined Generation -{" "}
                    {gen.metadata.refinement.refinement_type}
                  </span>
                )}
                {sourceIntegration && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap">
                    <ExternalLink size={10} />
                    Ticket Fetched From - {integrationLabel}
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
            {canSync && (
              <ExportMenu
                generationId={gen.id}
                ticketId={gen.ticket_id}
                onClose={onClose}
                onStatusChange={setExportBadge}
              />
            )}
            <SyncMenu
              sourceIntegration={sourceIntegration}
              integrationLabel={integrationLabel}
              canSync={canSync}
              syncing={syncing}
              onSync={handleSync}
            />
            <RefineMenu
              generationId={gen.id}
              onClose={onClose}
              onStatusChange={setRefineBadge}
            />

            {/* Monitor Ticket Toggle */}
            {canSync && (
              <button
                onClick={handleToggleMonitoring}
                disabled={monitorLoading || monitoring === null}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                  monitoring
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                }`}
                title={
                  monitoring
                    ? 'Stop monitoring this ticket for changes'
                    : 'Auto-regenerate tests when this ticket is updated'
                }
              >
                {monitorLoading ? (
                  <Loader size={14} className="animate-spin" />
                ) : monitoring ? (
                  <Bell size={14} />
                ) : (
                  <BellOff size={14} />
                )}
                <span className="hidden sm:inline">
                  {monitoring ? 'Monitoring' : 'Monitor'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ─── Scrollable Content ─── */}
        <div
          ref={contentRef}
          onScroll={handleContentScroll}
          className="flex-1 overflow-y-auto p-6 space-y-4 relative"
        >
          {/* ─── Clickable Summary / Jump Bar ─── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Jump to section
              </span>
              <span className="text-xs text-gray-400">
                Click any box to open and scroll
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {sectionStats.map((stat) => {
                const Icon = stat.icon;
                const colorClasses = {
                  blue: 'border-blue-200 hover:border-blue-300 hover:bg-blue-50 text-blue-700',
                  green: 'border-green-200 hover:border-green-300 hover:bg-green-50 text-green-700',
                  yellow: 'border-yellow-200 hover:border-yellow-300 hover:bg-yellow-50 text-yellow-700',
                  red: 'border-red-200 hover:border-red-300 hover:bg-red-50 text-red-700',
                  purple: 'border-purple-200 hover:border-purple-300 hover:bg-purple-50 text-purple-700',
                  orange: 'border-orange-200 hover:border-orange-300 hover:bg-orange-50 text-orange-700',
                  indigo: 'border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-700',
                  slate: 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700',
                };

                return (
                  <button
                    key={stat.id}
                    type="button"
                    onClick={() => scrollToSection(stat.id)}
                    className={`group w-full rounded-lg border bg-white px-4 py-3 text-left shadow-sm transition-all ${colorClasses[stat.color] || colorClasses.slate} ${stat.active ? '' : 'opacity-70'}`}
                    title={`Jump to ${stat.title}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <Icon size={13} className="shrink-0" />
                          <span className="truncate">{stat.title}</span>
                        </div>
                        <div className={`mt-2 text-2xl font-bold ${stat.color === 'slate' ? 'text-gray-900' : ''}`}>
                          {stat.value}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">{stat.detail}</div>
                      </div>
                      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 group-hover:text-gray-600">
                        Go
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {coverageHub && (
            <div
              ref={(node) => { sectionRefs.current.coverageHub = node; }}
              className="rounded-2xl border border-blue-200 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 p-3 sm:p-4 text-white shadow-lg shadow-blue-900/10"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                    <Target size={12} />
                    Coverage Spotlight
                  </div>
                  <h4 className="mt-2 text-base sm:text-lg font-bold leading-tight">
                    Coverage, gaps, and the first run.
                  </h4>
                  <p className="mt-1 text-xs sm:text-sm text-white/80">
                    {showCoverageHub
                      ? 'Review traceability, gaps, and the minimum viable run below.'
                      : 'Open the hub to view traceability, gaps, and the minimum viable run.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="rounded-xl bg-white/15 px-3 py-2.5 text-center min-w-[104px]">
                    <div className="text-xl text-black font-bold leading-none">
                      {coverageSummary.coverage_percentage !== undefined
                        ? `${Math.round(coverageSummary.coverage_percentage)}%`
                        : 'N/A'}
                    </div>
                    <div className="text-xs text-black">Coverage</div>
                  </div>
                  <button
                    onClick={() => setShowCoverageHub((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-blue-700 shadow-md shadow-blue-950/20 transition-transform hover:-translate-y-0.5 hover:bg-blue-50"
                  >
                    {showCoverageHub ? <X size={16} /> : <Target size={16} />}
                    {showCoverageHub ? 'Close' : 'Open Coverage Hub'}
                  </button>
                </div>
              </div>

              {showCoverageHub && (
                <div className="mt-2 rounded-xl bg-white/10 border border-white/15 p-2.5 sm:p-3 backdrop-blur-sm">
                  <CoverageHubPanel coverageHub={coverageHub} testCases={testCases} />
                </div>
              )}
            </div>
          )}

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
                          className={`inline-block w-2 h-2 rounded-full mr-1 ${priorityBarColors[p] || "bg-gray-400"}`}
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
                      className={`${priorityBarColors[p] || "bg-gray-400"} transition-all`}
                      style={{ width: `${(count / testCases.length) * 100}%` }}
                      title={`${p}: ${count} test cases`}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* ─── 1. Ticket Overview ─── */}
          <div ref={(node) => { sectionRefs.current.ticketOverview = node; }}>
            <AccordionSection
              icon={ClipboardList}
              title="Ticket Overview"
              color="slate"
              count={(gen.ticket_description || gen.ticket_acceptance_criteria) ? 1 : 0}
              isOpen={openSections.ticketOverview}
              onToggle={(nextOpen) => updateSectionOpen('ticketOverview', nextOpen)}
            >
              <div className="space-y-3">
                {gen.ticket_description ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Description
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {gen.ticket_description}
                    </p>
                  </div>
                ) : null}
                {gen.ticket_acceptance_criteria ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Acceptance Criteria
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {gen.ticket_acceptance_criteria}
                    </p>
                  </div>
                ) : null}
                {!gen.ticket_description && !gen.ticket_acceptance_criteria && (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                    No ticket description or acceptance criteria was captured for this generation.
                  </div>
                )}
              </div>
            </AccordionSection>
          </div>

          {/* ─── 2. Extracted Requirements ─── */}
          <div ref={(node) => { sectionRefs.current.extractedRequirements = node; }}>
            <AccordionSection
              icon={Target}
              title="Extracted Requirements"
              count={extractedRequirements.length}
              color="green"
              isOpen={openSections.extractedRequirements}
              onToggle={(nextOpen) => updateSectionOpen('extractedRequirements', nextOpen)}
            >
              {extractedRequirements.length > 0 ? (
                <div className="space-y-1.5">
                  {extractedRequirements.map((req, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle
                        size={14}
                        className="text-green-500 mt-0.5 shrink-0"
                      />
                      <span className="text-gray-700">{req}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                  No requirements were extracted from this ticket.
                </div>
              )}
            </AccordionSection>
          </div>

          {/* ─── 3. Acceptance Criteria Gaps ─── */}
          <div ref={(node) => { sectionRefs.current.acceptanceCriteriaGaps = node; }}>
            <AccordionSection
              icon={FileWarning}
              title="Acceptance Criteria Gaps"
              count={acceptanceCriteriaGaps.length}
              color="orange"
              isOpen={openSections.acceptanceCriteriaGaps}
              onToggle={(nextOpen) => updateSectionOpen('acceptanceCriteriaGaps', nextOpen)}
            >
              {acceptanceCriteriaGaps.length > 0 ? (
                <div className="space-y-1.5">
                  {acceptanceCriteriaGaps.map((gap, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <AlertCircle
                        size={14}
                        className="text-orange-500 mt-0.5 shrink-0"
                      />
                      <span className="text-gray-700">{gap}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                  No acceptance criteria gaps were identified.
                </div>
              )}
            </AccordionSection>
          </div>

          {/* ─── 4. Impacted Modules & Dependencies ─── */}
          <div ref={(node) => { sectionRefs.current.impactedModules = node; }}>
            <AccordionSection
              icon={Boxes}
              title="Modules & Dependencies"
              count={(impactedModules.length || 0) + (dependencies.length || 0)}
              color="indigo"
              isOpen={openSections.impactedModules}
              onToggle={(nextOpen) => updateSectionOpen('impactedModules', nextOpen)}
            >
              {(impactedModules.length > 0 || dependencies.length > 0) ? (
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
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                  No impacted modules or dependencies were identified.
                </div>
              )}
            </AccordionSection>
          </div>

          {/* ─── 5. QA Roadmap / Test Strategy ─── */}
          <div ref={(node) => { sectionRefs.current.qaRoadmap = node; }}>
            <AccordionSection
              icon={BookOpen}
              title="QA Roadmap / Test Strategy"
              count={Object.keys(qaRoadmap).length}
              color="purple"
              isOpen={openSections.qaRoadmap}
              onToggle={(nextOpen) => updateSectionOpen('qaRoadmap', nextOpen)}
            >
              {Object.keys(qaRoadmap).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(qaRoadmap).map(([category, scenarios]) => (
                    <div key={category}>
                      <div className="text-sm font-semibold text-purple-800 mb-1.5">
                        {category}
                      </div>
                      <div className="space-y-1 pl-3 border-l-2 border-purple-200">
                        {Array.isArray(scenarios) ? (
                          scenarios.map((s, i) => (
                            <div
                              key={i}
                              className="text-sm text-gray-700 flex items-start gap-2"
                            >
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
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                  No QA roadmap or strategy categories were generated.
                </div>
              )}
            </AccordionSection>
          </div>

          {/* ─── 6. Test Cases (with filters) ─── */}
          <div ref={(node) => { sectionRefs.current.testCases = node; }}>
            <AccordionSection
              icon={ListChecks}
              title="Test Cases"
              count={testCases.length}
              color="blue"
              isOpen={openSections.testCases}
              onToggle={(nextOpen) => updateSectionOpen('testCases', nextOpen)}
            >
              {testCases.length > 0 ? (
                <TestCaseList testCases={testCases} />
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                  No test cases were generated for this ticket.
                </div>
              )}
            </AccordionSection>
          </div>

          {/* ─── 7. Coverage Gaps ─── */}
          <div ref={(node) => { sectionRefs.current.coverageGaps = node; }}>
            <AccordionSection
              icon={ShieldAlert}
              title="Coverage Gaps"
              count={coverageGaps.length}
              color="yellow"
              isOpen={openSections.coverageGaps}
              onToggle={(nextOpen) => updateSectionOpen('coverageGaps', nextOpen)}
            >
              {coverageGaps.length > 0 ? (
                <div className="space-y-1.5">
                  {coverageGaps.map((gap, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <AlertCircle
                        size={14}
                        className="text-yellow-600 mt-0.5 shrink-0"
                      />
                      <span className="text-gray-700">{gap}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                  No coverage gaps were identified.
                </div>
              )}
            </AccordionSection>
          </div>

          {/* ─── 8. Risk Areas ─── */}
          <div ref={(node) => { sectionRefs.current.riskAreas = node; }}>
            <AccordionSection
              icon={ShieldAlert}
              title="Risk Areas"
              count={riskAreas.length}
              color="red"
              isOpen={openSections.riskAreas}
              onToggle={(nextOpen) => updateSectionOpen('riskAreas', nextOpen)}
            >
              {riskAreas.length > 0 ? (
                <div className="space-y-1.5">
                  {riskAreas.map((risk, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <AlertCircle
                        size={14}
                        className="text-red-500 mt-0.5 shrink-0"
                      />
                      <span className="text-gray-700">{risk}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                  No risk areas were flagged for this generation.
                </div>
              )}
            </AccordionSection>
          </div>

          {/* ─── 9. Clarification Questions ─── */}
          <div ref={(node) => { sectionRefs.current.clarificationQuestions = node; }}>
            <AccordionSection
              icon={HelpCircle}
              title="Clarification Questions"
              count={clarificationQuestions.length}
              color="cyan"
              isOpen={openSections.clarificationQuestions}
              onToggle={(nextOpen) => updateSectionOpen('clarificationQuestions', nextOpen)}
            >
              {clarificationQuestions.length > 0 ? (
                <div className="space-y-1.5">
                  {clarificationQuestions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <HelpCircle
                        size={14}
                        className="text-cyan-500 mt-0.5 shrink-0"
                      />
                      <span className="text-gray-700">{q}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                  No clarification questions were generated.
                </div>
              )}
            </AccordionSection>
          </div>
        </div>

        {/* ─── Sticky Footer ─── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 rounded-b-xl px-6 py-3 flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
            {testCases.length} test cases &middot;{" "}
            {Object.keys(qaRoadmap).length} strategy categories &middot;{" "}
            {coverageGaps.length} gaps identified

            {/* Sync badge */}
            <OperationStatusBadge
              active={!!syncing}
              text={
                cancelingSync
                  ? "Cancelling sync..."
                  : syncing === "full"
                    ? "Syncing to ticket..."
                    : syncing === "attach"
                      ? "Attaching Excel..."
                      : syncing === "comment"
                        ? "Adding comment..."
                        : ""
              }
              cancelling={cancelingSync}
              onCancel={syncing && !cancelingSync ? handleCancelSync : null}
              color="blue"
            />

            {/* Export badge */}
            <OperationStatusBadge
              active={exportBadge.active}
              text={exportBadge.text}
              cancelling={exportBadge.cancelling}
              onCancel={exportBadge.onCancel}
              color="purple"
            />

            {/* Refine badge */}
            <OperationStatusBadge
              active={refineBadge.active}
              text={refineBadge.text}
              cancelling={refineBadge.cancelling}
              onCancel={refineBadge.onCancel}
              color="indigo"
            />
          </div>
          {/* <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div> */}
        </div>

        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            className="absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-lg shadow-blue-900/20 border border-blue-100 transition-all hover:-translate-y-1 hover:scale-105 hover:bg-blue-50"
            title="Back to top"
          >
            <ArrowUp size={16} className="animate-bounce" />
            Top
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default DetailViewModal;
