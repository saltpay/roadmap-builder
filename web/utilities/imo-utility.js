/**
 * IMO Utility - Cross-Team IMO and Timeline Search Functionality
 * Handles directory scanning, story extraction, and filtering across multiple roadmap files
 */
class IMOUtility {
    
    /**
     * Scan a directory handle and extract all roadmap JSON files
     * @param {FileSystemDirectoryHandle} directoryHandle - Directory containing roadmap files
     * @returns {Promise<Array>} - Array of {fileName, fileContent, teamData} objects
     */
    static async scanRoadmapDirectory(directoryHandle) {
        const roadmapFiles = [];
        
        try {
            for await (const [name, handle] of directoryHandle.entries()) {
                if (handle.kind === 'file' && name.toLowerCase().endsWith('.json')) {
                    try {
                        const file = await handle.getFile();
                        const content = await file.text();
                        const roadmapData = JSON.parse(content);
                        
                        // Handle both new format (with metadata) and legacy format (direct teamData)
                        const teamData = roadmapData.teamData || roadmapData;
                        
                        if (teamData && teamData.teamName) {
                            roadmapFiles.push({
                                fileName: name,
                                fileContent: content,
                                teamData: teamData,
                                fileHandle: handle
                            });
                        }
                    } catch (error) {
                        console.warn(`Skipping invalid JSON file: ${name}`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Error scanning directory:', error);
            throw new Error('Failed to scan roadmap directory: ' + error.message);
        }
        
        // Sort files alphabetically by filename for consistent ordering
        roadmapFiles.sort((a, b) => a.fileName.localeCompare(b.fileName));
        
        return roadmapFiles;
    }
    
    /**
     * Extract all stories from a single roadmap's team data
     * @param {Object} teamData - Team data object from roadmap JSON
     * @param {string} teamName - Name of the team (for reference)
     * @returns {Array} - Array of story objects with team context
     */
    static extractStoriesFromRoadmap(teamData, teamName) {
        const stories = [];
        
        // Extract stories from epics
        if (teamData.epics && Array.isArray(teamData.epics)) {
            teamData.epics.forEach(epic => {
                if (epic.stories && Array.isArray(epic.stories)) {
                    epic.stories.forEach(story => {
                        if (story && typeof story === 'object' && story.title && story.title.trim()) {
                            stories.push({
                                ...story,
                                teamName: teamName,
                                epicName: epic.name || 'Unknown Epic',
                                sourceType: 'epic'
                            });
                        }
                    });
                }
            });
        }
        
        // Extract BTL stories
        if (teamData.btlStories && teamData.btlStories.stories && Array.isArray(teamData.btlStories.stories)) {
            teamData.btlStories.stories.forEach(story => {
                if (story && typeof story === 'object' && story.title && story.title.trim()) {
                    stories.push({
                        ...story,
                        teamName: teamName,
                        epicName: 'BTL', // BTL stories don't have epics
                        sourceType: 'btl'
                    });
                }
            });
        }
        
        return stories;
    }
    
    /**
     * Filter stories by IMO number or all IMO stories
     * @param {Array} stories - Array of story objects
     * @param {string} imoNumber - IMO number to search for (e.g., "0043") or "all" for any IMO
     * @returns {Array} - Filtered array of stories with matching IMO or all stories with any IMO
     */
    static filterStoriesByIMO(stories, imoNumber) {
        if (!imoNumber || !Array.isArray(stories)) return [];
        
        // Special case: "all" means find all stories with any IMO tag
        if (imoNumber === 'all') {
            return this.filterStoriesWithAnyIMO(stories);
        }
        
        const searchIMO = imoNumber.toString().trim().toLowerCase();
        
        return stories.filter(story => {
            if (story.imo && story.imo.toString().trim().toLowerCase() === searchIMO) {
                return true;
            }
            return false;
        });
    }
    
    /**
     * Filter stories that have any IMO tag
     * @param {Array} stories - Array of story objects
     * @returns {Array} - Filtered array of stories that have any IMO tag
     */
    static filterStoriesWithAnyIMO(stories) {
        if (!Array.isArray(stories)) return [];
        
        return stories.filter(story => {
            return story.imo && story.imo.toString().trim() !== '';
        });
    }
    
    /**
     * Filter stories by timeline (quarter, month, or date)
     * @param {Array} stories - Array of story objects
     * @param {string} timeline - Timeline to search for (e.g., "Q3", "April", "Mar 2025")
     * @returns {Array} - Filtered array of stories ending in specified timeline
     */
    static filterStoriesByTimeline(stories, timeline) {
        if (!timeline || !Array.isArray(stories)) return [];
        
        const searchTerm = timeline.toString().trim().toLowerCase();
        
        return stories.filter(story => {
            // Check end date/month
            if (story.endDate || story.endMonth) {
                const endValue = (story.endDate || story.endMonth || '').toString().toLowerCase();
                
                // Quarter matching (Q1, Q2, Q3, Q4)
                if (searchTerm.startsWith('q') && searchTerm.length === 2) {
                    const quarter = this.getQuarterFromDate(endValue);
                    if (quarter === searchTerm) return true;
                }
                
                // Month matching (partial or full)
                if (endValue.includes(searchTerm)) return true;
                
                // Year matching
                if (endValue.includes(searchTerm)) return true;
            }
            
            return false;
        });
    }
    
    /**
     * Determine which quarter a date/month falls into
     * @param {string} dateStr - Date or month string
     * @returns {string} - Quarter (q1, q2, q3, q4) or empty string if unknown
     */
    static getQuarterFromDate(dateStr) {
        if (!dateStr) return '';
        
        const str = dateStr.toLowerCase();
        
        // Q1: Jan, Feb, Mar
        if (str.includes('jan') || str.includes('feb') || str.includes('mar') || 
            str.includes('january') || str.includes('february') || str.includes('march')) {
            return 'q1';
        }
        
        // Q2: Apr, May, Jun
        if (str.includes('apr') || str.includes('may') || str.includes('jun') || 
            str.includes('april') || str.includes('june')) {
            return 'q2';
        }
        
        // Q3: Jul, Aug, Sep
        if (str.includes('jul') || str.includes('aug') || str.includes('sep') || str.includes('sept') ||
            str.includes('july') || str.includes('august') || str.includes('september')) {
            return 'q3';
        }
        
        // Q4: Oct, Nov, Dec
        if (str.includes('oct') || str.includes('nov') || str.includes('dec') || 
            str.includes('october') || str.includes('november') || str.includes('december')) {
            return 'q4';
        }
        
        return '';
    }
    
    /**
     * Aggregate stories from multiple roadmap files
     * @param {Array} roadmapFiles - Array from scanRoadmapDirectory()
     * @returns {Array} - Combined array of all stories with team context
     */
    static aggregateStoriesAcrossTeams(roadmapFiles) {
        const allStories = [];
        const storyMap = new Map(); // Track stories by title+team to handle duplicates
        
        roadmapFiles.forEach(roadmapFile => {
            // Extract year from filename (e.g., "Terminal.Teya-Roadmap.2025.json" -> 2025)
            const yearMatch = roadmapFile.fileName.match(/\.(\d{4})\./);
            const roadmapYear = yearMatch ? parseInt(yearMatch[1]) : 2025; // Default to 2025 if no year found
            
            const stories = this.extractStoriesFromRoadmap(roadmapFile.teamData, roadmapFile.teamData.teamName);
            stories.forEach(story => {
                story.sourceFile = roadmapFile.fileName;
                story.fileHandle = roadmapFile.fileHandle;
                story.roadmapYear = roadmapYear; // Add roadmap year to each story
                
                // Create unique key for duplicate detection
                const storyKey = `${story.teamName}-${story.title}`;
                
                // Check if we already have this story
                const existingStory = storyMap.get(storyKey);
                if (existingStory) {
                    // Prioritize stories with specific endDate over generic endMonth
                    const currentHasEndDate = story.endDate && story.endDate.trim();
                    const existingHasEndDate = existingStory.endDate && existingStory.endDate.trim();
                    
                    if (currentHasEndDate && !existingHasEndDate) {
                        // Current story has specific date, existing doesn't - use current
                        storyMap.set(storyKey, story);
                    } else if (!currentHasEndDate && existingHasEndDate) {
                        // Existing story has specific date, current doesn't - keep existing
                        // No action needed, keep existing
                    } else {
                        // Both have same type of date info - prefer newer file (with year in filename)
                        const currentHasYear = roadmapFile.fileName.includes('.2025.');
                        const existingHasYear = existingStory.sourceFile.includes('.2025.');
                        
                        if (currentHasYear && !existingHasYear) {
                            storyMap.set(storyKey, story);
                        }
                        // Otherwise keep existing
                    }
                } else {
                    // New story, add it
                    storyMap.set(storyKey, story);
                }
            });
        });
        
        // Convert map back to array
        allStories.push(...storyMap.values());
        
        return allStories;
    }

    /**
     * Filter roadmap files by Director/VP, EM, or PM name (team-level metadata)
     * @param {Array} roadmapFiles - Array from scanRoadmapDirectory()
     * @param {string} query - Case-insensitive substring to search in teamData.directorVP, em, or pm
     * @returns {Array} - Filtered roadmapFiles whose teamData.directorVP, em, or pm matches
     */
    static filterRoadmapsByDirector(roadmapFiles, query) {
        if (!Array.isArray(roadmapFiles) || !query) return [];
        const q = query.toString().trim().toLowerCase();
        if (!q) return [];
        
        console.log('🔍 Leadership search debug:', { query: q, roadmapFilesCount: roadmapFiles.length });
        
        return roadmapFiles.filter(f => {
            const td = f.teamData || {};
            const dvp = td.directorVP ? String(td.directorVP).toLowerCase() : '';
            const em = td.em ? String(td.em).toLowerCase() : '';
            const pm = td.pm ? String(td.pm).toLowerCase() : '';
            
            const matches = dvp.includes(q) || em.includes(q) || pm.includes(q);
            
            if (matches) {
                console.log('✅ Match found:', { 
                    teamName: td.teamName, 
                    directorVP: td.directorVP, 
                    em: td.em, 
                    pm: td.pm,
                    query: q 
                });
            }
            
            return matches;
        });
    }
    
    /**
     * Parse search query and determine search type
     * @param {string} query - Search query (e.g., "IMO", "IMO 0043", "0043", "Q3", "April")
     * @returns {Object} - {type: 'imo'|'timeline', value: string}
     */
    static parseSearchQuery(query) {
        if (!query || typeof query !== 'string') {
            return { type: null, value: '' };
        }
        
        const cleanQuery = query.trim();
        
        // IMO pattern: "IMO 0043" or just "0043"
        const imoMatch = cleanQuery.match(/^(?:imo\s*)?(\d+)$/i);
        if (imoMatch) {
            return { type: 'imo', value: imoMatch[1] };
        }
        
        // Just "IMO" - search for all stories with any IMO tag
        if (/^imo$/i.test(cleanQuery)) {
            return { type: 'imo', value: 'all' };
        }
        
        // Quarter pattern: "Q1", "Q2", etc.
        if (/^q[1-4]$/i.test(cleanQuery)) {
            return { type: 'timeline', value: cleanQuery.toLowerCase() };
        }
        
        // Default to timeline search for anything else (months, dates)
        return { type: 'timeline', value: cleanQuery };
    }
    
    /**
     * Search stories based on parsed query
     * @param {Array} allStories - Array of all stories from aggregateStoriesAcrossTeams()
     * @param {string} searchQuery - Raw search query string
     * @returns {Array} - Filtered stories matching the search
     */
    static searchStories(allStories, searchQuery) {
        const { type, value } = this.parseSearchQuery(searchQuery);
        
        if (!type) return [];
        
        if (type === 'imo') {
            return this.filterStoriesByIMO(allStories, value);
        } else if (type === 'timeline') {
            if (!value) return [];
            return this.filterStoriesByTimeline(allStories, value);
        }
        
        return [];
    }
    
    /**
     * Parse a story date string that may contain month names
     * @param {string} dateStr - Date string (e.g., "15/03/25", "15/AUG/25", "AUG 2025", "AUG")
     * @param {number} defaultYear - Default year to use if not specified
     * @returns {Date|null} - Parsed date or null if invalid
     */
    static parseStoryDate(dateStr, defaultYear) {
        if (!dateStr) return null;
        
        const str = dateStr.toLowerCase().trim();
        
        // Month name mappings
        const monthMap = {
            'jan': 0, 'january': 0,
            'feb': 1, 'february': 1,
            'mar': 2, 'march': 2,
            'apr': 3, 'april': 3,
            'may': 4,
            'jun': 5, 'june': 5,
            'jul': 6, 'july': 6,
            'aug': 7, 'august': 7,
            'sep': 8, 'sept': 8, 'september': 8,
            'oct': 9, 'october': 9,
            'nov': 10, 'november': 10,
            'dec': 11, 'december': 11
        };
        
        // Handle numeric dates like "15/03/25"
        if (str.includes('/') && /\d+\/\d+/.test(str)) {
            const parts = str.split('/');
            if (parts.length >= 2) {
                const day = parseInt(parts[0]);
                const monthPart = parts[1];
                
                // Check if month is numeric or name
                let month;
                if (/^\d+$/.test(monthPart)) {
                    month = parseInt(monthPart) - 1; // Month is 0-indexed
                } else {
                    month = monthMap[monthPart];
                    if (month === undefined) return null;
                }
                
                let year = parts.length > 2 ? parseInt(parts[2]) : defaultYear;
                
                // Handle 2-digit years - always assume 2000s for roadmaps
                if (year < 100) {
                    year = 2000 + year;
                }
                
                if (!isNaN(day) && month !== undefined && !isNaN(year)) {
                    return new Date(year, month, day);
                }
            }
        }
        
        // Handle "AUG 2025", "SEPT 15", "15 AUG", etc.
        const words = str.split(/[\s\/\-]+/);
        let day = null, month = null, year = null;
        
        for (const word of words) {
            const trimmed = word.trim();
            
            // Check if it's a month name
            if (monthMap[trimmed] !== undefined) {
                month = monthMap[trimmed];
            }
            // Check if it's a number
            else if (/^\d+$/.test(trimmed)) {
                const num = parseInt(trimmed);
                if (num > 31) {
                    // Likely a year - always assume 2000s for roadmaps
                    year = num < 100 ? 2000 + num : num;
                } else {
                    // Likely a day
                    day = num;
                }
            }
        }
        
        // Use defaults if not found
        if (month !== null) {
            if (year === null) year = defaultYear;
            if (day === null) day = 1; // Default to first of month
            
            return new Date(year, month, day);
        }
        
        return null;
    }

    /**
     * Search stories by title using string matching
     * @param {Array} allStories - Array of all stories
     * @param {string} searchText - Text to search for in story titles
     * @returns {Array} - Stories with titles containing the search text
     */
    static searchStoriesByTitle(allStories, searchText) {
        if (!searchText || !Array.isArray(allStories)) return [];
        
        const searchTerm = searchText.toString().trim().toLowerCase();
        if (!searchTerm) return [];
        
        return allStories.filter(story => {
            if (story.title && typeof story.title === 'string') {
                return story.title.toLowerCase().includes(searchTerm);
            }
            return false;
        });
    }

    /**
     * Search stories by date matching (exact, exact-7days, or range)
     * @param {Array} allStories - Array of all stories
     * @param {string} startDate - Start date in YYYY-MM-DD format (optional)
     * @param {string} endDate - End date in YYYY-MM-DD format (optional)
     * @param {string} searchMode - 'exact', 'exact-7days', or 'range' (default: 'exact')
     * @returns {Array} - Stories matching the date criteria
     */
    static searchStoriesByDateRange(allStories, startDate, endDate, searchMode = 'exact') {
        if (!startDate && !endDate) return [];
        
        return allStories.filter(story => {
            // Convert story dates to YYYY-MM-DD format for simple string comparison
            const storyStartDateStr = this.convertStoryDateToISO(story.startDate || story.startMonth || '', story.roadmapYear);
            const storyEndDateStr = this.convertStoryDateToISO(story.endDate || story.endMonth || '', story.roadmapYear);
            
            if (searchMode === 'exact') {
                // EXACT MATCH MODE
                if (startDate && endDate) {
                    // Story must start on startDate AND end on endDate
                    return storyStartDateStr === startDate && storyEndDateStr === endDate;
                } else if (startDate) {
                    // Story must start exactly on this date
                    return storyStartDateStr === startDate;
                } else if (endDate) {
                    // Story must end exactly on this date
                    return storyEndDateStr === endDate;
                }
            } else if (searchMode === 'exact-7days') {
                // EXACT +/- 7 DAYS MODE
                if (startDate && endDate) {
                    // Story must start within startDate to startDate+7 days AND end within endDate +/- 7 days
                    const startMatches = storyStartDateStr && this.isStartDateWithin7DaysForward(storyStartDateStr, startDate);
                    const endMatches = storyEndDateStr && this.isWithinDateRange(storyEndDateStr, endDate, 7, 7); // +/- 7 days
                    return startMatches && endMatches;
                } else if (startDate) {
                    // Story must start within startDate to startDate+7 days (FORWARD ONLY)
                    return storyStartDateStr && this.isStartDateWithin7DaysForward(storyStartDateStr, startDate);
                } else if (endDate) {
                    // Story must end within endDate +/- 7 days
                    return storyEndDateStr && this.isWithinDateRange(storyEndDateStr, endDate, 7, 7); // +/- 7 days
                }
            } else {
                // RANGE SEARCH MODE
                if (startDate && endDate) {
                    // Story must start on or after startDate AND end on or before endDate
                    if (storyStartDateStr && storyEndDateStr) {
                        return storyStartDateStr >= startDate && storyEndDateStr <= endDate;
                    } else if (storyStartDateStr) {
                        // Only story start date available - must start on or after start date
                        return storyStartDateStr >= startDate;
                    } else if (storyEndDateStr) {
                        // Only story end date available - must end on or before end date
                        return storyEndDateStr <= endDate;
                    }
                } else if (startDate) {
                    // Story must start on or after this date
                    return storyStartDateStr && storyStartDateStr >= startDate;
                } else if (endDate) {
                    // Story must end on or before this date
                    return storyEndDateStr && storyEndDateStr <= endDate;
                }
            }
            
            return false;
        });
    }

    /**
     * Convert story date to ISO format (YYYY-MM-DD) for simple string comparison
     * @param {string} dateStr - Story date string (various formats)
     * @param {number} defaultYear - Default year to use if not specified
     * @returns {string|null} - ISO date string or null if parsing fails
     */
    static convertStoryDateToISO(dateStr, defaultYear) {
        if (!dateStr) return null;
        
        const str = dateStr.toLowerCase().trim();
        const currentYear = defaultYear || new Date().getFullYear();
        
        // Already in ISO format
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            return str;
        }
        
        // Handle DD/MM/YY or DD/MM/YYYY format
        if (str.includes('/') && /\d+\/\d+/.test(str)) {
            const parts = str.split('/');
            if (parts.length >= 2) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                let year = parts.length > 2 ? parseInt(parts[2]) : currentYear;
                
                // Handle 2-digit years - always assume 2000s for roadmaps
                if (year < 100) {
                    year = 2000 + year;
                }
                
                if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                    const dayStr = String(day).padStart(2, '0');
                    const monthStr = String(month).padStart(2, '0');
                    return `${year}-${monthStr}-${dayStr}`;
                }
            }
        }
        
        // Handle month names (Jan, February, etc.)
        const monthMap = {
            'jan': '01', 'january': '01',
            'feb': '02', 'february': '02',
            'mar': '03', 'march': '03',
            'apr': '04', 'april': '04',
            'may': '05',
            'jun': '06', 'june': '06',
            'jul': '07', 'july': '07',
            'aug': '08', 'august': '08',
            'sep': '09', 'sept': '09', 'september': '09',
            'oct': '10', 'october': '10',
            'nov': '11', 'november': '11',
            'dec': '12', 'december': '12'
        };
        
        // Check for month name patterns
        for (const [monthName, monthNum] of Object.entries(monthMap)) {
            if (str.includes(monthName)) {
                // Extract day if present
                const dayMatch = str.match(/\d+/);
                const day = dayMatch ? parseInt(dayMatch[0]) : 1;
                
                // Extract year if present - handle both 2-digit and 4-digit years
                const yearMatch = str.match(/\b\d{2,4}\b/);
                let year = currentYear;
                if (yearMatch) {
                    year = parseInt(yearMatch[0]);
                    // Handle 2-digit years - always assume 2000s for roadmaps
                    if (year < 100) {
                        year = 2000 + year;
                    }
                }
                
                if (day >= 1 && day <= 31) {
                    const dayStr = String(day).padStart(2, '0');
                    return `${year}-${monthNum}-${dayStr}`;
                }
            }
        }
        
        return null;
    }

    /**
     * Check if a story start date is within 7 days forward from target date (NEVER backward)
     * @param {string} storyDateStr - Story date in YYYY-MM-DD format
     * @param {string} targetStartDate - Target start date in YYYY-MM-DD format
     * @returns {boolean} - True if story date is between targetStartDate and targetStartDate+7 days
     */
    static isStartDateWithin7DaysForward(storyDateStr, targetStartDate) {
        if (!storyDateStr || !targetStartDate) return false;
        
        const storyDate = new Date(storyDateStr);
        const targetDate = new Date(targetStartDate);
        
        // Calculate 7 days forward from target date
        const rangeEnd = new Date(targetDate);
        rangeEnd.setDate(targetDate.getDate() + 7);
        
        // Story date must be >= target date AND <= target date + 7 days
        // This ensures we never go backward from the target date
        return storyDate >= targetDate && storyDate <= rangeEnd;
    }

    /**
     * Check if a story date is within a range of days from a target date
     * @param {string} storyDateStr - Story date in YYYY-MM-DD format
     * @param {string} targetDateStr - Target date in YYYY-MM-DD format
     * @param {number} daysBefore - Number of days before target date
     * @param {number} daysAfter - Number of days after target date
     * @returns {boolean} - True if story date is within the range
     */
    static isWithinDateRange(storyDateStr, targetDateStr, daysBefore, daysAfter) {
        if (!storyDateStr || !targetDateStr) return false;
        
        const storyDate = new Date(storyDateStr);
        const targetDate = new Date(targetDateStr);
        
        // Calculate the range boundaries
        const rangeStart = new Date(targetDate);
        rangeStart.setDate(targetDate.getDate() - daysBefore);
        
        const rangeEnd = new Date(targetDate);
        rangeEnd.setDate(targetDate.getDate() + daysAfter);
        
        return storyDate >= rangeStart && storyDate <= rangeEnd;
    }

    /**
     * Get story status display information
     * @param {Object} story - Story object
     * @returns {Object} - {text: string, className: string, icon: string}
     */
    static getStoryStatus(story) {
        if (story.isDone) {
            return { text: 'Done', className: 'status-done', icon: '✅' };
        }
        if (story.isCancelled) {
            return { text: 'Cancelled', className: 'status-cancelled', icon: '❌' };
        }
        if (story.isAtRisk) {
            return { text: 'At Risk', className: 'status-at-risk', icon: '⚠️' };
        }
        if (story.isNewStory) {
            return { text: 'New', className: 'status-new', icon: '🆕' };
        }
        if (story.isProposed) {
            return { text: 'Proposed', className: 'status-proposed', icon: '💡' };
        }
        
        return { text: 'In Progress', className: 'status-in-progress', icon: '🔄' };
    }
}

// Export for both CommonJS and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { IMOUtility };
} else if (typeof window !== 'undefined') {
    window.IMOUtility = IMOUtility;
}