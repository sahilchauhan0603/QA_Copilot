/**
 * GenerationHistory Component
 * Cards/table view of past generations with search, filters, and pagination
 */
import { useState } from 'react';
import {
  Search,
  Grid,
  List,
  FileText,
  Eye,
  Download,
  Trash2,
  ListChecks,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader,
} from 'lucide-react';

const itemsPerPage = 9;

const GenerationHistory = ({
  generations,
  filteredGenerations,
  loading,
  showDetails,
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  onView,
  onDownload,
  onDelete,
}) => {
  const [viewMode, setViewMode] = useState('cards');
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h3 className="text-lg font-semibold">Generation History</h3>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'cards'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Grid size={16} className="inline mr-1" />
            Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <List size={16} className="inline mr-1" />
            Table
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ticket ID or title..."
            className="input pl-10"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="select w-full sm:w-auto"
        >
          <option value="all">All Types</option>
          <option value="story">Story</option>
          <option value="bug">Bug</option>
          <option value="task">Task</option>
          <option value="feature">Feature</option>
        </select>
      </div>

      {loading && !showDetails ? (
        <div className="flex items-center justify-center py-12">
          <Loader size={32} className="animate-spin text-primary-600" />
        </div>
      ) : filteredGenerations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText size={48} className="mx-auto mb-3 opacity-50" />
          {searchQuery || filterType !== 'all' ? (
            <>
              <div>No generations match your filters</div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                }}
                className="text-primary-600 hover:text-primary-700 text-sm mt-2"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <div>No test generations yet</div>
              <div className="text-sm">
                Click &quot;New Generation&quot; to create your first test suite
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Results Count */}
          <div className="text-sm text-gray-500 mb-4">
            Showing{' '}
            {Math.min((currentPage - 1) * itemsPerPage + 1, filteredGenerations.length)}-
            {Math.min(currentPage * itemsPerPage, filteredGenerations.length)} of{' '}
            {filteredGenerations.length} generation
            {filteredGenerations.length !== 1 ? 's' : ''}
          </div>

          {/* Cards View */}
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {filteredGenerations
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((gen) => (
                  <div
                    key={gen.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-mono font-semibold text-primary-600">
                            {gen.ticket_id}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {gen.ticket_type || 'story'}
                          </span>
                        </div>
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
                          {gen.ticket_title}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                      <div className="flex items-center gap-1">
                        <ListChecks size={14} />
                        <span>{gen.total_test_cases} tests</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{new Date(gen.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => onView(gen.id)}
                        className="btn-primary text-xs flex-1 flex items-center justify-center gap-1"
                      >
                        <Eye size={14} />
                        View
                      </button>
                      {gen.excel_file_path && (
                        <button
                          onClick={() => onDownload(gen.id)}
                          className="btn-secondary text-xs px-3"
                          title="Download Excel"
                        >
                          <Download size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(gen.id)}
                        className="btn-secondary text-red-600 hover:text-red-700 text-xs px-3"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ticket
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Test Cases
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredGenerations
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((gen) => (
                      <tr key={gen.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {gen.ticket_id}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                          {gen.ticket_title}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {gen.ticket_type || 'story'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {gen.total_test_cases}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(gen.timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => onView(gen.id)}
                              className="text-blue-600 hover:text-blue-800"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            {gen.excel_file_path && (
                              <button
                                onClick={() => onDownload(gen.id)}
                                className="text-green-600 hover:text-green-800"
                                title="Download Excel"
                              >
                                <Download size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => onDelete(gen.id)}
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

          {/* Pagination */}
          {filteredGenerations.length > itemsPerPage && (
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-500">
                Page {currentPage} of {Math.ceil(filteredGenerations.length / itemsPerPage)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} className="inline" />
                  Previous
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(Math.ceil(filteredGenerations.length / itemsPerPage), p + 1)
                    )
                  }
                  disabled={
                    currentPage >= Math.ceil(filteredGenerations.length / itemsPerPage)
                  }
                  className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight size={16} className="inline" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GenerationHistory;
