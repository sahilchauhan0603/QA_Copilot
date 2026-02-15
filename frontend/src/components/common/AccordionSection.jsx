/**
 * AccordionSection Component
 * Reusable collapsible section with icon, title, count badge, and color theming
 */
import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const colorMap = {
  blue: 'bg-blue-50 border-blue-200 text-blue-300',
  green: 'bg-green-50 border-green-200 text-green-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  teal: 'bg-teal-50 border-teal-200 text-teal-700',
  cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
  slate: 'bg-slate-50 border-slate-200 text-slate-700',
};

const badgeColorMap = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  purple: 'bg-purple-100 text-purple-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  orange: 'bg-orange-100 text-orange-800',
  teal: 'bg-teal-100 text-teal-800',
  cyan: 'bg-cyan-100 text-cyan-800',
  slate: 'bg-slate-100 text-slate-800',
};

const AccordionSection = ({ icon: Icon, title, count, color = 'blue', defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border rounded-lg overflow-hidden ${isOpen ? colorMap[color] : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
          isOpen ? '' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className={isOpen ? '' : 'text-gray-500'} />
          <span className={`font-semibold text-sm ${isOpen ? '' : 'text-gray-800'}`}>{title}</span>
          {count !== undefined && count !== null && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isOpen ? badgeColorMap[color] : 'bg-gray-100 text-gray-600'}`}>
              {count}
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
};

export default AccordionSection;
