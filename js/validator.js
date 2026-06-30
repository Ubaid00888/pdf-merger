// Strict 29-section portfolio ordering
const PORTFOLIO_SECTIONS = [
    "Title Page",
    "Outline",
    "Course Log",
    "Attendance",
    "Assignment 1",
    "Assignment 1 Solution",
    "Assignment 1 Best",
    "Assignment 1 Average",
    "Assignment 1 Worst",
    "Quiz 1",
    "Quiz 1 Solution",
    "Quiz 1 Best",
    "Quiz 1 Average",
    "Quiz 1 Worst",
    "Assignment 2",
    "Assignment 2 Solution",
    "Assignment 2 Best",
    "Assignment 2 Average",
    "Assignment 2 Worst",
    "Quiz 2",
    "Quiz 2 Solution",
    "Quiz 2 Best",
    "Quiz 2 Average",
    "Quiz 2 Worst",
    "Midterm",
    "Midterm Solution",
    "Midterm Best",
    "Midterm Average",
    "Midterm Worst"
];

const Validator = {
    // Validates a file before processing
    validateFile(file) {
        const errors = [];
        
        if (!file) {
            errors.push("Empty file reference.");
            return { valid: false, errors };
        }
        
        const extension = file.name.split('.').pop().toLowerCase();
        if (extension !== 'pdf' && extension !== 'docx') {
            errors.push(`Unsupported file type: .${extension}. Only PDF and DOCX files are allowed.`);
        }
        
        if (file.size === 0) {
            errors.push("The selected file is empty (0 bytes).");
        }
        
        if (file.size > 100 * 1024 * 1024) { // 100MB
            errors.push("File size exceeds the 100MB limit.");
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    // Scans uploaded files and returns mapping of section -> array of file objects
    getSectionMapping(files) {
        const mapping = {};
        PORTFOLIO_SECTIONS.forEach(sec => {
            mapping[sec] = [];
        });
        
        files.forEach(file => {
            if (file.classifiedSection && mapping[file.classifiedSection]) {
                mapping[file.classifiedSection].push(file);
            }
        });
        
        return mapping;
    },
    
    // Returns list of section names that have more than 1 file
    getDuplicateSections(files) {
        const mapping = this.getSectionMapping(files);
        const duplicates = [];
        
        Object.entries(mapping).forEach(([section, list]) => {
            if (list.length > 1) {
                duplicates.push({
                    section,
                    files: list.map(f => f.id)
                });
            }
        });
        
        return duplicates;
    },
    
    // Returns list of section names that do not have any files
    getMissingSections(files) {
        const mapping = this.getSectionMapping(files);
        const missing = [];
        
        Object.entries(mapping).forEach(([section, list]) => {
            if (list.length === 0) {
                missing.push(section);
            }
        });
        
        return missing;
    },
    
    // Compiles global portfolio statistics
    compileStats(files) {
        let totalPages = 0;
        let totalSizeBytes = 0;
        const missing = this.getMissingSections(files);
        const duplicates = this.getDuplicateSections(files);
        
        files.forEach(f => {
            totalPages += (f.pageCount || 0);
            totalSizeBytes += (f.size || 0);
        });
        
        const matchedRequiredCount = PORTFOLIO_SECTIONS.length - missing.length;
        
        return {
            requiredCount: PORTFOLIO_SECTIONS.length,
            matchedCount: matchedRequiredCount,
            uploadedCount: files.length,
            missingCount: missing.length,
            duplicateCount: duplicates.length,
            totalPages,
            totalSizeFormatted: this.formatBytes(totalSizeBytes),
            totalSizeBytes
        };
    },
    
    // Helper to format bytes to human readable string
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
};
