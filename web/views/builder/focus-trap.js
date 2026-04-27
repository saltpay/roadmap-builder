// Modal keyboard handling: Tab cycles focus through visible elements,
// Shift+Tab cycles backwards, Escape calls a per-modal close function.
// The previous module-level `modalFocusTrap` variable is now internal,
// so callers don't have to capture and forward the handle.

const FOCUSABLE_SELECTORS = [
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'a[href]:not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

function visibleFocusable(modal) {
    return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTORS)).filter((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0 &&
            !el.closest('[style*="display: none"]') &&
            !el.closest('[style*="display:none"]')
        );
    });
}

/**
 * @param {{ closeFns: Record<string, () => void> }} deps
 *        Map of modal id -> close function. Escape inside a modal looks up
 *        the matching close fn and invokes it.
 */
export function createModalFocusTrap({ closeFns }) {
    /** @type {{ modal: Element, listener: (e: KeyboardEvent) => void } | null} */
    let active = null;

    function setupModalFocusTrap(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        // If a previous trap is still installed (modal opened twice without
        // closing), tear it down first to avoid stacking listeners.
        removeModalFocusTrap();

        const listener = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                const closeFn = closeFns[modalId];
                if (closeFn) closeFn();
                return;
            }
            if (e.key !== 'Tab') return;

            const focusables = visibleFocusable(modal);
            if (focusables.length === 0) return;

            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        modal.addEventListener('keydown', listener);
        active = { modal, listener };
    }

    function removeModalFocusTrap() {
        if (!active) return;
        active.modal.removeEventListener('keydown', active.listener);
        active = null;
    }

    return { setupModalFocusTrap, removeModalFocusTrap };
}
