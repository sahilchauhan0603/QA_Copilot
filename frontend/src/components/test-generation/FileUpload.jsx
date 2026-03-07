/**
 * FileUpload Component
 * Drag & drop + file picker for uploading code/config files for AI analysis
 */
import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileCode } from 'lucide-react';
import toast from 'react-hot-toast';

const ALLOWED_EXTENSIONS = [
  '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cs', '.go', '.rb',
  '.php', '.html', '.css', '.json', '.yaml', '.yml', '.sql', '.md',
  '.txt', '.vue', '.kt', '.swift', '.cpp', '.c',
];
const MAX_FILE_SIZE = 500 * 1024; // 500 KB per file

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getExtension = (name) => {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
};

const FileUpload = ({ files = [], onChange, maxFiles = 3 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const validateFile = useCallback((file) => {
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(`${file.name}: Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`${file.name}: File too large (max 500 KB)`);
      return false;
    }
    return true;
  }, []);

  const addFiles = useCallback(
    (incoming) => {
      const valid = Array.from(incoming).filter(validateFile);
      const remaining = maxFiles - files.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${maxFiles} files allowed`);
        return;
      }
      const toAdd = valid.slice(0, remaining);
      if (valid.length > remaining) {
        toast.error(`Only ${remaining} more file(s) can be added`);
      }
      if (toAdd.length > 0) onChange([...files, ...toAdd]);
    },
    [files, maxFiles, onChange, validateFile],
  );

  const removeFile = useCallback(
    (index) => onChange(files.filter((_, i) => i !== index)),
    [files, onChange],
  );

  const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); addFiles(e.dataTransfer.files); }, [addFiles]);
  const handleSelect = useCallback((e) => { addFiles(e.target.files); e.target.value = ''; }, [addFiles]);

  return (
    <div>
      <label className="input-label flex items-center gap-1.5">
        <FileCode size={14} />
        Code / Config Files (optional)
      </label>

      {files.length < maxFiles && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-teal-500 bg-teal-50'
              : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'
          }`}
        >
          <Upload
            size={20}
            className={`mx-auto mb-2 ${isDragging ? 'text-teal-500' : 'text-gray-400'}`}
          />
          <p className="text-sm text-gray-600">
            <span className="font-medium text-teal-600">Click to upload</span> or drag & drop
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Code & config files (max 500 KB each, up to {maxFiles} files)
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS.join(',')}
            multiple
            onChange={handleSelect}
            className="hidden"
          />
        </div>
      )}

      {files.length > 0 && (
        <div className={`space-y-1.5 ${files.length < maxFiles ? 'mt-3' : ''}`}>
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-100 rounded-lg text-sm"
            >
              <FileCode size={16} className="text-teal-600 shrink-0" />
              <span className="truncate text-gray-800 flex-1">{file.name}</span>
              <span className="text-xs text-gray-400 shrink-0">{formatSize(file.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="shrink-0 p-0.5 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
