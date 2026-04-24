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
            <button type="button" id="appNavFolder" class="app-nav__folder" title="Shared folder for Builder and Search"></button>
        </div>
    `;

    const folderBtn = nav.querySelector('#appNavFolder');

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
            folderBtn.textContent = `📂 ${snap.name}`;
            folderBtn.dataset.state = 'granted';
        } else {
            folderBtn.textContent = `🔓 Unlock ${snap.name}`;
            folderBtn.dataset.state = 'prompt';
        }
    }

    folderBtn.addEventListener('click', async () => {
        const snap = window.AppDir.get();
        if (snap.handle && snap.permission !== 'granted' && snap.kind === 'native') {
            const after = await window.AppDir.requestAccess();
            if (after.permission === 'granted') return;
            // Permission denied/dismissed — fall through to pick a new folder.
        }
        await window.AppDir.select();
    });

    if (window.AppDir) window.AppDir.subscribe(renderFolder);
    window.__updateNav = updateActive;
})();
