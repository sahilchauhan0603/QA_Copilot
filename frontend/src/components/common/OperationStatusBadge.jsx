/**
 * OperationStatusBadge Component
 * Reusable badge for displaying active operation status in the footer
 * with spinner, status text, and an inline cancel button.
 *
 * Props:
 *   active    – boolean, show/hide the badge
 *   text      – status label (e.g. "Exporting to test tool...")
 *   cancelling – boolean, currently cancelling
 *   onCancel  – callback; when provided (and not cancelling), a Cancel button is shown
 *   color     – 'blue' | 'purple' | 'indigo' (theme for the pill)
 */
import { Loader } from 'lucide-react';

const colorMap = {
  blue: {
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    cancel: 'border-blue-300 bg-blue-100 text-blue-700 hover:bg-blue-200',
  },
  purple: {
    badge: 'border-purple-200 bg-purple-50 text-purple-700',
    cancel: 'border-purple-300 bg-purple-100 text-purple-700 hover:bg-purple-200',
  },
  indigo: {
    badge: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    cancel: 'border-indigo-300 bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
  },
};

const OperationStatusBadge = ({
  active = false,
  text = '',
  cancelling = false,
  onCancel = null,
  color = 'blue',
}) => {
  if (!active) return null;

  const theme = colorMap[color] || colorMap.blue;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-medium text-xs ${theme.badge}`}
    >
      <Loader size={12} className="animate-spin shrink-0" />
      <span>{text}</span>

      {/* Cancel button – hidden once cancelling is in progress */}
      {onCancel && !cancelling && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className={`ml-1 px-2 py-0.5 rounded text-xs font-semibold border transition-colors ${theme.cancel}`}
        >
          Cancel
        </button>
      )}
    </span>
  );
};

export default OperationStatusBadge;
