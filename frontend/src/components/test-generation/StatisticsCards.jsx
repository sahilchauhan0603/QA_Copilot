/**
 * StatisticsCards Component
 * Displays 3 summary statistics cards for test generations
 */
import { FileText, ListChecks, TrendingUp } from 'lucide-react';

const StatisticsCards = ({ statistics }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="card flex items-center gap-4">
        <div className="p-3 bg-blue-100 rounded-lg">
          <FileText size={24} className="text-blue-600" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {statistics.total_generations || 0}
          </div>
          <div className="text-sm text-gray-600">Total Generations</div>
        </div>
      </div>

      <div className="card flex items-center gap-4">
        <div className="p-3 bg-green-100 rounded-lg">
          <ListChecks size={24} className="text-green-600" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {statistics.total_test_cases || 0}
          </div>
          <div className="text-sm text-gray-600">Total Test Cases</div>
        </div>
      </div>

      <div className="card flex items-center gap-4">
        <div className="p-3 bg-purple-100 rounded-lg">
          <TrendingUp size={24} className="text-purple-600" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {statistics.avg_test_cases || 0}
          </div>
          <div className="text-sm text-gray-600">Avg Tests / Generation</div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsCards;
