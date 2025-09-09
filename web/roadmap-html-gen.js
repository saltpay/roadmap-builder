#!/usr/bin/env node
// Utility to generate a self-contained HTML roadmap from Roadmap-Default-Template.json

const fs = require('fs');
const path = require('path');

// Require the generator and utilities
const RoadmapGenerator = require('./roadmap-generator').RoadmapGenerator || require('./roadmap-generator');

// Input/output paths
const INPUT_PATH = path.resolve(__dirname, 'Roadmap-Default-Template.json');
const OUTPUT_PATH = path.resolve(__dirname, 'example-roadmap.html');

function main() {
    if (!fs.existsSync(INPUT_PATH)) {
        console.error(`[roadmap-html-gen] Input file not found: ${INPUT_PATH}`);
        process.exit(1);
    }
    let json;
    try {
        json = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
    } catch (err) {
        console.error('[roadmap-html-gen] Failed to parse input JSON:', err);
        process.exit(1);
    }
    let generator;
    try {
        generator = new RoadmapGenerator();
    } catch (err) {
        console.error('[roadmap-html-gen] Failed to instantiate RoadmapGenerator:', err);
        process.exit(1);
    }
    if (typeof generator.generateRoadmap !== 'function') {
        console.error('[roadmap-html-gen] RoadmapGenerator is missing generateRoadmap().');
        process.exit(1);
    }
    let html;
    try {
        // Support both {teamData: {...}} and direct object
        const teamData = json.teamData || json;
        html = generator.generateRoadmap(teamData, false, false); // standalone HTML with editing disabled
    } catch (err) {
        console.error('[roadmap-html-gen] Failed to generate HTML:', err);
        process.exit(1);
    }
    try {
        fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
    } catch (err) {
        console.error('[roadmap-html-gen] Failed to write output file:', err);
        process.exit(1);
    }
}

main();
