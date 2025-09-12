/**
 * Centralized Configuration & Layout Utility
 * Consolidates constants, magic numbers, and layout calculations
 */
class ConfigUtility {
    // Grid and Layout Constants
    static GRID = {
        ZOOM_THRESHOLD: 75,           // Grid units below which items can zoom
        MAX_COLUMNS: 120,             // Maximum grid columns (December end)
        POSITION_LIMIT: 109,          // Grid columns limit for positioning logic
        MONTHS_IN_YEAR: 12,
        COLUMNS_PER_MONTH: 10
    };

    // Text Box Width Configuration
    static TEXT_BOX_WIDTHS = {
        1: 16,   // 1 item
        2: 26,   // 2 items  
        3: 38,   // 3 items
        4: 50,   // 4 items
        5: 62,   // 5 items
        6: 74,   // 6 items
        7: 85,   // 7 items
        BASE_MULTIPLIER: 12,  // For 8+ items: increase by 12 from previous value
        MIN_LARGE_WIDTH: 85   // Minimum width for large text boxes
    };

    // Month Names and Positioning
    static MONTHS = {
        NAMES: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
        FULL_NAMES: ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'],
        GRID_POSITIONS: {
            'JAN': 1, 'JANUARY': 1, 'FEB': 11, 'FEBRUARY': 11, 'MAR': 21, 'MARCH': 21,
            'APR': 31, 'APRIL': 31, 'MAY': 41, 'JUN': 51, 'JUNE': 51, 'JUL': 61, 'JULY': 61,
            'AUG': 71, 'AUGUST': 71, 'SEP': 81, 'SEPTEMBER': 81, 'OCT': 91, 'OCTOBER': 91,
            'NOV': 101, 'NOVEMBER': 101, 'DEC': 111, 'DECEMBER': 111
        }
    };

    // Monthly Box Transform Offsets (for KTLO swimlane)
    static MONTHLY_BOX_TRANSFORMS = {
        0: { x: -2, startColumn: 1, extraClass: ' monthly-box-january' },                         // JAN
        1: { x: 0, startColumn: 1, extraClass: ' monthly-box-february' },                         // FEB
        2: { x: 0, startColumn: 1, extraClass: ' monthly-box-march' },                         // MAR
        3: { x: 2, startColumn: 1, extraClass: ' monthly-box-april' },                         // APR
        4: { x: 4, startColumn: 1, extraClass: ' monthly-box-may' },                         // MAY
        5: { x: 4, startColumn: 1, extraClass: ' monthly-box-june' },                         // JUN
        6: { x: 6, startColumn: 1, extraClass: ' monthly-box-july' },                         // JUL
        7: { x: 6, startColumn: 1, extraClass: ' monthly-box-august' },                         // AUG
        8: { x: 7, startColumn: 1, extraClass: ' monthly-box-september' },                         // SEP
        9: { x: 0, startColumn: 2, extraClass: ' monthly-box-october' },                         // OCT
        10: { x: 0, startColumn: 2, extraClass: ' monthly-box-november' },                        // NOV
        11: { x: 1, startColumn: 2, extraClass: ' monthly-box-december' }     // DEC
    };

    // CSS Transform Utilities
    static TRANSFORMS = {
        JANUARY_BASE: 'translateX(-4px)',
        JANUARY_HOVER: 'translateX(-4px) scale(1.3)',
        DECEMBER_BASE: 'translateX(1px)', 
        DECEMBER_HOVER: 'translateX(1px) scale(1.3)',
        STORY_JANUARY: 'translateX(-4px)',
        STORY_DECEMBER: 'translateX(1px)',
        STORY_JANUARY_HOVER: 'translateX(-4px) scale(1.20)',
        STORY_DECEMBER_HOVER: 'translateX(1px) scale(1.20)'
    };

    // Feature Flags
    static FEATURES = {
        SORT_STORIES: false  // Whether to sort stories by start/end date (default: off)
    };

    // CSS Constants for consistent styling
    static CSS = {
        // Z-Index Hierarchy
        Z_INDEX: {
            BASE_HOVER: 100,
            MONTHLY_HOVER: 1000,
            JANUARY_BASE: 200,
            JANUARY_CONTENT: 201,
            JANUARY_HOVER: 202,
            MODAL: 2000,
            FULLSCREEN: 1000,
            NOTIFICATION: 10000
        },
        
        // UI Constants
        UI: {
            CALENDAR_ICON_SIZE: 14,
            MODAL_MAX_WIDTH: 600,
            MODAL_PADDING: 24,
            CLOCK_ICON_SIZE: 20,
            ICON_OFFSET_TOP: -13,
            ICON_OFFSET_RIGHT: -14,
            BTL_MAX_STORIES: 3
        },
        
        // Timing Constants (in milliseconds)
        TIMING: {
            DEBOUNCE_DELAY: 300,
            PREVIEW_GENERATION: 100,
            KTLO_REPOSITION: 50,
            MODAL_INITIALIZATION: 100
        },
        
        // Border Radius Constants
        BORDER_RADIUS: {
            SMALL: '3px',
            MEDIUM: '4px',
            LARGE: '6px',
            XLARGE: '8px',
            ROUND: '50%',
            TEXT_BOX: '10px'
        },
        
        // Transition Constants  
        TRANSITIONS: {
            FAST: 'all 0.2s ease',
            BORDER: 'border-color 0.2s ease',
            BACKGROUND: 'background-color 0.2s ease'
        },
        
        // Transform Values
        SCALE: {
            HOVER: 1.3,
            STORY_HOVER: 1.20
        },
        
        // Box Shadow
        BOX_SHADOW: {
            HOVER: '0 4px 8px rgba(0,0,0,0.2)'
        },
        
        // Monthly Box Transforms (for hover effects)
        MONTHLY_TRANSFORMS: {
            JANUARY: 'translateX(-2px) scale(1.3)',
            FEBRUARY: 'scale(1.3)',
            MARCH: 'scale(1.3)', 
            APRIL: 'translateX(2px) scale(1.3)',
            MAY: 'translateX(4px) scale(1.3)',
            JUNE: 'translateX(4px) scale(1.3)',
            JULY: 'translateX(6px) scale(1.3)',
            AUGUST: 'translateX(6px) scale(1.3)',
            SEPTEMBER: 'translateX(7px) scale(1.3)',
            OCTOBER: 'scale(1.3)',
            NOVEMBER: 'scale(1.3)',
            DECEMBER: 'translateX(1px) scale(1.3)'
        }
    };

