// Export dropdown UI for the Builder. The top-bar dropdown drops down from
// its trigger button; the bottom-bar dropdown opens upward to avoid being
// hidden behind the preview iframe. Both reuse the .app-nav__folder-menu
// styling defined in index.html so the menu matches the global "Load
// roadmaps" picker.
//
// All four functions are referenced from inline onclick attributes in
// builder.html, so builder.js exposes them on window during init().

export function toggleShareDropdown(event) {
    event.stopPropagation();
    const menu = document.getElementById('shareDropdownMenu');
    const builderPanel = document.querySelector('.builder-panel');

    if (menu.classList.contains('is-open')) {
        closeShareDropdown();
        return;
    }

    if (builderPanel && builderPanel.classList.contains('collapsed')) {
        // When the builder panel is collapsed the dropdown's relative anchor
        // is gone, so we pin it below the trigger button using fixed
        // positioning derived from the button's viewport rect. setProperty
        // with 'important' is required to override the !important rules on
        // .app-nav__folder-menu.
        const shareButton = document.getElementById('shareDropdownBtn');
        const buttonRect = shareButton.getBoundingClientRect();
        menu.style.setProperty('position', 'fixed', 'important');
        menu.style.setProperty('top', `${buttonRect.bottom + 6}px`, 'important');
        menu.style.setProperty('left', `${buttonRect.right - 220}px`, 'important');
        menu.style.setProperty('right', 'auto', 'important');
    } else {
        menu.style.removeProperty('position');
        menu.style.removeProperty('top');
        menu.style.removeProperty('left');
        menu.style.removeProperty('right');
    }

    menu.classList.add('is-open');

    // Defer the outside-click listener by a tick so the click that opened
    // the menu doesn't immediately close it.
    setTimeout(() => {
        document.addEventListener('click', closeShareDropdown, { once: true });
    }, 0);
}

export function closeShareDropdown() {
    const menu = document.getElementById('shareDropdownMenu');
    if (menu) menu.classList.remove('is-open');
}

export function toggleShareDropdownBottom(event) {
    event.stopPropagation();
    const menu = document.getElementById('shareDropdownMenuBottom');

    if (menu.classList.contains('is-open')) {
        closeShareDropdownBottom();
        return;
    }

    // The bottom dropdown opens upward so the preview iframe can't cover it.
    menu.style.setProperty('top', 'auto', 'important');
    menu.style.setProperty('bottom', 'calc(100% + 6px)', 'important');

    menu.classList.add('is-open');

    setTimeout(() => {
        document.addEventListener('click', closeShareDropdownBottom, { once: true });
    }, 0);
}

export function closeShareDropdownBottom() {
    const menu = document.getElementById('shareDropdownMenuBottom');
    if (menu) menu.classList.remove('is-open');
}
