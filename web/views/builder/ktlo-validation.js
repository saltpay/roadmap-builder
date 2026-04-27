// KTLO percentage input validation. The KTLO percentage represents what
// fraction of a team's time is going to keep-the-lights-on work; it must
// be either blank or a multiple of 5 in [0, 100]. We surface invalid values
// immediately on `input` and refuse to let the user leave the field on `blur`.

const VALID_KTLO_INPUT_IDS = [
    'ktlo-current-percentage',
    'edit-ktlo-current-percentage',
    'editMonthlyKTLOPercentage',
];

const ERROR_MESSAGE = 'Value must be blank or a multiple of 5 between 0 and 100';

/**
 * @param {string|number|null|undefined} value
 * @returns {boolean} true if the value is acceptable.
 */
export function validateKTLOPercentage(value) {
    if (value === '' || value === null || value === undefined) return true;
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    if (num < 0 || num > 100) return false;
    return num % 5 === 0;
}

export function showKTLOValidationError(inputElement, message = ERROR_MESSAGE) {
    inputElement.classList.add('ktlo-percentage-error');
    removeKTLOValidationError(inputElement);

    const errorSpan = document.createElement('span');
    errorSpan.className = 'ktlo-percentage-error-message';
    errorSpan.textContent = message;
    inputElement.parentNode.appendChild(errorSpan);
}

export function removeKTLOValidationError(inputElement) {
    inputElement.classList.remove('ktlo-percentage-error');
    const errorMessage = inputElement.parentNode.querySelector('.ktlo-percentage-error-message');
    if (errorMessage) errorMessage.remove();
}

/**
 * blur/input event handler suitable for binding to the KTLO percentage inputs.
 */
export function handleKTLOPercentageValidation(event) {
    const inputElement = event.target;
    const value = inputElement.value.trim();

    if (validateKTLOPercentage(value)) {
        removeKTLOValidationError(inputElement);
        return true;
    }

    showKTLOValidationError(inputElement);

    // On blur, refocus the field so the user can't leave invalid data behind.
    // We defer the focus a tick so the browser commits the blur first.
    if (event.type === 'blur') {
        event.preventDefault();
        setTimeout(() => inputElement.focus(), 100);
    }
    return false;
}

/**
 * Wire blur+input listeners on every KTLO percentage input that exists in
 * the current DOM. Safe to call multiple times - addEventListener with the
 * same handler reference is a no-op so listeners don't accumulate.
 */
export function initializeKTLOValidation() {
    for (const id of VALID_KTLO_INPUT_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.addEventListener('blur', handleKTLOPercentageValidation);
        el.addEventListener('input', handleKTLOPercentageValidation);
    }
}
