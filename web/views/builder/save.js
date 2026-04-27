// Manual save: writes the current state back to the JSON file in place.
// Triggered explicitly by the user clicking the Save button - no auto-save.
//
// Save requires a folder/file selection (via the top-nav Load roadmaps
// button, stored on window.AppDir). Without one, save() refuses and the
// UI is expected to keep the Save button disabled.
//
// Three write paths, in order:
//   1. Existing writable file handle (the one we got back when the user
//      opened a file via the file-browser side panel on Chromium). Silent
//      write in place.
//   2. AppDir directory handle (Chromium): synthesise a writable file handle
//      via dirHandle.getFileHandle(filename, {create:true}) and write. This
//      covers new-roadmap and drag-drop cases where we have a folder but
//      no per-file handle.
//   3. Server endpoint POST /api/save (Safari, Firefox, or whenever the
//      browser sandbox can't open a writable handle at all). The server
//      is stateless - we send the absolute path from AppDir's server-
//      backed handle and the server writes there. CSRF is prevented by
//      the server not setting Allow-Origin on /api/* responses, so cross-
//      origin browser fetches die on preflight.

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
// We always return true while a file handle is held because that always
// has a backing folder (the user picked one to get the handle in the first
// place). For other cases, require a directory handle.
export function canSave() {
    if (fileHandle && typeof fileHandle.createWritable === 'function') return true;
    if (dirHandle) return true;
    return false;
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
 *                  inside the AppDir folder) and for path 3 (server write).
 */
export async function save({ suggestedName }) {
    if (saving) return;
    const state = getState();
    if (!state) return;

    if (!canSave()) {
        lastErrorMessage = 'pick a folder via "Load roadmaps" first';
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

        // Path 1: existing writable file handle (Chromium, file already opened).
        if (fileHandle && typeof fileHandle.createWritable === 'function') {
            const writable = await fileHandle.createWritable();
            await writable.write(json);
            await writable.close();
            setStatus('saved');
            return;
        }
        // Stale handle (e.g. polyfill, no createWritable): drop it.
        fileHandle = null;

        // Path 2: AppDir directory handle, native side. Synthesise a writable
        // file handle for `suggestedName` inside the picked folder.
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

        // Path 3: server-side write. Server is stateless; we send the
        // absolute path from AppDir's handle plus either an isFile flag
        // (single-file mode: write to that exact path) or a filename
        // (folder mode: write inside that directory).
        const snap = window.AppDir && typeof window.AppDir.get === 'function'
            ? window.AppDir.get() : null;
        const handle = snap && snap.handle;
        const path = handle && handle.__path;
        if (!path) {
            throw new Error('selection lost: pick a folder or file again');
        }
        const body = { path, content: json };
        if (handle.__serverFile) body.isFile = true;
        else body.filename = suggestedName;

        const res = await fetch('/api/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Required by the server's CSRF check. See server.mjs.
                'X-Roadmap-CSRF': '1',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const detail = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(detail.error ?? `HTTP ${res.status}`);
        }
        setStatus('saved');
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
