// Multi-entry "Info" section for stories. Each story can have any number of
// dated info entries (date + notes). Story-form variants live here; the
// Edit Story modal variants stay in builder.js because they share state
// with the modal-load flow (loadStoryData mutates a counter directly).
//
// addInfoEntry/removeInfoEntry are referenced from inline onclick attributes
// in dynamically-rendered HTML, so builder.js exposes them on window.

/**
 * @param {object} deps
 * @param {() => string} deps.getToday  Returns today's date in DD/MM/YY.
 * @param {() => void} deps.onChange    Called whenever a date or notes input
 *                                       changes (to refresh the preview).
 */
export function createInfoEntryHandlers({ getToday, onChange }) {
    function infoEntryHtml(entryId, entryNumber, dateValue = '', notesValue = '') {
        return `
            <div id="${entryId}" class="info-entry" style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong>Info Entry #${entryNumber}</strong>
                    <button type="button" onclick="removeInfoEntry('${entryId}')" style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 2px 6px; cursor: pointer; font-size: 12px;">Remove</button>
                </div>
                <div class="inline-group">
                    <div class="form-group">
                        <label for="info-date-${entryId}">Info Date:</label>
                        <input type="text" id="info-date-${entryId}" placeholder="15/01 or 15/01/25 or 15-01-2025" value="${dateValue}">
                    </div>
                    <div class="form-group">
                        <label for="info-notes-${entryId}">Information Details:</label>
                        <textarea id="info-notes-${entryId}" placeholder="Additional information about this story (multiple lines supported)" rows="3" style="height: 60px;">${notesValue}</textarea>
                    </div>
                </div>
            </div>
        `;
    }

    function attachAutoUpdateListeners(entryId) {
        const dateInput = document.getElementById(`info-date-${entryId}`);
        const notesInput = document.getElementById(`info-notes-${entryId}`);
        if (dateInput) dateInput.addEventListener('input', onChange);
        if (notesInput) notesInput.addEventListener('input', onChange);
    }

    function addInfoEntry(storyId) {
        const container = document.getElementById(`info-entries-${storyId}`);
        const entryId = `info-entry-${storyId}-${Date.now()}`;
        const entryNumber = container.querySelectorAll('.info-entry').length + 1;

        container.insertAdjacentHTML('beforeend', infoEntryHtml(entryId, entryNumber));

        const dateField = document.getElementById(`info-date-${entryId}`);
        if (dateField) {
            dateField.value = getToday();
            dateField.focus({ preventScroll: true });
        }
        attachAutoUpdateListeners(entryId);
    }

    function removeInfoEntry(entryId) {
        const entry = document.getElementById(entryId);
        if (!entry) return;
        entry.remove();

        // Renumber the remaining entries so #1, #2, #3... stay contiguous.
        const storyId = entryId.split('-')[2];
        const container = document.getElementById(`info-entries-${storyId}`);
        if (container) {
            container.querySelectorAll('.info-entry').forEach((el, index) => {
                const header = el.querySelector('strong');
                if (header) header.textContent = `Info Entry #${index + 1}`;
            });
        }
        onChange();
    }

    /**
     * Migrate a story from the legacy single-info storage (one date + notes
     * pair on the story root) to the multi-entry container. No-op if the
     * story already has any entries or has no legacy data.
     */
    function convertSingleInfoToMultiple(storyId) {
        const container = document.getElementById(`info-entries-${storyId}`);
        if (!container) return;
        if (container.querySelectorAll('.info-entry').length > 0) return; // already converted

        const oldDateEl = document.getElementById(`info-date-${storyId}`);
        const oldNotesEl = document.getElementById(`info-notes-${storyId}`);
        if (!oldDateEl || !oldNotesEl) return;
        if (!oldDateEl.value && !oldNotesEl.value) return;

        const entryId = `info-entry-${storyId}-${Date.now()}`;
        // First and only entry being seeded from legacy data, so number is 1.
        container.insertAdjacentHTML(
            'beforeend',
            infoEntryHtml(entryId, 1, oldDateEl.value, oldNotesEl.value)
        );
        attachAutoUpdateListeners(entryId);

        oldDateEl.value = '';
        oldNotesEl.value = '';
    }

    return { addInfoEntry, removeInfoEntry, convertSingleInfoToMultiple };
}
