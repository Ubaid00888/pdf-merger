import { useState, useRef, useEffect } from 'react';
import {
  Trash2,
  Layers,
  FileDown,
  Sparkles,
  ArrowRight,
  Check,
  RotateCcw,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { Reorder, useDragControls } from 'framer-motion';
import confetti from 'canvas-confetti';

import { ThemeToggle } from './components/ThemeToggle.tsx';
import { StatsDashboard, formatBytes } from './components/StatsDashboard.tsx';
import { Dropzone } from './components/Dropzone.tsx';
import { FileCard, PDFFile } from './components/FileCard.tsx';
import { getPdfDetails, mergePDFsClientSide } from './utils/pdf.ts';

// ─── Reorderable item wrapper (hooks must be in component scope) ─────────────
interface ReorderableFileCardProps {
  file: PDFFile;
  onRemove: () => void;
  onDuplicate: () => void;
  onReplace: (newFile: File) => void;
}

function ReorderableFileCard({ file, onRemove, onDuplicate, onReplace }: ReorderableFileCardProps) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      value={file}
      dragListener={false}
      dragControls={dragControls}
      className="w-full focus:outline-none"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
    >
      <FileCard
        file={file}
        dragControls={dragControls}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
        onReplace={onReplace}
      />
    </Reorder.Item>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [mergeStatus, setMergeStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Success view
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [mergedDetails, setMergedDetails] = useState<{ size: number; pageCount: number } | null>(null);
  const [customFilename, setCustomFilename] = useState('Merged_Document');

  // Use a ref to track the current blob URL for proper cleanup without triggering re-renders
  const blobUrlRef = useRef<string | null>(null);
  const filesListRef = useRef<HTMLDivElement>(null);

  // Derived stats
  const totalPages = files.reduce((acc, f) => acc + (f.status === 'ready' ? f.pageCount : 0), 0);
  const totalSize = files.reduce((acc, f) => acc + (f.status === 'ready' ? f.size : 0), 0);
  const readyFilesCount = files.filter(f => f.status === 'ready').length;

  // Revoke blob URL on unmount only
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // ── Upload handlers ─────────────────────────────────────────────────────────
  const handleFilesSelected = async (selectedFiles: File[]) => {
    setErrorMsg(null);
    const validPdfs = selectedFiles.filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (validPdfs.length === 0) {
      setErrorMsg('No valid PDF files selected. Please upload .pdf files only.');
      return;
    }

    // Scroll to list
    setTimeout(() => filesListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);

    // Add all placeholders immediately, then upload one by one
    const placeholders: PDFFile[] = validPdfs.map(f => ({
      id: crypto.randomUUID(),
      backendId: '',
      name: f.name,
      size: f.size,
      pageCount: 0,
      thumbnailUrl: '',
      uploadTimestamp: Date.now(),
      status: 'uploading' as const,
      progress: 0,
      fileObject: f,
    }));
    setFiles(prev => [...prev, ...placeholders]);

    // Process each file independently (non-blocking)
    for (let i = 0; i < validPdfs.length; i++) {
      processAndUpload(validPdfs[i], placeholders[i].id);
    }
  };

  const processAndUpload = async (fileObj: File, tempId: string) => {
    try {
      // Generate thumbnail and page count locally (non-blocking, fails gracefully)
      let pageCount = 0;
      let thumbnailUrl = '';
      try {
        const details = await getPdfDetails(fileObj);
        pageCount = details.pageCount;
        thumbnailUrl = details.thumbnail;
      } catch (previewErr) {
        console.warn('[Preview] Failed for', fileObj.name, previewErr);
      }
      
      // Mark ready immediately as there is no backend upload required
      setFiles(prev => prev.map(f => f.id === tempId
        ? { ...f, pageCount, thumbnailUrl, status: 'ready', progress: 100 }
        : f
      ));
    } catch (err: any) {
      console.error('[Process] Failed:', err);
      setFiles(prev => prev.map(f => f.id === tempId
        ? { ...f, status: 'error', errorMsg: err.message || 'Processing failed' }
        : f
      ));
    }
  };

  // ── File management ─────────────────────────────────────────────────────────
  const handleRemoveFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDuplicateFile = (file: PDFFile) => {
    const copy: PDFFile = { ...file, id: crypto.randomUUID(), uploadTimestamp: Date.now() };
    setFiles(prev => {
      const idx = prev.findIndex(f => f.id === file.id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const handleReplaceFile = async (id: string, _oldBackendId: string, newFileObj: File) => {
    if (!newFileObj.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Replacement must be a PDF file.');
      return;
    }
    setFiles(prev => prev.map(f => f.id === id
      ? { ...f, name: newFileObj.name, size: newFileObj.size, status: 'uploading', progress: 0, pageCount: 0, thumbnailUrl: '', fileObject: newFileObj }
      : f
    ));
    try {
      const details = await getPdfDetails(newFileObj).catch(() => ({ pageCount: 0, thumbnail: '' }));
      setFiles(prev => prev.map(f => f.id === id
        ? { ...f, pageCount: details.pageCount, thumbnailUrl: details.thumbnail, status: 'ready', progress: 100 }
        : f
      ));
    } catch (err: any) {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', errorMsg: err.message || 'Processing failed' } : f));
    }
  };

  const handleClearAll = () => {
    setFiles([]);
    setErrorMsg(null);
  };

  // ── Merge ───────────────────────────────────────────────────────────────────
  const handleMergePDFs = async () => {
    setErrorMsg(null);
    const ready = files.filter(f => f.status === 'ready');
    if (ready.length < 2) {
      setErrorMsg('Upload at least 2 valid PDF files to merge.');
      return;
    }

    setIsMerging(true);
    setMergeProgress(10);
    setMergeStatus('Reading PDFs...');

    try {
      // Get the actual File objects
      const fileObjects = ready.map(f => f.fileObject).filter((f): f is File => !!f);
      if (fileObjects.length < ready.length) {
        throw new Error('Some files were not found locally. Please try uploading them again.');
      }

      setMergeProgress(40);
      setMergeStatus('Merging pages...');
      
      const mergedBytes = await mergePDFsClientSide(fileObjects);
      
      setMergeProgress(85);
      setMergeStatus('Generating download link...');
      
      const blob = new Blob([mergedBytes as any], { type: 'application/pdf' });

      setMergeProgress(100);
      setMergeStatus('Done!');

      // Revoke old blob URL, create new one
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const newUrl = URL.createObjectURL(blob);
      blobUrlRef.current = newUrl;

      // Update state → triggers re-render to success view
      setMergedPdfUrl(newUrl);
      setMergedDetails({ size: blob.size, pageCount: totalPages });
      setIsMerging(false);

      confetti({ particleCount: 150, spread: 90, origin: { y: 0.55 } });

    } catch (err: any) {
      console.error('[Merge] Failed:', err);
      setErrorMsg(`Merge failed: ${err.message || 'Unknown error.'}`);
      setIsMerging(false);
      setMergeProgress(0);
      setMergeStatus('');
    }
  };

  // ── Reset ───────────────────────────────────────────────────────────────────
  const handleResetMerge = () => {
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    setMergedPdfUrl(null);
    setMergedDetails(null);
    setIsMerging(false);
    setMergeProgress(0);
    setMergeStatus('');
    setCustomFilename('Merged_Document');
    handleClearAll();
  };

  const handleDownload = () => {
    if (!mergedPdfUrl) return;
    const a = document.createElement('a');
    a.href = mergedPdfUrl;
    a.download = customFilename.endsWith('.pdf') ? customFilename : `${customFilename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark transition-colors duration-200">

      {/* ── Navbar ── */}
      <header className="border-b border-border-light dark:border-border-dark sticky top-0 z-40 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shadow-md">
              <Layers size={18} />
            </div>
            <span className="font-bold text-lg tracking-tight">
              PDF<span className="text-primary">.merge</span>
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-10 md:py-14 flex flex-col gap-10">

        {/* ══ SUCCESS VIEW ══ */}
        {mergedPdfUrl && mergedDetails ? (
          <div className="max-w-lg mx-auto w-full glass-panel p-8 rounded-3xl shadow-premium border border-border-light dark:border-border-dark flex flex-col items-center text-center gap-5">

            <div className="relative">
              <div className="absolute inset-0 bg-success/20 rounded-full blur-2xl scale-150" />
              <div className="relative h-16 w-16 bg-success rounded-full flex items-center justify-center text-white shadow-lg">
                <Check size={34} strokeWidth={3} />
              </div>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold mb-1">Merge Complete! 🎉</h2>
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                Your PDF has been successfully created, preserving all text, vectors, and page orientations.
              </p>
            </div>

            {/* Stats */}
            <div className="w-full grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900 border border-border-light dark:border-border-dark p-4 rounded-2xl text-left">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark font-medium">Pages merged</span>
                <span className="text-lg font-bold">{mergedDetails.pageCount}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark font-medium">Output size</span>
                <span className="text-lg font-bold">{formatBytes(mergedDetails.size)}</span>
              </div>
            </div>

            {/* Filename input */}
            <div className="w-full text-left">
              <label htmlFor="filename" className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider mb-2">
                File name
              </label>
              <div className="relative flex items-center">
                <input
                  id="filename"
                  type="text"
                  value={customFilename}
                  onChange={e => setCustomFilename(e.target.value)}
                  placeholder="Merged_Document"
                  className="w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 pr-12 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
                <span className="absolute right-4 text-xs text-text-secondary-light/60 dark:text-text-secondary-dark/50 pointer-events-none font-medium">.pdf</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-accent text-white font-bold py-3.5 px-6 rounded-xl shadow-md hover:opacity-90 hover:shadow-lg transition-all active:scale-[0.98]"
              >
                <FileDown size={18} />
                Download PDF
              </button>
              <button
                onClick={handleResetMerge}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-primary-light dark:text-text-primary-dark font-bold py-3.5 px-6 rounded-xl border border-border-light dark:border-border-dark transition-all active:scale-[0.98]"
              >
                <RotateCcw size={18} />
                Merge New Files
              </button>
            </div>
          </div>

        ) : (
          /* ══ EDITOR VIEW ══ */
          <>
            {/* Hero */}
            <section className="text-center flex flex-col items-center gap-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-xs font-semibold text-primary border border-primary/15">
                <Sparkles size={11} />
                <span>Enterprise-grade PDF processing</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Merge PDFs Effortlessly
              </h1>
              <p className="text-base md:text-lg text-text-secondary-light dark:text-text-secondary-dark max-w-md">
                Drag-and-drop, reorder, preview and merge multiple PDFs into a single document — all in seconds.
              </p>
            </section>

            {/* Error banner */}
            {errorMsg && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/30 text-red-700 dark:text-red-400 max-w-3xl mx-auto w-full">
                <AlertTriangle className="mt-0.5 flex-shrink-0" size={17} />
                <div className="flex-1 text-sm">
                  <span className="font-bold">Error: </span>{errorMsg}
                </div>
                <button onClick={() => setErrorMsg(null)} className="text-xs font-bold underline opacity-70 hover:opacity-100">Dismiss</button>
              </div>
            )}

            {/* Dropzone */}
            <section className="max-w-3xl mx-auto w-full">
              <Dropzone
                onFilesSelected={handleFilesSelected}
                isLoading={isMerging}
                disabled={isMerging}
              />
            </section>

            {/* File workspace */}
            {files.length > 0 && (
              <section ref={filesListRef} className="max-w-3xl mx-auto w-full flex flex-col gap-6">

                <StatsDashboard filesCount={files.length} totalPages={totalPages} totalSizeBytes={totalSize} />

                {/* List header */}
                <div className="flex items-center justify-between border-b border-border-light/50 dark:border-border-dark/50 pb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">Merge Order</h3>
                    <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-text-secondary-light dark:text-text-secondary-dark py-0.5 px-2 rounded-full">
                      {readyFilesCount} / {files.length} ready
                    </span>
                  </div>
                  <button
                    onClick={handleClearAll}
                    disabled={isMerging}
                    className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary-light hover:text-red-500 dark:text-text-secondary-dark dark:hover:text-red-400 py-1.5 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                    Clear All
                  </button>
                </div>

                {/* Draggable file list */}
                <Reorder.Group
                  axis="y"
                  values={files}
                  onReorder={setFiles}
                  className="flex flex-col gap-2.5 w-full"
                >
                  {files.map(file => (
                    <ReorderableFileCard
                      key={file.id}
                      file={file}
                      onRemove={() => handleRemoveFile(file.id)}
                      onDuplicate={() => handleDuplicateFile(file)}
                      onReplace={newFile => handleReplaceFile(file.id, file.backendId, newFile)}
                    />
                  ))}
                </Reorder.Group>

                {/* Merge CTA */}
                <div className="flex flex-col items-center gap-3 pt-6 border-t border-border-light/30 dark:border-border-dark/30">
                  {isMerging ? (
                    <div className="w-full flex flex-col gap-2">
                      <div className="flex justify-between text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                        <span>{mergeStatus}</span>
                        <span>{mergeProgress}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${mergeProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-center text-text-secondary-light/70 dark:text-text-secondary-dark/50 mt-1">
                        Processing {readyFilesCount} files, please wait…
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleMergePDFs}
                      disabled={readyFilesCount < 2}
                      className={`group w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold text-base shadow-lg transition-all duration-200 active:scale-[0.99]
                        ${readyFilesCount >= 2
                          ? 'bg-gradient-to-r from-primary to-accent text-white hover:shadow-premium-hover hover:opacity-95 cursor-pointer'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
                        }`}
                    >
                      <Layers size={18} />
                      Merge {readyFilesCount} PDF{readyFilesCount !== 1 ? 's' : ''}
                      {readyFilesCount >= 2 && (
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-150" />
                      )}
                    </button>
                  )}

                  {readyFilesCount < 2 && !isMerging && files.length > 0 && (
                    <p className="text-xs text-text-secondary-light/60 dark:text-text-secondary-dark/50 flex items-center gap-1">
                      <FileText size={12} />
                      {readyFilesCount === 0 ? 'Waiting for files to upload…' : 'Add at least one more PDF to enable merging.'}
                    </p>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border-light/40 dark:border-border-dark/40 py-5 bg-slate-50/50 dark:bg-slate-900/20">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-secondary-light/60 dark:text-text-secondary-dark/50">
          <span>© 2026 PDF Merger SaaS — All rights reserved.</span>
          <div className="flex items-center gap-3">
            <span>Browser-side previews</span>
            <span className="w-1 h-1 rounded-full bg-slate-400" />
            <span>Disk-safe merging</span>
            <span className="w-1 h-1 rounded-full bg-slate-400" />
            <span>Auto-cleanup</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
