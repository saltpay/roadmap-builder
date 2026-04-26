(function () {
    const ROUTES = {
        '/builder': '/views/builder.html',
        '/imo-search': '/views/imo-search.html',
        '/example': '/views/example.html',
    };
    const DEFAULT_ROUTE = '/builder';

    const main = document.getElementById('app');

    function normalizePath(path) {
        const cleaned = path.replace(/\/+$/, '');
        return cleaned === '' ? '/' : cleaned;
    }

    function resolveRoute() {
        const path = normalizePath(location.pathname);
        if (path === '/' || !ROUTES[path]) return DEFAULT_ROUTE;
        return path;
    }

    function clearPreviousView() {
        document.querySelectorAll('style[data-view-style]').forEach(el => el.remove());
        document.querySelectorAll('script[data-view-script]').forEach(el => el.remove());
    }

    function extractFnDeclarations(source) {
        const fnRegex = /^[\s]*(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
        const names = new Set();
        let match;
        while ((match = fnRegex.exec(source)) !== null) names.add(match[1]);
        return [...names];
    }

    function buildViewIIFE(source) {
        const fnNames = extractFnDeclarations(source);
        const exposure = fnNames.map(n => `try { window.${n} = ${n}; } catch (_) {}`).join('\n');
        // Exposure must live INSIDE the try block: function declarations
        // inside a block are block-scoped in modern engines, so if we exposed
        // them after the try they wouldn't be in scope and window.* would
        // silently stay undefined (breaking inline onclick handlers).
        return `(function () {
            const __viewReady = [];
            const __origAdd = document.addEventListener.bind(document);
            document.addEventListener = function (type, listener, opts) {
                if (type === 'DOMContentLoaded') { __viewReady.push(listener); return; }
                return __origAdd(type, listener, opts);
            };
            try {
                ${source}
                ${exposure}
            } finally {
                document.addEventListener = __origAdd;
            }
            for (const __fn of __viewReady) {
                try { __fn.call(document, new Event('DOMContentLoaded')); } catch (e) { console.error(e); }
            }
        })();`;
    }

    async function render() {
        const route = resolveRoute();
        const src = ROUTES[route];

        let text;
        try {
            const res = await fetch(src, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to load view ${src}: ${res.status}`);
            text = await res.text();
        } catch (err) {
            console.error(err);
            clearPreviousView();
            main.innerHTML = `<div style="padding:24px">Failed to load view: ${err.message}</div>`;
            return;
        }

        const doc = new DOMParser().parseFromString(text, 'text/html');

        // Tear down the previous view only once we have the new markup ready - tearing
        // down before the fetch resolves leaves the old DOM mounted without its styles
        // for one paint, which shows up as a flicker when switching tabs.
        clearPreviousView();

        // Inject view-specific <style> into <head>, tagged for cleanup on next nav.
        doc.querySelectorAll('style').forEach(s => {
            const style = document.createElement('style');
            style.setAttribute('data-view-style', route);
            style.textContent = s.textContent;
            document.head.appendChild(style);
        });

        // Collect inline + external scripts, then strip them before injecting markup.
        const inlineSources = [];
        const externalSrcs = [];
        doc.querySelectorAll('script').forEach(s => {
            if (s.src) externalSrcs.push(s.src);
            else inlineSources.push(s.textContent);
        });
        doc.querySelectorAll('script, style').forEach(s => s.remove());

        // Inject body markup.
        main.innerHTML = doc.body ? doc.body.innerHTML : text;

        // Load any external scripts the view depends on that aren't already loaded.
        for (const raw of externalSrcs) {
            const url = new URL(raw, location.href).href;
            if (document.querySelector(`script[data-ext-src="${url}"]`)) continue;
            await new Promise((resolve, reject) => {
                const el = document.createElement('script');
                el.src = raw;
                el.setAttribute('data-ext-src', url);
                el.onload = resolve;
                el.onerror = () => reject(new Error(`Failed to load ${raw}`));
                document.head.appendChild(el);
            });
        }

        // Execute combined inline scripts in an IIFE to isolate top-level const/let
        // across re-navigations, while exposing function declarations to window
        // so inline onclick/onchange handlers keep working.
        if (inlineSources.length) {
            const wrapped = buildViewIIFE(inlineSources.join('\n;\n'));
            const scriptEl = document.createElement('script');
            scriptEl.setAttribute('data-view-script', route);
            scriptEl.textContent = wrapped;
            document.body.appendChild(scriptEl);
        }

        if (window.__updateNav) window.__updateNav(route);
        window.scrollTo(0, 0);
    }

    function navigate(target, { replace = false } = {}) {
        const url = new URL(target, location.origin);
        if (url.origin !== location.origin) {
            location.href = target;
            return;
        }
        const here = location.pathname + location.search + location.hash;
        const there = url.pathname + url.search + url.hash;
        if (here === there) return;
        if (replace) history.replaceState({}, '', url);
        else history.pushState({}, '', url);
        render();
    }

    window.addEventListener('popstate', render);

    // Intercept clicks on same-origin links that resolve to a known SPA route.
    document.addEventListener('click', (e) => {
        if (e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = e.target.closest && e.target.closest('a');
        if (!a) return;
        if (a.target && a.target !== '' && a.target !== '_self') return;
        if (a.hasAttribute('download')) return;
        const href = a.getAttribute('href');
        if (!href) return;
        const url = new URL(href, location.href);
        if (url.origin !== location.origin) return;
        const path = normalizePath(url.pathname);
        if (!ROUTES[path] && path !== '/') return;
        e.preventDefault();
        navigate(url.pathname + url.search + url.hash);
    });

    // Rewrite the URL if the user lands on / so the active nav highlight matches.
    if (normalizePath(location.pathname) === '/') {
        history.replaceState({}, '', DEFAULT_ROUTE + location.search + location.hash);
    }

    window.__router = { navigate, routes: ROUTES };

    render();
})();
