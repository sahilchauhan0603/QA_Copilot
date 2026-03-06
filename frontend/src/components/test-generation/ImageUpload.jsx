/**
 * ImageUpload Component
 * Drag & drop + file picker for uploading screenshots (PNG, JPEG, JPG)
 * Supports multiple images with preview and removal
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per image

const ImageUpload = ({ images = [], onChange, maxFiles = 5 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const validateFile = useCallback((file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(`${file.name}: Only PNG, JPEG, JPG are allowed`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`${file.name}: File too large (max 5MB)`);
      return false;
    }
    return true;
  }, []);

  const addFiles = useCallback(
    (files) => {
      const validFiles = Array.from(files).filter(validateFile);
      const remaining = maxFiles - images.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${maxFiles} images allowed`);
        return;
      }
      const toAdd = validFiles.slice(0, remaining);
      if (validFiles.length > remaining) {
        toast.error(`Only ${remaining} more image(s) can be added`);
      }
      if (toAdd.length > 0) {
        onChange([...images, ...toAdd]);
      }
    },
    [images, maxFiles, onChange, validateFile]
  );

  const removeImage = useCallback(
    (index) => {
      onChange(images.filter((_, i) => i !== index));
    },
    [images, onChange]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleFileSelect = useCallback(
    (e) => {
      addFiles(e.target.files);
      e.target.value = ''; // Reset so same file can be re-selected
    },
    [addFiles]
  );

  return (
    <div>
      <label className="input-label flex items-center gap-1.5">
        <ImageIcon size={14} />
        Screenshots (optional)
      </label>

      {/* Drop zone */}
      {images.length < maxFiles && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
          }`}
        >
          <Upload
            size={20}
            className={`mx-auto mb-2 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`}
          />
          <p className="text-sm text-gray-600">
            <span className="font-medium text-indigo-600">Click to upload</span> or drag & drop
          </p>
          <p className="text-xs text-gray-400 mt-1">
            PNG, JPEG, JPG (max 5MB each, up to {maxFiles} images)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpeg,.jpg"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Preview grid */}
      {images.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${images.length < maxFiles ? 'mt-3' : ''}`}>
          {images.map((file, index) => (
            <ImagePreview key={`${file.name}-${file.size}-${index}`} file={file} onRemove={() => removeImage(index)} />
          ))}
        </div>
      )}
    </div>
  );
};

/** Full-screen image viewer modal */
const ImageModal = ({ src, name, size, onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 p-1.5 bg-white text-gray-700 rounded-full shadow-lg hover:bg-gray-100"
          title="Close"
        >
          <X size={16} />
        </button>
        <img
          src={src}
          alt={name}
          className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain"
        />
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-300">
          <span className="truncate max-w-xs">{name}</span>
          <span className="shrink-0 text-gray-500">·</span>
          <span className="shrink-0">{size}</span>
        </div>
      </div>
    </div>
  );
};

/** Individual image preview with thumbnail, view and remove buttons */
const ImagePreview = ({ file, onRemove }) => {
  const [src, setSrc] = useState(null);
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <>
      <div className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shadow-sm flex-shrink-0">
        {/* Thumbnail */}
        {src ? (
          <img src={src} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={20} className="text-gray-300 m-auto mt-4" />
        )}

        {/* Hover overlay with action buttons */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => setViewing(true)}
            className="p-1 bg-white/90 text-gray-700 rounded-full hover:bg-white shadow"
            title="View image"
          >
            <Eye size={11} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow"
            title="Remove image"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Full-screen viewer modal */}
      {viewing && src && (
        <ImageModal
            src={src}
            name={file.name}
            size={
              file.size < 1024 * 1024
                ? `${(file.size / 1024).toFixed(0)} KB`
                : `${(file.size / (1024 * 1024)).toFixed(1)} MB`
            }
            onClose={() => setViewing(false)}
          />
      )}
    </>
  );
};

export default ImageUpload;
