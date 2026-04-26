#!/usr/bin/env node
// One-shot Phase 2 helper: pull <style> and <script> blocks out of a view
// HTML and write three sibling files (.html with stripped markup, .css with
// concatenated styles, .js with concatenated scripts wrapped in init(root)).
//
// Usage: node scripts/extract-view.mjs <view-name>
// Input:  web/views/<view-name>.html
// Output: web/views/<view-name>/<view-name>.html (markup only, with link+script tags)
//         web/views/<view-name>/<view-name>.css
//         web/views/<view-name>/<view-name>.js
//
// Inline onclick="..." attributes stay put; the extracted .js exposes the
// referenced functions on window so they keep resolving. Phase 3 will move
// those handlers to addEventListener as it slices the script.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const name = process.argv[2];
if (!name) {
    console.error('Usage: extract-view.mjs <view-name>');
    process.exit(1);
}

const inputPath = resolve(repoRoot, 'web/views', `${name}.html`);
const outDir = resolve(repoRoot, 'web/views', name);
const outHtml = resolve(outDir, `${name}.html`);
const outCss = resolve(outDir, `${name}.css`);
const outJs = resolve(outDir, `${name}.js`);

if (!existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const src = readFileSync(inputPath, 'utf8');

function extractBlocks(source, tag) {
    const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'g');
    /** @type {{ attrs: string, body: string, start: number, end: number }[]} */
    const blocks = [];
    let m;
    while ((m = re.exec(source)) !== null) {
        const attrs = m[1] || '';
        if (tag === 'script' && /\bsrc\s*=/.test(attrs)) continue; // external script -> leave for index.html
        blocks.push({
            attrs: attrs.trim(),
            body: m[2],
            start: m.index,
            end: m.index + m[0].length,
        });
    }
    return blocks;
}

const styleBlocks = extractBlocks(src, 'style');
const scriptBlocks = extractBlocks(src, 'script');

const allBlocks = [...styleBlocks, ...scriptBlocks].sort((a, b) => b.start - a.start);
let stripped = src;
for (const b of allBlocks) {
    stripped = stripped.slice(0, b.start) + stripped.slice(b.end);
}
stripped = stripped.replace(/\n[ \t]+\n/g, '\n').trimEnd() + '\n';

const cssBody = styleBlocks.map((b) => b.body).join('\n\n').trim() + '\n';

const scriptBody = scriptBlocks.map((b) => b.body).join('\n;\n');

// Find function declarations in the body so we can expose them on window
// for inline onclick attributes.
const fnNames = (() => {
    const re = /^[\s]*(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
    const names = new Set();
    let m;
    while ((m = re.exec(scriptBody)) !== null) names.add(m[1]);
    return [...names];
})();
const exposures = fnNames.map((n) => `if (typeof ${n} === 'function') window.${n} = ${n};`).join('\n');

// Module structure:
//   - export init(root): each call re-runs the entire legacy body so that
//     any top-level setup (not just DOMContentLoaded handlers) executes
//     against the freshly-mounted DOM. Matches the previous router's
//     "re-eval the inline script on every navigation" behavior.
//   - Inside init(): shim addEventListener to capture DOMContentLoaded,
//     run the body, restore addEventListener, fire the captured handlers,
//     expose top-level function declarations on window.
const moduleSource = `// Auto-extracted from views/${name}.html during Phase 2 of the v2 migration.
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
${scriptBody}
        // === END legacy script body ===

        // Expose function declarations to window so inline onclick="foo()"
        // handlers in the view markup keep resolving. Phase 3 will migrate
        // these to delegated addEventListener wiring and remove these.
        ${exposures}
    } finally {
        document.addEventListener = __origAdd;
    }
    for (const fn of __viewReady) {
        try { fn.call(document, new Event('DOMContentLoaded')); } catch (e) { console.error(e); }
    }
}
`;

// The router injects the matching <link> tag for the view's css and
// dynamic-imports the js module, so the html stays a pure markup fragment.
writeFileSync(outHtml, stripped, 'utf8');
writeFileSync(outCss, cssBody, 'utf8');
writeFileSync(outJs, moduleSource, 'utf8');

console.log(`✔ ${name}: ${styleBlocks.length} style block(s), ${scriptBlocks.length} script block(s), ${fnNames.length} fn names exposed`);
console.log(`  html ${outHtml} ${stripped.length} bytes`);
console.log(`  css  ${outCss} ${cssBody.length} bytes`);
console.log(`  js   ${outJs} ${moduleSource.length} bytes`);
