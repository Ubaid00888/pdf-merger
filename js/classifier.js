const Classifier = {
    // Keywords dictionary for the 29 sections
    keywords: {
        "Title Page": ["title page", "cover page", "portfolio", "course portfolio", "student portfolio", "front page"],
        "Outline": ["outline", "syllabus", "course outline", "course description", "learning outcomes", "curriculum"],
        "Course Log": ["course log", "weekly plan", "lecture plan", "log book", "course diary", "weekly log"],
        "Attendance": ["attendance", "roll call", "presence", "attendance sheet", "attendance record", "absentee"],
        
        "Assignment 1": ["assignment 1", "assignment one", "assign 1", "assignment #1", "assignment#1", "assign1", "asg 1"],
        "Assignment 1 Solution": ["assignment 1 solution", "assignment 1 key", "assignment 1 answers", "assign 1 sol", "asg 1 sol"],
        "Assignment 1 Best": ["assignment 1 best", "assignment 1 high", "assignment 1 grade a", "assign 1 best", "assignment 1 top"],
        "Assignment 1 Average": ["assignment 1 average", "assignment 1 medium", "assignment 1 avg", "assign 1 avg", "assignment 1 mid"],
        "Assignment 1 Worst": ["assignment 1 worst", "assignment 1 low", "assignment 1 grade c", "assign 1 worst", "assignment 1 min"],
        
        "Quiz 1": ["quiz 1", "quiz one", "quiz #1", "quiz#1", "qz 1", "q1"],
        "Quiz 1 Solution": ["quiz 1 solution", "quiz 1 key", "quiz 1 answers", "quiz 1 sol", "q1 sol", "qz 1 sol"],
        "Quiz 1 Best": ["quiz 1 best", "quiz 1 high", "quiz 1 top", "quiz 1 grade a", "q1 best"],
        "Quiz 1 Average": ["quiz 1 average", "quiz 1 avg", "quiz 1 medium", "quiz 1 mid", "q1 avg"],
        "Quiz 1 Worst": ["quiz 1 worst", "quiz 1 low", "quiz 1 min", "quiz 1 poor", "q1 worst"],
        
        "Assignment 2": ["assignment 2", "assignment two", "assign 2", "assignment #2", "assignment#2", "assign2", "asg 2"],
        "Assignment 2 Solution": ["assignment 2 solution", "assignment 2 key", "assignment 2 answers", "assign 2 sol", "asg 2 sol"],
        "Assignment 2 Best": ["assignment 2 best", "assignment 2 high", "assignment 2 grade a", "assign 2 best", "assignment 2 top"],
        "Assignment 2 Average": ["assignment 2 average", "assignment 2 medium", "assignment 2 avg", "assign 2 avg", "assignment 2 mid"],
        "Assignment 2 Worst": ["assignment 2 worst", "assignment 2 low", "assignment 2 grade c", "assign 2 worst", "assignment 2 min"],
        
        "Quiz 2": ["quiz 2", "quiz two", "quiz #2", "quiz#2", "qz 2", "q2"],
        "Quiz 2 Solution": ["quiz 2 solution", "quiz 2 key", "quiz 2 answers", "quiz 2 sol", "q2 sol", "qz 2 sol"],
        "Quiz 2 Best": ["quiz 2 best", "quiz 2 high", "quiz 2 top", "quiz 2 grade a", "q2 best"],
        "Quiz 2 Average": ["quiz 2 average", "quiz 2 avg", "quiz 2 medium", "quiz 2 mid", "q2 avg"],
        "Quiz 2 Worst": ["quiz 2 worst", "quiz 2 low", "quiz 2 min", "quiz 2 poor", "q2 worst"],
        
        "Midterm": ["midterm", "mid term", "mid-term", "mid exam", "mid semester"],
        "Midterm Solution": ["midterm solution", "midterm key", "midterm answers", "midterm sol", "mid sol"],
        "Midterm Best": ["midterm best", "midterm high", "midterm top", "midterm grade a"],
        "Midterm Average": ["midterm average", "midterm avg", "midterm medium", "midterm mid"],
        "Midterm Worst": ["midterm worst", "midterm low", "midterm min", "midterm poor"]
    },

    // Subtypes keywords to distinguish between Solution, Best, Average, Worst, and Student Work
    subtypes: {
        "Solution": ["solution", "sol", "key", "answer", "marking scheme", "rubric"],
        "Best": ["best", "high", "top", "max", "excellent", "grade a", "100%", "95%", "a+"],
        "Average": ["average", "avg", "medium", "mid", "mean", "satisfactory", "grade b", "80%", "75%", "70%"],
        "Worst": ["worst", "low", "min", "poor", "grade c", "grade d", "failed", "50%", "40%"]
    },

    // Main entry point to extract text and classify a file
    async classifyFile(file, arrayBuffer) {
        let extractedText = "";
        let pageCount = 1;

        try {
            const extension = file.name.split('.').pop().toLowerCase();
            if (extension === 'pdf') {
                const pdfData = new Uint8Array(arrayBuffer);
                const loadingTask = pdfjsLib.getDocument({ data: pdfData });
                const pdf = await loadingTask.promise;
                pageCount = pdf.numPages;
                
                // Extract text from the first 2 pages (sufficient for classification and fast)
                const maxPagesToRead = Math.min(2, pdf.numPages);
                let textChunks = [];
                for (let i = 1; i <= maxPagesToRead; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(" ");
                    textChunks.push(pageText);
                }
                extractedText = textChunks.join("\n");
            } else if (extension === 'docx') {
                // Extract text using Mammoth
                const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                extractedText = result.value;
                
                // Estimate page count for DOCX (approx 400 words per page)
                const wordCount = extractedText.trim().split(/\s+/).length;
                pageCount = Math.max(1, Math.ceil(wordCount / 400));
            }
        } catch (error) {
            console.error("Text extraction failed:", error);
            // We can still classify using filename if text extraction fails
        }

        return this.runClassificationEngine(file.name, extractedText, pageCount);
    },

    // Classification engine based on scoring
    runClassificationEngine(filename, text, pageCount) {
        const cleanFilename = filename.toLowerCase().replace(/[-_.]/g, " ");
        const cleanText = text.toLowerCase();
        
        let bestMatch = "Unclassified";
        let maxScore = 0;
        let matchReason = "No clear matches found. Please manually classify.";
        let confidence = 0;

        // Iterate through each of the 29 sections
        for (const [section, keywordsList] of Object.entries(this.keywords)) {
            let score = 0;
            let filenameMatched = false;
            let textMatched = false;

            // 1. Filename match
            // Exact match of the section name in filename (case insensitive)
            if (cleanFilename.includes(section.toLowerCase())) {
                score += 100;
                filenameMatched = true;
            }

            // Keyword match in filename
            keywordsList.forEach(kw => {
                if (cleanFilename.includes(kw)) {
                    score += 60;
                    filenameMatched = true;
                }
            });

            // 2. Text match (if text is available)
            if (cleanText) {
                // Count occurrences of keywords in text
                keywordsList.forEach(kw => {
                    const regex = new RegExp(this.escapeRegExp(kw), 'g');
                    const matches = cleanText.match(regex);
                    if (matches) {
                        score += 20 * Math.min(3, matches.length); // Cap at 3 occurrences
                        textMatched = true;
                    }
                });
            }

            // 3. Subtype validation
            // If we match a section like "Assignment 1 Best", let's make sure the filename or text actually contains "best"
            // Let's check if the section name contains any subtype
            let sectionSubtype = null;
            for (const subtype of Object.keys(this.subtypes)) {
                if (section.includes(subtype)) {
                    sectionSubtype = subtype;
                    break;
                }
            }

            if (sectionSubtype) {
                // This is a subtype section (Solution, Best, Average, Worst)
                // Check if the file has matching subtype keywords
                const hasSubtypeKeywordInFilename = this.subtypes[sectionSubtype].some(kw => cleanFilename.includes(kw));
                const hasSubtypeKeywordInText = cleanText ? this.subtypes[sectionSubtype].some(kw => cleanText.includes(kw)) : false;
                
                if (hasSubtypeKeywordInFilename) {
                    score += 40;
                } else if (hasSubtypeKeywordInText) {
                    score += 20;
                } else {
                    // Penalty if this is a subtype section but the file has no indicators of this subtype
                    score -= 50;
                }
            } else {
                // This is a base student work section (e.g. "Assignment 1" or "Quiz 1" or "Midterm")
                // Check if the file contains any subtype keywords (Solution, Best, Average, Worst).
                // If it does, we penalize it for the base section, as it should match the subtype section instead.
                let hasOtherSubtype = false;
                for (const [subtype, kws] of Object.entries(this.subtypes)) {
                    if (kws.some(kw => cleanFilename.includes(kw))) {
                        hasOtherSubtype = true;
                        break;
                    }
                }
                
                if (hasOtherSubtype) {
                    score -= 60; // Heavy penalty
                }
            }

            // Keep track of the highest scoring section
            if (score > maxScore) {
                maxScore = score;
                bestMatch = section;
                if (filenameMatched && textMatched) {
                    matchReason = `Detected from filename and document text.`;
                } else if (filenameMatched) {
                    matchReason = `Detected from filename.`;
                } else if (textMatched) {
                    matchReason = `Detected from document headings and content.`;
                } else {
                    matchReason = `Fuzzy matched.`;
                }
            }
        }

        // Calculate confidence score (0 - 100)
        if (maxScore > 0) {
            // Normalize score to a percentage
            if (maxScore >= 120) {
                confidence = 99;
            } else if (maxScore >= 80) {
                confidence = Math.min(95, 80 + (maxScore - 80) * 0.4);
            } else {
                confidence = Math.min(75, 40 + maxScore * 0.4);
            }
        } else {
            bestMatch = "Unclassified";
            confidence = 0;
            matchReason = "No keywords matched. Placed in Unclassified.";
        }

        return {
            section: bestMatch,
            confidence: Math.round(confidence),
            reason: matchReason,
            pageCount
        };
    },

    // Helper to escape regex special characters
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
};
