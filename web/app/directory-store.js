// Shared directory store: owns the selected roadmap folder so both the Builder
// and the Cross-team Search view can read from a single source of truth.
//
// Supports two backends:
//   - Real FileSystemDirectoryHandle (Chromium, Edge) — persisted via IndexedDB
//     across reloads. Permission must be re-granted on each session, via user
//     gesture.
//   - Polyfill fallback for browsers without showDirectoryPicker (uses a hidden
//     <input type="file" webkitdirectory>). In-memory only, cannot persist.
(function () {
    const DB_NAME = 'roadmap-builder';
    const DB_VERSION = 1;
    const STORE = 'kv';
    const HANDLE_KEY = 'dirHandle';

    const listeners = new Set();
    let state = {
        handle: null,       // FileSystemDirectoryHandle | polyfill | null
        name: null,         // folder name (string)
        permission: 'prompt', // 'granted' | 'prompt' | 'denied'
        kind: null,         // 'native' | 'fallback'
    };

    const hasNativePicker = typeof window.showDirectoryPicker === 'function';

    // ---- IndexedDB helpers (small, promise-wrapped) ----------------------

    function openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function idbGet(key) {
        const db = await openDb();
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readonly');
                const req = tx.objectStore(STORE).get(key);
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror = () => reject(req.error);
            });
        } finally { db.close(); }
    }

    async function idbPut(key, value) {
        const db = await openDb();
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } finally { db.close(); }
    }

    async function idbDelete(key) {
        const db = await openDb();
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } finally { db.close(); }
    }

    // ---- State + notifications ------------------------------------------

    function snapshot() {
        return { handle: state.handle, name: state.name, permission: state.permission, kind: state.kind };
    }

    function setState(patch) {
        state = { ...state, ...patch };
        const snap = snapshot();
        for (const cb of listeners) {
            try { cb(snap); } catch (e) { console.error('AppDir subscriber failed', e); }
        }
    }

    // ---- Permission helpers ---------------------------------------------

    async function queryPermission(handle) {
        if (!handle || typeof handle.queryPermission !== 'function') return 'granted';
        try { return await handle.queryPermission({ mode: 'read' }); }
        catch { return 'prompt'; }
    }

    async function requestPermission(handle) {
        if (!handle || typeof handle.requestPermission !== 'function') return 'granted';
        try { return await handle.requestPermission({ mode: 'read' }); }
        catch { return 'denied'; }
    }

    // ---- Fallback polyfill (browsers without File System Access API) ----

    function polyfillHandleFromFiles(files) {
        if (!files || files.length === 0) return null;
        const name = files[0].webkitRelativePath?.split('/')[0] || 'selected folder';
        // Keep only top-level files to mirror non-recursive showDirectoryPicker behaviour.
        const topLevel = Array.from(files).filter(f => {
            const p = f.webkitRelativePath || f.name;
            return p.split('/').length === 2;
        });
        return {
            kind: 'directory',
            name,
            entries: async function* () {
                for (const file of topLevel) {
                    yield [file.name, {
                        kind: 'file',
                        name: file.name,
                        getFile: async () => file,
                    }];
                }
            },
        };
    }

    function openFallbackPicker() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.webkitdirectory = true;
            input.style.display = 'none';
            input.addEventListener('change', () => {
                const h = polyfillHandleFromFiles(input.files);
                input.remove();
                resolve(h);
            });
            input.addEventListener('cancel', () => { input.remove(); resolve(null); });
            document.body.appendChild(input);
            input.click();
        });
    }

    // ---- Public API -----------------------------------------------------

    async function select() {
        if (hasNativePicker) {
            try {
                const handle = await window.showDirectoryPicker();
                await idbPut(HANDLE_KEY, handle).catch(() => { /* persistence best-effort */ });
                setState({ handle, name: handle.name, permission: 'granted', kind: 'native' });
                return snapshot();
            } catch (err) {
                if (err && err.name === 'AbortError') return snapshot();
                console.warn('showDirectoryPicker failed, falling back', err);
            }
        }
        const fallback = await openFallbackPicker();
        if (fallback) setState({ handle: fallback, name: fallback.name, permission: 'granted', kind: 'fallback' });
        return snapshot();
    }

    // Request read permission on the current handle (must be called from a user gesture).
    async function requestAccess() {
        if (!state.handle || state.kind !== 'native') return snapshot();
        const perm = await requestPermission(state.handle);
        setState({ permission: perm });
        return snapshot();
    }

    async function clear() {
        await idbDelete(HANDLE_KEY).catch(() => { });
        setState({ handle: null, name: null, permission: 'prompt', kind: null });
    }

    function get() { return snapshot(); }

    function subscribe(cb) {
        listeners.add(cb);
        try { cb(snapshot()); } catch (e) { console.error(e); }
        return () => listeners.delete(cb);
    }

    // ---- Boot: restore from IndexedDB without triggering a prompt --------

    async function init() {
        if (!hasNativePicker) return; // fallback-only: nothing to restore
        let handle = null;
        try { handle = await idbGet(HANDLE_KEY); } catch { /* ignore */ }
        if (!handle) return;
        const perm = await queryPermission(handle);
        setState({ handle, name: handle.name, permission: perm, kind: 'native' });
    }

    window.AppDir = { select, requestAccess, clear, get, subscribe, hasNativePicker };
    init();
})();
