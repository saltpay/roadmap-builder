// In-memory store for the loaded roadmap teamData.
//
// v2 single source of truth. Editing surfaces (the legacy form, the new
// inline-edit on the rendered roadmap) call mutate(fn) to update the data,
// and subscribers (render, save status indicator) react to the new state.
//
// While an inline edit is in progress, render is suppressed via the
// editing-lock so the active <input>/contenteditable doesn't get blown
// away by a re-render triggered from elsewhere.

let state = null;
let editingLock = false;
const subscribers = new Set();

export function getState() {
    return state;
}

export function setState(newState) {
    state = newState;
    notify('replace');
}

// Apply a mutation function to the current state in place. The function
// receives the live state object and may mutate it directly. Subscribers
// are notified afterwards. Render subscribers must check the editing-lock
// themselves to avoid clobbering an in-progress inline edit.
export function mutate(fn) {
    if (state == null) return;
    fn(state);
    notify('mutate');
}

export function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}

export function setEditingLock(locked) {
    editingLock = locked;
}

export function isEditingLocked() {
    return editingLock;
}

function notify(kind) {
    for (const fn of subscribers) {
        try {
            fn(state, kind);
        } catch (err) {
            console.error('state subscriber error:', err);
        }
    }
}
