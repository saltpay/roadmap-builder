// Pure grid math for the 12-month roadmap layout. The roadmap grid spans
// 120 columns (10 columns per month). Months snap to a fixed start column.
//
// Delegates to ConfigUtility for the moment so tests cover the existing
// implementation. Phase 3 will likely inline these into the domain module.

import { ConfigUtility } from '../utilities/config-utility.js';
import { monthIndex } from './dates.js';

export const COLUMNS_PER_MONTH = 10;
export const MONTHS_IN_YEAR = 12;
export const MAX_COLUMNS = COLUMNS_PER_MONTH * MONTHS_IN_YEAR; // 120
export const POSITION_LIMIT = 109;

/** @typedef {'small' | 'medium' | 'large'} ZoomLevel */

/**
 * Grid column where a month starts (1-indexed).
 * January = 1, February = 11, ..., December = 111.
 *
 * @param {string} month - Short or long month name
 * @returns {number} 1-indexed grid column. Defaults to 1 for unknown input
 *                   (matches existing behavior; callers tolerate this).
 */
export function monthToGridStart(month) {
    return ConfigUtility.getMonthGridPosition(month);
}

/**
 * Inverse of monthToGridStart: which 0-indexed month does a column belong to?
 *
 * @param {number} column - 1-indexed grid column
 * @returns {number} 0-indexed month (Jan = 0). Returns -1 for out-of-range.
 */
export function gridToMonthIndex(column) {
    if (typeof column !== 'number' || column < 1 || column > MAX_COLUMNS) return -1;
    return Math.floor((column - 1) / COLUMNS_PER_MONTH);
}

/**
 * Width of the IMO/text-box badge for a given item count, in grid units.
 * Matches the table in ConfigUtility.TEXT_BOX_WIDTHS, including the linear
 * extrapolation for 8+ items.
 *
 * @param {number} totalItems
 * @returns {number}
 */
export function textBoxWidth(totalItems) {
    return ConfigUtility.calculateTextBoxWidth(totalItems);
}

/**
 * Visual zoom bucket for a story given its grid width and edge positions.
 * Stories that touch January or December get capped to 'small' to avoid
 * the zoom transform clipping at the roadmap edges.
 *
 * @param {number} width - Story width in grid units
 * @param {number|null} [startGrid] - Story start column
 * @param {number|null} [endGrid] - Story end column
 * @returns {ZoomLevel}
 */
export function zoomLevel(width, startGrid = null, endGrid = null) {
    return /** @type {ZoomLevel} */ (ConfigUtility.getZoomLevel(width, startGrid, endGrid));
}

/**
 * True if the IMO badge should sit below the story rather than to its right.
 * Either the story+badge would overflow the right edge, or the badge has too
 * many items to read horizontally.
 *
 * @param {number} storyWidth
 * @param {number} badgeWidth
 * @param {number} totalItems
 * @returns {boolean}
 */
export function shouldPlaceBadgeBelow(storyWidth, badgeWidth, totalItems) {
    return ConfigUtility.shouldPositionBelow(storyWidth, badgeWidth, totalItems);
}

/**
 * Convert a month name to its 0-indexed position in the year.
 * Re-exported here for callers thinking in grid terms.
 *
 * @param {string} name
 * @returns {number}
 */
export function monthToIndex(name) {
    return monthIndex(name);
}
