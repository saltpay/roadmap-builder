// Auto-extracted from views/example.html during Phase 2 of the v2 migration.
// Phase 3 will slice this into smaller modules. For now it preserves the
// original logic intact, including its dependence on window globals set by
// the utilities (DateUtility, RoadmapGenerator, etc.).

/**
 * Mount this view. Called by the SPA router on every navigation here.
 *
 * @param {HTMLElement} _root - The container element (currently unused;
 *                              legacy code reaches DOM via document.* directly)
 */
export function init(_root) {
    const __viewReady = [];
    const __origAdd = document.addEventListener.bind(document);
    document.addEventListener = function (type, listener, opts) {
        if (type === 'DOMContentLoaded') { __viewReady.push(listener); return; }
        return __origAdd(type, listener, opts);
    };
    try {
        // === BEGIN legacy script body ===

    let selectedStory = null;

    // Add click event listeners to all story items
    document.addEventListener('DOMContentLoaded', function () {
        const storyItems = document.querySelectorAll('.story-item, .ktlo-story');

        // January/December hover now handled by CSS


        // Editing disabled - no click event listeners added
        storyItems.forEach((story, index) => {
            // Remove pointer cursor for non-editable stories
            story.style.cursor = 'default';
        });


    });


    function editStory() {
        if (!selectedStory) return;

        // Open roadmap builder with story details
        const builderUrl = '/builder';
        const params = new URLSearchParams({
            action: 'edit',
            epic: selectedStory.epicName,
            story: selectedStory.storyTitle,
            index: selectedStory.storyIndex
        });

        window.open(builderUrl + '?' + params.toString(), '_blank');
    }



        // === END legacy script body ===

        // Expose function declarations to window so inline onclick="foo()"
        // handlers in the view markup keep resolving. Phase 3 will migrate
        // these to delegated addEventListener wiring and remove these.
        if (typeof editStory === 'function') window.editStory = editStory;
    } finally {
        document.addEventListener = __origAdd;
    }
    for (const fn of __viewReady) {
        try { fn.call(document, new Event('DOMContentLoaded')); } catch (e) { console.error(e); }
    }
}
