/**
 * Centralized European Date Utility
 * Handles all date parsing, formatting, and validation with European DD/MM/YY preference
 */
class DateUtility {
    static monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    static fullMonthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    
    // Centralized regex patterns for date validation and parsing
    static EUROPEAN_DATE_REGEX = /^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/;
    static ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
    static MONTH_YEAR_REGEX = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s*(\d{4}|\d{2})?$/i;

    /**
     * Get current date in European DD/MM/YY format
     */
    static getTodaysDateEuropean() {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = String(today.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
    }

    /**
     * Format European date - normalize all European formats to DD/MM/YY for consistent display
     */
    static formatDateEuropean(dateStr, roadmapYear = null) {
        if (!dateStr || typeof dateStr !== 'string') return dateStr;
        
        try {
            let parts;
            
            if (dateStr.includes('/')) {
                parts = dateStr.split('/');
            } else if (dateStr.includes('-')) {
                parts = dateStr.split('-');
            } else {
                return dateStr;
            }
            
            if (parts.length >= 2) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                let year = parts[2] || (roadmapYear || new Date().getFullYear()).toString();
                
                if (year.length === 2) {
                    const twoDigitYear = parseInt(year);
                    
                    if (twoDigitYear <= 30) {
                        year = (2000 + twoDigitYear).toString(); // 00-30 = 2000-2030
                    } else {
                        year = (2000 + twoDigitYear).toString(); // Always assume 2000s for roadmaps
                    }
                }
                
                const twoDigitYear = year.slice(-2);
                return `${day}/${month}/${twoDigitYear}`;
            }
            
            return dateStr;
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * Convert European date format to ISO format (YYYY-MM-DD)
     */
    static convertEuropeanToISO(dateStr, roadmapYear = null) {
        if (!dateStr || typeof dateStr !== 'string') return dateStr;
        
        try {
            let parts;
            
            if (dateStr.includes('/')) {
                parts = dateStr.split('/');
            } else if (dateStr.includes('-')) {
                parts = dateStr.split('-');
            } else {
                return dateStr;
            }
            
            if (parts.length >= 2) {
                let day = parseInt(parts[0]);
                let month = parseInt(parts[1]);
                let year = parts[2] || (roadmapYear || new Date().getFullYear()).toString();
                
                // Smart validation with auto-correction for swapped day/month
                if (month > 12 && day <= 12) {
                    // Month is invalid but day could be month - swap them
                    [day, month] = [month, day]; // Swap values
                }
                
                // Final validation
                if (day < 1 || day > 31 || month < 1 || month > 12) {
                    return dateStr;
                }
                
                const dayStr = String(day).padStart(2, '0');
                const monthStr = String(month).padStart(2, '0');
                
                if (year.length === 2) {
                    const twoDigitYear = parseInt(year);
                    
                    if (twoDigitYear <= 30) {
                        year = (2000 + twoDigitYear).toString(); // 00-30 = 2000-2030
                    } else {
                        year = (2000 + twoDigitYear).toString(); // Always assume 2000s for roadmaps
                    }
                }
                
                const isoDate = `${year}-${monthStr}-${dayStr}`;
                const testDate = new Date(isoDate);
                if (!isNaN(testDate.getTime())) {
                    return isoDate;
                } else {
                    return dateStr;
                }
            }
            return dateStr;
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * Safe date parsing that handles ONLY European and ISO formats - NO US FORMAT EVER
     */
    static parseDateSafe(dateStr) {
        if (!dateStr) return null;
        
        try {
            // ONLY European format (DD/MM/YY) - convert to ISO first
            if (/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(dateStr)) {
                const isoDate = this.convertEuropeanToISO(dateStr, null);
                if (isoDate) {
                    const date = new Date(isoDate);
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                }
                // If European format conversion failed, return null - NO FALLBACK TO US FORMAT
                return null;
            }
            
            // ONLY ISO format (YYYY-MM-DD) - safe to parse directly
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const date = new Date(dateStr + 'T00:00:00');
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
            
            // NO OTHER FORMATS ALLOWED - prevents any US date interpretation
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Parse text input that can be month names, month+day, or DD/MM dates
     * Used by date picker functionality
     */
    static parseTextValue(value, isEndDateField = false, roadmapYear = null) {
        if (!value) return '';
        
        const currentYear = roadmapYear || new Date().getFullYear();
        
        // Handle month names (both 3-letter and full names, with optional day)
        const upperValue = value.toUpperCase().trim();
        
        // Check for formats like "FEB 8", "FEB 8TH", "FEBRUARY 8", "8 FEB", etc.
        const monthDayPattern = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JANUARY|FEBRUARY|MARCH|APRIL|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s*(\d{1,2})(ST|ND|RD|TH)?\s*$/i;
        const dayMonthPattern = /^(\d{1,2})(ST|ND|RD|TH)?\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JANUARY|FEBRUARY|MARCH|APRIL|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s*$/i;
        
        let monthIndex = -1;
        let dayValue = null;
        
        // Try month-day format (e.g., "FEB 8", "FEB 8TH")
        const monthDayMatch = upperValue.match(monthDayPattern);
        if (monthDayMatch) {
            const monthName = monthDayMatch[1];
            dayValue = parseInt(monthDayMatch[2]);
            monthIndex = this.monthNames.indexOf(monthName);
            if (monthIndex === -1) {
                monthIndex = this.fullMonthNames.indexOf(monthName);
            }
        }
        
        // Try day-month format (e.g., "8 FEB", "8TH FEB")
        if (monthIndex === -1) {
            const dayMonthMatch = upperValue.match(dayMonthPattern);
            if (dayMonthMatch) {
                dayValue = parseInt(dayMonthMatch[1]);
                const monthName = dayMonthMatch[3];
                monthIndex = this.monthNames.indexOf(monthName);
                if (monthIndex === -1) {
                    monthIndex = this.fullMonthNames.indexOf(monthName);
                }
            }
        }
        
        // Try just month name (existing logic)
        if (monthIndex === -1) {
            monthIndex = this.monthNames.indexOf(upperValue);
            if (monthIndex === -1) {
                monthIndex = this.fullMonthNames.indexOf(upperValue);
            }
        }
        
        if (monthIndex !== -1) {
            let finalDay;
            if (dayValue && dayValue >= 1 && dayValue <= 31) {
                // Use the specified day
                finalDay = dayValue;
            } else if (isEndDateField) {
                // For end dates, use the last day of the month
                finalDay = new Date(currentYear, monthIndex + 1, 0).getDate();
            } else {
                // For start dates, use the first day of the month
                finalDay = 1;
            }
            
            const result = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
            return result;
        }
       
        // Handle DD/MM/YY format
        if (value.match(/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/)) {
            const parts = value.split(/[\/\-]/);
            if (parts.length >= 2) {
                let day = parseInt(parts[0]);
                let month = parseInt(parts[1]);
                let year = parts[2] ? parseInt(parts[2]) : currentYear;
                
                // Smart validation with auto-correction for swapped day/month
                // Always assume DD/MM format for European dates unless month > 12
                if (month > 12 && day <= 12) {
                    // Month is invalid but day could be month - swap them
                    [day, month] = [month, day]; // Swap values
                }
                // Additional check: if day <= 12 and month <= 12, assume DD/MM format (European)
                // No swapping needed - we're already interpreting as DD/MM
                
                // Final validation
                if (day < 1 || day > 31 || month < 1 || month > 12) {
                    console.error('Invalid date components after correction:', { day, month, year, originalValue: value });
                    return '';
                }
                
                if (year < 100) {
                    if (year <= 30) {
                        year = 2000 + year;
                    } else {
                        year = 2000 + year; // Always assume 2000s for roadmaps
                    }
                }
                
                // Create the ISO date string
                const dayStr = String(day).padStart(2, '0');
                const monthStr = String(month).padStart(2, '0');
                const result = `${year}-${monthStr}-${dayStr}`;
                
                // Validate the result by trying to create a Date object
                const testDate = new Date(result);
                if (isNaN(testDate.getTime()) || 
                    testDate.getFullYear() !== year || 
                    testDate.getMonth() !== month - 1 || 
                    testDate.getDate() !== day) {
                    console.error('Invalid date created:', { result, testDate, originalValue: value });
                    return '';
                }
                
                return result;
            }
        }
        
        return '';
    }

    /**
     * Convert ISO date value back to European DD/MM/YY text format
     */
    static formatDateToText(dateValue) {
        if (!dateValue) return '';
        
        try {
            const date = new Date(dateValue + 'T00:00:00');
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2);
            return `${day}/${month}/${year}`;
        } catch (e) {
            return '';
        }
    }

    /**
     * Compare two dates to determine if new date is earlier than previous date
     */
    static isEarlyDelivery(prevEndDate, newEndDate) {
        try {
            const prevDate = this.parseDateSafe(prevEndDate);
            const newDate = this.parseDateSafe(newEndDate);
            
            if (!prevDate || !newDate) {
                return false; // Default to delay if parsing fails
            }
            
            return newDate < prevDate; // Early if new date is before previous date
        } catch (e) {
            return false; // Default to delay if parsing fails
        }
    }

    /**
     * Validate if a date string is valid
     */
    static isValidDate(dateStr) {
        if (!dateStr) return false;
        const parsed = this.parseDateSafe(dateStr);
        return parsed !== null;
    }

    /**
     * Get month name from month number (1-12)
     */
    static getMonthName(monthNumber) {
        if (monthNumber < 1 || monthNumber > 12) return 'JAN';
        return this.monthNames[monthNumber - 1];
    }

    /**
     * Convert specific date to grid position with sub-month precision.
     * Implements a 4-position mapping within the month (4–10 => +3, 11–20 => +6, 21–25 => +9).
     * Note: Calling code handles special cases like start-of-month (1–3), end-of-month (26–31),
     * and previous/next-month semantics for starts/ends.
     */
    static dateToGrid(dateStr, monthToGridCallback) {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return 1;
            }
            
            const month = date.getMonth() + 1;
            const dayOfMonth = date.getDate();
            
            // 4-position mapping used by both start and end computations
            let positionWithinMonth;
            
            if (dayOfMonth >= 1 && dayOfMonth <= 3) {
                // Days 1-3: End of previous month (handled by isEndOfPreviousMonth logic)
                positionWithinMonth = 0; // This will be adjusted by the calling code
            } else if (dayOfMonth >= 4 && dayOfMonth <= 10) {
                // Days 4-10: 30% (1st week)
                positionWithinMonth = 3; // 3 out of 10 = 30%
            } else if (dayOfMonth >= 11 && dayOfMonth <= 20) {
                // Days 11-20: 60% (middle)
                positionWithinMonth = 6; // 6 out of 10 = 60%
            } else if (dayOfMonth >= 21 && dayOfMonth <= 25) {
                // Days 21-25: 90% (3rd week)
                positionWithinMonth = 9; // 9 out of 10 = 90%
            } else {
                // Days 26-31: Let the roadmap generator handle with isEndOfMonth logic
                // This will make them span the full month (+10)
                positionWithinMonth = 9; // 9 out of 10 = 90% (will be overridden by +10)
            }
            
            const monthStartColumn = monthToGridCallback(this.getMonthName(month));
            return monthStartColumn + positionWithinMonth;
        } catch (e) {
            return 1;
        }
    }

    /**
     * Smart position calculator - handles both month names and dates
     */
    static getGridPosition(value, monthToGridCallback) {
        if (!value) return 1;
        
        if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return this.dateToGrid(value, monthToGridCallback);
        }
        
        if (typeof value === 'string' && value.match(/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/)) {
            const isoDate = this.convertEuropeanToISO(value, null);
            return this.dateToGrid(isoDate, monthToGridCallback);
        }
        
        return monthToGridCallback(value);
    }

    
    /**
     * Check if a date represents the end of month (26th-31st)  
     * These dates should be treated as full month span for roadmap positioning
     */
    static isEndOfMonth(dateStr) {
        const date = this.parseDateSafe(dateStr);
        if (!date) return false;
        const dayOfMonth = date.getDate();
        return dayOfMonth >= 26; // 26, 27, 28, 29, 30, 31
    }

    /**
     * Check if a date represents the start of month (1st–3rd).
     * Used by callers to snap starts to the current month boundary.
     */
    static isStartOfMonth(dateStr) {
        const date = this.parseDateSafe(dateStr);
        if (!date) return false;
        const dayOfMonth = date.getDate();
        return dayOfMonth >= 1 && dayOfMonth <= 3; // 1st, 2nd, 3rd
    }

    /**
     * Check if a date represents the end of the previous month (1st–3rd of current month).
     * Note: Overlaps numerically with isStartOfMonth on 1–3; callers choose semantics (start vs end).
     */
    static isEndOfPreviousMonth(dateStr) {
        const date = this.parseDateSafe(dateStr);
        if (!date) return false;
        const dayOfMonth = date.getDate();
        return dayOfMonth >= 1 && dayOfMonth <= 3; // 1st, 2nd, 3rd
    }

    /**
     * Get the previous month from a date, treating it as end of that month
     * @param {string} dateStr - Date string to analyze
     * @returns {string|null} - Month name (e.g., "JUL") or null if invalid
     */
    static getPreviousMonthName(dateStr) {
        const date = this.parseDateSafe(dateStr);
        if (!date) return null;
        
        // Get previous month
        const prevMonth = new Date(date);
        prevMonth.setMonth(date.getMonth() - 1);
        
        return this.getMonthName(prevMonth.getMonth() + 1);
    }

    /**
     * Get the semantic meaning of a date for roadmap positioning
     * @param {string} dateStr - Date string to analyze
     * @returns {object} - {type: 'start'|'end'|'end-prev'|'mid', dayOfMonth: number}
     */
    static getDatePositionType(dateStr) {
        const date = this.parseDateSafe(dateStr);
        if (!date) return { type: 'mid', dayOfMonth: null };
        
        const dayOfMonth = date.getDate();
        if (this.isStartOfMonth(dateStr)) {
            return { type: 'start', dayOfMonth };
        } else if (this.isEndOfPreviousMonth(dateStr)) {
            return { type: 'end-prev', dayOfMonth };
        } else if (this.isEndOfMonth(dateStr)) {
            return { type: 'end', dayOfMonth };
        } else {
            return { type: 'mid', dayOfMonth };
        }
    }

    /**
     * Add or subtract days from a date string
     * @param {string} dateStr - Date string (European or ISO format)
     * @param {number} days - Number of days to add (positive) or subtract (negative)
     * @returns {string|null} - Adjusted date in ISO format (YYYY-MM-DD) or null if invalid
     */
    static addDays(dateStr, days) {
        const date = this.parseDateSafe(dateStr);
        if (!date || !Number.isInteger(days)) return null;
        
        const adjustedDate = new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));
        if (isNaN(adjustedDate.getTime())) return null;
        
        return adjustedDate.toISOString().split('T')[0];
    }

