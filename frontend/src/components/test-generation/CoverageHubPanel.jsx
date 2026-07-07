/**
 * CoverageHubPanel Component
 * Traceability and execution-priority view for a generated test suite.
 */
import { useMemo } from "react";
import {
  Target,
  ShieldAlert,
  ListChecks,
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Layers3,
  Flag,
} from "lucide-react";
import CoverageRing from "../common/CoverageRing";

const STATUS_META = {
  full: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    border: "border-l-emerald-500",
    label: "Full",
    icon: CheckCircle2,
  },
  partial: {
    dot: "bg-amber-500",
    text: "text-amber-700",
    border: "border-l-amber-500",
    label: "Partial",
    icon: CircleDashed,
  },
  gap: {
    dot: "bg-rose-500",
    text: "text-rose-700",
    border: "border-l-rose-500",
    label: "Gap",
    icon: AlertCircle,
  },
};

const PRIORITY_STYLES = {
  P0: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  P1: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
  P2: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  P3: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  P4: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
};

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

const CoverageHubPanel = ({ coverageHub, testCases = [] }) => {
  const summary = coverageHub?.summary || {};
  const mappings = coverageHub?.requirement_mappings || [];
  const gaps = coverageHub?.coverage_gaps || [];
  const minimumSet = coverageHub?.minimum_viable_set || {
    test_cases: [],
    rationale: [],
  };
  const priorityBreakdown = coverageHub?.priority_breakdown || {};

  const topPriorityCases = useMemo(() => {
    return [...(minimumSet.test_cases || [])].sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
    );
  }, [minimumSet.test_cases]);

  const coveragePercent = Number(summary.coverage_percentage || 0);
  const coverageGrade = summary.coverage_grade || "Unknown";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <CoverageRing
              percentage={coveragePercent}
              size={68}
              strokeWidth={6}
              tone="indigo"
            />
            <div>
              {/* <div className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                <Target size={11} />
                Coverage Hub
              </div> */}
              <h4 className="mt-1.5 text-base font-semibold text-slate-900">
                {coverageGrade} coverage
              </h4>
              <p className="mt-0.5 max-w-md text-sm text-slate-500">
                Requirement-to-test traceability, open gaps, and the minimum set
                to run first.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 sm:grid-cols-6">
            <StatCell
              label="Requirements"
              value={summary.total_requirements ?? mappings.length}
            />
            <StatCell
              label="Full"
              value={summary.requirements_full ?? 0}
              tone="emerald"
            />
            <StatCell
              label="Partial"
              value={summary.requirements_partial ?? 0}
              tone="amber"
            />
            <StatCell
              label="Gap"
              value={summary.requirements_gap ?? 0}
              tone="rose"
            />
            <StatCell
              label="P0 Cases"
              value={summary.p0_test_cases ?? 0}
              tone="rose"
            />
            <StatCell
              label="Run First"
              value={minimumSet.total_count ?? 0}
              tone="indigo"
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="grid gap-3 items-start xl:grid-cols-[1.45fr_0.95fr]">
        {/* Requirement Traceability */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm self-start">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h5 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Layers3 size={16} className="text-slate-400" />
                Requirement Traceability
              </h5>
              <p className="text-xs text-slate-500 mt-0.5">
                Each requirement mapped to its most relevant test cases.
              </p>
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-500">
              {mappings.length} mapped
            </span>
          </div>

          <div className="space-y-2 max-h-[785px] overflow-y-auto pr-1.5">
            {mappings.length > 0 ? (
              mappings.map((mapping) => {
                const meta =
                  STATUS_META[mapping.coverage_status] || STATUS_META.gap;
                return (
                  <div
                    key={mapping.requirement_id}
                    className={`rounded-lg border border-slate-200 border-l-4 ${meta.border} bg-white p-3`}
                  >
                    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${meta.text}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                            />
                            {meta.label}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {mapping.requirement_id}
                          </span>
                          {typeof mapping.confidence === "number" && (
                            <span className="text-xs text-slate-400">
                              {Math.round(mapping.confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-sm text-slate-800 leading-relaxed">
                          {mapping.requirement_text}
                        </p>
                        {mapping.coverage_notes && (
                          <p className="mt-1 text-xs text-slate-500">
                            {mapping.coverage_notes}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 min-w-[200px] lg:max-w-[230px]">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                          Mapped Tests
                        </div>
                        {mapping.mapped_test_cases?.length ? (
                          <div className="space-y-1.5">
                            {mapping.mapped_test_cases.map((testCase) => (
                              <div
                                key={`${mapping.requirement_id}-${testCase.test_case_id}`}
                                className="text-xs"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-indigo-700">
                                    {testCase.test_case_id}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY_STYLES[testCase.priority] || "bg-slate-100 text-slate-600"}`}
                                  >
                                    {testCase.priority}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-slate-600 line-clamp-2">
                                  {testCase.title}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">
                            No mapped tests
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No extracted requirements were found for this generation.
              </div>
            )}
          </div>
        </div>

        {/* Priority Breakdown */}
        {/* <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm self-start">
          <h5 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
            <Flag size={16} className="text-slate-400" />
            Priority Breakdown
          </h5>
          <div className="space-y-2">
            {Object.keys(priorityBreakdown).length > 0 ? (
              Object.entries(priorityBreakdown).map(([priority, count]) => (
                <div
                  key={priority}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[priority] || "bg-slate-100 text-slate-600"}`}
                  >
                    {priority}
                  </span>
                  <span className="font-medium text-slate-700 tabular-nums">
                    {count}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">
                No priority data available.
              </div>
            )}
          </div>
          {testCases.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
              {testCases.length} total test cases in this generation
            </div>
          )}
        </div> */}

        <div className="space-y-3 self-start">
          {/* Coverage Gaps */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm self-start">
            <h5 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <ShieldAlert size={16} className="text-slate-400" />
              Coverage Gaps
            </h5>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1.5">
              {gaps.length > 0 ? (
                gaps.map((gap) => (
                  <div
                    key={gap.id}
                    className="rounded-lg border border-slate-200 border-l-4 border-l-amber-400 bg-white p-2.5"
                  >
                    <div className="text-xs font-mono text-amber-700">
                      {gap.id}
                    </div>
                    <p className="mt-1 text-sm text-slate-700 leading-relaxed">
                      {gap.description}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                  No unresolved coverage gaps detected.
                </div>
              )}
            </div>
          </div>

          {/* Minimum Viable Run */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm self-start">
            <h5 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <ListChecks size={16} className="text-slate-400" />
              Minimum Viable Run
            </h5>
            {minimumSet.description && (
              <p className="text-sm text-slate-500 leading-relaxed mb-2.5">
                {minimumSet.description}
              </p>
            )}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1.5">
              {topPriorityCases.length > 0 ? (
                topPriorityCases.map((testCase) => (
                  <div
                    key={testCase.test_case_id}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-indigo-700">
                          {testCase.test_case_id}
                        </div>
                        <div className="text-sm font-medium text-slate-900 line-clamp-2">
                          {testCase.title}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[testCase.priority] || "bg-slate-100 text-slate-600"}`}
                      >
                        {testCase.priority}
                      </span>
                    </div>
                    {testCase.category && (
                      <div className="mt-1 text-xs text-slate-500">
                        {testCase.category}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No minimum viable set could be derived.
                </div>
              )}
            </div>
            {minimumSet.rationale?.length > 0 && (
              <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Why these cases
                </div>
                <ul className="space-y-1 text-xs text-slate-600">
                  {minimumSet.rationale.slice(0, 5).map((reason, index) => (
                    <li key={`${reason}-${index}`}>– {reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCell = ({ label, value, tone = "slate" }) => {
  const toneText = {
    slate: "text-slate-900",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
    indigo: "text-indigo-700",
  };
  return (
    <div className="flex flex-col items-center justify-center px-3 py-2.5 text-center">
      <span
        className={`text-lg font-bold tabular-nums leading-none ${toneText[tone] || toneText.slate}`}
      >
        {value}
      </span>
      <span className="mt-1 text-[11px] font-medium text-slate-500">
        {label}
      </span>
    </div>
  );
};

export default CoverageHubPanel;
