// Transient toast notifications. Used for ephemeral confirmations after
// toggles like KTLO position swap or story-sort enable. The toast lives 2s
// and fades in/out via a @keyframes rule injected on first call.

const STYLE_ID = 'builder-toast-style';
const TOAST_DURATION_MS = 2000;

function ensureKeyframesInjected() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(-10px); }
            20% { opacity: 1; transform: translateY(0); }
            80% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-10px); }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Show a 2s toast pinned to the top-right of the viewport.
 *
 * @param {string} message - Plain text or HTML.
 * @param {object} [opts]
 * @param {string} [opts.color] - Background color. Defaults to #28a745 (green).
 * @param {number} [opts.topOffset] - Top offset in px. Defaults to 20.
 */
export function showToast(message, opts = {}) {
    ensureKeyframesInjected();
    const { color = '#28a745', topOffset = 20 } = opts;

    const toast = document.createElement('div');
    toast.innerHTML = message;
    toast.style.cssText = `
        position: fixed;
        top: ${topOffset}px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        font-weight: bold;
        z-index: 10000;
        animation: fadeInOut ${TOAST_DURATION_MS}ms ease-in-out;
    `;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), TOAST_DURATION_MS);
}
