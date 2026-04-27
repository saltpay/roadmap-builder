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
        handle: null,       // FileSystemDirectoryHandle | FileSystemFileHandle | polyfill | null
        name: null,         // folder/file name (string)
        permission: 'prompt', // 'granted' | 'prompt' | 'denied'
        kind: null,         // 'native' | 'fallback'
        type: null,         // 'folder' | 'file'
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
        return {
            handle: state.handle,
            name: state.name,
            permission: state.permission,
            kind: state.kind,
            type: state.type,
        };
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
    //
    // Browsers that don't support showDirectoryPicker (Safari, Firefox) can't
    // give us a writable handle - and webkitdirectory only gives us File
    // objects with no absolute path, so we can't tell the server where to
    // save either. Instead we route through the local Node server, which
    // shells out to a native OS folder picker (POSIX path included). The
    // synthesised "handle" then proxies entries() to GET /api/list-folder
    // and getFile() to GET /api/file?name=<name>. Save lives on the same
    // server-stored directory via POST /api/save.

    async function fetchJson(input, init) {
        const res = await fetch(input, init);
        if (!res.ok) {
            const detail = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(detail.error ?? `HTTP ${res.status}`);
        }
        return res.json();
    }

    // The server is stateless - the picked path is sent on every later
    // request and the server just acts on it. Browser CSRF protection
    // (no Allow-Origin on /api/* responses) keeps cross-origin pages from
    // calling these endpoints.
    function makeServerBackedHandle({ path, name }) {
        return {
            kind: 'directory',
            name,
            __serverBacked: true,
            __path: path,
            entries: async function* () {
                const params = new URLSearchParams({ path });
                const data = await fetchJson(`/api/list-folder?${params}`);
                for (const f of data.files ?? []) {
                    yield [f.name, {
                        kind: 'file',
                        name: f.name,
                        getFile: async () => {
                            const fp = new URLSearchParams({ path, name: f.name });
                            const res = await fetch(`/api/file?${fp}`);
                            if (!res.ok) {
                                const detail = await res.json().catch(() => ({ error: res.statusText }));
                                throw new Error(detail.error ?? `HTTP ${res.status}`);
                            }
                            const text = await res.text();
                            return {
                                name: f.name,
                                size: f.size,
                                lastModified: f.lastModified,
                                text: async () => text,
                            };
                        },
                    }];
                }
            },
        };
    }

    async function openFallbackPicker() {
        try {
            const data = await fetchJson('/api/select-folder', { method: 'POST' });
            if (!data.ok || data.cancelled) return null;
            return makeServerBackedHandle({ path: data.path, name: data.name });
        } catch (err) {
            console.error('select-folder failed:', err);
            alert(`Could not pick folder: ${err.message}`);
            return null;
        }
    }

    // ---- Public API -----------------------------------------------------

    async function select() {
        if (hasNativePicker) {
            try {
                const handle = await window.showDirectoryPicker();
                await idbPut(HANDLE_KEY, handle).catch(() => { /* persistence best-effort */ });
                setState({
                    handle, name: handle.name, permission: 'granted',
                    kind: 'native', type: 'folder',
                });
                return snapshot();
            } catch (err) {
                if (err && err.name === 'AbortError') return snapshot();
                console.warn('showDirectoryPicker failed, falling back', err);
            }
        }
        const fallback = await openFallbackPicker();
        if (fallback) {
            setState({
                handle: fallback, name: fallback.name, permission: 'granted',
                kind: 'fallback', type: 'folder',
            });
        }
        return snapshot();
    }

    // Pick a single .json file. On Chromium uses showOpenFilePicker which
    // returns a writable file handle; on other browsers shells through the
    // server's native picker (POST /api/select-file) and stores the path
    // on the server side. Returns { content, name, fileHandle? } so the
    // caller can populate the editor without an extra read.
    async function selectFile() {
        const hasNativeFilePicker = typeof window.showOpenFilePicker === 'function';
        if (hasNativeFilePicker) {
            try {
                const [fh] = await window.showOpenFilePicker({
                    multiple: false,
                    types: [{ description: 'Roadmap JSON', accept: { 'application/json': ['.json'] } }],
                });
                const file = await fh.getFile();
                const content = await file.text();
                setState({
                    handle: fh, name: file.name, permission: 'granted',
                    kind: 'native', type: 'file',
                });
                // Native single-file mode: stop persisting the prior folder
                // handle so reload doesn't restore stale folder state. Best
                // effort - we don't await.
                idbDelete(HANDLE_KEY).catch(() => {});
                return { content, name: file.name, fileHandle: fh };
            } catch (err) {
                if (err && err.name === 'AbortError') return null;
                console.warn('showOpenFilePicker failed, falling back', err);
            }
        }
        // Server-side picker (Safari/Firefox).
        try {
            const res = await fetch('/api/select-file', { method: 'POST' });
            if (!res.ok) {
                const detail = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(detail.error ?? `HTTP ${res.status}`);
            }
            const data = await res.json();
            if (!data.ok) return null; // user cancelled
            // Server is stateless: the absolute path is the only thing
            // we need to pass back on save.
            const handle = {
                __serverFile: true,
                __path: data.path,
                name: data.name,
                kind: 'file',
            };
            setState({
                handle, name: data.name, permission: 'granted',
                kind: 'fallback', type: 'file',
            });
            return { content: data.content, name: data.name, fileHandle: null };
        } catch (err) {
            console.error('select-file failed:', err);
            alert(`Could not pick file: ${err.message}`);
            return null;
        }
    }

    // True when the current selection writes via POST /api/save (rather than
    // a writable browser handle). Covers both server-backed folder and
    // server-backed single-file modes.
    function isServerBacked() {
        if (state.kind !== 'fallback' || !state.handle) return false;
        return state.handle.__serverBacked === true || state.handle.__serverFile === true;
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
        setState({ handle: null, name: null, permission: 'prompt', kind: null, type: null });
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
        setState({ handle, name: handle.name, permission: perm, kind: 'native', type: 'folder' });
    }

    window.AppDir = {
        select, selectFile, requestAccess, clear, get, subscribe,
        hasNativePicker, isServerBacked,
    };
    init();
})();
