const PreviewManager = {
    currentFile: null,
    zoomLevel: 1.0,
    pdfDoc: null,

    // Generates a base64 image of the first page of a PDF
    async generatePdfThumbnail(arrayBuffer) {
        try {
            const pdfData = new Uint8Array(arrayBuffer);
            const loadingTask = pdfjsLib.getDocument({ data: pdfData });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            
            const viewport = page.getViewport({ scale: 0.3 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            return canvas.toDataURL('image/jpeg', 0.7);
        } catch (err) {
            console.error("Failed to generate PDF thumbnail:", err);
            return '';
        }
    },

    // Opens the full preview modal for a file
    async open(fileObj) {
        this.currentFile = fileObj;
        this.zoomLevel = 1.0;
        this.pdfDoc = null;

        const modal = document.getElementById('preview-modal');
        const title = document.getElementById('preview-title');
        const subtitle = document.getElementById('preview-subtitle');
        const sidebar = document.getElementById('preview-sidebar');
        const viewer = document.getElementById('preview-viewer');
        const zoomLevelText = document.getElementById('zoom-level');

        if (!modal || !title || !subtitle || !sidebar || !viewer) return;

        // Reset UI
        modal.classList.remove('hidden');
        title.textContent = fileObj.name;
        subtitle.textContent = `Pages: ${fileObj.pageCount - fileObj.deletedPages.length} | Size: ${Validator.formatBytes(fileObj.size)}`;
        if (zoomLevelText) zoomLevelText.textContent = '100%';
        sidebar.innerHTML = '';
        viewer.innerHTML = '';

        // Add event listeners for modal controls if not already done
        this.setupControls();

        if (fileObj.extension === 'docx') {
            // Render DOCX content as HTML
            sidebar.classList.add('hidden');
            viewer.innerHTML = '<div class="flex items-center justify-center p-8"><i class="fa-solid fa-circle-notch animate-spin text-3xl text-brand-500 mr-3"></i><span>Converting DOCX for preview...</span></div>';
            
            try {
                const result = await mammoth.convertToHtml({ arrayBuffer: fileObj.binaryData });
                viewer.innerHTML = `
                    <div class="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-8 sm:p-12 rounded-xl shadow-md border border-slate-200/50 dark:border-slate-800/50 max-w-3xl w-full prose dark:prose-invert font-serif animate__animated animate__fadeIn">
                        ${result.value || '<p class="text-center text-slate-400">Empty Document</p>'}
                    </div>
                `;
            } catch (err) {
                viewer.innerHTML = `<div class="text-rose-500 p-8 text-center"><i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i><p>Failed to render DOCX preview.</p></div>`;
            }
        } else if (fileObj.extension === 'pdf') {
            // Render PDF page by page
            sidebar.classList.remove('hidden');
            viewer.innerHTML = '<div class="flex items-center justify-center p-8"><i class="fa-solid fa-circle-notch animate-spin text-3xl text-brand-500 mr-3"></i><span>Loading PDF...</span></div>';

            try {
                const pdfData = new Uint8Array(fileObj.binaryData);
                const loadingTask = pdfjsLib.getDocument({ data: pdfData });
                this.pdfDoc = await loadingTask.promise;
                
                viewer.innerHTML = ''; // Clear loading
                
                // Render pages
                await this.renderPdfPages();
            } catch (err) {
                viewer.innerHTML = `<div class="text-rose-500 p-8 text-center"><i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i><p>Failed to load PDF pages. It may be password protected or corrupted.</p></div>`;
            }
        }
    },

    // Renders all pages of the current PDF
    async renderPdfPages() {
        if (!this.pdfDoc || !this.currentFile) return;

        const sidebar = document.getElementById('preview-sidebar');
        const viewer = document.getElementById('preview-viewer');
        sidebar.innerHTML = '';
        viewer.innerHTML = '';

        const numPages = this.pdfDoc.numPages;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const pageIndex = pageNum - 1;
            
            // Skip if page is deleted
            if (this.currentFile.deletedPages.includes(pageIndex)) {
                continue;
            }

            // 1. Create containers for viewer
            const pageContainer = document.createElement('div');
            pageContainer.className = 'pdf-page-container flex flex-col items-center p-2 relative group';
            pageContainer.dataset.pageIndex = pageIndex;

            const canvas = document.createElement('canvas');
            pageContainer.appendChild(canvas);

            // Action overlay on page hover
            const overlay = document.createElement('div');
            overlay.className = 'absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10';
            overlay.innerHTML = `
                <button class="h-8 w-8 rounded-lg bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center shadow-md transition-all btn-delete-page" data-page-index="${pageIndex}" title="Delete Page">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            `;
            pageContainer.appendChild(overlay);

            viewer.appendChild(pageContainer);

            // 2. Create sidebar thumbnail
            const thumbContainer = document.createElement('div');
            thumbContainer.className = 'preview-thumb bg-white dark:bg-slate-800 p-1';
            thumbContainer.dataset.pageIndex = pageIndex;
            
            const thumbCanvas = document.createElement('canvas');
            thumbContainer.appendChild(thumbCanvas);
            
            const thumbLabel = document.createElement('div');
            thumbLabel.className = 'text-[10px] text-center font-bold py-0.5 text-slate-500';
            thumbLabel.textContent = `Page ${pageNum}`;
            thumbContainer.appendChild(thumbLabel);

            // Sidebar click to scroll to page
            thumbContainer.addEventListener('click', () => {
                pageContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                document.querySelectorAll('.preview-thumb').forEach(t => t.classList.remove('active'));
                thumbContainer.classList.add('active');
            });

            sidebar.appendChild(thumbContainer);

            // Render both canvases
            await this.renderPageCanvas(pageNum, canvas, this.zoomLevel, false);
            await this.renderPageCanvas(pageNum, thumbCanvas, 0.15, true);
        }

        // Bind delete page buttons
        viewer.querySelectorAll('.btn-delete-page').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.pageIndex);
                this.deletePage(idx);
            });
        });
    },

    // Renders a specific page onto a canvas
    async renderPageCanvas(pageNum, canvas, scale, isThumbnail = false) {
        if (!this.pdfDoc || !this.currentFile) return;

        try {
            const page = await this.pdfDoc.getPage(pageNum);
            const pageIndex = pageNum - 1;
            
            // Get rotation from file state
            const rotation = this.currentFile.pagesRotation[pageIndex] || 0;
            
            // PDF.js handles rotation natively in viewport if we pass it, or we can apply CSS transform.
            // Let's pass it to PDF.js viewport for clean rendering.
            const viewport = page.getViewport({ scale: scale, rotation: rotation });
            
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            await page.render(renderContext).promise;
        } catch (err) {
            console.error(`Failed to render page ${pageNum}:`, err);
        }
    },

    // Deletes a page from the current document
    deletePage(pageIndex) {
        if (!this.currentFile) return;

        Swal.fire({
            title: 'Delete this page?',
            text: "This page will be excluded from the final merged PDF. You can reset the file to restore it.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, delete it'
        }).then(async (result) => {
            if (result.isConfirmed) {
                this.currentFile.deletedPages.push(pageIndex);
                
                // Update subtitle
                const subtitle = document.getElementById('preview-subtitle');
                if (subtitle) {
                    subtitle.textContent = `Pages: ${this.currentFile.pageCount - this.currentFile.deletedPages.length} | Size: ${Validator.formatBytes(this.currentFile.size)}`;
                }

                // If all pages are deleted, close modal
                if (this.currentFile.deletedPages.length === this.currentFile.pageCount) {
                    this.close();
                    // Remove file entirely since it has 0 pages
                    App.state.files = App.state.files.filter(f => f.id !== this.currentFile.id);
                    App.refreshUI();
                } else {
                    await this.renderPdfPages();
                    App.refreshUI();
                }
            }
        });
    },

    // Rotates the entire document by 90 degrees
    rotateDocument() {
        if (!this.currentFile || this.currentFile.extension !== 'pdf') return;

        const numPages = this.currentFile.pageCount;
        for (let i = 0; i < numPages; i++) {
            if (this.currentFile.deletedPages.includes(i)) continue;
            const currentRotation = this.currentFile.pagesRotation[i] || 0;
            this.currentFile.pagesRotation[i] = (currentRotation + 90) % 360;
        }

        // Re-render
        this.renderPdfPages();
    },

    // Adjusts zoom level and re-renders main canvases
    async zoom(delta) {
        if (!this.pdfDoc || !this.currentFile) return;

        this.zoomLevel = Math.max(0.5, Math.min(2.5, this.zoomLevel + delta));
        
        const zoomLevelText = document.getElementById('zoom-level');
        if (zoomLevelText) {
            zoomLevelText.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }

        const viewer = document.getElementById('preview-viewer');
        const containers = viewer.querySelectorAll('.pdf-page-container');
        
        for (const container of containers) {
            const pageIndex = parseInt(container.dataset.pageIndex);
            const canvas = container.querySelector('canvas');
            if (canvas) {
                await this.renderPageCanvas(pageIndex + 1, canvas, this.zoomLevel, false);
            }
        }
    },

    // Closes the preview modal
    close() {
        const modal = document.getElementById('preview-modal');
        if (modal) modal.classList.add('hidden');
        this.currentFile = null;
        this.pdfDoc = null;
    },

    // Sets up control event listeners once
    setupControls() {
        if (this.controlsSetup) return;

        const closeBtn = document.getElementById('preview-close');
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const rotateBtn = document.getElementById('preview-rotate');
        const modal = document.getElementById('preview-modal');

        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoom(0.25));
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoom(-0.25));
        if (rotateBtn) rotateBtn.addEventListener('click', () => this.rotateDocument());

        // Close on clicking outside the modal content
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.close();
            });
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (modal && !modal.classList.includes?.('hidden') && !modal.classList.contains('hidden')) {
                if (e.key === 'Escape') this.close();
            }
        });

        this.controlsSetup = true;
    }
};