    /**
     * Convert a Date object to ISO date string (YYYY-MM-DD)
     * @param {Date} date - Date object
     * @returns {string|null} - ISO date string or null if invalid
     */
    static dateToISOString(date) {
        if (!date || isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    }

    /**
     * Check if a Date object is valid
     * @param {Date} date - Date object to validate
     * @returns {boolean} - True if valid
     */
    static isValidDate(date) {
        return date instanceof Date && !isNaN(date.getTime());
    }

    /**
     * Check if a date is in January
     * @param {string} dateStr - Date string to check
     * @returns {boolean} - True if date is in January
     */
    static isJanuary(dateStr) {
        // Handle ISO format check first
        if (typeof dateStr === 'string' && dateStr.startsWith('2025-01')) {
            return true;
        }
        
        // Handle European format check
        if (typeof dateStr === 'string' && dateStr.match(/^\d{1,2}[\/\-]0?1[\/\-]/)) {
            return true; // Day/1/Year or Day/01/Year patterns
        }
        
        // Fallback to date parsing
        const date = this.parseDateSafe(dateStr);
        return date ? date.getMonth() === 0 : false; // January is month 0
    }

    /**
     * Check if a date is in October  
     * @param {string} dateStr - Date string to check
     * @returns {boolean} - True if date is in October
     */
    static isOctober(dateStr) {
        // Handle ISO format check first
        if (typeof dateStr === 'string' && dateStr.startsWith('2025-10')) {
            return true;
        }
        
        // Handle European format check for October
        if (typeof dateStr === 'string' && dateStr.match(/^\d{1,2}[\/\-]10[\/\-]/)) {
            return true; // Day/10/Year patterns
        }
        
        // Fallback to date parsing
        const date = this.parseDateSafe(dateStr);
        return date ? date.getMonth() === 9 : false; // October is month 9
    }

    /**
     * Get the month from a date string and return the month name
     * @param {string} dateStr - Date string
     * @returns {string} - Month name (JAN, FEB, etc.) or 'JAN' if invalid
     */
    static getMonthFromDate(dateStr) {
        const date = this.parseDateSafe(dateStr);
        if (!date) return 'JAN';
        return this.getMonthName(date.getMonth() + 1);
    }

    /**
     * Adjust date for visual alignment in roadmap grid
     * Used for positioning stories that start/end at certain parts of the month
     * @param {string} dateStr - Date string to adjust
     * @param {string} adjustmentType - 'start-back', 'start-forward', 'mid-forward', 'end-forward'
     * @returns {string|null} - Adjusted date in ISO format or null if invalid
     */


    /**
     * Compare two dates chronologically (for sorting)
     * @param {string} dateA - First date string 
     * @param {string} dateB - Second date string
     * @returns {number} - Negative if A < B, positive if A > B, 0 if equal
     */
    static compareDates(dateA, dateB) {
        const parsedA = this.parseDateSafe(dateA);
        const parsedB = this.parseDateSafe(dateB);
        
        // Handle invalid dates by putting them at the end
        if (!parsedA || isNaN(parsedA.getTime())) return 1;
        if (!parsedB || isNaN(parsedB.getTime())) return -1;
        
        return parsedA.getTime() - parsedB.getTime();
    }

    /**
     * Compare two values that can be either dates or month names (for sorting)
     * @param {string} valueA - First value (date or month)
     * @param {string} valueB - Second value (date or month)
     * @param {number} roadmapYear - Year for context
     * @returns {number} - Negative if A < B, positive if A > B, 0 if equal
     */
    static compareDateOrMonth(valueA, valueB, roadmapYear) {
        // Try to parse as dates first
        const dateA = this.parseDateSafe(valueA);
        const dateB = this.parseDateSafe(valueB);
        
        // If both are valid dates, compare them
        if (dateA && !isNaN(dateA.getTime()) && dateB && !isNaN(dateB.getTime())) {
            return dateA.getTime() - dateB.getTime();
        }
        
        // If both are month names, compare them
        if (this.MONTH_YEAR_REGEX.test(valueA) && this.MONTH_YEAR_REGEX.test(valueB)) {
            const monthA = this.getMonthName(this.monthNames.indexOf(valueA.toUpperCase()) + 1);
            const monthB = this.getMonthName(this.monthNames.indexOf(valueB.toUpperCase()) + 1);
            const monthIndexA = this.monthNames.indexOf(monthA);
            const monthIndexB = this.monthNames.indexOf(monthB);
            return monthIndexA - monthIndexB;
        }
        
        // If one is a date and one is a month, convert month to date for comparison
        if (dateA && !isNaN(dateA.getTime()) && this.MONTH_YEAR_REGEX.test(valueB)) {
            const monthB = this.getMonthName(this.monthNames.indexOf(valueB.toUpperCase()) + 1);
            const monthDateB = this.convertMonthToStartDate(monthB, roadmapYear);
            const parsedMonthB = this.parseDateSafe(monthDateB);
            if (parsedMonthB && !isNaN(parsedMonthB.getTime())) {
                return dateA.getTime() - parsedMonthB.getTime();
            }
        }
        
        if (dateB && !isNaN(dateB.getTime()) && this.MONTH_YEAR_REGEX.test(valueA)) {
            const monthA = this.getMonthName(this.monthNames.indexOf(valueA.toUpperCase()) + 1);
            const monthDateA = this.convertMonthToStartDate(monthA, roadmapYear);
            const parsedMonthA = this.parseDateSafe(monthDateA);
            if (parsedMonthA && !isNaN(parsedMonthA.getTime())) {
                return parsedMonthA.getTime() - dateB.getTime();
            }
        }
        
        // Fallback: treat as strings
        return valueA.localeCompare(valueB);
    }
    
    /**
     * Convert month names to first day of month dates (for START dates)
     * @param {string} monthName - Month name (JAN, JANUARY, etc.)
     * @param {number} roadmapYear - Year to use (defaults to current year)
     * @returns {string} - European format date (01/MM/YY)
     */
    static convertMonthToStartDate(monthName, roadmapYear = null) {
        if (!monthName || typeof monthName !== 'string') return monthName;
        
        const currentYear = roadmapYear || new Date().getFullYear();
        const yearShort = currentYear.toString().slice(-2);
        
        const monthMap = {
            'JAN': '01/01/' + yearShort, 'JANUARY': '01/01/' + yearShort,
            'FEB': '01/02/' + yearShort, 'FEBRUARY': '01/02/' + yearShort,
            'MAR': '01/03/' + yearShort, 'MARCH': '01/03/' + yearShort,
            'APR': '01/04/' + yearShort, 'APRIL': '01/04/' + yearShort,
            'MAY': '01/05/' + yearShort,
            'JUN': '01/06/' + yearShort, 'JUNE': '01/06/' + yearShort,
            'JUL': '01/07/' + yearShort, 'JULY': '01/07/' + yearShort,
            'AUG': '01/08/' + yearShort, 'AUGUST': '01/08/' + yearShort,
            'SEP': '01/09/' + yearShort, 'SEPTEMBER': '01/09/' + yearShort,
            'OCT': '01/10/' + yearShort, 'OCTOBER': '01/10/' + yearShort,
            'NOV': '01/11/' + yearShort, 'NOVEMBER': '01/11/' + yearShort,
            'DEC': '01/12/' + yearShort, 'DECEMBER': '01/12/' + yearShort
        };
        
        const upperMonth = monthName.toUpperCase();
        return monthMap[upperMonth] || monthName; // Return original if not a recognized month
    }
    
    /**
     * Convert month names to last day of month dates (for END dates)
     * @param {string} monthName - Month name (JAN, JANUARY, etc.)
     * @param {number} roadmapYear - Year to use (defaults to current year)
     * @returns {string} - European format date (DD/MM/YY)
     */
    static convertMonthToEndDate(monthName, roadmapYear = null) {
        if (!monthName || typeof monthName !== 'string') return monthName;
        
        const currentYear = roadmapYear || new Date().getFullYear();
        const yearShort = currentYear.toString().slice(-2);
        
        // Calculate days in February for leap year
        const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
        const febDays = isLeapYear ? 29 : 28;
        
        const monthMap = {
            'JAN': '31/01/' + yearShort, 'JANUARY': '31/01/' + yearShort,
            'FEB': febDays + '/02/' + yearShort, 'FEBRUARY': febDays + '/02/' + yearShort,
            'MAR': '31/03/' + yearShort, 'MARCH': '31/03/' + yearShort,
            'APR': '30/04/' + yearShort, 'APRIL': '30/04/' + yearShort,
            'MAY': '31/05/' + yearShort,
            'JUN': '30/06/' + yearShort, 'JUNE': '30/06/' + yearShort,
            'JUL': '31/07/' + yearShort, 'JULY': '31/07/' + yearShort,
            'AUG': '31/08/' + yearShort, 'AUGUST': '31/08/' + yearShort,
            'SEP': '30/09/' + yearShort, 'SEPTEMBER': '30/09/' + yearShort,
            'OCT': '31/10/' + yearShort, 'OCTOBER': '31/10/' + yearShort,
            'NOV': '30/11/' + yearShort, 'NOVEMBER': '30/11/' + yearShort,
            'DEC': '31/12/' + yearShort, 'DECEMBER': '31/12/' + yearShort
        };
        
        const upperMonth = monthName.toUpperCase();
        return monthMap[upperMonth] || monthName; // Return original if not a recognized month
    }
    
    /**
     * Parse European date format for timeline change sorting
     * @param {string} dateStr - European format date string (DD/MM/YY or DD/MM/YYYY)
     * @returns {Date} - Parsed Date object
     */
    static parseEuropeanDateForTimeline(dateStr) {
        if (!dateStr) return new Date(0); // Very old date for empty strings
        
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // Month is 0-indexed
            let year = parseInt(parts[2]);
            if (year < 100) year += 2000; // Convert YY to YYYY
            return new Date(year, month, day);
        }
        return new Date(dateStr); // Fallback
    }
}

// Support both CommonJS and ES6 module exports
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = DateUtility;
} else if (typeof window !== 'undefined') {
    window.DateUtility = DateUtility;
} 