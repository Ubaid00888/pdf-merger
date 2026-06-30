// Global Application Coordinator
window.App = {
    state: {
        files: [],          // Array of uploaded file objects
        filter: 'all',      // Active filter: 'all', 'duplicates', 'warnings', 'completed'
        searchQuery: '',    // Search keyword
        mergedPdfBytes: null // Stores compiled bytes for download
    },

    // Initialization entry point
    init() {
        // Initialize sub-modules
        UploadManager.init();
        UIManager.init();

        // Bind core action buttons
        const btnClearAll = document.getElementById('btn-clear-all');
        if (btnClearAll) {
            btnClearAll.addEventListener('click', () => this.resetApp());
        }

        const btnDownloadReport = document.getElementById('btn-download-report');
        if (btnDownloadReport) {
            btnDownloadReport.addEventListener('click', () => {
                ReportManager.downloadReport(this.state.files);
            });
        }

        const btnMerge = document.getElementById('btn-merge');
        if (btnMerge) {
            btnMerge.addEventListener('click', () => this.handleMergeWorkflow());
        }

        // Success Modal close
        const successClose = document.getElementById('success-close');
        if (successClose) {
            successClose.addEventListener('click', () => {
                const modal = document.getElementById('success-modal');
                if (modal) modal.classList.add('hidden');
            });
        }

        // Success Modal download
        const successDownload = document.getElementById('success-download');
        if (successDownload) {
            successDownload.addEventListener('click', () => this.downloadMergedPdf());
        }

        // Initial render
        this.refreshUI();
    },

    // Refreshes all UI components when state changes
    refreshUI() {
        UIManager.renderFileList();
        UIManager.renderChecklist();
        UIManager.updateStatsAndFooter();
    },

    // Resets the entire application state
    resetApp() {
        if (this.state.files.length === 0) return;

        Swal.fire({
            title: 'Reset Dashboard?',
            text: "All uploaded files, page deletions, and manual classifications will be cleared.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, reset everything'
        }).then((result) => {
            if (result.isConfirmed) {
                this.state.files = [];
                this.state.mergedPdfBytes = null;
                this.refreshUI();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Cleared',
                    text: 'Dashboard has been reset.',
                    confirmButtonColor: '#5275ff'
                });
            }
        });
    },

    // Triggers the merging workflow with progress indicators
    async handleMergeWorkflow() {
        if (this.state.files.length === 0) return;

        const stats = Validator.compileStats(this.state.files);
        
        // If there are missing files, show warning but allow proceeding
        if (stats.missingCount > 0) {
            const result = await Swal.fire({
                title: 'Portfolio Incomplete',
                text: `You have ${stats.missingCount} missing section(s). Do you still want to compile and merge?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#5275ff',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, merge anyway'
            });
            
            if (!result.isConfirmed) return;
        }

        // Show merging progress alert
        Swal.fire({
            title: 'Compiling Portfolio',
            html: `
                <div class="space-y-4 py-3 text-center">
                    <div class="flex items-center justify-center">
                        <i class="fa-solid fa-compact-disc animate-spin text-4xl text-brand-500"></i>
                    </div>
                    <p id="merge-status-text" class="text-sm font-bold text-slate-500">Starting merge engine...</p>
                    <div class="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div id="merge-progress-bar" class="bg-brand-500 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false
        });

        const statusTextElement = document.getElementById('merge-status-text');
        const progressBarElement = document.getElementById('merge-progress-bar');

        try {
            // Perform merge
            const pdfBytes = await MergerEngine.mergePortfolio(this.state.files, (progress, statusText) => {
                if (statusTextElement) statusTextElement.textContent = statusText;
                if (progressBarElement) progressBarElement.style.width = `${progress * 100}%`;
            });

            this.state.mergedPdfBytes = pdfBytes;

            // Close progress dialog
            Swal.close();

            // Setup and Open Success Modal
            const successModal = document.getElementById('success-modal');
            const successSections = document.getElementById('success-sections');
            const successPages = document.getElementById('success-pages');
            const successSize = document.getElementById('success-size');

            if (successModal) {
                if (successSections) successSections.textContent = `${stats.matchedCount} / ${stats.requiredCount}`;
                if (successPages) successPages.textContent = `${stats.totalPages} Pages`;
                
                // Estimate size of merged bytes
                if (successSize) {
                    successSize.textContent = Validator.formatBytes(pdfBytes.length);
                }
                
                successModal.classList.remove('hidden');
                
                // Confetti celebration!
                confetti({
                    particleCount: 150,
                    spread: 85,
                    origin: { y: 0.6 }
                });
            }

        } catch (err) {
            console.error("Merge failed:", err);
            Swal.fire({
                icon: 'error',
                title: 'Merge Failed',
                text: err.message || 'An error occurred while compiling the PDF portfolio.',
                confirmButtonColor: '#5275ff'
            });
        }
    },

    // Triggers download of the compiled PDF
    downloadMergedPdf() {
        if (!this.state.mergedPdfBytes) return;

        let filenameInput = document.getElementById('output-filename');
        let filename = filenameInput ? filenameInput.value.trim() : "Student_Portfolio_Merged";
        
        if (!filename) filename = "Student_Portfolio_Merged";
        
        // Remove .pdf extension if typed by user to avoid duplicate extension
        if (filename.toLowerCase().endsWith('.pdf')) {
            filename = filename.slice(0, -4);
        }

        const blob = new Blob([this.state.mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Hide success modal
        const modal = document.getElementById('success-modal');
        if (modal) modal.classList.add('hidden');

        Swal.fire({
            icon: 'success',
            title: 'Downloaded!',
            text: 'Your PDF portfolio has been downloaded successfully.',
            confirmButtonColor: '#5275ff',
            timer: 3000
        });
    }
};

// Initialize App on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
