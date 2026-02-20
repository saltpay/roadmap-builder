const fs = typeof require !== 'undefined' ? require('fs') : null;
const path = typeof require !== 'undefined' ? require('path') : null;

// Import DateUtility for centralized date handling
let _DateUtility;
function getDateUtility() {
    if (!_DateUtility) {
        if (typeof require !== 'undefined') {
            _DateUtility = require('./utilities/date-utility');
        } else if (typeof window !== 'undefined') {
            _DateUtility = window.DateUtility;
        }
        if (!_DateUtility) {
            throw new Error('DateUtility not available. Make sure utilities/date-utility.js is loaded before roadmap-generator.js');
        }
    }
    return _DateUtility;
}

// Import UIUtility for centralized UI generation
let _UIUtility;
function getUIUtility() {
    if (!_UIUtility) {
        if (typeof require !== 'undefined') {
            _UIUtility = require('./utilities/ui-utility').UIUtility;
        } else if (typeof window !== 'undefined') {
            _UIUtility = window.UIUtility;
        }
        if (!_UIUtility) {
            throw new Error('UIUtility not available. Make sure utilities/ui-utility.js is loaded before roadmap-generator.js');
        }
    }
    return _UIUtility;
}

// Import ConfigUtility for centralized configuration
let _ConfigUtility;
function getConfigUtility() {
    if (!_ConfigUtility) {
        if (typeof require !== 'undefined') {
            _ConfigUtility = require('./utilities/config-utility').ConfigUtility;
        } else if (typeof window !== 'undefined') {
            _ConfigUtility = window.ConfigUtility;
        }
        if (!_ConfigUtility) {
            throw new Error('ConfigUtility not available. Make sure utilities/config-utility.js is loaded before roadmap-generator.js');
        }
    }
    return _ConfigUtility;
}

class RoadmapGenerator {
    constructor(roadmapYear = null) {
        this.months = getConfigUtility().getAllMonthNames();
        const year = roadmapYear || new Date().getFullYear();
        const shortYear = year.toString().slice(-2);
        this.quarters = [`Q1'${shortYear}`, `Q2'${shortYear}`, `Q3'${shortYear}`, `Q4'${shortYear}`];
        this.roadmapYear = year;
        this.enableStackedIcons = false;
    }

    // Helper method to check if a story should be displayed based on roadmap year
    shouldDisplayStory(story) {
        if (!this.roadmapYear) return true; // If no roadmap year set, display all
        
        let startYear = null;
        let endYear = null;
        
        // Parse start date/year
        if (story.startDate) {
            try {
                let isoStartDate = story.startDate;
                if (story.startDate.match(/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/)) {
                    isoStartDate = this.convertEuropeanToISO(story.startDate);
                }
                const startDate = new Date(isoStartDate);
                if (!isNaN(startDate.getTime())) {
                    startYear = startDate.getFullYear();
                }
            } catch (e) {
                // If date parsing fails, continue
            }
        } else if (story.startMonth) {
            // For month-only start dates, assume they're in roadmap year
            startYear = this.roadmapYear;
        }
        
        // Parse end date/year
        if (story.endDate) {
            try {
                let isoEndDate = story.endDate;
                if (story.endDate.match(/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/)) {
                    isoEndDate = this.convertEuropeanToISO(story.endDate);
                }
                const endDate = new Date(isoEndDate);
                if (!isNaN(endDate.getTime())) {
                    endYear = endDate.getFullYear();
                }
            } catch (e) {
                // If date parsing fails, continue
            }
        } else if (story.endMonth) {
            // For month-only end dates, assume they're in roadmap year
            endYear = this.roadmapYear;
        }
        
        // Show story if it's active during the roadmap year
        // (starts before or during roadmap year AND ends during or after roadmap year)
        if (startYear !== null && endYear !== null) {
            return startYear <= this.roadmapYear && endYear >= this.roadmapYear;
        }
        
        // If only start year is known, show if it starts in or before roadmap year
        if (startYear !== null) {
            return startYear <= this.roadmapYear;
        }
        
        // If only end year is known, show if it ends in or after roadmap year
        if (endYear !== null) {
            return endYear >= this.roadmapYear;
        }
        
        return true; // Display by default if no date info
    }
    
    // Helper to check if a date is outside the roadmap year
    isDateOutsideRoadmapYear(dateStr) {
        if (!dateStr || !this.roadmapYear) return false;
        
        try {
            let isoDate = dateStr;
            if (dateStr.match(getDateUtility().EUROPEAN_DATE_REGEX)) {
                isoDate = this.convertEuropeanToISO(dateStr);
            }
            const date = new Date(isoDate);
            return !isNaN(date.getTime()) && date.getFullYear() !== this.roadmapYear;
        } catch (e) {
            return false; // If parsing fails, don't filter out
        }
    }

    // Helper to check if a story continues past the roadmap year or search range
    storyContinuesNextYear(story) {
        if (!story.endDate) return false;
        
        // Use date-only comparison to avoid time component issues
        const storyEndDateStr = this.convertStoryDateToISO(story.endDate, this.roadmapYear);
        if (!storyEndDateStr) return false;
        
        // Extract year from the ISO date string (YYYY-MM-DD)
        const storyEndYear = parseInt(storyEndDateStr.split('-')[0]);
        
        // For normal roadmaps, check if story ends after the roadmap year
        if (this.roadmapYear && storyEndYear > this.roadmapYear) {
            return true;
        }
        
        // For date range searches, check if story ends after the search range END date
        if (this.searchRange && this.searchRange.endDate) {
            return storyEndDateStr > this.searchRange.endDate;
        }
        
        return false;
    }

