const UploadManager = {
    init() {
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('file-input');
        
        if (!dropzone || !fileInput) return;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        // Toggle dropzone highlight
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.add('dropzone-dragging'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.remove('dropzone-dragging'), false);
        });

        // Handle dropped files
        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            this.handleFiles(files);
        });

        // Handle selected files
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            this.handleFiles(files);
        });
    },

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    },

    // Process a list of files
    async handleFiles(fileList) {
        if (fileList.length === 0) return;
        
        const filesArray = Array.from(fileList);
        const validFiles = [];
        
        // 1. Validate all files first
        for (const file of filesArray) {
            const validation = Validator.validateFile(file);
            if (!validation.valid) {
                Swal.fire({
                    icon: 'error',
                    title: 'Invalid File',
                    text: `${file.name}: ${validation.errors.join(' ')}`,
                    confirmButtonColor: '#5275ff'
                });
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length === 0) return;

        // Show global upload/processing overlay
        const overlay = document.getElementById('upload-overlay');
        const percentageText = document.getElementById('upload-percentage');
        const spinner = document.getElementById('upload-spinner');
        const statusTitle = document.getElementById('upload-status-title');
        const statusDetail = document.getElementById('upload-status-detail');

        if (overlay) overlay.classList.remove('hidden');

        // Total steps = reading + classifying + thumbnail generation per file
        const totalSteps = validFiles.length;
        let completedSteps = 0;

        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            const fileId = 'file_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
            
            if (statusTitle) statusTitle.textContent = `Processing file ${i + 1} of ${validFiles.length}`;
            if (statusDetail) statusDetail.textContent = file.name;

            // Update progress ring
            const progress = (completedSteps / totalSteps) * 100;
            this.updateProgressRing(progress, spinner, percentageText);

            try {
                // Read file as ArrayBuffer
                const arrayBuffer = await this.readFileAsArrayBuffer(file);
                
                // Classify file
                if (statusDetail) statusDetail.textContent = `Classifying ${file.name}...`;
                const classification = await Classifier.classifyFile(file, arrayBuffer);
                
                // Generate preview thumbnail (base64)
                if (statusDetail) statusDetail.textContent = `Generating thumbnail for ${file.name}...`;
                let thumbnail = '';
                const extension = file.name.split('.').pop().toLowerCase();
                
                if (extension === 'pdf') {
                    thumbnail = await PreviewManager.generatePdfThumbnail(arrayBuffer);
                } else {
                    thumbnail = 'assets/docx-placeholder.png'; // Handled in UI
                }

                // Create our file state object
                const fileObj = {
                    id: fileId,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    extension: extension,
                    binaryData: arrayBuffer,
                    classifiedSection: classification.section,
                    confidence: classification.confidence,
                    reason: classification.reason,
                    pageCount: classification.pageCount,
                    thumbnail: thumbnail,
                    pagesRotation: {}, // pageIndex (0-indexed) -> rotation degrees (0, 90, 180, 270)
                    deletedPages: [] // array of 0-indexed deleted pages
                };

                // Add to global state
                App.state.files.push(fileObj);
                
            } catch (err) {
                console.error(`Error processing ${file.name}:`, err);
                Swal.fire({
                    icon: 'error',
                    title: 'Processing Failed',
                    text: `Could not process ${file.name}. It might be corrupted or password-protected.`,
                    confirmButtonColor: '#5275ff'
                });
            }

            completedSteps++;
            const finalProgress = (completedSteps / totalSteps) * 100;
            this.updateProgressRing(finalProgress, spinner, percentageText);
        }

        // Hide overlay and refresh UI
        setTimeout(() => {
            if (overlay) overlay.classList.add('hidden');
            // Reset input so the same file can be uploaded again if deleted
            document.getElementById('file-input').value = '';
            
            // Refresh UI
            App.refreshUI();
            
            // Trigger success alert
            Swal.fire({
                icon: 'success',
                title: 'Files Uploaded',
                text: `Successfully processed and classified ${validFiles.length} file(s).`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        }, 500);
    },

    // Helper to read file as ArrayBuffer using Promise
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    },

    // Updates the SVG progress ring
    updateProgressRing(percent, spinner, textElement) {
        if (!spinner || !textElement) return;
        const radius = spinner.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;
        spinner.style.strokeDasharray = `${circumference} ${circumference}`;
        spinner.style.strokeDashoffset = offset;
        textElement.textContent = `${Math.round(percent)}%`;
    }
};
