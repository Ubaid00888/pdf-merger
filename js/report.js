const ReportManager = {
    // Generates a plain-text merge report
    generateReport(files) {
        const stats = Validator.compileStats(files);
        const missing = Validator.getMissingSections(files);
        const duplicates = Validator.getDuplicateSections(files);
        const mapping = Validator.getSectionMapping(files);
        
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        const timeStr = now.toLocaleTimeString();

        let r = "";
        r += "=========================================================================\n";
        r += "                      PORTFOLIO MERGE REPORT                             \n";
        r += "=========================================================================\n";
        r += `Status:        ${stats.missingCount === 0 ? 'COMPLETE' : 'INCOMPLETE (Merged with Warnings)'}\n`;
        r += `Date:          ${dateStr}\n`;
        r += `Time:          ${timeStr}\n`;
        r += `Compiler:      100% Client-Side PDF Portfolio Merger (GitHub Pages)\n`;
        r += "=========================================================================\n\n";

        r += "SUMMARY STATISTICS:\n";
        r += "-------------------------------------------------------------------------\n";
        r += `Required Sections Filled:  ${stats.matchedCount} / ${stats.requiredCount} (${Math.round((stats.matchedCount / stats.requiredCount) * 100)}%)\n`;
        r += `Total Files Uploaded:      ${stats.uploadedCount} file(s)\n`;
        r += `Total Portfolio Pages:     ${stats.totalPages} page(s)\n`;
        r += `Estimated Portfolio Size:  ${stats.totalSizeFormatted}\n`;
        r += `Duplicate Warnings:        ${stats.duplicateCount} section(s)\n`;
        r += `Missing Sections:          ${stats.missingCount} section(s)\n`;
        r += "-------------------------------------------------------------------------\n\n";

        if (duplicates.length > 0) {
            r += "⚠️ DUPLICATE WARNINGS:\n";
            r += "-------------------------------------------------------------------------\n";
            duplicates.forEach((dup, idx) => {
                r += `${idx + 1}. Section [${dup.section}] has ${mapping[dup.section].length} files assigned:\n`;
                mapping[dup.section].forEach(f => {
                    r += `   - ${f.name} (${f.pageCount} pages, confidence: ${f.confidence}%)\n`;
                });
            });
            r += "Recommendation: Manual override or delete duplicate files before merging.\n\n";
        }

        if (missing.length > 0) {
            r += "❌ MISSING SECTIONS:\n";
            r += "-------------------------------------------------------------------------\n";
            missing.forEach((sec, idx) => {
                r += `${idx + 1}. [ ] ${sec}\n`;
            });
            r += "Recommendation: Upload files for these sections to complete the portfolio.\n\n";
        }

        r += "FINAL PORTFOLIO COMPILATION ORDER:\n";
        r += "-------------------------------------------------------------------------\n";
        PORTFOLIO_SECTIONS.forEach((section, idx) => {
            const sectionFiles = mapping[section] || [];
            const num = (idx + 1).toString().padStart(2, '0');
            
            if (sectionFiles.length === 0) {
                r += `${num}. [MISSING]   - ${section}\n`;
            } else if (sectionFiles.length === 1) {
                const f = sectionFiles[0];
                r += `${num}. [MATCHED]   - ${section} -> "${f.name}" (${f.pageCount} pgs, ${f.confidence}% confidence)\n`;
            } else {
                r += `${num}. [DUPLICATE] - ${section} -> Merged ${sectionFiles.length} files:\n`;
                sectionFiles.forEach(f => {
                    r += `                 * "${f.name}" (${f.pageCount} pgs, ${f.confidence}% confidence)\n`;
                });
            }
        });
        r += "-------------------------------------------------------------------------\n\n";

        r += "ORIGINAL UPLOADED FILES LOG:\n";
        r += "-------------------------------------------------------------------------\n";
        files.forEach((f, idx) => {
            r += `${idx + 1}. Name: ${f.name}\n`;
            r += `   Type: ${f.extension.toUpperCase()} | Size: ${Validator.formatBytes(f.size)} | Pages: ${f.pageCount}\n`;
            r += `   Classified As: "${f.classifiedSection}" (${f.confidence}% confidence)\n`;
            if (f.deletedPages.length > 0) {
                r += `   Deleted Pages: [${f.deletedPages.map(p => p + 1).join(', ')}]\n`;
            }
            if (Object.keys(f.pagesRotation).length > 0) {
                r += `   Rotations: ${JSON.stringify(f.pagesRotation)}\n`;
            }
            r += "\n";
        });
        r += "=========================================================================\n";
        r += "                          END OF REPORT                                  \n";
        r += "=========================================================================\n";

        return r;
    },

    // Triggers download of the report text file
    downloadReport(files) {
        const reportText = this.generateReport(files);
        const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Portfolio_Merge_Report_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};
