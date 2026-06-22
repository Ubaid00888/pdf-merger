import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileWarning } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
  disabled: boolean;
}

export function Dropzone({ onFilesSelected, isLoading, disabled }: DropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles);
      }
    },
    [onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    disabled: disabled || isLoading,
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={`w-full relative group cursor-pointer select-none rounded-3xl border-2 border-dashed transition-all duration-300 outline-none
        ${isDragActive && !isDragReject ? 'border-primary bg-blue-50/30 dark:bg-blue-950/10 scale-[1.01] shadow-lg' : ''}
        ${isDragReject ? 'border-red-500 bg-red-50/30 dark:bg-red-950/10' : ''}
        ${!isDragActive && !isDragReject ? 'border-border-light dark:border-border-dark bg-surface-light/50 dark:bg-surface-dark/40 hover:border-indigo-400 hover:dark:border-indigo-600 hover:shadow-premium' : ''}
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center justify-center py-12 px-6 text-center min-h-[260px]">
        {/* Glow behind the icon */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 dark:from-blue-500/10 dark:to-indigo-500/10 rounded-full blur-3xl -z-10 group-hover:scale-125 transition-transform duration-500" />

        <AnimatePresence mode="wait">
          {isDragReject ? (
            <motion.div
              key="reject"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="mb-4 p-4 rounded-full bg-red-50 dark:bg-red-950/30 text-red-500"
            >
              <FileWarning size={36} />
            </motion.div>
          ) : (
            <motion.div
              key="normal"
              animate={isDragActive ? { y: -8, scale: 1.1 } : { y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className={`mb-4 p-4 rounded-full bg-slate-50 dark:bg-slate-800 text-text-secondary-light dark:text-text-secondary-dark 
                group-hover:text-primary group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20 transition-all duration-300
                ${isDragActive ? 'text-primary bg-blue-50 dark:bg-blue-950/20' : ''}
              `}
            >
              <UploadCloud size={36} className={isDragActive ? 'animate-bounce' : ''} />
            </motion.div>
          )}
        </AnimatePresence>

        <h3 className="text-lg md:text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
          {isDragActive
            ? isDragReject
              ? 'Only PDF files are supported'
              : 'Drop files to upload'
            : 'Merge PDFs Effortlessly'}
        </h3>
        
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark max-w-sm mb-4">
          Drag and drop your PDF files here, or <span className="text-primary font-medium group-hover:underline">browse</span> to locate them
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-text-secondary-light/70 dark:text-text-secondary-dark/60 bg-slate-100/50 dark:bg-slate-800/40 py-1.5 px-3.5 rounded-full border border-border-light/40 dark:border-border-dark/30">
          <span>Max 100 PDFs</span>
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span>Up to 100MB / file</span>
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span>Secured merge</span>
        </div>
      </div>
    </div>
  );
}
