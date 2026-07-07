/**
 * StatisticsCards Component
 * Displays 3 summary statistics cards for test generations
 */
import { FileText, ListChecks, TrendingUp } from 'lucide-react';

const PERIOD_LABELS = {
  today: 'Today',
  this_month: 'This Month',
  previous_month: 'Previous Month',
  this_year: 'This Year',
  last_year: 'Last Year',
};

const PERIOD_ORDER = ['today', 'this_month', 'previous_month', 'this_year', 'last_year'];

const LoadingDots = () => (
  <span className="inline-flex items-end gap-1" role="status" aria-label="Loading statistics">
    <span className="inline-block h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
    <span className="inline-block h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
    <span className="inline-block h-2 w-2 rounded-full bg-current animate-bounce" />
  </span>
);

const StatHoverPanel = ({ title, valueLabel, value, details, accentClassName }) => (
  <div className="pointer-events-none absolute left-0 top-full z-20 mt-3 w-full max-w-[21rem] opacity-0 translate-y-2 scale-95 transition duration-200 ease-out group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100">
    <div className={`rounded-xl border bg-white/95 p-3 shadow-2xl backdrop-blur ${accentClassName}`}>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{valueLabel}: {value}</div>
      <div className="mt-3 space-y-1.5">
        {PERIOD_ORDER.map((period) => {
          const periodStats = details?.[period] || { generations: 0, test_cases: 0 };
          const displayValue = title === 'Avg Tests / Generation'
            ? periodStats.generations > 0
              ? (periodStats.test_cases / periodStats.generations).toFixed(1)
              : '0.0'
            : periodStats[valueLabel === 'Total Test Cases' ? 'test_cases' : 'generations'];

          return (
            <div key={period} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5">
              <span className="text-xs font-medium text-slate-600">{PERIOD_LABELS[period]}</span>
              <span className="text-xs font-semibold text-slate-900">{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

const StatisticsCards = ({ statistics = {}, loading = false }) => {
  const timeBreakdown = statistics?.time_breakdown || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="group relative card overflow-visible flex items-center gap-4 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
        <div className="p-3 bg-gray-600 rounded-lg">
          <FileText size={24} className="text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {loading ? <LoadingDots /> : statistics.total_generations || 0}
          </div>
          <div className="text-sm text-gray-700">Total Generations</div>
        </div>
        <StatHoverPanel
          title="Total Generations"
          valueLabel="Total Generations"
          value={loading ? '...' : statistics.total_generations || 0}
          details={timeBreakdown}
          accentClassName="border-gray-100"
        />
      </div>

      <div className="group relative card overflow-visible flex items-center gap-4 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
        <div className="p-3 bg-gray-600 rounded-lg">
          <ListChecks size={24} className="text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {loading ? <LoadingDots /> : statistics.total_test_cases || 0}
          </div>
          <div className="text-sm text-gray-700">Total Test Cases</div>
        </div>
        <StatHoverPanel
          title="Total Test Cases"
          valueLabel="Total Test Cases"
          value={loading ? '...' : statistics.total_test_cases || 0}
          details={timeBreakdown}
          accentClassName="border-gray-100"
        />
      </div>

      <div className="group relative card overflow-visible flex items-center gap-4 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
        <div className="p-3 bg-gray-600 rounded-lg">
          <TrendingUp size={24} className="text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {loading ? <LoadingDots /> : statistics.avg_test_cases || 0}
          </div>
          <div className="text-sm text-gray-700">Avg Tests / Generation</div>
        </div>
        <StatHoverPanel
          title="Avg Tests / Generation"
          valueLabel="Avg Tests / Generation"
          value={loading ? '...' : statistics.avg_test_cases || 0}
          details={timeBreakdown}
          accentClassName="border-gray-100"
        />
      </div>
    </div>
  );
};

export default StatisticsCards;
