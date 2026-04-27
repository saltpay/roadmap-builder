// Click-to-edit story titles on the rendered roadmap.
//
// First v2 migration: the form's per-story Title input gets a direct-
// manipulation alternative on the rendered roadmap. Click a story bar's
// title to edit inline; Enter/blur commits, Esc reverts, empty rejects.
//
// During an edit we set the editing-lock on state so a concurrent re-render
// from elsewhere (debounced form change) doesn't blow away the contenteditable.
// On commit, we hand the new title + the originating story element back to
// the caller via onCommit; the caller is responsible for propagating the
// change into the form (and thus into the data model).

import { setEditingLock } from './state.js';

export function enableTitleEditing(rootEl, { onCommit } = {}) {
    rootEl.addEventListener('click', (e) => {
        const titleEl = e.target.closest('.task-title');
        if (!titleEl) return;
        const storyEl = titleEl.closest('.story-item, .ktlo-story');
        if (!storyEl) return;
        e.preventDefault();
        e.stopPropagation();
        beginEdit(titleEl, storyEl, onCommit);
    });
}

function beginEdit(titleEl, storyEl, onCommit) {
    if (titleEl.isContentEditable) return;

    const original = titleEl.textContent;
    titleEl.contentEditable = 'true';
    titleEl.spellcheck = true;
    titleEl.classList.add('inline-editing');
    setEditingLock(true);

    const range = document.createRange();
    range.selectNodeContents(titleEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    titleEl.focus();

    let committed = false;

    const commit = () => {
        if (committed) return;
        committed = true;
        const next = titleEl.textContent.trim();
        teardown();
        if (!next || next === original) {
            // Empty or unchanged: revert visually. Nothing to propagate.
            titleEl.textContent = original;
            return;
        }
        if (onCommit) {
            onCommit({ storyEl, nextTitle: next, originalTitle: original });
        }
        // The caller will trigger a form input event which flows through
        // collectFormData -> setState -> render, replacing this DOM. Until
        // then, leave the user-typed text on screen.
    };

    const cancel = () => {
        if (committed) return;
        committed = true;
        titleEl.textContent = original;
        teardown();
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    };

    const teardown = () => {
        titleEl.contentEditable = 'false';
        titleEl.classList.remove('inline-editing');
        titleEl.removeEventListener('keydown', onKeyDown);
        titleEl.removeEventListener('blur', commit);
        setEditingLock(false);
    };

    titleEl.addEventListener('keydown', onKeyDown);
    titleEl.addEventListener('blur', commit);
}
