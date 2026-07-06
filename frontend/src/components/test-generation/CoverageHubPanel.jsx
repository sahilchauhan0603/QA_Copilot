/**
 * CoverageHubPanel Component
 * Traceability and execution-priority view for a generated test suite.
 */
import { useMemo } from 'react';
import {
  Target,
  ShieldAlert,
  ListChecks,
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Layers3,
  Sparkles,
  Flag,
} from 'lucide-react';

const statusStyles = {
  full: 'bg-green-100 text-green-800 border-green-200',
  partial: 'bg-amber-100 text-amber-800 border-amber-200',
  gap: 'bg-red-100 text-red-800 border-red-200',
};

const statusIcons = {
  full: CheckCircle2,
  partial: CircleDashed,
  gap: AlertCircle,
};

const priorityStyles = {
  P0: 'bg-red-100 text-red-800',
  P1: 'bg-orange-100 text-orange-800',
  P2: 'bg-yellow-100 text-yellow-800',
  P3: 'bg-green-100 text-green-800',
  P4: 'bg-blue-100 text-blue-800',
};

const CoverageHubPanel = ({ coverageHub, testCases = [] }) => {
  const summary = coverageHub?.summary || {};
  const mappings = coverageHub?.requirement_mappings || [];
  const gaps = coverageHub?.coverage_gaps || [];
  const minimumSet = coverageHub?.minimum_viable_set || { test_cases: [], rationale: [] };
  const priorityBreakdown = coverageHub?.priority_breakdown || {};

  const topPriorityCases = useMemo(() => {
    return [...(minimumSet.test_cases || [])].sort((a, b) => {
      const order = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
      return (order[a.priority] ?? 99) - (order[b.priority] ?? 99);
    });
  }, [minimumSet.test_cases]);

  const coveragePercent = Number(summary.coverage_percentage || 0);
  const coverageGrade = summary.coverage_grade || 'Unknown';

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              <Target size={12} />
              Coverage Hub
            </div>
            <h4 className="mt-2 text-lg sm:text-xl font-bold text-slate-900 leading-tight">
              Traceability, gaps, and the minimum set to run first.
            </h4>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 max-w-2xl">
              This view links each extracted requirement to test coverage, highlights where you still have gaps, and surfaces the smallest practical set for a release-ready run.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:min-w-[340px]">
            <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Coverage</div>
              <div className="mt-1 text-xl font-bold text-blue-700 leading-none">{coveragePercent.toFixed(1)}%</div>
              <div className="text-xs text-slate-500">{coverageGrade}</div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Requirements</div>
              <div className="mt-1 text-xl font-bold text-emerald-700 leading-none">{summary.total_requirements ?? mappings.length}</div>
              <div className="text-xs text-slate-500">{summary.requirements_full ?? 0} fully covered</div>
            </div>
            <div className="rounded-lg border border-amber-100 bg-white px-3 py-2 shadow-sm sm:col-span-3 lg:col-span-1">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Run First</div>
              <div className="mt-1 text-xl font-bold text-amber-700 leading-none">{minimumSet.total_count ?? 0}</div>
              <div className="text-xs text-slate-500">minimum viable cases</div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          <Metric label="Full" value={summary.requirements_full ?? 0} tone="green" />
          <Metric label="Partial" value={summary.requirements_partial ?? 0} tone="amber" />
          <Metric label="Gap" value={summary.requirements_gap ?? 0} tone="red" />
          <Metric label="Coverage Gaps" value={summary.total_coverage_gaps ?? gaps.length} tone="slate" />
          <Metric label="P0 Cases" value={summary.p0_test_cases ?? 0} tone="red" />
          <Metric label="P1 Cases" value={summary.p1_test_cases ?? 0} tone="orange" />
        </div>
      </div>

      <div className="grid gap-3 items-start xl:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm self-start">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h5 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Layers3 size={16} className="text-blue-600" />
                Requirement Traceability
              </h5>
              <p className="text-xs text-gray-500 mt-1">Each requirement is matched to the most relevant test cases.</p>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <Sparkles size={12} />
              {mappings.length} requirements mapped
            </div>
          </div>

          <div className="space-y-2.5 max-h-[390px] overflow-y-auto pr-1.5">
            {mappings.length > 0 ? mappings.map((mapping) => {
              const StatusIcon = statusIcons[mapping.coverage_status] || AlertCircle;
              return (
                <div key={mapping.requirement_id} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                  <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${statusStyles[mapping.coverage_status] || statusStyles.gap}`}>
                          <StatusIcon size={12} />
                          {mapping.coverage_status?.toUpperCase() || 'GAP'}
                        </span>
                        <span className="text-xs font-mono text-gray-500">{mapping.requirement_id}</span>
                        {typeof mapping.confidence === 'number' && (
                          <span className="text-xs text-gray-500">Confidence {Math.round(mapping.confidence * 100)}%</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm text-gray-900 leading-relaxed">{mapping.requirement_text}</p>
                      <p className="mt-1.5 text-xs text-gray-600">{mapping.coverage_notes}</p>
                    </div>

                    <div className="shrink-0 rounded-lg bg-white border border-gray-200 px-3 py-2 min-w-[200px] lg:max-w-[230px]">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Mapped Tests</div>
                      {mapping.mapped_test_cases?.length ? (
                        <div className="space-y-1">
                          {mapping.mapped_test_cases.map((testCase) => (
                            <div key={`${mapping.requirement_id}-${testCase.test_case_id}`} className="text-xs text-gray-700">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-blue-700">{testCase.test_case_id}</span>
                                <span className={`rounded-full px-2 py-0.5 font-medium ${priorityStyles[testCase.priority] || 'bg-gray-100 text-gray-700'}`}>
                                  {testCase.priority}
                                </span>
                              </div>
                              <div className="mt-0.5 line-clamp-2">{testCase.title}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">No mapped tests</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                No extracted requirements were found for this generation.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 self-start">
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm self-start">
            <h5 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2.5">
              <ShieldAlert size={16} className="text-amber-600" />
              Coverage Gaps
            </h5>
            <div className="space-y-2">
              {gaps.length > 0 ? gaps.map((gap) => (
                <div key={gap.id} className="rounded-lg border border-amber-100 bg-amber-50/70 p-2.5">
                  <div className="text-xs font-mono text-amber-700">{gap.id}</div>
                  <p className="mt-1 text-sm text-amber-950 leading-relaxed">{gap.description}</p>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                  No unresolved coverage gaps detected.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm self-start">
            <h5 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2.5">
              <ListChecks size={16} className="text-green-600" />
              Minimum Viable Run
            </h5>
            <p className="text-sm text-gray-600 leading-relaxed">{minimumSet.description}</p>
            <div className="mt-2.5 space-y-2 max-h-56 overflow-y-auto pr-1.5">
              {topPriorityCases.length > 0 ? topPriorityCases.map((testCase) => (
                <div key={testCase.test_case_id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-blue-700">{testCase.test_case_id}</div>
                      <div className="text-sm font-medium text-gray-900 line-clamp-2">{testCase.title}</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityStyles[testCase.priority] || 'bg-gray-100 text-gray-700'}`}>
                      {testCase.priority}
                    </span>
                  </div>
                  {testCase.category && (
                    <div className="mt-1 text-xs text-gray-500">{testCase.category}</div>
                  )}
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                  No minimum viable set could be derived.
                </div>
              )}
            </div>
            {minimumSet.rationale?.length > 0 && (
              <div className="mt-2.5 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Why these cases</div>
                <ul className="space-y-1 text-xs text-gray-600">
                  {minimumSet.rationale.slice(0, 5).map((reason, index) => (
                    <li key={`${reason}-${index}`}>- {reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm self-start">
            <h5 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2.5">
              <Flag size={16} className="text-indigo-600" />
              Priority Breakdown
            </h5>
            <div className="space-y-1.5">
              {Object.keys(priorityBreakdown).length > 0 ? Object.entries(priorityBreakdown).map(([priority, count]) => (
                <div key={priority} className="flex items-center justify-between text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityStyles[priority] || 'bg-gray-100 text-gray-700'}`}>{priority}</span>
                  <span className="font-medium text-gray-700">{count}</span>
                </div>
              )) : (
                <div className="text-sm text-gray-500">No priority data available.</div>
              )}
            </div>
            {testCases.length > 0 && (
              <div className="mt-2.5 text-xs text-gray-500">
                {testCases.length} total test cases in this generation.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Metric = ({ label, value, tone }) => {
  const tones = {
    green: 'text-green-700 bg-green-50 border-green-100',
    amber: 'text-amber-700 bg-amber-50 border-amber-100',
    red: 'text-red-700 bg-red-50 border-red-100',
    slate: 'text-slate-700 bg-slate-50 border-slate-100',
    orange: 'text-orange-700 bg-orange-50 border-orange-100',
  };

  return (
    <div className={`rounded-lg border px-3 py-2 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
};

export default CoverageHubPanel;