    /**
     * Calculate text box width based on number of items
     * @param {number} totalItems - Number of items in text box
     * @returns {number} - Width in grid units
     */
    static calculateTextBoxWidth(totalItems) {
        if (totalItems <= 7) {
            return this.TEXT_BOX_WIDTHS[totalItems] || this.TEXT_BOX_WIDTHS[1];
        }
        // For 8+ items: start from 85 (7 items) and add 12 for each additional item
        return this.TEXT_BOX_WIDTHS[7] + (totalItems - 7) * this.TEXT_BOX_WIDTHS.BASE_MULTIPLIER;
    }

    /**
     * Check if an item can zoom based on its width
     * @param {number} width - Width in grid units
     * @returns {boolean} - True if item can zoom
     */
    static canZoom(width) {
        return width < this.GRID.ZOOM_THRESHOLD;
    }

    /**
     * Generate CSS grid style for start/end positioning
     * @param {number} startGrid - Start grid position
     * @param {number} endGrid - End grid position
     * @param {number} gridRow - Grid row (optional)
     * @returns {string} - CSS style string
     */
    static generateGridStyle(startGrid, endGrid, gridRow = null) {
        let style = `--start: ${startGrid}; --end: ${endGrid};`;
        if (gridRow !== null) {
            style += ` grid-row: ${gridRow};`;
        }
        return style;
    }

    /**
     * Generate CSS grid-column style for monthly boxes
     * @param {number} startColumn - Start column
     * @param {number} endColumn - End column
     * @returns {string} - CSS grid-column value
     */
    static generateGridColumn(startColumn, endColumn) {
        return `${startColumn} / ${endColumn}`;
    }

    /**
     * Get month transform configuration for monthly boxes
     * @param {number} monthIndex - Month index (0-11)
     * @returns {object} - Transform configuration {x, startColumn, extraClass}
     */
    static getMonthlyBoxTransform(monthIndex) {
        return this.MONTHLY_BOX_TRANSFORMS[monthIndex] || { x: 0, startColumn: 1, extraClass: '' };
    }

    /**
     * Generate transform CSS for monthly boxes
     * @param {number} xOffset - X offset in pixels
     * @returns {string} - CSS transform string
     */
    static generateTransform(xOffset) {
        return `transform: translateX(${xOffset}px);`;
    }

    /**
     * Check if text box positioning should be below story
     * @param {number} storyWidth - Story width in grid units
     * @param {number} textBoxWidth - Text box width in grid units
     * @param {number} totalItems - Number of items in text box
     * @returns {boolean} - True if should position below
     */
    static shouldPositionBelow(storyWidth, textBoxWidth, totalItems) {
        return (storyWidth + textBoxWidth > this.GRID.POSITION_LIMIT) || (totalItems >= 3);
    }

    /**
     * Check if grid position exceeds maximum
     * @param {number} gridPosition - Grid position to check
     * @returns {boolean} - True if exceeds maximum
     */
    static exceedsMaxGrid(gridPosition) {
        return gridPosition > this.GRID.MAX_COLUMNS;
    }

    /**
     * Get maximum grid position
     * @returns {number} - Maximum grid position
     */
    static getMaxGrid() {
        return this.GRID.MAX_COLUMNS;
    }

    /**
     * Get month name by index
     * @param {number} index - Month index (0-11)
     * @returns {string} - Month name
     */
    static getMonthName(index) {
        return this.MONTHS.NAMES[index] || 'JAN';
    }

    /**
     * Get month grid position
     * @param {string} month - Month name
     * @returns {number} - Grid position
     */
    static getMonthGridPosition(month) {
        return this.MONTHS.GRID_POSITIONS[month.toUpperCase()] || 1;
    }

    /**
     * Get all month names
     * @returns {Array} - Array of month names
     */
    static getAllMonthNames() {
        return [...this.MONTHS.NAMES];
    }

    // Story Sorting Configuration
    static shouldSortStories() {
        // Check localStorage when available (browser); default to false in Node/CLI
        try {
            if (typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('roadmap-sort-stories');
                if (stored !== null) {
                    return stored === 'true';
                }
            }
        } catch (e) {}
        return false; // Default: sorting off
    }
    
    static setSortStories(enabled) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('roadmap-sort-stories', enabled.toString());
            }
        } catch (e) {}
    }
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConfigUtility };
} else if (typeof window !== 'undefined') {
    window.ConfigUtility = ConfigUtility;
} 