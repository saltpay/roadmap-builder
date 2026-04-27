(function () {
    const LINKS = [
        { path: '/builder', label: 'Builder' },
        { path: '/imo-search', label: 'Cross-team Search' },
    ];

    const nav = document.getElementById('appNav');
    if (!nav) return;

    nav.innerHTML = `
        <div class="app-nav__top">
            <a href="/builder" class="app-nav__brand" data-spa-link>🗺️ Roadmap</a>
        </div>
        <div class="app-nav__bottom">
            <div class="app-nav__links">
                ${LINKS.map(l => `<a href="${l.path}" class="app-nav__link" data-spa-link>${l.label}</a>`).join('')}
            </div>
            <div class="app-nav__folder-wrap" style="position: relative;">
                <button type="button" id="appNavFolder" class="app-nav__folder" title="Open a roadmap file or folder"></button>
                <div id="appNavFolderMenu" class="app-nav__folder-menu">
                    <button type="button" data-pick="file" class="app-nav__folder-menu-item">📄 Open a single file...</button>
                    <button type="button" data-pick="folder" class="app-nav__folder-menu-item">📂 Open a folder...</button>
                </div>
            </div>
        </div>
    `;

    const folderBtn = nav.querySelector('#appNavFolder');
    const menuEl = nav.querySelector('#appNavFolderMenu');

    function updateActive(path) {
        nav.querySelectorAll('.app-nav__link').forEach(a => {
            if (a.getAttribute('href') === path) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
    }

    function renderFolder(snap) {
        if (!snap || !snap.handle) {
            folderBtn.textContent = '📂 Select folder';
            folderBtn.dataset.state = 'empty';
        } else if (snap.permission === 'granted') {
            const icon = snap.type === 'file' ? '📄' : '📂';
            folderBtn.textContent = `${icon} ${snap.name}`;
            folderBtn.dataset.state = 'granted';
        } else {
            folderBtn.textContent = `🔓 Unlock ${snap.name}`;
            folderBtn.dataset.state = 'prompt';
        }
    }

    function openMenu() {
        menuEl.classList.add('is-open');
        // Dismiss on outside click. Defer the listener so the click that
        // opened the menu doesn't immediately close it.
        setTimeout(() => {
            document.addEventListener('click', onOutside, { once: true });
        }, 0);
    }
    function closeMenu() {
        menuEl.classList.remove('is-open');
    }
    function isMenuOpen() {
        return menuEl.classList.contains('is-open');
    }
    function onOutside(e) {
        if (menuEl.contains(e.target) || folderBtn.contains(e.target)) {
            // Re-arm the outside listener since this click was inside.
            setTimeout(() => {
                document.addEventListener('click', onOutside, { once: true });
            }, 0);
            return;
        }
        closeMenu();
    }

    folderBtn.addEventListener('click', async () => {
        const snap = window.AppDir.get();
        // If we already have a granted native folder handle that's just
        // pending re-permission, skip the menu and re-request access.
        if (snap.handle && snap.permission !== 'granted' && snap.kind === 'native') {
            const after = await window.AppDir.requestAccess();
            if (after.permission === 'granted') return;
            // Permission denied/dismissed - fall through to the menu.
        }
        if (isMenuOpen()) closeMenu();
        else openMenu();
    });

    menuEl.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-pick]');
        if (!btn) return;
        closeMenu();
        const choice = btn.dataset.pick;
        if (choice === 'folder') {
            await window.AppDir.select();
        } else if (choice === 'file') {
            const result = await window.AppDir.selectFile();
            if (result && typeof window.onRoadmapFilePicked === 'function') {
                window.onRoadmapFilePicked(result);
            }
        }
    });

    if (window.AppDir) window.AppDir.subscribe(renderFolder);
    window.__updateNav = updateActive;
})();
