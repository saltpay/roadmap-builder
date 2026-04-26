// Share dropdown UI for the Builder. The top-bar dropdown drops down from
// its trigger button; the bottom-bar dropdown opens upward to avoid being
// hidden behind the preview iframe.
//
// All four functions are referenced from inline onclick attributes in
// builder.html, so builder.js exposes them on window during init().

export function toggleShareDropdown(event) {
    event.stopPropagation();
    const menu = document.getElementById('shareDropdownMenu');
    const builderPanel = document.querySelector('.builder-panel');

    if (menu.style.display === 'block') {
        menu.style.display = 'none';
        return;
    }

    if (builderPanel.classList.contains('collapsed')) {
        // When the builder panel is collapsed the dropdown's relative anchor
        // is gone, so we pin it below the trigger button using fixed
        // positioning derived from the button's viewport rect.
        const shareButton = document.getElementById('shareDropdownBtn');
        const buttonRect = shareButton.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${buttonRect.bottom + 2}px`;
        menu.style.left = `${buttonRect.right - 120}px`;
        menu.style.right = 'auto';
        menu.style.bottom = 'auto';
    } else {
        menu.style.position = 'absolute';
        menu.style.top = '100%';
        menu.style.left = 'auto';
        menu.style.right = '0';
        menu.style.bottom = 'auto';
    }

    menu.style.display = 'block';

    // Defer the outside-click listener by a tick so the click that opened
    // the menu doesn't immediately close it.
    setTimeout(() => {
        document.addEventListener('click', closeShareDropdown, { once: true });
    }, 0);
}

export function closeShareDropdown() {
    const menu = document.getElementById('shareDropdownMenu');
    if (menu) menu.style.display = 'none';
}

export function toggleShareDropdownBottom(event) {
    event.stopPropagation();
    const menu = document.getElementById('shareDropdownMenuBottom');

    if (menu.style.display === 'block') {
        menu.style.display = 'none';
        return;
    }

    // The bottom dropdown opens upward so the preview iframe can't cover it.
    menu.style.position = 'absolute';
    menu.style.top = 'auto';
    menu.style.left = 'auto';
    menu.style.right = '0';
    menu.style.bottom = '100%';
    menu.style.display = 'block';

    setTimeout(() => {
        document.addEventListener('click', closeShareDropdownBottom, { once: true });
    }, 0);
}

export function closeShareDropdownBottom() {
    const menu = document.getElementById('shareDropdownMenuBottom');
    if (menu) menu.style.display = 'none';
}
