// Save dropdown UI. Mirrors share.js's pattern: a top-bar dropdown that
// drops down from the trigger and a bottom-bar dropdown that opens upward
// to avoid being hidden behind the preview iframe. Both reuse the
// .app-nav__folder-menu styling.
//
// Functions are exposed on window during builder.js init() because the
// dropdown trigger and items are wired via inline onclick attributes in
// builder.html.

export function toggleSaveDropdown(event) {
    event.stopPropagation();
    const menu = document.getElementById('saveDropdownMenu');
    const builderPanel = document.querySelector('.builder-panel');

    if (menu.classList.contains('is-open')) {
        closeSaveDropdown();
        return;
    }

    if (builderPanel && builderPanel.classList.contains('collapsed')) {
        // When the builder panel is collapsed the dropdown's relative
        // anchor is gone, so we pin it below the trigger button using
        // fixed positioning derived from the button's viewport rect.
        const btn = document.getElementById('saveDropdownBtn');
        const rect = btn.getBoundingClientRect();
        menu.style.setProperty('position', 'fixed', 'important');
        menu.style.setProperty('top', `${rect.bottom + 6}px`, 'important');
        menu.style.setProperty('left', `${rect.right - 220}px`, 'important');
        menu.style.setProperty('right', 'auto', 'important');
    } else {
        menu.style.removeProperty('position');
        menu.style.removeProperty('top');
        menu.style.removeProperty('left');
        menu.style.removeProperty('right');
    }

    menu.classList.add('is-open');

    setTimeout(() => {
        document.addEventListener('click', closeSaveDropdown, { once: true });
    }, 0);
}

export function closeSaveDropdown() {
    const menu = document.getElementById('saveDropdownMenu');
    if (menu) menu.classList.remove('is-open');
}

export function toggleSaveDropdownBottom(event) {
    event.stopPropagation();
    const menu = document.getElementById('saveDropdownMenuBottom');

    if (menu.classList.contains('is-open')) {
        closeSaveDropdownBottom();
        return;
    }

    // The bottom dropdown opens upward so the preview iframe can't cover it.
    menu.style.setProperty('top', 'auto', 'important');
    menu.style.setProperty('bottom', 'calc(100% + 6px)', 'important');

    menu.classList.add('is-open');

    setTimeout(() => {
        document.addEventListener('click', closeSaveDropdownBottom, { once: true });
    }, 0);
}

export function closeSaveDropdownBottom() {
    const menu = document.getElementById('saveDropdownMenuBottom');
    if (menu) menu.classList.remove('is-open');
}
