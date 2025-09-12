# Copilot Instructions for this repository

## Project Overview
This is an open-source roadmap builder application licensed under Apache License 2.0. The project consists of:
- A Node.js server using only built-in modules (no npm dependencies)
- Frontend JavaScript applications with custom utilities
- Third-party libraries loaded via CDN (see NOTICE file)

## License Compliance Requirements

### When Adding New Dependencies or Software
**CRITICAL**: Before suggesting, installing, or using any new libraries, frameworks, or software components, you MUST:

1. **Verify License Compatibility**:
   - Check that the license is compatible with Apache License 2.0
   - Compatible licenses include: MIT, BSD, Apache 2.0, ISC
   - Avoid copyleft licenses (GPL, LGPL, AGPL) unless explicitly approved
   - When in doubt, ask for guidance before proceeding

2. **Document Attribution Requirements**:
   - Update the NOTICE file with proper attribution
   - Include copyright notices and license text
   - Document the source, version, and usage location

3. **Review Chain Dependencies**:
   - Check transitive dependencies for license compatibility
   - Ensure all sub-dependencies meet our license requirements

### Current Third-Party Components
This project currently uses these CDN-loaded libraries:
- html-to-image v1.11.11 (MIT) - Image export functionality
- jsPDF v2.5.1 (MIT) - PDF generation
- SheetJS/xlsx v0.18.5 (Apache 2.0) - Excel file operations

All attributions are documented in the NOTICE file.

## Development Guidelines

### Code Standards
- Follow existing code conventions and patterns
- Use built-in Node.js modules when possible to minimize dependencies
- Prefer vanilla JavaScript over frameworks for frontend components
- Maintain security best practices (no hardcoded secrets, validate inputs)

### File Structure
- Server code: `server.js` (main entry point)
- Frontend: `web/` directory
- Utilities: `web/utilities/` directory
- Static assets: served from `web/` directory

### Before Committing Changes
When adding new functionality that involves external libraries:
1. Verify all licenses are compatible and documented
2. Test that the application works with the new dependencies
3. Update documentation if needed
4. Ensure no security vulnerabilities are introduced
