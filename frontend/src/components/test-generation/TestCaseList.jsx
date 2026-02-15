/**
 * TestCaseList Component
 * Filterable, searchable, expandable list of test cases
 */
import { useState } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

const TestCaseList = ({ testCases }) => {
  const [tcSearch, setTcSearch] = useState('');
  const [tcPriorityFilter, setTcPriorityFilter] = useState('all');
  const [tcCategoryFilter, setTcCategoryFilter] = useState('all');
  const [expandedTestCase, setExpandedTestCase] = useState(null);

  const priorities = [...new Set(testCases.map((tc) => tc.priority))].sort();
  const categories = [...new Set(testCases.map((tc) => tc.category))].sort();

  const priorityCounts = testCases.reduce((acc, tc) => {
    acc[tc.priority] = (acc[tc.priority] || 0) + 1;
    return acc;
  }, {});

  const filteredTestCases = testCases.filter((tc) => {
    const matchesSearch =
      tcSearch === '' ||
      tc.title.toLowerCase().includes(tcSearch.toLowerCase()) ||
      tc.category.toLowerCase().includes(tcSearch.toLowerCase());
    const matchesPriority = tcPriorityFilter === 'all' || tc.priority === tcPriorityFilter;
    const matchesCategory = tcCategoryFilter === 'all' || tc.category === tcCategoryFilter;
    return matchesSearch && matchesPriority && matchesCategory;
  });

  return (
    <>
      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-blue-100">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search test cases..."
            value={tcSearch}
            onChange={(e) => setTcSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>
        <select
          value={tcPriorityFilter}
          onChange={(e) => setTcPriorityFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="all">All Priorities</option>
          {priorities.map((p) => (
            <option key={p} value={p}>
              {p} ({priorityCounts[p]})
            </option>
          ))}
        </select>
        <select
          value={tcCategoryFilter}
          onChange={(e) => setTcCategoryFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {(tcSearch || tcPriorityFilter !== 'all' || tcCategoryFilter !== 'all') && (
          <button
            onClick={() => {
              setTcSearch('');
              setTcPriorityFilter('all');
              setTcCategoryFilter('all');
            }}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          Showing {filteredTestCases.length} of {testCases.length}
        </span>
      </div>

      {/* Test Case Accordion Items */}
      <div className="space-y-2">
        {filteredTestCases.map((tc) => {
          const isExpanded = expandedTestCase === tc.id;
          const globalIndex = testCases.indexOf(tc) + 1;
          return (
            <div key={tc.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpandedTestCase(isExpanded ? null : tc.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs text-gray-400 font-mono w-6 shrink-0">
                  #{globalIndex}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${
                    tc.priority === 'P0'
                      ? 'bg-red-100 text-red-700'
                      : tc.priority === 'P1'
                        ? 'bg-orange-100 text-orange-700'
                        : tc.priority === 'P2'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                  }`}
                >
                  {tc.priority}
                </span>
                <span className="text-sm font-medium text-gray-800 truncate flex-1">
                  {tc.title}
                </span>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs shrink-0">
                  {tc.category}
                </span>
                {isExpanded ? (
                  <ChevronUp size={16} className="text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400 shrink-0" />
                )}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3">
                  {tc.preconditions && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Preconditions
                      </div>
                      <p className="text-sm text-gray-700">{tc.preconditions}</p>
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Test Steps
                    </div>
                    <ol className="list-decimal list-inside space-y-1">
                      {(tc.test_steps || []).map((step, i) => (
                        <li key={i} className="text-sm text-gray-700">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Expected Result
                    </div>
                    <p className="text-sm text-gray-700">{tc.expected_result}</p>
                  </div>
                  {tc.test_data && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Test Data
                      </div>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded p-2 font-mono whitespace-pre-wrap">
                        {typeof tc.test_data === 'object'
                          ? JSON.stringify(tc.test_data, null, 2)
                          : tc.test_data}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filteredTestCases.length === 0 && (
          <div className="text-center text-sm text-gray-400 py-6">
            No test cases match the current filters.
          </div>
        )}
      </div>
    </>
  );
};

export default TestCaseList;
