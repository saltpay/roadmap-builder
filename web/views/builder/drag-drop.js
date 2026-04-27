// Story drag-and-drop handlers for the Builder.
//
// Stories can only be dragged when they are collapsed and only within the
// same epic. Reordering happens live during dragover; drop fires the
// renumber/preview-regenerate side effects.
//
// The handlers depend on two callbacks owned by builder.js (updateStoryNumbers,
// generatePreview), which is why this module is a factory rather than a set
// of plain exports.

/**
 * @param {object} deps
 * @param {(epic: Element) => void} deps.updateStoryNumbers
 * @param {() => void} deps.generatePreview
 * @returns {{
 *   handleStoryDragStart: (event: DragEvent, storyId: string) => void | false,
 *   handleStoryDragOver: (event: DragEvent) => false,
 *   handleStoryDrop: (event: DragEvent, targetStoryId: string) => false,
 *   handleStoryDragEnd: (event: DragEvent) => void,
 * }}
 */
export function createStoryDragHandlers({ updateStoryNumbers, generatePreview }) {
    let draggedStoryElement = null;

    function handleStoryDragStart(event, storyId) {
        // Only collapsed stories are draggable; expanded ones might contain
        // form inputs the user is editing.
        const contentDiv = document.getElementById(`story-content-${storyId}`);
        const isCollapsed = contentDiv && contentDiv.style.display === 'none';
        if (!isCollapsed) {
            event.preventDefault();
            return false;
        }

        draggedStoryElement = document.getElementById(`story-${storyId}`);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/html', draggedStoryElement.innerHTML);

        // Defer the opacity change so the browser uses the original element
        // for the drag image, not the dimmed one.
        setTimeout(() => {
            if (draggedStoryElement) draggedStoryElement.style.opacity = '0.4';
        }, 0);
    }

    function handleStoryDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        const targetStory = event.currentTarget;
        if (!targetStory || !targetStory.classList.contains('story-section')) return false;
        if (targetStory === draggedStoryElement) return false;

        // Cross-epic drag isn't allowed - epics own their stories.
        const draggedEpic = draggedStoryElement.closest('.epic-section');
        const targetEpic = targetStory.closest('.epic-section');
        if (draggedEpic !== targetEpic) return false;

        const container = targetStory.parentNode;
        const allStories = Array.from(container.querySelectorAll('.story-section'));
        const draggedIndex = allStories.indexOf(draggedStoryElement);
        const targetIndex = allStories.indexOf(targetStory);
        if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
            return false;
        }

        // Insert before/after the target based on cursor position relative
        // to its midpoint - this gives the visual "swap" feel.
        const rect = targetStory.getBoundingClientRect();
        const insertBefore = event.clientY < rect.top + rect.height / 2;
        if (insertBefore) {
            container.insertBefore(draggedStoryElement, targetStory);
        } else {
            container.insertBefore(draggedStoryElement, targetStory.nextSibling);
        }
        return false;
    }

    function handleStoryDrop(event, _targetStoryId) {
        event.stopPropagation();
        event.preventDefault();
        // Reordering already happened during dragover. Drop just commits the
        // side effects: renumber stories within the epic and refresh the preview.
        if (draggedStoryElement) {
            const draggedEpic = draggedStoryElement.closest('.epic-section');
            if (draggedEpic) {
                updateStoryNumbers(draggedEpic);
                setTimeout(generatePreview, 100);
            }
        }
        return false;
    }

    function handleStoryDragEnd(_event) {
        if (draggedStoryElement) draggedStoryElement.style.opacity = '1';

        // Clear any drop-zone visual hints left by dragover handlers.
        document.querySelectorAll('.story-section').forEach((story) => {
            story.style.borderTop = '';
            story.style.borderBottom = '';
            story.style.marginTop = '';
            story.style.marginBottom = '';
        });

        draggedStoryElement = null;
    }

    return { handleStoryDragStart, handleStoryDragOver, handleStoryDrop, handleStoryDragEnd };
}
