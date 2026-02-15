# ACP Media Companion

Created by Mathew Lim for the SLS Community

## Overview

ACP Media Companion helps educators package ACP-generated HTML5 interactives with media files into a ready-to-upload ZIP.

The tool is designed for workflows using SLS Authoring Copilot (ACP), where teachers:

- Generate an interactive with `index.html`, `style.css`, and `script.js`
- Reference media files using main-folder filenames (for example, `image.png`)
- Upload media and produce a final ZIP for use in SLS

## Rationale of the Programme

### Problem this programme solves

SLS's Authoring Copilot (ACP) currently generates interactives without embedded media such as images, sound, and video. Many teachers also do not know how to modify project files (`index.html`, `style.css`, and `script.js`) to embed media files correctly.

As a result, interactives may be less engaging and may rely on generic SVG images that are not always suitable.

### Why this programme is needed

This programme provides a practical bridge between ACP output and SLS deployment by:

- Consolidating code and media in one interface
- Detecting path issues early
- Producing a correct ZIP structure for upload

Solution follows this order:

1. How to prompt ACP to create media placeholders in the HTML5 files.
2. Step-by-step instructions on how to add media files and package them into a ZIP file with the HTML5 files.
3. An additional HTML5 ZIP-Media Compiler for teachers who are unsure how to manage folders, place media files, and zip them before uploading to SLS.

### Intended users

- Teachers using SLS Authoring Copilot (ACP)
- Curriculum designers preparing interactive resources
- Support teams helping teachers package HTML5 resources

## Various Features

### 1) Prompting ACP to Add Media Placeholders

- Guided prompt templates to help teachers instruct ACP to create media placeholders in HTML5 files
- Ready-to-use prompt patterns for:
  - image placeholders
  - sound effects
  - video placeholders
  - background audio controls
- Filename emphasis for case-sensitive media references

### 2) Step-by-Step SLS ACP Workflow Guide

- 8-step instructional workflow with video walkthroughs
- Covers:
  - preparing ACP prompts
  - setting correct filenames
  - downloading the interactive ZIP file
  - adding media and uploading to SLS
- Includes manual and compiler-assisted paths for packaging

### 3) HTML5 ZIP-Media Compiler (Additional Support)

- Additional help for teachers who are unsure how to manage folders and ZIP files
- Upload a ZIP file and auto-load:
  - `index.html`
  - `style.css` or `styles.css`
  - `script.js`
- Upload media files by button or drag-and-drop
- Main Folder Path Checker to flag incorrect media references
- Media filename matching checks to detect mismatch errors
- Generate a new ZIP file with HTML5 files and media in the main folder

## Steps

1. Prepare or generate interactive code in ACP.
2. (Optional) Add teacher-created content and/or existing interactive code into ACP Knowledge Base.
3. Ensure media filenames in prompts are exact and case-sensitive.
4. Generate and refine output in ACP.
5. Download the interactive ZIP file from ACP.
6. Upload the ZIP file into HTML5 ZIP-Media Compiler.
7. Resolve main-folder path and naming errors if flagged.
8. Upload all required media files.
9. Generate final ZIP.
10. Upload final ZIP into SLS Text Media Component.
11. Validate that media displays/plays correctly in SLS.

## Media References

Media files should be referenced using main-folder filenames:

- `image.png`
- `backgroundmusic.mp3`
- `introvideo.mp4`

Examples:

- `heroimage.jpg`
- `clicksound.mp3`
- `introvideo.mp4`

Current guide-page media references include:

- `assets/banner.png` (header banner image)
- `assets/step-01.mp4` to `assets/step-08.mp4`

## Project Structure

Core files:

- `index.html` - Main compiler application UI
- `script.js` - App logic for uploads, path checks, ZIP generation, preview
- `style.css` - Shared styling for all pages
- `jszip.min.js` - ZIP handling library
- `glossary-hover.js` - Hover glossary definitions for key technical terms

Guidance pages:

- `prompting-acp-to-add-media.html`
- `prompting-acp-media.js`
- `guide-to-media-embedding.html`
- `guide-to-media-embedding.js`
- `instructions-using-ai-chatbot.html`

## Credits

Created by Mathew Lim for the SLS Community.
