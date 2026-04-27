// SPA router. Each route is { html, css, js }. The router fetches the markup,
// injects the CSS as a tagged <link>, dynamic-imports the module, and calls
// its exported init(root). On navigation, the previous view's CSS link is
// removed and the new view is mounted.
//
// View modules are imported once and cached by the browser; init(root) is
// re-invoked on every navigation back to that view, which is the view's
// responsibility to make idempotent (the auto-extracted Phase 2 modules do
// this by re-firing the legacy DOMContentLoaded handlers).

const ROUTES = {
    '/builder': {
        html: '/views/builder/builder.html',
        css: '/views/builder/builder.css',
        js: '/views/builder/builder.js',
    },
    '/imo-search': {
        html: '/views/imo-search/imo-search.html',
        css: '/views/imo-search/imo-search.css',
        js: '/views/imo-search/imo-search.js',
    },
    '/example': {
        html: '/views/example/example.html',
        css: '/views/example/example.css',
        js: '/views/example/example.js',
    },
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

function clearPreviousViewCss() {
    document.querySelectorAll('link[data-view-css]').forEach((el) => el.remove());
}

function injectViewCss(href, route) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-view-css', route);
    document.head.appendChild(link);
}

async function render() {
    const route = resolveRoute();
    const config = ROUTES[route];

    let html;
    try {
        const res = await fetch(config.html, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load ${config.html}: ${res.status}`);
        html = await res.text();
    } catch (err) {
        console.error(err);
        clearPreviousViewCss();
        main.innerHTML = `<div style="padding:24px">Failed to load view: ${err.message}</div>`;
        return;
    }

    // Hold off on tearing down the previous view's stylesheet until we have
    // the new markup ready - swapping earlier leaves the old DOM mounted
    // unstyled for one paint, which shows up as a flicker on tab switches.
    clearPreviousViewCss();
    injectViewCss(config.css, route);
    main.innerHTML = html;

    // Dynamic import is cached by the browser, so navigating back to the
    // same view doesn't re-evaluate the module. init(root) handles re-mount.
    let mod;
    try {
        mod = await import(config.js);
    } catch (err) {
        console.error(`Failed to load ${config.js}:`, err);
        main.innerHTML = `<div style="padding:24px">Failed to load view module: ${err.message}</div>`;
        return;
    }
    if (typeof mod.init === 'function') {
        try {
            mod.init(main);
        } catch (err) {
            console.error(`init() failed for ${route}:`, err);
        }
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

if (normalizePath(location.pathname) === '/') {
    history.replaceState({}, '', DEFAULT_ROUTE + location.search + location.hash);
}

window.__router = { navigate, routes: ROUTES };

render();