    // Convert story date to ISO format (same logic as in IMOUtility but local copy for RoadmapGenerator)
    convertStoryDateToISO(dateStr, defaultYear) {
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
                
                // Extract year if present - handle 2-digit years correctly
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
    
    // Helper to check if a story starts on or before the search range
    storyStartsBeforeRange(story) {
        if (!this.searchRange || !this.searchRange.startDate) return false;
        if (!story.startDate && !story.startMonth) return false;
        
        try {
            let storyStartDate = null;
            
            if (story.startDate) {
                let isoStartDate = story.startDate;
                if (story.startDate.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/)) {
                    isoStartDate = this.convertEuropeanToISO(story.startDate);
                }
                storyStartDate = new Date(isoStartDate);
                

            } else if (story.startMonth) {
                // For startMonth, we need to determine the correct year
                // If the story has no explicit year, it's from the roadmap year
                let storyStartStr = story.startMonth;
                let yearToUse = this.roadmapYear || new Date().getFullYear();
                
                // If startMonth has a date format, extract the year
                if (storyStartStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/)) {
                    let isoStartDate = this.convertEuropeanToISO(storyStartStr);
                    storyStartDate = new Date(isoStartDate);
                } else {
                    // Pure month name - use roadmap year
                    storyStartDate = this.parseMonthToDate(storyStartStr, yearToUse);
                }
                

            }
            
            if (!storyStartDate || isNaN(storyStartDate.getTime())) {
                return false;
            }
            
            const searchStartParts = this.searchRange.startDate.split('-');
            const searchStartDate = new Date(parseInt(searchStartParts[0]), parseInt(searchStartParts[1]) - 1, parseInt(searchStartParts[2]));
            return storyStartDate <= searchStartDate;
        } catch (e) {
            return false;
        }
    }
    
    // Helper to parse month string to date
    parseMonthToDate(monthStr, year) {
        const monthMap = {
            'jan': 0, 'january': 0, 'feb': 1, 'february': 1, 'mar': 2, 'march': 2,
            'apr': 3, 'april': 3, 'may': 4, 'jun': 5, 'june': 5,
            'jul': 6, 'july': 6, 'aug': 7, 'august': 7, 'sep': 8, 'sept': 8, 'september': 8,
            'oct': 9, 'october': 9, 'nov': 10, 'november': 10, 'dec': 11, 'december': 11
        };
        
        const month = monthMap[monthStr.toLowerCase()];
        if (month !== undefined) {
            return new Date(year, month, 1);
        }
        return null;
    }
    
    // Helper to format story title with start information if it starts in previous year
    getStoryTitleWithStartInfo(story) {
        let title = this.formatText(story.title);
        
        if (story._startsInPreviousYear && story._actualStartYear && story._originalStartDate) {
            try {
                let isoStartDate = story._originalStartDate;
                if (story._originalStartDate.match(/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/)) {
                    isoStartDate = this.convertEuropeanToISO(story._originalStartDate);
                }
                const startDate = new Date(isoStartDate);
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const actualStartMonth = monthNames[startDate.getMonth()];
                const startInfo = `<span style="font-size: smaller; font-style: italic; font-weight: normal; color: black;"> (📅 ${actualStartMonth} ${story._actualStartYear})</span>`;
                title += startInfo;
            } catch (e) {
                // Fallback if date parsing fails
                const startInfo = `<span style="font-size: smaller; font-style: italic; font-weight: normal; color: black;"> (📅 ${story._actualStartYear})</span>`;
                title += startInfo;
            }
        }
        
        return title;
    }

    // Format text to support strikethrough, underline, bold, italics, and other formatting
    formatText(text) {
        if (!text) return '';
        
        // Convert Unicode character codes (U+XXXX) to actual Unicode characters
        text = text.replace(/U\+([0-9A-Fa-f]{4,6})/g, (match, hex) => {
            return String.fromCodePoint(parseInt(hex, 16));
        });
        
        // Convert **text** to bold
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert ?text? to italic
        text = text.replace(/\?(.*?)\?/g, '<em>$1</em>');
        
        // Convert ~~text~~ to strikethrough
        text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
        
        // Convert __text__ to underline
        text = text.replace(/__(.*?)__/g, '<u>$1</u>');
        
        return text;
    }

    // Format monthly description with manual line breaks and italic second line
    formatMonthlyDescription(description) {
        if (!description || typeof description !== 'string') return description;
        
        const formatted = this.formatText(description);
        
        let lines = [];
        if (formatted.includes('\n')) {
            lines = formatted.split('\n');
        } else if (formatted.includes('|')) {
            lines = formatted.split('|');
        } else if (formatted.includes('  ')) {
            lines = formatted.split('  ');
        } else {
            return formatted;
        }
        
        lines = lines.map(line => line.trim()).filter(line => line.length > 0);
        
        if (lines.length === 1) {
            return lines[0];
        } else if (lines.length >= 2) {
            return `${lines[0]}<br/>${lines[1]}`;
        }
        
        return formatted;
    }

    // Wrap text at specified character limit, breaking at whitespace
    wrapTextAtWordBoundary(text, maxLength = 120) {
        if (!text || text.length <= maxLength) {
            return text;
        }
        
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            // If adding this word would exceed the limit and we have content, start a new line
            if (currentLine.length + word.length + 1 > maxLength && currentLine.length > 0) {
                lines.push(currentLine.trim());
                currentLine = word;
            } else {
                // Add word to current line
                if (currentLine.length > 0) {
                    currentLine += ' ' + word;
                } else {
                    currentLine = word;
                }
            }
        }
        
        // Add the last line if it has content
        if (currentLine.trim().length > 0) {
            lines.push(currentLine.trim());
        }
        
        return lines.join('<br>');
    }

    // Generate team description HTML - handles both string and array formats for backward compatibility
    generateTeamDescription(description) {
        if (!description) return '';
        
        if (Array.isArray(description)) {
            // Old format: array of lines
            return description.map(line => 
                `<div class="team-description-line">${this.wrapTextAtWordBoundary(this.formatText(line))}</div>`
            ).join('');
        } else if (typeof description === 'string') {
            // New format: multi-line string
            const lines = description.split('\n').filter(line => line.trim() !== '');
            return lines.map(line => 
                `<div class="team-description-line">${this.wrapTextAtWordBoundary(this.formatText(line))}</div>`
            ).join('');
        }
        
        return '';
    }

    // Format European date - normalize all European formats to DD/MM/YY for consistent display
    formatDateEuropean(dateStr) {
        return getDateUtility().formatDateEuropean(dateStr, this.roadmapYear);
    }

    // Convert European date format to ISO format (YYYY-MM-DD)
    convertEuropeanToISO(dateStr) {
        return getDateUtility().convertEuropeanToISO(dateStr, this.roadmapYear);
    }

    // Safe date parsing that handles ONLY European and ISO formats - NO US FORMAT EVER
    parseDateSafe(dateStr) {
        return getDateUtility().parseDateSafe(dateStr);
    }

    // Convert month name to grid position
    monthToGrid(month) {
        return getConfigUtility().getMonthGridPosition(month);
    }

    // Convert specific date to grid position with sub-month precision
    dateToGrid(dateStr) {
        return getDateUtility().dateToGrid(dateStr, (month) => this.monthToGrid(month));
    }

    // Helper function to get month name from number
    getMonthName(monthNum) {
        return getDateUtility().getMonthName(monthNum);
    }

    // Smart position calculator - handles both month names and dates
    getGridPosition(value) {
        return getDateUtility().getGridPosition(value, (month) => this.monthToGrid(month));
    }

    // Generate the CSS styles - now links to external CSS file
    generateCSS(fixedWidth = false) {
        // Add cache-busting parameter to force CSS reload
        const timestamp = Date.now();
        let css = `<link rel="stylesheet" href="roadmap-styles.css?v=${timestamp}">`;
        
        // Add fixed width styles for read-only roadmap view
        if (fixedWidth) {
            css += `
            <style>
                body {
                    overflow-x: auto;
                    min-width: 1200px;
                }
                .roadmap-container {
                    min-width: 1200px;
                    width: 1200px;
                }
                .timeline-header {
                    min-width: 1200px;
                    width: 1200px;
                }
                .swimlanes-container {
                    min-width: 1200px;
                    width: 1200px;
                }
            </style>`;
        }
        
        return css;
    }

    // Generate timeline header
    generateTimelineHeader() {
        const quartersHTML = this.quarters.map(quarter => 
            `<div class="quarter-header" style="grid-column: span 3;">${quarter}</div>`
        ).join('');
        
        const monthsHTML = this.months.map(month => 
            `<div class="month-header">${month}</div>`
        ).join('');

        return `
        <div class="timeline-header sticky-header">
            <div class="quarters-row">${quartersHTML}</div>
            <div class="months-row">${monthsHTML}</div>
        </div>
        <div class="timeline-separator"></div>`;
    }

    // Generate grid cells for timeline
    generateTimelineGrid() {
        return `
        <div class="timeline-grid">
            ${Array(120).fill().map(() => '<div class="grid-cell"></div>').join('')}
        </div>`;
    }

    // Helper function to get the effective end date (considering timeline changes)
    getEffectiveEndDate(story) {
        // If no timeline changes, use original end date
        if (!story.roadmapChanges?.changes || story.roadmapChanges.changes.length === 0) {
            return story.endDate || story.endMonth;
        }
        
        // Sort timeline changes by change date (most recent first)
        const sortedChanges = [...story.roadmapChanges.changes].sort((a, b) => {
            return getDateUtility().compareDates(b.date, a.date); // Reverse order for most recent first
        });
        
        // Get the newEndDate from the most recent change
        const mostRecentChange = sortedChanges[0];
        if (mostRecentChange && mostRecentChange.newEndDate) {
            // Determine if this is a date or month format
            const newEndDate = mostRecentChange.newEndDate;
            if (newEndDate.includes('-') || newEndDate.match(/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/)) {
                // It's a date format
                return newEndDate;
            } else {
                // It's a month format
                return newEndDate.toUpperCase();
            }
        }
        
        // Fallback to original end date
        return story.endDate || story.endMonth;
    }

    // Helper function to determine if effective end date is a date or month
    isEffectiveEndDateADate(story) {
        const effectiveEndDate = this.getEffectiveEndDate(story);
        if (!effectiveEndDate) return false;
        
        // Check if it's a date format (contains - or matches DD/MM pattern)
        return effectiveEndDate.includes('-') || effectiveEndDate.match(/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/);
    }

    // Generate story HTML
    generateStory(story, epicName = '', storyIndex = 0, embedded = false, backgroundColor = '') {
        // Check if story should be displayed based on roadmap year
        if (!this.shouldDisplayStory(story)) {
            return ''; // Don't display stories with dates outside roadmap year
        }
        
        // Generate unique identifier for story-textbox pairing (sanitize for CSS selectors)
        const storyId = getUIUtility().generateStoryId(epicName, storyIndex);
        
        // Support both date formats (startDate/endDate and startMonth/endMonth)
        const startValue = story.startDate || story.startMonth;
        
        // Use effective end date that considers timeline changes
        const effectiveEndValue = this.getEffectiveEndDate(story);
        const effectiveEndIsDate = this.isEffectiveEndDateADate(story);
        
        let startGrid;
        // Use clean 4-position system for start dates (same as end dates)
        if (story.startDate) {
            try {
                // Convert European date to ISO if needed
                let isoStartDate = story.startDate;
                if (story.startDate.match(/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/)) {
                    isoStartDate = this.convertEuropeanToISO(story.startDate);
                }
                
                const startDate = new Date(isoStartDate);
                if (!isNaN(startDate.getTime())) {
                    // Check if story starts before the roadmap year
                    if (startDate.getFullYear() < this.roadmapYear) {
                        // Story starts before roadmap year - treat exactly as if it starts on 01/01/2025
                        // Override the story's start date to be 01/01 of roadmap year for positioning
                        story._originalStartDate = story.startDate; // Save original for reference
                        story.startDate = `01/01/${this.roadmapYear}`; // Set to January 1st of roadmap year
                        const jan1IsoDate = `${this.roadmapYear}-01-01`;
                        
                        // Use the same logic as normal January 1st dates
                        const isStartOfMonth = getDateUtility().isStartOfMonth(jan1IsoDate);
                        if (isStartOfMonth) {
                            startGrid = this.monthToGrid('JAN');
                        } else {
                            startGrid = getDateUtility().dateToGrid(jan1IsoDate, this.monthToGrid.bind(this));
                        }
                        // Note: January 1st is never the 15th, so no special backup needed here
                        
                        // Add visual indicator that story started in previous year
                        story._startsInPreviousYear = true;
                        story._actualStartYear = startDate.getFullYear();
                    } else {
                        // Story starts in roadmap year - use 4-position system
                        const isStartOfMonth = getDateUtility().isStartOfMonth(isoStartDate);
                        const isEndOfPreviousMonth = getDateUtility().isEndOfPreviousMonth(isoStartDate);
                        
                        if (isStartOfMonth) {
                            // Start of month (1st-3rd): Position at month start
                            const monthName = this.getMonthName(startDate.getMonth() + 1);
                            startGrid = this.monthToGrid(monthName);
                        } else if (isEndOfPreviousMonth) {
                            // End of previous month (1st-3rd): Position at previous month start
                            const previousMonthName = getDateUtility().getPreviousMonthName(isoStartDate);
                            startGrid = this.monthToGrid(previousMonthName);
                        } else {
                            // Regular dates (4th-31st)
                            const startDateObj = new Date(isoStartDate);
                            const dayOfMonth = startDateObj.getDate();

                            if (dayOfMonth >= 28) {
                                // 27th–31st: position as 1st of next month
                                const currentMonth = startDateObj.getMonth() + 1; // getMonth() is 0-based
                                const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
                                const nextMonthName = this.getMonthName(nextMonth);
                                startGrid = this.monthToGrid(nextMonthName);
                            } else {
                                // Base: 4-position system
                                startGrid = getDateUtility().dateToGrid(isoStartDate, this.monthToGrid.bind(this));
                                
                                // Adjust: 4th–27th shift back by 2 grid units
                                if (dayOfMonth >= 4 && dayOfMonth <= 27) {
                                    startGrid = startGrid - 2;
                                }
                            }
                        }
                    }
                } else {
                    startGrid = this.getGridPosition(startValue);
                }
            } catch (e) {
                // If date parsing fails, use fallback
                startGrid = this.getGridPosition(startValue);
            }
        } else {
            // Month name path - use monthToGrid directly for consistency
            startGrid = this.monthToGrid(startValue);
        }
        
        let endGrid;
        if (effectiveEndValue) {
            // Check if this is a date that represents end of month (26th-31st) or end of previous month (1st-3rd)
            const isEndOfMonth = effectiveEndIsDate && getDateUtility().isEndOfMonth(effectiveEndValue);
            const isEndOfPreviousMonth = effectiveEndIsDate && getDateUtility().isEndOfPreviousMonth(effectiveEndValue);
            
            if (!effectiveEndIsDate) {
                // Month name: position at month start + 10 to span full month
                endGrid = this.getGridPosition(effectiveEndValue) + 10;
            } else if (isEndOfMonth) {
                // End of month (26th-31st): treat like month name - position at month start + 10
                const parsedEndDate = this.parseDateSafe(effectiveEndValue);
                const monthName = this.getMonthName(parsedEndDate.getMonth() + 1);
                endGrid = this.getGridPosition(monthName) + 10;
            } else if (isEndOfPreviousMonth) {
                // End of previous month (1st-3rd): treat as end of previous month
                const previousMonthName = getDateUtility().getPreviousMonthName(effectiveEndValue);
                endGrid = this.getGridPosition(previousMonthName) + 10;
            } else {
                // Regular specific date: handle with alignment adjustments
                try {
                    // Convert European date to ISO if needed
                    let isoEndDate = effectiveEndValue;
                    if (effectiveEndValue.match(/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/)) {
                        isoEndDate = this.convertEuropeanToISO(effectiveEndValue);
                    }
                    
                    const endDate = new Date(isoEndDate);
                    if (!isNaN(endDate.getTime())) {
                        const dayOfMonth = endDate.getDate();
                        
                        if (getDateUtility().isStartOfMonth(isoEndDate)) {
                            // Start of month (1st-3rd): Use new 4-position system
                            endGrid = this.getGridPosition(isoEndDate);
                        } else if (dayOfMonth >= 4 && dayOfMonth <= 25) {
                            // Mid-month dates (4th-25th): Use new 4-position system
                            endGrid = this.getGridPosition(isoEndDate);
                        } else {
                            // 26th-31st should be handled by isEndOfMonth above, but fallback to exact positioning
                            endGrid = this.getGridPosition(isoEndDate);
                        }
                    } else {
                        endGrid = this.getGridPosition(effectiveEndValue);
                    }
                } catch (e) {
                    // If date parsing fails, use original
                    endGrid = this.getGridPosition(effectiveEndValue);
                }
            }
        } else {
            endGrid = startGrid + 10; // Default to one month width
        }
        
        // Check if story continues past roadmap year or search range - if so, extend to December
        const continuesNextYear = this.storyContinuesNextYear(story);
        const startsBeforeRange = this.storyStartsBeforeRange(story);
        const isContinuingStory = continuesNextYear || startsBeforeRange;
        
        if (continuesNextYear) {
            endGrid = this.getGridPosition('DEC') + 10; // Extend to end of December
        }
        
        // For stories that start before search range, ensure they start from January
        if (startsBeforeRange) {
            startGrid = this.getGridPosition('JAN'); // Start from January
        }
        
        const bulletsHTML = getUIUtility().generateBulletsHTML(story.bullets, (text) => this.formatText(text));
        
        // Generate stacked clock icons for multiple timeline changes (not for done/cancel/at-risk only)
        let iconHTML = '';
        if (story.hasRoadmapChanges && story.roadmapChanges.changes && story.roadmapChanges.changes.length > 0) {
            const numChanges = story.roadmapChanges.changes.length;
            
            // Determine overall trend: count early vs late changes
            let earlyCount = 0;
            let lateCount = 0;
            story.roadmapChanges.changes.forEach(change => {
                if (this.isEarlyDelivery(change.prevEndDate, change.newEndDate)) {
                    earlyCount++;
                } else {
                    lateCount++;
                }
            });
            
            // No background styling - clean clock icon with larger font size
            const clockIconStyle = `color: #666; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; font-size: ${getConfigUtility().CSS.UI.CLOCK_ICON_SIZE}px; top: ${getConfigUtility().CSS.UI.ICON_OFFSET_TOP}px; right: ${getConfigUtility().CSS.UI.ICON_OFFSET_RIGHT}px;`;
            
            if (numChanges === 1 || !this.enableStackedIcons) {
                // Single change or stacking disabled - just one centered icon
                iconHTML = `<div class="roadmap-icon" style="${clockIconStyle}">🕐</div>`;
            } else {
                // Multiple changes - show stacking (only when enabled)
                for (let i = 0; i < numChanges; i++) {
                    if (i === 0) {
                        // Top/front icon stays in original centered position
                        iconHTML += `<div class="roadmap-icon" style="z-index: ${9999 + numChanges - i}; ${clockIconStyle}">🕐</div>`;
                    } else {
                        // Background icons offset up and to the right to show stacking
                        const offsetTop = -10 - (i * 2);  // Move up: -12, -14, -16, etc. (adjusted for new base position)
                        const offsetRight = -10 - (i * 2); // Move right: -12, -14, -16, etc.
                        const zIndex = 9999 + numChanges - i; // Front icon highest z-index
                        iconHTML += `<div class="roadmap-icon" style="top: ${offsetTop}px; right: ${offsetRight}px; z-index: ${zIndex}; ${clockIconStyle}">🕐</div>`;
                    }
                }
            }
        }
        
        // Add shooting star icon for BTL stories (Below the Line) to indicate future aspirations
        if (epicName === 'Below the Line') {
            const shootingStarIconStyle = `color: #666; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; font-size: 20px; top: ${getConfigUtility().CSS.UI.ICON_OFFSET_TOP}px; right: ${getConfigUtility().CSS.UI.ICON_OFFSET_RIGHT + 1}px;`;
            iconHTML = `<div class="roadmap-icon" style="${shootingStarIconStyle}">🌠</div>`;
        }
        // Icon precedence system - only highest priority icon shows in each position
        
        // Top-left position: Proposed > New Story
        const showProposedIcon = story.isProposed;
        const showNewStoryIcon = story.isNewStory && !story.isProposed;
        
        // Bottom-right position: Cancelled > Done > At Risk > Transferred Out  
        const showCancelledIcon = story.isCancelled;
        const showDoneIcon = story.isDone && !story.isCancelled;
        const showAtRiskIcon = story.isAtRisk && !story.isCancelled && !story.isDone;
        const showTransferredOutIcon = story.isTransferredOut && !story.isCancelled && !story.isDone && !story.isAtRisk;
        
        // Bottom-left position: Info > Transferred In
        const showInfoIcon = story.isInfo;
        const showTransferredInIcon = story.isTransferredIn && !story.isInfo;

        const doneIconHTML = showDoneIcon ? '<div class="done-icon">✅</div>' : '';
        const cancelIconHTML = showCancelledIcon ? '<div class="cancel-icon">X</div>' : '';
        const atRiskIconHTML = showAtRiskIcon ? '<div class="atrisk-icon"></div>' : '';
        const newStoryIconHTML = showNewStoryIcon ? '<div class="newstory-icon">🌟</div>' : '';
        const transferredOutIconHTML = showTransferredOutIcon ? '<div class="transferredout-icon">➡️</div>' : '';
        const infoIconHTML = showInfoIcon ? '<div class="transferredin-icon info-position">ℹ️</div>' : '';
        const transferredInIconHTML = showTransferredInIcon ? '<div class="transferredin-icon">➡️</div>' : '';
        const proposedIconHTML = showProposedIcon ? '<div class="proposed-icon">💡</div>' : '';
        
        // Generate country flags HTML
        let countryFlagsHTML = '';
        if (story.countryFlags && story.countryFlags.length > 0) {
            const flagMap = {
                'Global': '🌍',
                'UK': '🇬🇧',
                'Iceland': '🇮🇸',
                'Hungary': '🇭🇺',
                'Spain': '🇪🇸',
                'Italy': '🇮🇹',
                'Portugal': '🇵🇹',
                'Czechia': '🇨🇿',
                'Slovakia': '🇸🇰',
                'Slovenia': '🇸🇮',
                'Croatia': '🇭🇷',
                'Germany': '🇩🇪'
            };
            const flagEmojis = story.countryFlags.map(f => flagMap[f] || '').filter(f => f).join('');
            const hasTimelineIcon = iconHTML !== '';
            const topOffset = hasTimelineIcon ? '3px' : '3px';
            const rightOffset = hasTimelineIcon ? '11px' : '4px';
            countryFlagsHTML = `<div class="country-flags-display" style="position: absolute; top: ${topOffset}; right: ${rightOffset}; font-size: 10px; z-index: 9998; line-height: 1;">${flagEmojis}</div>`;
        }
        
        const cancelledClass = story.isCancelled ? ' story-cancelled' : '';
        const transferredClass = '';
        const proposedClass = story.isProposed ? ' story-proposed' : '';
        const continuesClass = isContinuingStory ? ' story-continues story-with-continuation' : '';
        const storyWidth = endGrid - startGrid;
        
        // Graduated zooming logic: all stories can zoom, just at different levels based on width
        // Pass startGrid and endGrid to apply special rules (e.g., January/December stories > 3 months cap at 1.10x)
        const zoomLevel = getConfigUtility().getZoomLevel(storyWidth, startGrid, endGrid);
        const zoomClass = ` story-zoom-${zoomLevel}`;
        
        // Add edit icon only in embedded mode (builder view)
        const editIconHTML = getUIUtility().generateEditIconHTML(embedded, epicName, story.title, storyIndex, (text) => this.formatText(text));
        
        // Add continuation year indicator for stories that continue past roadmap year or start before search range
        let continuationYearHTML = '';
        if (continuesNextYear && story.endDate) {
            // Story continues after the search range - show actual end date using date-only logic
            const storyEndDateStr = this.convertStoryDateToISO(story.endDate, this.roadmapYear);
            if (storyEndDateStr) {
                const [yearStr, monthStr, dayStr] = storyEndDateStr.split('-');
                const actualEndYear = parseInt(yearStr);
                const monthIndex = parseInt(monthStr) - 1; // Convert to 0-based index
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const actualEndMonth = monthNames[monthIndex];
                continuationYearHTML = `<div class="continuation-indicator">
                    <div class="continuation-month">${actualEndMonth}</div>
                    <div class="continuation-year">${String(actualEndYear).slice(-2)}</div>
                </div>`;
            } else {
                // Fallback to roadmap year + 1 if date parsing fails
                const nextYear = this.roadmapYear + 1;
                continuationYearHTML = `<div class="continuation-indicator">
                    <div class="continuation-month">Dec</div>
                    <div class="continuation-year">${String(nextYear).slice(-2)}</div>
                </div>`;
            }
        }
        
        // Determine visual month alignment from computed startGrid so dates shifted
        // to next month (e.g., 28th–31st) get identical alignment as true month starts
        let startsInJanuary = false;
        let startsInOctober = false;
        // Only apply alignment tweaks when exactly at the start of a month grid
        for (const monthName of this.months) {
            if (startGrid === this.monthToGrid(monthName)) {
                if (monthName === 'JAN') startsInJanuary = true;
                if (monthName === 'OCT') startsInOctober = true;
                break;
            }
        }
        
        let positionClass = '';
        if (startsInJanuary) {
            positionClass = ' story-positioned-january';
        } else if (startsInOctober) {
            positionClass = ' story-positioned-october';
        }
        
        return `
            <div class="story-item${cancelledClass}${transferredClass}${proposedClass}${continuesClass}${zoomClass}${positionClass}" 
             style="--start: ${startGrid}; --end: ${endGrid};" 
             data-epic-name="${this.formatText(epicName)}" 
             data-story-title="${this.formatText(story.title)}" 
             data-story-index="${storyIndex}"
             data-story-id="${storyId}">
            ${iconHTML}
            ${countryFlagsHTML}
                            ${doneIconHTML}
                ${cancelIconHTML}
                ${atRiskIconHTML}
                ${newStoryIconHTML}
                ${transferredOutIconHTML}
                ${infoIconHTML}
                ${transferredInIconHTML}
                ${proposedIconHTML}
            ${editIconHTML}
            ${continuationYearHTML}
            ${story.imo ? `<div class="imo-tag" style="text-shadow: -2px -2px 0 ${backgroundColor}, 2px -2px 0 ${backgroundColor}, -2px 2px 0 ${backgroundColor}, 2px 2px 0 ${backgroundColor}, 0 -2px 0 ${backgroundColor}, 0 2px 0 ${backgroundColor}, -2px 0 0 ${backgroundColor}, 2px 0 0 ${backgroundColor}, -1px -1px 0 ${backgroundColor}, 1px -1px 0 ${backgroundColor}, -1px 1px 0 ${backgroundColor}, 1px 1px 0 ${backgroundColor}, 0 -1px 0 ${backgroundColor}, 0 1px 0 ${backgroundColor}, -1px 0 0 ${backgroundColor}, 1px 0 0 ${backgroundColor};">(${story.imo})</div>` : ''}
                                <div class="task-title">${this.getStoryTitleWithStartInfo(story)}</div>
            ${bulletsHTML}
        </div>`;
    }

    // Helper function to truncate EPIC names based on available height
    truncateEpicName(name, numStories = 1) {
        return getUIUtility().processEpicName(name, numStories);
    }

    // Helper function to parse date strings and compare them
    isEarlyDelivery(prevEndDate, newEndDate) {
        return getDateUtility().isEarlyDelivery(prevEndDate, newEndDate);
    }

    // Generate roadmap changes HTML
    generateRoadmapChanges(changes, startGrid, endGrid, doneInfo = null, cancelInfo = null, atRiskInfo = null, newStoryInfo = null, infoInfo = null, transferredOutInfo = null, transferredInInfo = null, proposedInfo = null, positionBelow = false, storyStartGrid = null, backgroundColor = null, storyId = null) {
        // Detect if text box is positioned to the left of the story
        const isLeftOfStory = storyStartGrid !== null && endGrid <= storyStartGrid;
        const leftSideStyle = isLeftOfStory ? 'top: 4px; ' : '';
        // Add negative left positioning to move text content further left inside text boxes
        const allTextBoxStyle = 'position: relative; left: -3px; ';
        // Check if timeline changes exist to determine if status boxes need baseline adjustment
        const hasTimelineChanges = changes && changes.length > 0;
        const statusBoxStyle = ''; // Remove margin that was creating extra space at top
        
        if ((!changes || changes.length === 0) && !doneInfo && !cancelInfo && !atRiskInfo && !newStoryInfo && !infoInfo && !transferredOutInfo && !transferredInInfo && !proposedInfo) return '';
        
        // Collect all items (timeline changes + status items) for unified chronological sorting
        const allItems = [];
        
        // Add timeline changes to the items array
        if (changes && changes.length > 0) {
            changes.forEach(change => {
                
                // Determine if this is an early delivery (acceleration) or delay
                const isEarly = this.isEarlyDelivery(change.prevEndDate, change.newEndDate);
                
                // Format dates in European format (DD/MM) for display
                const prevDateEU = this.formatDateEuropean(change.prevEndDate);
                const newDateEU = this.formatDateEuropean(change.newEndDate);
                const dateDisplay = isEarly ? 
                    `${newDateEU} <- ${prevDateEU}` : // Reversed arrow for early
                    `${prevDateEU} -> ${newDateEU}`;   // Normal arrow for delay
                
                const formattedDescription = this.formatText(change.description);
                
                allItems.push({
                    date: change.date,
                    html: `
                        <div class="roadmap-column" style="${allTextBoxStyle}${leftSideStyle}">
                            <div style="font-weight: bold; font-size: 12px; margin-bottom: 3px; display: flex; align-items: center; height: 16px;"><span style="margin-right: 3px; font-size: 16px; display: inline-block; vertical-align: top;">🕐</span><span style="font-size: 12px; font-weight: bold; color: ${isEarly ? '#28a745' : 'red'}; margin-left: 1px;">${this.formatDateEuropean(change.date)}</span></div>
                            <div class="roadmap-description"><span style="font-size: 10px; font-weight: normal; color: ${isEarly ? '#28a745' : 'red'}; margin-bottom: 1px; display: block;">${dateDisplay}</span>${formattedDescription}</div>
                        </div>`
                });
            });
        }

        // Helper function to generate status columns (done, cancel, at-risk, new story)
        const generateStatusColumn = (icon, iconColor, date, notes, dateColor = null, notesClass = 'roadmap-description') => {
            const displayDateColor = dateColor || iconColor;
            // Make transferred in icon 13px, transferred out icon 12px, star icon smaller (12px), lightbulb smaller (12px), info icon (14px), others normal (16px)
            const iconSize = icon === '💡' ? '12px' : (icon === '➡️' && date.startsWith('In:') ? '13px' : (icon === '➡️' ? '12px' : (icon === '🌟' ? '12px' : (icon === 'ℹ️' ? '14px' : '16px'))));
            // Use consistent 3px spacing for all status icons
            const marginBottom = '3px';
            // Move info icon down by 1px
            const iconVerticalOffset = icon === 'ℹ️' ? 'transform: translateY(1px);' : '';
            // Add blue background for lightbulb icon (minimal size for text boxes)
            const iconBackground = icon === '💡' ? 'background-color: #005a8b; border-radius: 1px; padding: 2px 0px 0px 1px; color: #fff; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: flex-start;' : '';
            const iconTextColor = icon === '💡' ? '#fff' : iconColor;
            return `<div class="roadmap-column" style="${allTextBoxStyle}${statusBoxStyle}${leftSideStyle}">
                        <div style="font-weight: bold; font-size: 12px; margin-bottom: ${marginBottom}; display: flex; align-items: center; height: 16px;"><span style="margin-right: 3px; font-size: ${iconSize}; display: inline-block; vertical-align: top; color: ${iconTextColor}; ${iconBackground}${iconVerticalOffset}">${icon}</span><span style="font-size: 12px; font-weight: bold; color: ${displayDateColor}; margin-left: 1px;">${this.formatDateEuropean(date)}</span></div>
                        <div class="${notesClass}">${this.formatText(notes)}</div>
                    </div>`;
        };

        // Add status items to the same allItems array for unified sorting
        if (doneInfo && (doneInfo.date || doneInfo.notes)) {
            allItems.push({
                date: doneInfo.date,
                html: `<div class="roadmap-column" style="${allTextBoxStyle}${statusBoxStyle}${leftSideStyle}">
                        <div style="font-weight: bold; font-size: 12px; margin-bottom: 3px; display: flex; align-items: center; height: 16px;"><span style="margin-right: 3px; font-size: 16px; display: inline-block; vertical-align: top; color: #28a745;">✓</span><span style="font-size: 12px; font-weight: bold; color: #28a745; margin-left: 1px;">${this.formatDateEuropean(doneInfo.date)}</span></div>
                        <div class="roadmap-description">${this.formatText(doneInfo.notes)}</div>
                    </div>`
            });
        }
        
        if (cancelInfo && (cancelInfo.date || cancelInfo.notes)) {
            allItems.push({
                date: cancelInfo.date,
                html: generateStatusColumn('✖', '#dc3545', cancelInfo.date, cancelInfo.notes)
            });
        }
        
        if (atRiskInfo && (atRiskInfo.date || atRiskInfo.notes)) {
            allItems.push({
                date: atRiskInfo.date,
                html: `<div class="roadmap-column" style="${allTextBoxStyle}${statusBoxStyle}${leftSideStyle}">
                        <div style="font-weight: bold; font-size: 12px; margin-bottom: 3px; display: flex; align-items: center; height: 16px;"><span style="margin-right: 3px; font-size: 16px; display: inline-block; vertical-align: top; color: black;">❗</span><span style="font-size: 12px; font-weight: bold; color: black; margin-left: 1px;">${this.formatDateEuropean(atRiskInfo.date)}</span></div>
                        <div class="atrisk-notes" style="transform: translateY(0.25px);">${this.formatText(atRiskInfo.notes)}</div>
                    </div>`
            });
        }
        
        if (newStoryInfo && (newStoryInfo.date || newStoryInfo.notes)) {
            allItems.push({
                date: newStoryInfo.date,
                html: generateStatusColumn('🌟', 'black', newStoryInfo.date, newStoryInfo.notes)
            });
        }
        
        // Handle multiple info entries
        if (infoInfo) {
            if (Array.isArray(infoInfo)) {
                // Multiple info entries
                infoInfo.forEach(entry => {
                    if (entry && (entry.date || entry.notes)) {
                        allItems.push({
                            date: entry.date,
                            html: generateStatusColumn('ℹ️', '#007cba', entry.date, entry.notes)
                        });
                    }
                });
            } else if (infoInfo.date || infoInfo.notes) {
                // Single info entry (backward compatibility)
                allItems.push({
                    date: infoInfo.date,
                    html: generateStatusColumn('ℹ️', '#007cba', infoInfo.date, infoInfo.notes)
                });
            }
        }
        
        // Add transferred in first (to ensure it appears before transferred out)
        if (transferredInInfo && (transferredInInfo.date || transferredInInfo.notes)) {
            allItems.push({
                date: transferredInInfo.date,
                html: generateStatusColumn('➡️', '#007cba', `In: ${transferredInInfo.date}`, transferredInInfo.notes, 'black')
            });
        }
        
        if (transferredOutInfo && (transferredOutInfo.date || transferredOutInfo.notes)) {
            allItems.push({
                date: transferredOutInfo.date,
                html: generateStatusColumn('➡️', '#007cba', `Out: ${transferredOutInfo.date}`, transferredOutInfo.notes, 'black')
            });
        }
        
        if (proposedInfo && (proposedInfo.date || proposedInfo.notes)) {
            allItems.push({
                date: proposedInfo.date,
                html: generateStatusColumn('💡', '#007cba', proposedInfo.date, proposedInfo.notes)
            });
        }
        

        
        // Sort all items (timeline changes + status items) by date chronologically (earliest first)
        allItems.sort((a, b) => {
            return getDateUtility().compareDates(a.date, b.date);
        });
        
        // Generate chronologically sorted HTML for all items
        const allItemsHTML = allItems.map(item => item.html).join('');



        const forceBelow = (typeof getConfigUtility === 'function' && getConfigUtility().shouldForceTextBelow && getConfigUtility().shouldForceTextBelow());
        const effectiveBelow = forceBelow ? true : positionBelow;
        const gridRow = effectiveBelow ? 2 : 1;
        const marginStyle = effectiveBelow ? '' : 'margin-top: 1px; '; // Shift text boxes down by 1px when not below
        const textBoxWidth = endGrid - startGrid;
        const zoomLevel = getConfigUtility().getZoomLevel(textBoxWidth, startGrid, endGrid);
        const zoomClass = ` story-zoom-${zoomLevel}`;
        const belowClass = effectiveBelow ? ' roadmap-text-below' : '';
        const backgroundStyle = backgroundColor ? `background-color: ${backgroundColor}; ` : '';
        
        return `
        <div class="roadmap-text roadmap-text-simple${zoomClass}${belowClass}" 
             style="--start: ${startGrid}; --end: ${endGrid}; grid-row: ${gridRow}; ${marginStyle}${backgroundStyle}"
             data-story-id="${storyId || ''}">
            <div class="roadmap-columns">
                ${allItemsHTML}
            </div>
        </div>`;
    }

    // Generate BTL date added text box
    generateBTLDateAddedBox(story, storyIndex, totalEpics, ktloPosition) {
        
        // Calculate story positioning to determine text box placement
        const startValue = story.startDate || story.startMonth;
        
        // Use effective end date that considers timeline changes for BTL positioning too
        const effectiveEndValue = this.getEffectiveEndDate(story);
        const effectiveEndIsDate = this.isEffectiveEndDateADate(story);
        
        let startGrid;
        // Handle multi-year stories - if story starts before roadmap year, position at January
        if (story.startDate) {
            try {
                let isoStartDate = story.startDate;
                if (story.startDate.match(/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/)) {
                    isoStartDate = this.convertEuropeanToISO(story.startDate);
                }
                const startDate = new Date(isoStartDate);
                if (!isNaN(startDate.getTime()) && startDate.getFullYear() < this.roadmapYear) {
                    // Story starts before roadmap year - position at January
                    startGrid = this.getGridPosition('JAN');
                    // Add flag for BTL stories that start in previous year
                    story._startsInPreviousYear = true;
                    story._actualStartYear = startDate.getFullYear();
                } else {
                    startGrid = this.getGridPosition(startValue);
                }
            } catch (e) {
                startGrid = this.getGridPosition(startValue);
            }
        } else {
            startGrid = this.getGridPosition(startValue);
        }
        let endGrid;
        
        if (effectiveEndValue) {
            // Check if this is an end-of-month date (26th-31st) or end of previous month (1st-3rd)
            const isEndOfMonth = effectiveEndIsDate && getDateUtility().isEndOfMonth(effectiveEndValue);
            const isEndOfPreviousMonth = effectiveEndIsDate && getDateUtility().isEndOfPreviousMonth(effectiveEndValue);
            
            if (!effectiveEndIsDate) {
                // Month name: position at month start + 10 to span full month
                endGrid = this.getGridPosition(effectiveEndValue) + 10;
            } else if (isEndOfMonth) {
                // End of month: treat like month name - position at month start + 10
                const parsedEndDate = this.parseDateSafe(effectiveEndValue);
                const monthName = this.getMonthName(parsedEndDate.getMonth() + 1);
                endGrid = this.getGridPosition(monthName) + 10;
            } else if (isEndOfPreviousMonth) {
                // End of previous month (1st-3rd): treat as end of previous month
                const previousMonthName = getDateUtility().getPreviousMonthName(effectiveEndValue);
                endGrid = this.getGridPosition(previousMonthName) + 10;
            } else {
                endGrid = this.getGridPosition(effectiveEndValue);
            }
        } else {
            endGrid = startGrid + 10; // Default to one month width
        }
        
        // Calculate text box positioning - place after story end
        const textBoxWidth = getConfigUtility().calculateTextBoxWidth(1); // BTL text boxes always have 1 item (date added)
        let textStartGrid = endGrid + 2; // Small buffer after story
        let textEndGrid = textStartGrid + textBoxWidth;
        let positionBelow = false;
        
        // If text box would extend past December, position it below the story instead of to the left
        if (getConfigUtility().exceedsMaxGrid(textEndGrid)) {
            positionBelow = true;
            textStartGrid = startGrid + 1; // Slight indent from story start
            textEndGrid = textStartGrid + textBoxWidth;
            
            // If still too wide when below, adjust to fit
            if (getConfigUtility().exceedsMaxGrid(textEndGrid)) {
                const overflow = textEndGrid - getConfigUtility().getMaxGrid();
                textStartGrid = Math.max(1, textStartGrid - overflow);
                textEndGrid = textStartGrid + textBoxWidth;
            }
        }
        
        // Calculate background color for text box (same as BTL background)
        let btlVisualPosition;
        if (ktloPosition === 'top') {
            btlVisualPosition = totalEpics + 1;
        } else {
            btlVisualPosition = totalEpics + 1;
        }
        const backgroundColor = getUIUtility().getAlternatingBackgroundColor(btlVisualPosition);
        
        // Format the date for display (European format)
        const formattedDate = this.formatDateEuropean(story.dateAdded);
        
        // Generate description line only if it exists
        const descriptionHTML = story.dateAddedDescription ? 
            `<div class="roadmap-description">${this.formatText(story.dateAddedDescription)}</div>` : 
            '';
        
        // Generate text box HTML similar to timeline changes
        const gridRow = positionBelow ? 2 : 1;
        const belowClass = positionBelow ? ' roadmap-text-below' : '';
        const textBoxHTML = `
        <div class="roadmap-text roadmap-text-simple story-non-zoomable${belowClass}" 
             style="--start: ${textStartGrid}; --end: ${textEndGrid}; grid-row: ${gridRow}; background-color: ${backgroundColor};">
            <div class="roadmap-columns">
                <div class="roadmap-column" style="position: relative; top: 4px;">
                    <div style="font-weight: bold; font-size: 12px; margin-bottom: 3px; display: flex; align-items: center; height: 16px;">
                        <span style="margin-right: 3px; font-size: 16px; display: inline-block; vertical-align: top;">🌠</span>
                        <span style="font-size: 12px; font-weight: bold; color: #666; margin-left: 1px;">${formattedDate}</span>
                    </div>
                    ${descriptionHTML}
                </div>
            </div>
        </div>`;
        
        return textBoxHTML;
    }

    // Generate BTL (Below the Line) special swimlane
    generateBTLSwimlane(btlData, totalEpics = 0, embedded = false, ktloPosition = 'top') {
        // Skip BTL generation entirely if no stories
        if (!btlData || !btlData.stories || btlData.stories.length === 0) {
            return '';
        }
        
        // BTL stories (if any) - simple stories with dateAdded text boxes
        let storiesHTML = '';
        if (btlData && btlData.stories && btlData.stories.length > 0) {
            btlData.stories.forEach((story, storyIndex) => {
                const storyHTML = this.generateStory(story, 'Below the Line', storyIndex, embedded);
                
                // Generate text box for BTL stories with dateAdded field
                let dateAddedHTML = '';
                if (story.dateAdded) {
                    dateAddedHTML = this.generateBTLDateAddedBox(story, storyIndex, totalEpics, ktloPosition);
                }
                
                storiesHTML += `<div class="story-track">${storyHTML}${dateAddedHTML}</div>`;
            });
        }
        
        // Calculate BTL background color based on its actual position in the visual order
        // BTL is always at the very bottom, so its position depends on total sections above it
        let btlVisualPosition;
        if (ktloPosition === 'top') {
            // Order: KTLO (0), EPIC1 (1), EPIC2 (2), ..., BTL (totalEpics + 1)
            btlVisualPosition = totalEpics + 1;
        } else if (ktloPosition === 'hidden') {
            // Order: EPIC1 (0), EPIC2 (1), ..., BTL (totalEpics) - KTLO is not rendered
            btlVisualPosition = totalEpics;
        } else {
            // Order: EPIC1 (0), EPIC2 (1), ..., KTLO (totalEpics), BTL (totalEpics + 1)
            btlVisualPosition = totalEpics + 1;
        }
        
        const btlBackgroundColor = getUIUtility().getAlternatingBackgroundColor(btlVisualPosition);
        
        return `
        <div class="swimlane btl-swimlane">
            <div class="epic-label">Below the Line</div>
                            <div class="swimlane-content" style="background-color: ${btlBackgroundColor}; min-height: 172px;">
                ${this.generateTimelineGrid()}
                ${storiesHTML}
            </div>
        </div>`;
    }

    // Generate KTLO special swimlane
    generateKTLOSwimlane(ktloData, totalEpics = 0, embedded = false, ktloPosition = 'top') {
        const bulletsHTML = getUIUtility().generateBulletsHTML(ktloData.story.bullets, (text) => this.formatText(text));
        
        // KTLO spans the entire year (120 grid units), so it gets the 'tiny' zoom level
        const ktloWidth = 120; // Full year
        const zoomLevel = getConfigUtility().getZoomLevel(ktloWidth);
        const zoomClass = ` story-zoom-${zoomLevel}`;
        
        // Add edit and move icons only in embedded mode (builder view) - KTLO doesn't need move icons since it's always alone
        const editIconHTML = getUIUtility().generateEditIconHTML(embedded, 'KTLO', ktloData.story.title, 0, (text) => this.formatText(text));
        
        const ktloStoryHTML = `
        <div class="story-track">
            <div class="ktlo-story${zoomClass}" 
                 data-epic-name="KTLO" 
                 data-story-title="${this.formatText(ktloData.story.title)}" 
                 data-story-index="0"
                 data-story-id="">
                ${editIconHTML}
                                    <div class="task-title">${this.formatText(ktloData.story.title)}</div>
                ${bulletsHTML}
            </div>
        </div>`;
        
        // Calculate background color based on visual position in roadmap
        // When KTLO is at top: KTLO=0, EPIC1=1, EPIC2=2, etc.
        // When KTLO is at bottom: EPIC1=0, EPIC2=1, KTLO=N, BTL=N+1
        const visualPosition = ktloPosition === 'top' ? 0 : totalEpics;
        const ktloBackgroundColor = getUIUtility().getAlternatingBackgroundColor(visualPosition); // Even = lime, odd = brown
        
        const monthlyBoxesHTML = ktloData.monthlyData.map((monthData, index) => {
            // Get transform configuration from ConfigUtility
            const transform = getConfigUtility().getMonthlyBoxTransform(index);
            const startColumn = (index * getConfigUtility().GRID.COLUMNS_PER_MONTH) + transform.startColumn;
            const endColumn = startColumn + 9; // Use 9 columns (20% bigger than 8)
            const extraStyle = getConfigUtility().generateTransform(transform.x);
            const extraClass = transform.extraClass;
            
            // Get month name for header
            const monthName = this.months[index]; // JAN, FEB, MAR, etc.
            
            // Add edit icon and single-click handler for entire box in embedded mode
            const editIconHTML = embedded ? `<div class="monthly-edit-icon" title="Edit ${monthName} KTLO">✏️</div>` : '';
            const clickHandler = embedded ? ` onclick="parent.openEditMonthlyKTLOModal('${monthName.toLowerCase()}')"` : '';
            
            return `
            <div class="monthly-box${extraClass}" style="grid-column: ${startColumn} / ${endColumn}; ${extraStyle}">
                <div class="monthly-box-content"${clickHandler} style="cursor: ${embedded ? 'pointer' : 'default'};">
                    ${editIconHTML}
                    <div class="monthly-box-header">${monthName}</div>
                    <div class="monthly-box-numbers">${monthData.number} / ${monthData.percentage}%</div>
                    <div class="monthly-box-description">${this.formatMonthlyDescription(monthData.description)}</div>
                </div>
            </div>
        `}).join('');

        return `
        <div class="swimlane special-swimlane">
            <div class="epic-label">KTLO</div>
                            <div class="swimlane-content" style="background-color: ${ktloBackgroundColor}; padding-bottom: 10px;">
                ${this.generateTimelineGrid()}
                ${ktloStoryHTML}
                <div class="monthly-boxes-container">
                    ${monthlyBoxesHTML}
                </div>
            </div>
        </div>`;
    }

    // Generate a single EPIC swimlane
    generateEpic(epic, epicIndex, embedded = false, ktloPosition = 'top') {
        // Calculate background color based on visual position in roadmap
        // When KTLO is at top: KTLO=0, EPIC1=1, EPIC2=2, etc. 
        // When KTLO is at bottom: EPIC1=0, EPIC2=1, KTLO=N, BTL=N+1
        const visualPosition = ktloPosition === 'top' ? epicIndex + 1 : epicIndex;
        const backgroundColor = getUIUtility().getAlternatingBackgroundColor(visualPosition); // Even = lime, odd = brown
        
        let tracksHTML = '';
        
        // Optionally sort stories by start date first, then by end date as secondary sort
        const storiesToProcess = getConfigUtility().shouldSortStories() ? 
            [...epic.stories].sort((a, b) => {
                // Get start values (date or month)
                const aStart = a.startDate || a.startMonth || 'JAN';
                const bStart = b.startDate || b.startMonth || 'JAN';
                
                // Get end values (use effective end date that considers timeline changes)
                const aEnd = this.getEffectiveEndDate(a) || a.endDate || a.endMonth || 'MAR';
                const bEnd = this.getEffectiveEndDate(b) || b.endDate || b.endMonth || 'MAR';
                
                // Primary sort: by start date (handles both dates and months)
                const startComparison = getDateUtility().compareDateOrMonth(aStart, bStart, this.roadmapYear);
                if (startComparison !== 0) {
                    return startComparison;
                }
                
                // Secondary sort: by end date (if start dates are the same)
                return getDateUtility().compareDateOrMonth(aEnd, bEnd, this.roadmapYear);
            }) : epic.stories;
        
        storiesToProcess.forEach((story, storyIndex) => {
            // Generate unique identifier for story-textbox pairing (sanitize for CSS selectors)
            const storyId = getUIUtility().generateStoryId(epic.name, storyIndex);
            
            const storyHTML = this.generateStory(story, epic.name, storyIndex, embedded, backgroundColor);
            let timelineHTML = '';
            
                        const hasChanges = story.roadmapChanges && story.roadmapChanges.changes && story.roadmapChanges.changes.length > 0;
            const hasDoneInfo = story.roadmapChanges && story.roadmapChanges.doneInfo && (story.roadmapChanges.doneInfo.date || story.roadmapChanges.doneInfo.notes);
            const hasCancelInfo = story.roadmapChanges && story.roadmapChanges.cancelInfo && (story.roadmapChanges.cancelInfo.date || story.roadmapChanges.cancelInfo.notes);
            const hasAtRiskInfo = story.roadmapChanges && story.roadmapChanges.atRiskInfo && (story.roadmapChanges.atRiskInfo.date || story.roadmapChanges.atRiskInfo.notes);
            const hasNewStoryInfo = story.roadmapChanges && story.roadmapChanges.newStoryInfo && (story.roadmapChanges.newStoryInfo.date || story.roadmapChanges.newStoryInfo.notes);
            const hasInfoInfo = story.roadmapChanges && story.roadmapChanges.infoInfo && (
                (Array.isArray(story.roadmapChanges.infoInfo) && story.roadmapChanges.infoInfo.length > 0) ||
                (!Array.isArray(story.roadmapChanges.infoInfo) && (story.roadmapChanges.infoInfo.date || story.roadmapChanges.infoInfo.notes))
            );
            const hasTransferredOutInfo = story.roadmapChanges && story.roadmapChanges.transferredOutInfo && (story.roadmapChanges.transferredOutInfo.date || story.roadmapChanges.transferredOutInfo.notes);
            const hasTransferredInInfo = story.roadmapChanges && story.roadmapChanges.transferredInInfo && (story.roadmapChanges.transferredInInfo.date || story.roadmapChanges.transferredInInfo.notes);
            const hasProposedInfo = story.roadmapChanges && story.roadmapChanges.proposedInfo && (story.roadmapChanges.proposedInfo.date || story.roadmapChanges.proposedInfo.notes);
            if (hasChanges || hasDoneInfo || hasCancelInfo || hasAtRiskInfo || hasNewStoryInfo || hasInfoInfo || hasTransferredOutInfo || hasTransferredInInfo || hasProposedInfo) {
                // Timeline changes should only appear when the parent story is visible
                // Use the same visibility rules as the story itself
                const storyIsVisible = this.shouldDisplayStory(story);
                
                if (!storyIsVisible) {
                    // No timeline changes if parent story is not visible in this roadmap year
                    timelineHTML = '';
                } else {
                
                let textStartValue = story.roadmapChanges?.textStartDate || story.roadmapChanges?.textStartMonth;
                let textEndValue = story.roadmapChanges?.textEndDate || story.roadmapChanges?.textEndMonth;
                
                // SINGLE UNIFIED WIDTH CALCULATION - Calculate width first, then positioning
                let totalItems = 0;
                if (hasChanges) totalItems += story.roadmapChanges?.changes?.length || 0;
                if (hasDoneInfo) totalItems += 1;
                if (hasCancelInfo) totalItems += 1;
                if (hasAtRiskInfo) totalItems += 1;
                if (hasNewStoryInfo) totalItems += 1;
                if (hasInfoInfo) {
                    // Count each info entry individually, not just as 1
                    if (Array.isArray(story.roadmapChanges.infoInfo)) {
                        totalItems += story.roadmapChanges.infoInfo.length;
                    } else {
                        totalItems += 1; // Single info entry (backward compatibility)
                    }
                }
                if (hasTransferredOutInfo) totalItems += 1;
                if (hasTransferredInInfo) totalItems += 1;
                if (hasProposedInfo) totalItems += 1;
                
                const textBoxWidth = getConfigUtility().calculateTextBoxWidth(totalItems);
                
                // Calculate story positioning for reference
                let storyStartGrid;
                if (story.startDate) {
                    try {
                        // Convert European date to ISO if needed
                        let isoStartDate = story.startDate;
                        if (story.startDate.match(/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/)) {
                            isoStartDate = this.convertEuropeanToISO(story.startDate);
                        }
                        
                        const startDate = this.parseDateSafe(isoStartDate);
                        if (startDate && !isNaN(startDate.getTime())) {
                            // Check if story starts before the roadmap year
                            if (startDate.getFullYear() < this.roadmapYear) {
                                // Story starts before roadmap year - treat exactly as if it starts on 01/01/2025
                                // Override the story's start date to be 01/01 of roadmap year for positioning
                                story._originalStartDate = story.startDate; // Save original for reference
                                story.startDate = `01/01/${this.roadmapYear}`; // Set to January 1st of roadmap year
                                const jan1IsoDate = `${this.roadmapYear}-01-01`;
                                
                                // Use the same logic as normal January 1st dates
                                const isStartOfMonth = getDateUtility().isStartOfMonth(jan1IsoDate);
                                if (isStartOfMonth) {
                                    storyStartGrid = this.monthToGrid('JAN');
                                } else {
                                    storyStartGrid = getDateUtility().dateToGrid(jan1IsoDate, this.monthToGrid.bind(this));
                                }
                                // Note: January 1st is never the 15th, so no special backup needed here
                                
                                // Add visual indicator that story started in previous year
                                story._startsInPreviousYear = true;
                                story._actualStartYear = startDate.getFullYear();
                            } else {
                                // Story starts in roadmap year - use 4-position system
                                const isStartOfMonth = getDateUtility().isStartOfMonth(isoStartDate);
                                const isEndOfPreviousMonth = getDateUtility().isEndOfPreviousMonth(isoStartDate);
                                
                                if (isStartOfMonth) {
                                    // Start of month (1st-3rd): Position at month start
                                    const monthName = this.getMonthName(startDate.getMonth() + 1);
                                    storyStartGrid = this.monthToGrid(monthName);
                                } else if (isEndOfPreviousMonth) {
                                    // End of previous month (1st-3rd): Position at previous month start
                                    const previousMonthName = getDateUtility().getPreviousMonthName(isoStartDate);
                                    storyStartGrid = this.monthToGrid(previousMonthName);
                                } else {
                                    // Regular dates (4th-31st): Use 4-position system
                                    storyStartGrid = getDateUtility().dateToGrid(isoStartDate, this.monthToGrid.bind(this));
                                    
                                    // Special case adjustments for specific start dates
                                    const startDate = this.parseDateSafe(isoStartDate);
                                    if (startDate) {
                                        const dayOfMonth = startDate.getDate();
                                        
                                        if (dayOfMonth >= 11 && dayOfMonth <= 21) {
                                            // Stories starting on 11th-21st (including 15th) need to be backed up by 2 grid lines
                                            storyStartGrid -= 2;
                                        } else if (dayOfMonth >= 22 && dayOfMonth <= 26) {
                                            // Stories starting on 22nd-26th need to be backed up by 5 grid lines to match 21st position
                                            storyStartGrid -= 5;
                                        } else if (dayOfMonth >= 27 && dayOfMonth <= 31) {
                                            // Stories starting on 27th-31st should be positioned as 1st of next month
                                            const currentMonth = startDate.getMonth() + 1; // getMonth() is 0-based
                                            const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
                                            const nextMonthName = this.getMonthName(nextMonth);
                                            storyStartGrid = this.monthToGrid(nextMonthName);
                                        } else if (dayOfMonth >= 4 && dayOfMonth <= 10) {
                                            // Stories starting on 7th (and range 4-10) need to be backed up by 1 grid line
                                            storyStartGrid -= 1;
                                        }
                                    }
                                }
                            }
                        } else {
                            storyStartGrid = this.getGridPosition(story.startDate);
                        }
                    } catch (e) {
                        storyStartGrid = this.getGridPosition(story.startDate);
                    }
                } else {
                    storyStartGrid = this.monthToGrid(story.startMonth);
                }
                
                // Calculate story end grid for visual positioning (using 4-position system)
                let storyEndGrid;
                // Calculate actual end grid for text box positioning (using actual dates)
                let actualEndGrid;
                
                const effectiveEndValue = this.getEffectiveEndDate(story);
                const effectiveEndIsDate = this.isEffectiveEndDateADate(story);
                
                if (effectiveEndIsDate) {
                    const parsedEndDate = this.parseDateSafe(effectiveEndValue);
                    const isEndOfMonth = getDateUtility().isEndOfMonth(effectiveEndValue);
                    const isEndOfPreviousMonth = getDateUtility().isEndOfPreviousMonth(effectiveEndValue);
                    
                    if (isEndOfMonth) {
                        // End of month: treat like month name - position at month start + 10
                        const monthName = this.getMonthName(parsedEndDate.getMonth() + 1);
                        storyEndGrid = this.getGridPosition(monthName) + 10;
                        actualEndGrid = storyEndGrid; // Same for text box
                    } else if (isEndOfPreviousMonth) {
                        // End of previous month (1st-3rd): treat as end of previous month
                        const previousMonthName = getDateUtility().getPreviousMonthName(effectiveEndValue);
                        storyEndGrid = this.getGridPosition(previousMonthName) + 10;
                        actualEndGrid = storyEndGrid; // Same for text box
                    } else {
                        // Regular specific date: use 4-position system for story, actual date for text box
                        if (parsedEndDate && getDateUtility().isValidDate(parsedEndDate)) {
                            // Story positioning: use 4-position system
                            storyEndGrid = getDateUtility().dateToGrid(effectiveEndValue, this.monthToGrid.bind(this));
                            
                            // Text box positioning: use actual date without 4-position adjustments
                            actualEndGrid = this.getGridPosition(effectiveEndValue);
                        } else {
                            storyEndGrid = this.getGridPosition(effectiveEndValue);
                            actualEndGrid = storyEndGrid;
                        }
                    }
                } else {
                    // Month name: position at month start + 10 to span full month
                    storyEndGrid = this.getGridPosition(effectiveEndValue) + 10;
                    actualEndGrid = storyEndGrid; // Same for text box
                }
                
                // SIMPLIFIED POSITIONING LOGIC
                let changeStartGrid, changeEndGrid;
                let shouldPositionBelowFinal = false;

                // Force text box below if story ends between Oct 4 and Dec 31 of the roadmap year
                let endsBetweenOct4AndDec31 = false;
                if (effectiveEndIsDate) {
                    const parsed = this.parseDateSafe(effectiveEndValue);
                    if (parsed && !isNaN(parsed.getTime()) && parsed.getFullYear() === this.roadmapYear) {
                        const m = parsed.getMonth(); // 0-based, Oct=9
                        const d = parsed.getDate();
                        if (m > 9 || (m === 9 && d >= 4)) {
                            endsBetweenOct4AndDec31 = true;
                        }
                    }
                }

                // Check if story continues past roadmap year - if so, use December as visual end
                const continuesNextYear = this.storyContinuesNextYear(story);
                const visualStoryEndGrid = continuesNextYear ? (this.getGridPosition('DEC') + 10) : storyEndGrid;

                // For stories that continue past roadmap year or end in Oct 4–Dec 31, position text boxes below
                if (continuesNextYear || endsBetweenOct4AndDec31) {
                    shouldPositionBelowFinal = true;
                } else {
                    // Step 1: Check if story + text box fits on same line (for ALL item counts)
                    const buffer = 2; // Small buffer between story and text box
                    const combinedWidth = visualStoryEndGrid + buffer + textBoxWidth;
                    
                    if (getConfigUtility().exceedsMaxGrid(combinedWidth)) {
                        shouldPositionBelowFinal = true;
                    }
                }
                
                // Global force: when enabled, always position below and align with story start
                // Check localStorage, main form temporary variable, and search results temporary variable
                const forceBelowFromConfig = (typeof getConfigUtility === 'function' && getConfigUtility().shouldForceTextBelow());
                const forceBelowFromTemp = (typeof tempForceTextBelow !== 'undefined' && tempForceTextBelow);
                const forceBelowFromSearch = (typeof searchTempForceTextBelow !== 'undefined' && searchTempForceTextBelow);
                const forceBelowGlobal = forceBelowFromConfig || forceBelowFromTemp || forceBelowFromSearch;
                if (forceBelowGlobal) {
                    shouldPositionBelowFinal = true;
                }
                
                if (shouldPositionBelowFinal) {
                    // Position below story, align start with story start when forced; otherwise small indent
                    const forceBelowFromConfig = (typeof getConfigUtility === 'function' && getConfigUtility().shouldForceTextBelow());
                    const forceBelowFromTemp = (typeof tempForceTextBelow !== 'undefined' && tempForceTextBelow);
                    const forceBelowFromSearch = (typeof searchTempForceTextBelow !== 'undefined' && searchTempForceTextBelow);
                    const forceBelowGlobal = forceBelowFromConfig || forceBelowFromTemp || forceBelowFromSearch;
                    changeStartGrid = forceBelowGlobal ? storyStartGrid : (storyStartGrid + 1);
                    changeEndGrid = changeStartGrid + textBoxWidth;
                    
                    // If text box would still extend past December when below, shift left
                    if (getConfigUtility().exceedsMaxGrid(changeEndGrid)) {
                        const overflow = changeEndGrid - getConfigUtility().getMaxGrid();
                        changeStartGrid = Math.max(1, changeStartGrid - overflow);
                        changeEndGrid = changeStartGrid + textBoxWidth;
                    }
                } else {
                    // Position to the right of story on same line
                    const buffer = 2;
                    changeStartGrid = actualEndGrid + buffer;
                    changeEndGrid = changeStartGrid + textBoxWidth;
                }
                
                timelineHTML = this.generateRoadmapChanges(story.roadmapChanges.changes, changeStartGrid, changeEndGrid, story.roadmapChanges.doneInfo, story.roadmapChanges.cancelInfo, story.roadmapChanges.atRiskInfo, story.roadmapChanges.newStoryInfo, story.roadmapChanges.infoInfo, story.roadmapChanges.transferredOutInfo, story.roadmapChanges.transferredInInfo, story.roadmapChanges.proposedInfo, shouldPositionBelowFinal, storyStartGrid, backgroundColor, storyId);
                }
            }
            
            // Put story and timeline in same track (like original)
            tracksHTML += `<div class="story-track">${storyHTML}${timelineHTML}</div>`;
        });

        return `
        <div class="swimlane">
            <div class="epic-label">${this.truncateEpicName(epic.name, epic.stories.length)}</div>
                            <div class="swimlane-content" style="background-color: ${backgroundColor};">
                ${this.generateTimelineGrid()}
                ${tracksHTML}
            </div>
        </div>`;
    }

    // Generate complete roadmap HTML
    generateRoadmap(teamData, embedded = false, enableEditing = true, fixedWidth = false) {
        // Store search range for date range searches (used by continuation logic)
        this.searchRange = teamData.searchRange || null;
        
        // Check KTLO position setting (default to 'bottom' for better UX)
        const ktloPosition = teamData.ktloSwimlane?.position || 'bottom';
        
        // Generate KTLO swimlane 
        let ktloHTML = '';
        if (teamData.ktloSwimlane && ktloPosition === 'top') {
            ktloHTML = this.generateKTLOSwimlane(teamData.ktloSwimlane, 0, embedded, ktloPosition); // Pass 0 for top position
        }
        // Skip KTLO generation entirely if position is 'hidden'
        
        const epicsHTML = teamData.epics.map((epic, index) => {
            const separatorHTML = index === 0 ? '' : '<div class="swimlane-separator"></div>'; // Skip separator before first epic
            return separatorHTML + this.generateEpic(epic, index, embedded, ktloPosition);
        }).join('');
        
        // Generate BTL and KTLO at bottom
        let bottomHTML = '';
        
        // Add KTLO at bottom if positioned there (skip if hidden)
        if (teamData.ktloSwimlane && ktloPosition === 'bottom') {
            bottomHTML += '<div class="swimlane-separator"></div>';
            bottomHTML += this.generateKTLOSwimlane(teamData.ktloSwimlane, teamData.epics.length, embedded, ktloPosition);
        }
        
        // Add BTL swimlane only if it has content
        const btlHTML = this.generateBTLSwimlane(teamData.btlSwimlane, teamData.epics.length, embedded, ktloPosition);
        if (btlHTML) {
            bottomHTML += '<div class="swimlane-separator-dashed"></div>';
            bottomHTML += btlHTML;
        }

        // Use Teya Logo image file directly
        const logoSrc = 'teya-logo.png';
        const roadmapContent = `
            <div class="header">
                <img src="${logoSrc}" alt="Teya Logo" class="teya-logo">
                <div class="team-name">${teamData.teamName}</div>
                ${(teamData.em || teamData.pm) ? `<div class=\"team-members\">${teamData.em ? `${teamData.em} (EM)` : ''}${teamData.em && teamData.pm ? ' / ' : ''}${teamData.pm ? `${teamData.pm} (PM)` : ''}</div>` : ''}
                ${teamData.description ? 
                    `<div class="team-description">${this.generateTeamDescription(teamData.description)}</div>` : ''}
            </div>
            
            <div class="roadmap-container">
                ${this.generateTimelineHeader()}
                <div class="swimlanes-container">
                    ${ktloHTML}
                    ${epicsHTML}
                    ${bottomHTML}
                </div>
            </div>
            
            `;

        if (embedded) {
            return `<div class="roadmap-wrapper">${this.generateCSS(fixedWidth)}${roadmapContent}</div>`;
        }

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${teamData.teamName}.Teya.Roadmap.${teamData.roadmapYear || 2025}</title>
            ${this.generateCSS(fixedWidth)}
        </head>
        <body>
            ${roadmapContent}
            
            <script>
                let selectedStory = null;
                
                // Add click event listeners to all story items
                document.addEventListener('DOMContentLoaded', function() {
                    const storyItems = document.querySelectorAll('.story-item, .ktlo-story');
                    
                    // January/December hover now handled by CSS
                    

                    ${enableEditing ? `
                    storyItems.forEach((story, index) => {
                        // Add single-click event listener to open edit dialog
                        story.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            selectedStory = {
                                epicName: this.dataset.epicName,
                                storyTitle: this.dataset.storyTitle,
                                storyIndex: this.dataset.storyIndex,
                                element: this
                            };
                            
                            // Call the edit function
                            editStory();
                        });
                        
                        // Visual indicator for clickable stories
                        story.style.cursor = 'pointer';
                    });` : `
                    // Editing disabled - no click event listeners added
                    storyItems.forEach((story, index) => {
                        // Remove pointer cursor for non-editable stories
                        story.style.cursor = 'default';
                    });`}
                    

                    
                });
                
                
                function editStory() {
                    if (!selectedStory) return;
                    
                    // Open roadmap builder with story details
                    const builderUrl = 'roadmap-builder.html';
                    const params = new URLSearchParams({
                        action: 'edit',
                        epic: selectedStory.epicName,
                        story: selectedStory.storyTitle,
                        index: selectedStory.storyIndex
                    });
                    
                    window.open(builderUrl + '?' + params.toString(), '_blank');
                }
                

            </script>
        </body>
        </html>`;
    }

    // Generate roadmap for embedding in existing pages
    generateEmbeddedRoadmap(teamData, enableEditing = true, fixedWidth = false) {
        return this.generateRoadmap(teamData, true, enableEditing, fixedWidth);
    }
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RoadmapGenerator };
} else if (typeof window !== 'undefined') {
    window.RoadmapGenerator = RoadmapGenerator;
}
