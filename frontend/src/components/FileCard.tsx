import { useRef } from 'react';
import { GripVertical, Trash2, Copy, RefreshCw, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { DragControls } from 'framer-motion';
import { formatBytes } from './StatsDashboard.tsx';

export interface PDFFile {
  id: string;
  backendId: string;
  name: string;
  size: number;
  pageCount: number;
  thumbnailUrl: string;
  uploadTimestamp: number;
  status: 'uploading' | 'ready' | 'error';
  progress?: number;
  errorMsg?: string;
  fileObject?: File; // Keep reference for replacement/duplication if needed
}

interface FileCardProps {
  file: PDFFile;
  dragControls: DragControls;
  onRemove: () => void;
  onDuplicate: () => void;
  onReplace: (newFile: File) => void;
}

export function FileCard({ file, dragControls, onRemove, onDuplicate, onReplace }: FileCardProps) {
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleReplaceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    replaceInputRef.current?.click();
  };

  const handleReplaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onReplace(files[0]);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="flex items-center gap-3 p-3 w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl shadow-premium hover:shadow-premium-hover hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
      
      {/* 1. Drag Handle */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="cursor-grab active:cursor-grabbing p-1 text-text-secondary-light/40 hover:text-text-primary-light dark:text-text-secondary-dark/40 dark:hover:text-text-primary-dark rounded transition-colors duration-150 touch-none"
        title="Drag to reorder"
      >
        <GripVertical size={20} />
      </div>

      {/* 2. PDF Thumbnail Preview */}
      <div className="relative w-16 h-20 md:w-20 md:h-24 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden border border-border-light dark:border-border-dark flex items-center justify-center flex-shrink-0 group">
        {file.status === 'uploading' ? (
          <div className="absolute inset-0 bg-slate-900/10 dark:bg-black/40 flex flex-col items-center justify-center p-2">
            <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[10px] font-bold mt-1 text-slate-500">{file.progress || 0}%</span>
          </div>
        ) : file.status === 'error' ? (
          <div className="text-red-500">
            <AlertCircle size={24} />
          </div>
        ) : file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="text-text-secondary-light dark:text-text-secondary-dark flex flex-col items-center">
            <FileText size={28} />
            <span className="text-[10px] font-medium mt-1">PDF</span>
          </div>
        )}

        {/* Small checkmark indicating uploaded status */}
        {file.status === 'ready' && (
          <div className="absolute bottom-1 right-1 bg-success text-white rounded-full p-0.5 shadow-sm">
            <CheckCircle2 size={12} strokeWidth={3} />
          </div>
        )}
      </div>

      {/* 3. Metadata Content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate mb-1" title={file.name}>
          {file.name}
        </h4>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
          <span className="font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span>{formatBytes(file.size)}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 hidden sm:inline" />
          <span className="hidden sm:inline">{formatTimestamp(file.uploadTimestamp)}</span>
        </div>
        
        {file.status === 'error' && (
          <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
            <AlertCircle size={12} />
            {file.errorMsg || 'Upload failed'}
          </p>
        )}
      </div>

      {/* 4. Action Buttons */}
      <div className="flex items-center gap-1">
        {/* Hidden replacement input */}
        <input
          type="file"
          ref={replaceInputRef}
          onChange={handleReplaceChange}
          accept=".pdf"
          className="hidden"
        />
        
        <button
          onClick={handleReplaceClick}
          className="p-2 text-text-secondary-light hover:text-primary hover:bg-slate-100 dark:text-text-secondary-dark dark:hover:text-blue-400 dark:hover:bg-slate-800 rounded-xl transition-all duration-150"
          title="Replace File"
          disabled={file.status === 'uploading'}
        >
          <RefreshCw size={16} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="p-2 text-text-secondary-light hover:text-accent hover:bg-slate-100 dark:text-text-secondary-dark dark:hover:text-purple-400 dark:hover:bg-slate-800 rounded-xl transition-all duration-150"
          title="Duplicate Entry"
          disabled={file.status === 'uploading' || file.status === 'error'}
        >
          <Copy size={16} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-2 text-text-secondary-light hover:text-red-500 hover:bg-red-50 dark:text-text-secondary-dark dark:hover:text-red-400 dark:hover:bg-red-950/20 rounded-xl transition-all duration-150"
          title="Delete File"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
