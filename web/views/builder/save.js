// Manual save: writes the current state back to the JSON file in place.
// Triggered explicitly by the user clicking the Save button - no auto-save.
//
// Save requires a writable file/folder handle from the File System Access
// API (Chromium-only). Without one, save() refuses and the UI keeps the
// Save button disabled.
//
// Two write paths, in order:
//   1. Existing writable file handle (from showOpenFilePicker, the
//      file-browser side panel, or the new-roadmap "Save As" dialog).
//      Silent write in place.
//   2. AppDir directory handle: synthesise a writable file handle via
//      dirHandle.getFileHandle(filename, {create:true}) and write. Covers
//      the new-roadmap and drag-drop cases where we have a folder but no
//      per-file handle.

import { getState } from './state.js';

let fileHandle = null;
let dirHandle = null;
let dirKind = null; // 'native' | 'fallback' | null
const dirSubscribers = new Set();
let statusEl = null;
let saving = false;
let lastErrorMessage = '';

export function init({ statusElement }) {
    statusEl = statusElement;
    setStatus(fileHandle ? 'saved' : 'idle');
    subscribeToAppDir();
}

// Subscribe to the AppDir store once, so dirHandle/dirKind track the
// user's folder selection. AppDir.subscribe is idempotent enough that a
// repeat subscription on view re-mount is fine.
let appDirSubscribed = false;
function subscribeToAppDir() {
    if (appDirSubscribed) return;
    if (!window.AppDir) return; // not loaded yet; ignore (init() runs late enough that this is unusual)
    appDirSubscribed = true;
    window.AppDir.subscribe((snap) => {
        const isUsable = snap && snap.handle && snap.permission !== 'denied';
        dirHandle = isUsable ? snap.handle : null;
        dirKind = isUsable ? snap.kind : null;
        // Reflect availability to subscribers (the UI uses this to enable/disable Save).
        for (const cb of dirSubscribers) {
            try { cb(canSave()); } catch (e) { console.error(e); }
        }
    });
}

// True when at least one save path is viable. The save() call enforces
// this too, but the UI uses it to disable the button.
//
// We always return true while a writable file handle is held because that
// has a backing folder (the user picked one to get the handle in the first
// place). For other cases, require a writable native directory handle.
export function canSave() {
    if (fileHandle && typeof fileHandle.createWritable === 'function') return true;
    if (dirHandle && dirKind === 'native' && typeof dirHandle.getFileHandle === 'function') return true;
    return false;
}

// True when this browser can save edits back to disk at all (= has the
// File System Access API). When false the UI should communicate that
// saving is unsupported instead of prompting the user to pick a folder.
export function canSaveInBrowser() {
    return Boolean(window.AppDir && window.AppDir.canSaveInBrowser);
}

// Subscribe to canSave() changes. Fires immediately with the current value
// so callers can sync their UI without an extra read.
export function onSaveAvailabilityChange(cb) {
    dirSubscribers.add(cb);
    try { cb(canSave()); } catch (e) { console.error(e); }
    return () => dirSubscribers.delete(cb);
}

export function setFileHandle(handle) {
    fileHandle = handle;
    setStatus(handle ? 'saved' : 'idle');
}

export function getFileHandle() {
    return fileHandle;
}

export function getLastError() {
    return lastErrorMessage;
}

/**
 * Save the current state.
 *
 * @param {{ suggestedName: string }} options
 *   suggestedName: filename (no path) used for path 2 (creating a file
 *                  inside the AppDir folder).
 */
export async function save({ suggestedName }) {
    if (saving) return;
    const state = getState();
    if (!state) return;

    if (!canSave()) {
        lastErrorMessage = canSaveInBrowser()
            ? 'pick a folder via "Load roadmaps" first'
            : 'this browser cannot save back to disk; use Chrome or Edge';
        setStatus('error');
        return;
    }

    saving = true;
    setStatus('saving');
    lastErrorMessage = '';
    try {
        const json = JSON.stringify({
            version: '1.0',
            created: new Date().toISOString(),
            teamData: state,
        }, null, 2);

        // Path 1: existing writable file handle.
        if (fileHandle && typeof fileHandle.createWritable === 'function') {
            const writable = await fileHandle.createWritable();
            await writable.write(json);
            await writable.close();
            setStatus('saved');
            return;
        }
        // Stale handle: drop it.
        fileHandle = null;

        // Path 2: AppDir directory handle. Synthesise a writable file handle
        // for `suggestedName` inside the picked folder.
        if (dirHandle && dirKind === 'native' && typeof dirHandle.getFileHandle === 'function') {
            const fh = await dirHandle.getFileHandle(suggestedName, { create: true });
            const writable = await fh.createWritable();
            await writable.write(json);
            await writable.close();
            // Keep the handle around so subsequent saves take path 1 directly.
            fileHandle = fh;
            setStatus('saved');
            return;
        }

        throw new Error('no writable handle available');
    } catch (err) {
        if (err && err.name === 'AbortError') {
            setStatus(fileHandle ? 'saved' : 'idle');
            return;
        }
        console.error('save failed:', err);
        lastErrorMessage = err && err.message ? err.message : String(err);
        setStatus('error');
    } finally {
        saving = false;
    }
}

function setStatus(kind) {
    if (statusEl) {
        // 'saved' is communicated by the button animation + confetti, not text.
        const messages = {
            idle: '',
            saving: 'Saving...',
            saved: '',
            error: lastErrorMessage ? `Save failed: ${lastErrorMessage}` : 'Save failed',
        };
        statusEl.dataset.status = kind;
        statusEl.textContent = messages[kind] ?? '';
        statusEl.title = kind === 'error' && lastErrorMessage ? lastErrorMessage : '';
    }
    if (kind === 'saved') {
        // Fire after the current call so listeners can read DOM positions
        // (button rect for confetti origin) without timing fragility.
        document.dispatchEvent(new CustomEvent('roadmap:saved'));
    }
}
