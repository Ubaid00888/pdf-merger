const UIManager = {
    sortable: null,

    init() {
        // Theme toggle listener
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
            // Load saved theme
            const savedTheme = localStorage.getItem('theme') || 'dark';
            if (savedTheme === 'light') {
                document.documentElement.classList.remove('dark');
            } else {
                document.documentElement.classList.add('dark');
            }
        }

        // Search listener
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                App.state.searchQuery = e.target.value;
                this.renderFileList();
            });
        }

        // Filter listeners
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                App.state.filter = btn.dataset.filter;
                this.renderFileList();
            });
        });

        // Setup SortableJS for drag-and-drop reordering
        const fileListContainer = document.getElementById('file-list');
        if (fileListContainer) {
            this.sortable = new Sortable(fileListContainer, {
                animation: 150,
                handle: '.drag-handle',
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                onEnd: (evt) => {
                    this.handleReorder(evt);
                }
            });
        }
    },

    // Toggles light / dark mode
    toggleTheme() {
        const isDark = document.documentElement.classList.contains('dark');
        const themeToggle = document.getElementById('theme-toggle');
        const sunIcon = themeToggle?.querySelector('.fa-sun');
        const moonIcon = themeToggle?.querySelector('.fa-moon');

        if (isDark) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            sunIcon?.classList.add('hidden');
            moonIcon?.classList.remove('hidden');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            moonIcon?.classList.add('hidden');
            sunIcon?.classList.remove('hidden');
            sunIcon?.classList.add('rotate-sun');
            setTimeout(() => sunIcon?.classList.remove('rotate-sun'), 500);
        }
    },

    // Handles the reordering of files in the state array based on drag-and-drop
    handleReorder(evt) {
        const fileCards = document.querySelectorAll('.file-card-item');
        const newOrderedFiles = [];
        
        fileCards.forEach(card => {
            const id = card.dataset.fileId;
            const fileObj = App.state.files.find(f => f.id === id);
            if (fileObj) {
                newOrderedFiles.push(fileObj);
            }
        });

        // Preserve files that were not rendered due to filtering/search at the end
        App.state.files.forEach(f => {
            if (!newOrderedFiles.some(nf => nf.id === f.id)) {
                newOrderedFiles.push(f);
            }
        });

        App.state.files = newOrderedFiles;
        this.renderChecklist();
        this.updateStatsAndFooter();
    },

    // Renders the list of file cards on the left
    renderFileList() {
        const container = document.getElementById('file-list');
        const emptyState = document.getElementById('empty-state');
        if (!container) return;

        // Clear existing cards (except empty state)
        const cards = container.querySelectorAll('.file-card-item');
        cards.forEach(c => c.remove());

        const filteredFiles = this.getFilteredFiles();

        if (filteredFiles.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        const duplicates = Validator.getDuplicateSections(App.state.files);

        filteredFiles.forEach(file => {
            const isDuplicate = duplicates.some(d => d.section === file.classifiedSection);
            const isUnclassified = file.classifiedSection === "Unclassified";
            
            let statusColor = "border-emerald-500/30 dark:border-emerald-500/20";
            let statusIcon = '<i class="fa-solid fa-circle-check text-emerald-500"></i>';
            let statusText = "Classified";

            if (isUnclassified) {
                statusColor = "border-amber-500/30 dark:border-amber-500/20";
                statusIcon = '<i class="fa-solid fa-circle-question text-amber-500"></i>';
                statusText = "Unclassified";
            } else if (isDuplicate) {
                statusColor = "border-rose-500/30 dark:border-rose-500/20";
                statusIcon = '<i class="fa-solid fa-circle-exclamation text-rose-500"></i>';
                statusText = "Duplicate Warning";
            }

            const card = document.createElement('div');
            card.className = `file-card-item file-card glass-panel p-4 flex flex-col sm:flex-row items-center gap-4 ${statusColor} animate__animated animate__fadeInUp animate__faster`;
            card.dataset.fileId = file.id;

            // Thumbnail
            let thumbnailHtml = '';
            if (file.extension === 'pdf' && file.thumbnail) {
                thumbnailHtml = `<img src="${file.thumbnail}" alt="PDF Page 1" class="h-16 w-12 object-cover rounded shadow-sm border border-slate-200/50 dark:border-slate-700/50">`;
            } else {
                // Word icon placeholder
                thumbnailHtml = `
                    <div class="h-16 w-12 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/30 flex flex-col items-center justify-center text-blue-500">
                        <i class="fa-solid fa-file-word text-2xl"></i>
                        <span class="text-[8px] font-extrabold mt-1">DOCX</span>
                    </div>
                `;
            }

            // Create classification dropdown options
            let dropdownOptions = `<option value="Unclassified" ${isUnclassified ? 'selected' : ''}>❓ Unclassified</option>`;
            PORTFOLIO_SECTIONS.forEach(sec => {
                dropdownOptions += `<option value="${sec}" ${file.classifiedSection === sec ? 'selected' : ''}>${sec}</option>`;
            });

            // Highlight search query in filename
            let highlightedName = file.name;
            if (App.state.searchQuery) {
                const query = App.state.searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp(`(${query})`, 'gi');
                highlightedName = file.name.replace(regex, '<mark class="bg-amber-200 dark:bg-amber-800/60 text-slate-900 dark:text-slate-100 rounded px-0.5">$1</mark>');
            }

            card.innerHTML = `
                <!-- Drag Handle -->
                <div class="drag-handle cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-700 hover:text-slate-500 p-1 hidden sm:block">
                    <i class="fa-solid fa-grip-vertical text-base"></i>
                </div>
                
                <!-- Thumbnail -->
                <div class="flex-shrink-0">
                    ${thumbnailHtml}
                </div>
                
                <!-- Info & Classification -->
                <div class="flex-1 min-w-0 w-full">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 class="text-sm font-bold truncate max-w-[240px] sm:max-w-[320px]" title="${file.name}">
                            ${highlightedName}
                        </h4>
                        <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                            ${file.extension.toUpperCase()}
                        </span>
                        <span class="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-500 text-[10px] font-bold">
                            ${file.confidence}% match
                        </span>
                    </div>
                    
                    <p class="text-xs text-slate-400 dark:text-slate-500 mb-2 font-medium">
                        Pages: ${file.pageCount - file.deletedPages.length} | Size: ${Validator.formatBytes(file.size)} | ${file.reason}
                    </p>
                    
                    <!-- Dropdown Override -->
                    <div class="flex items-center gap-1.5 w-full">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Assign To:</label>
                        <select class="dropdown-override text-xs font-bold py-1.5 px-2.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/30 focus:outline-none focus:border-brand-500 w-full sm:max-w-xs cursor-pointer">
                            ${dropdownOptions}
                        </select>
                    </div>
                </div>

                <!-- Actions & Status -->
                <div class="flex sm:flex-col items-center justify-between sm:justify-center gap-3 w-full sm:w-auto border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800/60 pt-3 sm:pt-0">
                    <!-- Status Badge -->
                    <div class="flex items-center gap-1 text-xs font-bold">
                        ${statusIcon}
                        <span class="text-slate-500 dark:text-slate-400">${statusText}</span>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="flex items-center gap-1.5">
                        <button class="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-500 hover:text-white text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all btn-preview" title="Preview File">
                            <i class="fa-solid fa-eye text-xs"></i>
                        </button>
                        <button class="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all btn-delete" title="Delete File">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </div>
            `;

            // Bind Dropdown Override
            const select = card.querySelector('.dropdown-override');
            select.addEventListener('change', (e) => {
                file.classifiedSection = e.target.value;
                file.confidence = 100; // Manual override is 100% confident
                file.reason = "Manually assigned";
                
                // Re-render checklist and stats
                this.renderFileList();
                this.renderChecklist();
                this.updateStatsAndFooter();
            });

            // Bind Preview Button
            card.querySelector('.btn-preview').addEventListener('click', () => {
                PreviewManager.open(file);
            });

            // Bind Delete Button
            card.querySelector('.btn-delete').addEventListener('click', () => {
                this.deleteFile(file.id);
            });

            container.appendChild(card);
        });
    },

    // Deletes a file from global state
    deleteFile(fileId) {
        Swal.fire({
            title: 'Remove this file?',
            text: "This file will be deleted from the merger list.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, remove it'
        }).then((result) => {
            if (result.isConfirmed) {
                App.state.files = App.state.files.filter(f => f.id !== fileId);
                this.renderFileList();
                this.renderChecklist();
                this.updateStatsAndFooter();
                
                Swal.fire({
                    icon: 'success',
                    title: 'File Removed',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000
                });
            }
        });
    },

    // Gets files filtered by search and active category tab
    getFilteredFiles() {
        let list = App.state.files;

        // Apply search query
        if (App.state.searchQuery) {
            const query = App.state.searchQuery.toLowerCase();
            list = list.filter(f => f.name.toLowerCase().includes(query) || f.classifiedSection.toLowerCase().includes(query));
        }

        // Apply filter tab
        if (App.state.filter === 'duplicates') {
            const duplicates = Validator.getDuplicateSections(App.state.files);
            list = list.filter(f => duplicates.some(d => d.section === f.classifiedSection));
        } else if (App.state.filter === 'warnings') {
            // Warnings: unclassified files or duplicates
            const duplicates = Validator.getDuplicateSections(App.state.files);
            list = list.filter(f => f.classifiedSection === 'Unclassified' || duplicates.some(d => d.section === f.classifiedSection));
        } else if (App.state.filter === 'completed') {
            list = list.filter(f => f.classifiedSection !== 'Unclassified');
        }

        return list;
    },

    // Renders the 29-section checklist on the right
    renderChecklist() {
        const container = document.getElementById('portfolio-checklist');
        if (!container) return;

        container.innerHTML = '';
        const mapping = Validator.getSectionMapping(App.state.files);

        PORTFOLIO_SECTIONS.forEach((section, idx) => {
            const matchedFiles = mapping[section] || [];
            const isMatched = matchedFiles.length === 1;
            const isDuplicate = matchedFiles.length > 1;
            const isMissing = matchedFiles.length === 0;

            let itemClass = "checklist-item";
            let statusIcon = '<div class="h-5 w-5 rounded-full border border-slate-300 dark:border-slate-700 flex-shrink-0"></div>';
            let detailHtml = '<span class="text-xs text-slate-400 dark:text-slate-500 font-medium">Missing</span>';

            if (isMatched) {
                itemClass += " matched border-emerald-500/20 dark:border-emerald-500/10";
                statusIcon = '<div class="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-check text-[10px] font-black"></i></div>';
                detailHtml = `<span class="text-xs text-slate-500 dark:text-slate-400 font-bold truncate max-w-[180px]" title="${matchedFiles[0].name}">${matchedFiles[0].name}</span>`;
            } else if (isDuplicate) {
                itemClass += " duplicate border-rose-500/20 dark:border-rose-500/10";
                statusIcon = '<div class="h-5 w-5 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-exclamation text-[10px] font-black"></i></div>';
                detailHtml = `<span class="text-xs text-rose-500 font-bold">${matchedFiles.length} files (Duplicate)</span>`;
            }

            const item = document.createElement('div');
            item.className = `${itemClass} flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40`;
            
            item.innerHTML = `
                <div class="flex items-center gap-2.5 min-w-0">
                    ${statusIcon}
                    <div class="min-w-0">
                        <h4 class="text-xs font-bold truncate text-slate-700 dark:text-slate-300">${idx + 1}. ${section}</h4>
                        ${detailHtml}
                    </div>
                </div>
            `;

            // Clicking a checklist item scrolls to/highlights the file card if matched
            if (!isMissing) {
                item.addEventListener('click', () => {
                    const firstFileId = matchedFiles[0].id;
                    const card = document.querySelector(`[data-file-id="${firstFileId}"]`);
                    if (card) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        card.classList.add('animate__pulse');
                        setTimeout(() => card.classList.remove('animate__pulse'), 1000);
                    }
                });
            }

            container.appendChild(item);
        });
    },

    // Updates the stats cards and bottom floating action bar
    updateStatsAndFooter() {
        const stats = Validator.compileStats(App.state.files);

        // Update stats cards
        const statRequired = document.getElementById('stat-required');
        const statUploaded = document.getElementById('stat-uploaded');
        const statMissing = document.getElementById('stat-missing');
        const statDuplicates = document.getElementById('stat-duplicates');
        const statPages = document.getElementById('stat-pages');
        const progressBadge = document.getElementById('checklist-progress-badge');

        if (statRequired) statRequired.textContent = `${stats.matchedCount} / ${stats.requiredCount}`;
        if (statUploaded) statUploaded.textContent = `${stats.uploadedCount} File${stats.uploadedCount !== 1 ? 's' : ''}`;
        if (statMissing) statMissing.textContent = `${stats.missingCount} Section${stats.missingCount !== 1 ? 's' : ''}`;
        if (statDuplicates) statDuplicates.textContent = stats.duplicateCount;
        if (statPages) statPages.textContent = `${stats.totalPages} Page${stats.totalPages !== 1 ? 's' : ''}`;
        if (progressBadge) progressBadge.textContent = `${stats.matchedCount} / 29`;

        // Update floating footer bar
        const footerStatusIcon = document.getElementById('footer-status-icon');
        const footerStatusTitle = document.getElementById('footer-status-title');
        const footerStatusDesc = document.getElementById('footer-status-desc');
        const btnMerge = document.getElementById('btn-merge');
        const btnReport = document.getElementById('btn-download-report');

        if (!footerStatusIcon || !footerStatusTitle || !footerStatusDesc || !btnMerge || !btnReport) return;

        if (stats.uploadedCount === 0) {
            // Empty State
            footerStatusIcon.className = "h-9 w-9 rounded-lg bg-slate-500/10 text-slate-500 flex items-center justify-center";
            footerStatusIcon.innerHTML = '<i class="fa-solid fa-file-circle-plus"></i>';
            footerStatusTitle.textContent = "No Files Uploaded";
            footerStatusDesc.textContent = "Drag and drop your PDF/DOCX files to begin.";
            btnMerge.disabled = true;
            btnMerge.classList.add('opacity-50', 'cursor-not-allowed');
            btnReport.disabled = true;
            btnReport.classList.add('opacity-50', 'cursor-not-allowed');
        } else if (stats.missingCount > 0 || stats.duplicateCount > 0) {
            // Incomplete or duplicate warnings
            footerStatusIcon.className = "h-9 w-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center";
            footerStatusIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            
            let desc = "";
            if (stats.missingCount > 0 && stats.duplicateCount > 0) {
                desc = `${stats.missingCount} missing sections and ${stats.duplicateCount} duplicate warnings.`;
            } else if (stats.missingCount > 0) {
                desc = `${stats.missingCount} missing sections.`;
            } else {
                desc = `${stats.duplicateCount} duplicate warnings.`;
            }

            footerStatusTitle.textContent = "Portfolio Incomplete";
            footerStatusDesc.textContent = `${desc} You can still merge, but it is recommended to resolve warnings.`;
            
            btnMerge.disabled = false;
            btnMerge.classList.remove('opacity-50', 'cursor-not-allowed');
            btnReport.disabled = false;
            btnReport.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            // Perfect portfolio structure
            footerStatusIcon.className = "h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center";
            footerStatusIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            footerStatusTitle.textContent = "Portfolio Ready";
            footerStatusDesc.textContent = "All 29 required sections are successfully matched and validated!";
            
            btnMerge.disabled = false;
            btnMerge.classList.remove('opacity-50', 'cursor-not-allowed');
            btnReport.disabled = false;
            btnReport.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
};
