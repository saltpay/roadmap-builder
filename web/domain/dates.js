// Pure date helpers used across the app. Delegates to DateUtility for now;
// Phase 3 will likely fold DateUtility into this module entirely.

import { DateUtility } from '../utilities/date-utility.js';

/** @type {readonly string[]} */
export const MONTH_SHORT = Object.freeze([
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]);

/** @type {readonly string[]} */
export const MONTH_LONG = Object.freeze([
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]);

/**
 * Today's date in European DD/MM/YY format.
 * @returns {string}
 */
export function todayEuropean() {
    return DateUtility.getTodaysDateEuropean();
}

/**
 * Normalize an arbitrary European date string (DD/MM/YY, DD-MM-YYYY, etc.)
 * to canonical DD/MM/YY. Returns the original string if it can't be parsed.
 *
 * @param {string} dateStr
 * @param {number|null} [roadmapYear]
 * @returns {string}
 */
export function formatEuropean(dateStr, roadmapYear = null) {
    return DateUtility.formatDateEuropean(dateStr, roadmapYear);
}

/**
 * Convert a European-format date to ISO (YYYY-MM-DD).
 * Auto-corrects obvious day/month swaps (e.g. 13/05 stays, 05/13 -> 13/05).
 *
 * @param {string} dateStr
 * @param {number|null} [roadmapYear]
 * @returns {string}
 */
export function europeanToIso(dateStr, roadmapYear = null) {
    return DateUtility.convertEuropeanToISO(dateStr, roadmapYear);
}

/**
 * Parse a European DD/MM/YY[YY] date into a Date for comparison.
 * Returns Date(0) for empty input so empty strings sort earliest.
 *
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseEuropean(dateStr) {
    return DateUtility.parseEuropeanDateForTimeline(dateStr);
}

/**
 * True if `dateStr` matches the European date shape (with or without year).
 * @param {string} dateStr
 * @returns {boolean}
 */
export function looksEuropean(dateStr) {
    return typeof dateStr === 'string' && DateUtility.EUROPEAN_DATE_REGEX.test(dateStr);
}

/**
 * True if `dateStr` is in ISO YYYY-MM-DD shape.
 * @param {string} dateStr
 * @returns {boolean}
 */
export function looksIso(dateStr) {
    return typeof dateStr === 'string' && DateUtility.ISO_DATE_REGEX.test(dateStr);
}

/**
 * Index 0-11 for a month name (short or long, case-insensitive).
 * Returns -1 if not recognized.
 *
 * @param {string} name
 * @returns {number}
 */
export function monthIndex(name) {
    if (!name || typeof name !== 'string') return -1;
    const upper = name.toUpperCase();
    const short = MONTH_SHORT.indexOf(upper);
    if (short !== -1) return short;
    return MONTH_LONG.indexOf(upper);
}
