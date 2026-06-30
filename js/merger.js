const MergerEngine = {
    // Converts DOCX file to a PDF document using pdf-lib
    async convertDocxToPdf(fileObj) {
        const docxPdf = await PDFLib.PDFDocument.create();
        const font = await docxPdf.embedFont(PDFLib.StandardFonts.Helvetica);
        const boldFont = await docxPdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
        
        let text = "";
        try {
            const result = await mammoth.extractRawText({ arrayBuffer: fileObj.binaryData });
            text = result.value;
        } catch (err) {
            console.error("Mammoth text extraction failed during merge:", err);
            text = `[Error converting DOCX file: ${fileObj.name}]`;
        }

        // Page setup (A4: 595.28 x 841.89 points)
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const margin = 50;
        const maxContentWidth = pageWidth - (margin * 2);
        
        let page = docxPdf.addPage([pageWidth, pageHeight]);
        let y = pageHeight - margin;
        
        const fontSize = 11;
        const titleFontSize = 16;
        const lineHeight = 16;
        const paragraphSpacing = 12;

        // Draw Document Title
        page.drawText(fileObj.classifiedSection || "Document", {
            x: margin,
            y: y,
            size: titleFontSize,
            font: boldFont,
            color: PDFLib.rgb(0.07, 0.11, 0.19) // brand color dark
        });
        
        // Underline title
        y -= 8;
        page.drawLine({
            start: { x: margin, y: y },
            end: { x: pageWidth - margin, y: y },
            thickness: 1,
            color: PDFLib.rgb(0.8, 0.8, 0.8)
        });
        
        y -= 25;

        // Split text into paragraphs
        const paragraphs = text.split('\n');
        
        for (const para of paragraphs) {
            const cleanPara = para.trim();
            if (!cleanPara) {
                y -= paragraphSpacing;
                continue;
            }

            // Wrap text to fit page width
            const words = cleanPara.split(' ');
            let currentLine = "";
            const lines = [];

            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const width = font.widthOfTextAtSize(testLine, fontSize);
                
                if (width > maxContentWidth) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) {
                lines.push(currentLine);
            }

            // Draw lines of paragraph
            for (const line of lines) {
                // Check page break
                if (y < margin + 40) {
                    // Add footer to current page
                    this.drawFooter(page, pageWidth, margin, font);
                    
                    // Create new page
                    page = docxPdf.addPage([pageWidth, pageHeight]);
                    y = pageHeight - margin - 20;
                }

                page.drawText(line, {
                    x: margin,
                    y: y,
                    size: fontSize,
                    font: font,
                    color: PDFLib.rgb(0.18, 0.25, 0.37) // slate-700
                });
                y -= lineHeight;
            }
            y -= paragraphSpacing; // Add spacing between paragraphs
        }

        // Draw footer on last page
        this.drawFooter(page, pageWidth, margin, font);

        return docxPdf;
    },

    // Helper to draw a footer on A4 page
    drawFooter(page, pageWidth, margin, font) {
        page.drawLine({
            start: { x: margin, y: 45 },
            end: { x: pageWidth - margin, y: 45 },
            thickness: 0.5,
            color: PDFLib.rgb(0.85, 0.85, 0.85)
        });
        
        page.drawText("Converted from DOCX client-side", {
            x: margin,
            y: 30,
            size: 8,
            font: font,
            color: PDFLib.rgb(0.6, 0.6, 0.6)
        });
    },

    // Main compilation engine
    async mergePortfolio(files, onProgress) {
        const mergedDoc = await PDFLib.PDFDocument.create();
        
        // Sort files exactly matching the PORTFOLIO_SECTIONS order
        const sortedFiles = [];
        PORTFOLIO_SECTIONS.forEach(section => {
            // Find files matching this section
            const sectionFiles = files.filter(f => f.classifiedSection === section);
            
            // If duplicates, we merge all of them in order of their listing (though validator warns, we still merge what is active)
            sectionFiles.forEach(f => {
                sortedFiles.push(f);
            });
        });

        // Add any remaining unclassified files at the end
        const unclassifiedFiles = files.filter(f => !PORTFOLIO_SECTIONS.includes(f.classifiedSection) || !f.classifiedSection);
        unclassifiedFiles.forEach(f => {
            sortedFiles.push(f);
        });

        if (sortedFiles.length === 0) {
            throw new Error("No files to merge.");
        }

        const totalFiles = sortedFiles.length;
        
        for (let i = 0; i < totalFiles; i++) {
            const fileObj = sortedFiles[i];
            
            if (onProgress) {
                onProgress(i / totalFiles, `Merging ${fileObj.name}...`);
            }

            try {
                if (fileObj.extension === 'pdf') {
                    // Load source PDF
                    const srcDoc = await PDFLib.PDFDocument.load(fileObj.binaryData);
                    const totalSrcPages = srcDoc.getPageCount();
                    
                    // Build list of page indices to copy, excluding deleted pages
                    const pageIndicesToCopy = [];
                    for (let pIdx = 0; pIdx < totalSrcPages; pIdx++) {
                        if (!fileObj.deletedPages.includes(pIdx)) {
                            pageIndicesToCopy.push(pIdx);
                        }
                    }

                    if (pageIndicesToCopy.length > 0) {
                        // Copy pages
                        const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndicesToCopy);
                        
                        // Apply rotation and add
                        copiedPages.forEach((copiedPage, localIdx) => {
                            const originalPageIdx = pageIndicesToCopy[localIdx];
                            const rotation = fileObj.pagesRotation[originalPageIdx] || 0;
                            if (rotation !== 0) {
                                // PDF-Lib setRotation takes degrees
                                copiedPage.setRotation(PDFLib.degrees(rotation));
                            }
                            mergedDoc.addPage(copiedPage);
                        });
                    }
                } else if (fileObj.extension === 'docx') {
                    // Convert DOCX to PDF
                    const docxPdf = await this.convertDocxToPdf(fileObj);
                    
                    // Copy all pages
                    const pagesToCopy = Array.from({ length: docxPdf.getPageCount() }, (_, index) => index);
                    const copiedPages = await mergedDoc.copyPages(docxPdf, pagesToCopy);
                    
                    copiedPages.forEach(copiedPage => {
                        mergedDoc.addPage(copiedPage);
                    });
                }
            } catch (err) {
                console.error(`Failed to merge file ${fileObj.name}:`, err);
                throw new Error(`Failed to merge ${fileObj.name}. It may contain corrupted data.`);
            }
        }

        if (onProgress) {
            onProgress(1.0, "Saving merged document...");
        }

        // Save PDF
        const pdfBytes = await mergedDoc.save();
        return pdfBytes;
    }
};
