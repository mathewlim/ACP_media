const ALLOWED_MEDIA_EXTENSIONS = new Set([
  'mp3', 'mp4', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'wav', 'ogg', 'webm', 'mov', 'm4a'
]);
const CORE_FILENAME_SET = new Set(['index.html', 'style.css', 'styles.css', 'script.js']);
const CANONICAL_CORE_FILENAMES = new Set(['index.html', 'style.css', 'script.js']);
const MEDIA_MIME_TYPES = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml'
};
// Preview links for uploaded media, created once per file.
const previewUrlCache = new WeakMap();

const state = {
  files: [],
  code: {
    'index.html': '',
    'style.css': '',
    'script.js': ''
  },
  activeCodeFile: 'index.html',
  // True when there is work that has not been downloaded as a ZIP yet.
  hasUnsavedChanges: false,
  pathPromptShown: {
    'index.html': false,
    'style.css': false,
    'script.js': false
  }
};

const codeEditor = document.getElementById('codeEditor');
const codeFileSelect = document.getElementById('codeFileSelect');
const codeFileInput = document.getElementById('codeFileInput');
const codeHighlightLayer = document.getElementById('codeHighlightLayer');
const fileInput = document.getElementById('fileInput');
const zipInput = document.getElementById('zipInput');
const uploadBtn = document.getElementById('uploadBtn');
const clearMediaBtn = document.getElementById('clearMediaBtn');
const uploadZipBtn = document.getElementById('uploadZipBtn');
const clearCodeBtn = document.getElementById('clearCodeBtn');
const uploadCodeBtn = document.getElementById('uploadCodeBtn');
const dropZone = document.getElementById('dropZone');
const fileList = document.getElementById('fileList');
const previewBtn = document.getElementById('previewBtn');
const generateBtn = document.getElementById('generateBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessage = document.getElementById('statusMessage');
const workflowStepButtons = Array.from(document.querySelectorAll('.workflow-step'));
const workflowPanels = Array.from(document.querySelectorAll('.workflow-panel'));
const pathSnippetList = document.getElementById('pathSnippetList');
const pathErrorList = document.getElementById('pathErrorList');
const pathErrorBox = pathErrorList?.closest('.checker-box-error') || null;
const mediaNameErrorList = document.getElementById('mediaNameErrorList');
const mediaNameMatchList = document.getElementById('mediaNameMatchList');
const mediaNameErrorBox = mediaNameErrorList?.closest('.checker-box-error') || null;

uploadBtn.addEventListener('click', () => fileInput.click());
clearMediaBtn?.addEventListener('click', clearMediaFiles);
uploadZipBtn.addEventListener('click', () => zipInput.click());
clearCodeBtn?.addEventListener('click', clearCodeFiles);
uploadCodeBtn.addEventListener('click', () => codeFileInput.click());
codeFileSelect.addEventListener('change', handleEditorFileChange);
codeEditor.addEventListener('input', () => {
  syncEditorToState();
  state.hasUnsavedChanges = true;
  updateAssetPathChecker({ showAlert: false });
});
codeEditor.addEventListener('scroll', syncCodeOverlayScroll);
codeFileInput.addEventListener('change', async (event) => {
  await loadSingleCodeInput(event.target.files?.[0], getSelectedCodeFile());
  codeFileInput.value = '';
});
fileInput.addEventListener('change', async (event) => {
  await addFiles(event.target.files);
});
fileList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-file]');
  if (button) {
    removeMediaFile(button.dataset.removeFile);
  }
});
window.addEventListener('beforeunload', (event) => {
  if (state.hasUnsavedChanges && hasProjectContent()) {
    event.preventDefault();
    event.returnValue = '';
  }
});
zipInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (file) {
    await importProjectZip(file);
  }
  zipInput.value = '';
});

previewBtn.addEventListener('click', previewProject);
generateBtn.addEventListener('click', generateZip);
resetBtn.addEventListener('click', resetAll);

setupDropZone();
setMediaInputAccept();
state.activeCodeFile = getSelectedCodeFile();
setCodeFileInputAccept();
renderEditorForSelectedFile();
setupWorkflowMap();
updateAssetPathChecker();

function setMediaInputAccept() {
  fileInput.accept = Array.from(ALLOWED_MEDIA_EXTENSIONS).map((ext) => `.${ext}`).join(',');
}

// Browsers save repeated downloads as "script (1).js"; treat those as the core file.
function getCoreFilename(filename) {
  const lower = (filename || '').toLowerCase().replace(/\s\(\d+\)(?=\.[a-z]+$)/, '');
  return CORE_FILENAME_SET.has(lower) ? lower : '';
}

function getMediaMimeType(filename) {
  return MEDIA_MIME_TYPES[getFileExtension(filename)] || '';
}

// Hidden system files that zip tools add (macOS __MACOSX, .DS_Store, Thumbs.db).
function isSystemZipEntry(path) {
  const parts = path.split(/[\\/]/).filter(Boolean);
  const base = parts[parts.length - 1] || '';
  return parts.includes('__MACOSX') || base.startsWith('.') || /^(?:thumbs\.db|desktop\.ini)$/i.test(base);
}

function hasProjectContent() {
  return state.files.length > 0 || Object.values(state.code).some((content) => content.trim().length > 0);
}

// Adds a media file; a file with the same name replaces the earlier copy.
function stageMediaFile(file) {
  const index = state.files.findIndex((item) => item.name === file.name);
  if (index >= 0) {
    state.files[index] = file;
    return 'replaced';
  }
  state.files.push(file);
  return 'added';
}

function getSelectedCodeFile() {
  return codeFileSelect.value;
}

function syncEditorToState() {
  state.code[state.activeCodeFile] = codeEditor.value;
}

function renderEditorForSelectedFile() {
  const selected = state.activeCodeFile;
  codeEditor.value = state.code[selected] || '';
  codeEditor.placeholder = `Paste your ${selected} code here...`;
  renderCodeHighlights();
  syncCodeOverlayScroll();
}

function setCodeFileInputAccept() {
  const selected = state.activeCodeFile;
  uploadCodeBtn.textContent = `Upload ${selected}`;
  if (selected === 'index.html') {
    codeFileInput.accept = '.html,text/html';
  } else if (selected === 'style.css') {
    codeFileInput.accept = '.css,text/css';
  } else {
    codeFileInput.accept = '.js,text/javascript,application/javascript';
  }
}

function handleEditorFileChange() {
  state.code[state.activeCodeFile] = codeEditor.value;
  state.activeCodeFile = getSelectedCodeFile();
  renderEditorForSelectedFile();
  setCodeFileInputAccept();
  updateAssetPathChecker();
}

function setupWorkflowMap() {
  if (workflowStepButtons.length === 0 || workflowPanels.length === 0) {
    return;
  }

  workflowStepButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.stepTarget;
      activateWorkflowStep(targetId);
    });
  });
}

function activateWorkflowStep(targetId) {
  if (!targetId) {
    return;
  }

  workflowPanels.forEach((panel) => {
    const isActive = panel.id === targetId;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });

  workflowStepButtons.forEach((button) => {
    const isActive = button.dataset.stepTarget === targetId;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

async function loadSingleCodeInput(file, targetName) {
  if (!file) {
    return;
  }

  const loaded = await loadCodeFile(file, targetName);
  if (loaded) {
    state.hasUnsavedChanges = true;
    setStatus(`${targetName} loaded.`, 'success');
  } else {
    setStatus(`Could not load ${targetName}.`, 'error');
  }
}

function setupDropZone() {
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('active');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove('active');
    });
  });

  dropZone.addEventListener('drop', async (event) => {
    await addFiles(event.dataTransfer.files);
  });

  dropZone.addEventListener('click', () => fileInput.click());

  // Files dropped anywhere else on the page would make the browser open them
  // and lose the teacher's work, so handle them like a drop-zone drop.
  window.addEventListener('dragover', (event) => {
    if (isFileDrag(event) && !dropZone.contains(event.target)) {
      event.preventDefault();
    }
  });
  window.addEventListener('drop', async (event) => {
    if (!isFileDrag(event) || dropZone.contains(event.target)) {
      return;
    }
    event.preventDefault();
    await addFiles(event.dataTransfer.files);
  });

  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
}

function isFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

async function addFiles(fileCollection) {
  if (!fileCollection || fileCollection.length === 0) {
    return;
  }

  const incomingFiles = Array.from(fileCollection);
  let loadedCodeCount = 0;
  let addedMediaCount = 0;
  let replacedMediaCount = 0;
  let importedZipCount = 0;
  const rejected = [];

  for (const file of incomingFiles) {
    const extension = getFileExtension(file.name);
    const coreName = getCoreFilename(file.name);

    if (extension === 'zip') {
      const imported = await importProjectZip(file, true);
      if (imported) {
        importedZipCount += 1;
      } else {
        rejected.push(file.name);
      }
      continue;
    }

    if (coreName) {
      const loaded = await loadCodeFile(file, coreName);
      if (loaded) {
        loadedCodeCount += 1;
      } else {
        rejected.push(file.name);
      }
      continue;
    }

    if (!ALLOWED_MEDIA_EXTENSIONS.has(extension)) {
      rejected.push(file.name);
      continue;
    }

    if (stageMediaFile(file) === 'replaced') {
      replacedMediaCount += 1;
    } else {
      addedMediaCount += 1;
    }
  }

  if (loadedCodeCount + addedMediaCount + replacedMediaCount + importedZipCount > 0) {
    state.hasUnsavedChanges = true;
  }
  renderFileList();
  updateAssetPathChecker();
  setStatus(
    buildUploadStatusMessage(loadedCodeCount, addedMediaCount, importedZipCount, rejected, replacedMediaCount),
    rejected.length > 0 ? 'error' : 'success'
  );
  fileInput.value = '';
}

function buildUploadStatusMessage(codeCount, mediaCount, zipCount, rejectedNames, replacedCount = 0) {
  const rejectedCount = rejectedNames.length;
  const parts = [];
  if (codeCount > 0) {
    parts.push(`${codeCount} code file(s) loaded`);
  }
  if (mediaCount > 0) {
    parts.push(`${mediaCount} media file(s) added`);
  }
  if (replacedCount > 0) {
    parts.push(`${replacedCount} media file(s) replaced with the new upload`);
  }
  if (zipCount > 0) {
    parts.push(`${zipCount} ZIP file(s) imported`);
  }
  if (rejectedCount > 0) {
    const shown = rejectedNames.slice(0, 3).join(', ');
    const more = rejectedCount > 3 ? ` and ${rejectedCount - 3} more` : '';
    parts.push(`${rejectedCount} file(s) skipped because they are not supported or could not be read (${shown}${more})`);
  }
  return parts.length > 0 ? `${parts.join(', ')}.` : 'No supported files were uploaded.';
}

async function loadCodeFile(file, lowerName) {
  try {
    const content = await file.text();
    if (lowerName === 'index.html') {
      state.code['index.html'] = content;
      if (getSelectedCodeFile() === 'index.html') {
        renderEditorForSelectedFile();
      }
      updateAssetPathChecker();
      return true;
    }
    if (lowerName === 'style.css' || lowerName === 'styles.css') {
      state.code['style.css'] = content;
      if (getSelectedCodeFile() === 'style.css') {
        renderEditorForSelectedFile();
      }
      updateAssetPathChecker();
      return true;
    }
    if (lowerName === 'script.js') {
      state.code['script.js'] = content;
      if (getSelectedCodeFile() === 'script.js') {
        renderEditorForSelectedFile();
      }
      updateAssetPathChecker();
      return true;
    }
    return false;
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function importProjectZip(file, isSilent = false) {
  if (typeof JSZip === 'undefined') {
    setStatus('ZIP library failed to load. Check your local jszip.min.js file and reload.', 'error');
    return false;
  }

  try {
    const zip = await JSZip.loadAsync(file);
    const allEntries = Object.values(zip.files).filter((entry) => !entry.dir && !isSystemZipEntry(entry.name));
    if (allEntries.length === 0) {
      if (!isSilent) {
        setStatus('ZIP import failed: no files found inside the archive.', 'error');
      }
      return false;
    }

    const byCoreFile = new Map();
    for (const entry of allEntries) {
      const basename = getCoreFilename(getBasename(entry.name));
      if (!basename) {
        continue;
      }
      const canonicalName = basename === 'styles.css' ? 'style.css' : basename;
      if (!CANONICAL_CORE_FILENAMES.has(canonicalName)) {
        continue;
      }
      const existing = byCoreFile.get(canonicalName);
      if (!existing || entry.name.length < existing.name.length) {
        byCoreFile.set(canonicalName, entry);
      }
    }

    let loadedCodeCount = 0;
    const htmlEntry = byCoreFile.get('index.html');
    const cssEntry = byCoreFile.get('style.css');
    const jsEntry = byCoreFile.get('script.js');

    const isProjectZip = Boolean(htmlEntry || cssEntry || jsEntry);
    if (isProjectZip) {
      // A project ZIP replaces all three files, so code from an earlier project is not mixed in.
      state.code['index.html'] = htmlEntry ? await htmlEntry.async('string') : '';
      state.code['style.css'] = cssEntry ? await cssEntry.async('string') : '';
      state.code['script.js'] = jsEntry ? await jsEntry.async('string') : '';
      loadedCodeCount = [htmlEntry, cssEntry, jsEntry].filter(Boolean).length;
      state.pathPromptShown = { 'index.html': false, 'style.css': false, 'script.js': false };
    }
    renderEditorForSelectedFile();

    const importedAssets = [];

    for (const entry of allEntries) {
      const baseName = getBasename(entry.name);
      if (!baseName) {
        continue;
      }
      if (getCoreFilename(baseName)) {
        continue;
      }

      const blob = await entry.async('blob');
      const uniqueName = getUniqueFilename(baseName, importedAssets.map((item) => item.name));
      importedAssets.push(new File([blob], uniqueName, { type: blob.type || getMediaMimeType(uniqueName) }));
    }

    let keptCount = 0;
    if (isProjectZip) {
      // Keep media uploaded earlier only if this project uses it; drop the rest
      // so files from a previous project do not end up in the new ZIP.
      const referenced = new Set(collectMediaReferencesByFile().map((item) => getReferenceFilename(item.snippet)));
      state.files = state.files.filter((item) => referenced.has(item.name));
      keptCount = state.files.filter((item) => !importedAssets.some((asset) => asset.name === item.name)).length;
    }
    importedAssets.forEach(stageMediaFile);
    state.hasUnsavedChanges = true;
    renderFileList();
    updateAssetPathChecker();

    if (!isSilent) {
      const kept = keptCount > 0 ? ` ${keptCount} media file(s) you uploaded earlier were kept.` : '';
      setStatus(`ZIP imported: ${loadedCodeCount} code file(s) loaded and ${importedAssets.length} media file(s) staged in the main folder.${kept}`, 'success');
    }
    return true;
  } catch (error) {
    console.error(error);
    if (!isSilent) {
      setStatus(`ZIP import failed: ${error.message}`, 'error');
    }
    return false;
  }
}

function getFileExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function getBasename(path) {
  return path.split(/[\\/]/).pop()?.trim() || '';
}

function getUniqueFilename(originalName, existingNames) {
  if (!existingNames.includes(originalName)) {
    return originalName;
  }

  const dotIndex = originalName.lastIndexOf('.');
  const base = dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName;
  const ext = dotIndex > 0 ? originalName.slice(dotIndex) : '';

  let counter = 1;
  let candidate = `${base} (${counter})${ext}`;
  while (existingNames.includes(candidate)) {
    counter += 1;
    candidate = `${base} (${counter})${ext}`;
  }

  return candidate;
}

function renderFileList() {
  fileList.innerHTML = '';

  if (state.files.length === 0) {
    fileList.innerHTML = '<li class="muted">No files uploaded.</li>';
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const file of state.files) {
    const li = document.createElement('li');
    li.className = 'file-list-item';
    const label = document.createElement('span');
    label.textContent = `${file.name} (${formatFileSize(file.size)})`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'file-remove-btn';
    remove.dataset.removeFile = file.name;
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    li.append(label, remove);
    fragment.appendChild(li);
  }

  fileList.appendChild(fragment);
}

function removeMediaFile(name) {
  const before = state.files.length;
  state.files = state.files.filter((file) => file.name !== name);
  if (state.files.length === before) {
    return;
  }
  state.hasUnsavedChanges = true;
  renderFileList();
  updateAssetPathChecker();
  setStatus(`Removed ${name}.`, 'success');
}

function formatFileSize(sizeInBytes) {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }
  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function generateZip() {
  if (generateBtn.disabled) return;
  if (typeof JSZip === 'undefined') {
    setStatus('ZIP library failed to load. Check your local jszip.min.js file and reload.', 'error');
    return;
  }

  syncEditorToState();
  const errors = getPackagingErrors();
  if (errors.length > 0) {
    setStatus(errors.join(' '), 'error');
    return;
  }

  generateBtn.disabled = true;
  setStatus('Generating ZIP...', '');

  try {
    const zip = new JSZip();

    const htmlRaw = state.code['index.html'];
    const cssRaw = state.code['style.css'];
    const jsRaw = state.code['script.js'];
    const htmlFinal = ensureRequiredLinks(htmlRaw);

    zip.file('index.html', htmlFinal || '');
    zip.file('style.css', cssRaw || '');
    zip.file('script.js', jsRaw || '');

    state.files.forEach((file) => {
      zip.file(file.name, file);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(blob, 'my-project.zip');
    state.hasUnsavedChanges = false;
    setStatus('ZIP generated and download started.', 'success');
  } catch (error) {
    console.error(error);
    setStatus(`Failed to generate ZIP: ${error.message}`, 'error');
  } finally {
    generateBtn.disabled = false;
  }
}

function getPackagingErrors() {
  const errors = [];
  const html = state.code['index.html'] || '';
  if (!html.trim()) {
    return ['Add your index.html code before generating the ZIP.'];
  }

  for (const [name, content] of Object.entries(state.code)) {
    if (content.trim().startsWith('```')) {
      errors.push(`Paste only the code into ${name}, without the Markdown backticks.`);
    }
  }
  if (/<link\b[^>]*\bhref\s*=\s*["'](?:\.\/)?styles?\.css(?:[?#][^"']*)?["']/i.test(html) && !state.code['style.css'].trim()) {
    errors.push('Add the style.css code referenced by index.html.');
  }
  if (/<script\b[^>]*\bsrc\s*=\s*["'](?:\.\/)?script\.js(?:[?#][^"']*)?["']/i.test(html) && !state.code['script.js'].trim()) {
    errors.push('Add the script.js code referenced by index.html.');
  }

  const uploadedNames = new Set(state.files.map((file) => file.name));
  const references = new Set(collectMediaReferencesByFile().map((entry) => entry.snippet));
  for (const reference of references) {
    if (!isMainFolderMediaReference(reference)) {
      errors.push(`Use a main-folder filename for "${reference}".`);
    } else if (!uploadedNames.has(getReferenceFilename(reference))) {
      errors.push(`Upload "${getReferenceFilename(reference)}" or correct its filename in the code.`);
    }
  }
  return errors;
}

function previewProject() {
  try {
    syncEditorToState();
    const htmlRaw = state.code['index.html'] || '';
    const cssRaw = state.code['style.css'] || '';
    const jsRaw = state.code['script.js'] || '';

    const mediaUrls = getPreviewMediaUrls();
    const previewDocument = createPreviewDocument(
      replaceMediaReferences(htmlRaw, mediaUrls),
      replaceMediaReferences(cssRaw, mediaUrls),
      replaceMediaReferences(jsRaw, mediaUrls)
    );
    openPreviewWindow(previewDocument);
    const mediaNote = state.files.length > 0
      ? ` Uploaded media is included; filenames built by code (for example 'cat' + n + '.jpg') will only work in the final ZIP.`
      : ' Upload media files to see them in the preview.';
    setStatus(`Preview opened in a new window.${mediaNote}`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(`Preview failed: ${error.message}`, 'error');
  }
}

function getPreviewMediaUrls() {
  const urls = new Map();
  state.files.forEach((file) => {
    if (!previewUrlCache.has(file)) {
      previewUrlCache.set(file, URL.createObjectURL(file));
    }
    urls.set(file.name, previewUrlCache.get(file));
  });
  return urls;
}

// Swap main-folder media references for preview URLs, using the same
// detection as the checker so only real references are changed.
function replaceMediaReferences(text, urlMap) {
  if (!text || urlMap.size === 0) {
    return text || '';
  }
  let cursor = 0;
  let output = '';
  for (const match of getMediaReferenceMatches(text)) {
    if (match.start < cursor || !isMainFolderMediaReference(match.snippet)) {
      continue;
    }
    const url = urlMap.get(getReferenceFilename(match.snippet));
    if (!url) {
      continue;
    }
    output += text.slice(cursor, match.start) + url;
    cursor = match.end;
  }
  return output + text.slice(cursor);
}

function ensureRequiredLinks(html) {
  const defaultHtml = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '  <title>My Project</title>',
    '</head>',
    '<body>',
    '</body>',
    '</html>'
  ].join('\n');

  let finalHtml = html && html.trim().length > 0 ? html : defaultHtml;
  // ZIP imports accept styles.css, but the compiler writes the canonical style.css.
  finalHtml = finalHtml.replace(/(<link\b[^>]*\bhref\s*=\s*["'])(?:\.\/)?styles\.css(?=[?#"'])/gi, '$1style.css');

  const hasCssLink = /<link\b[^>]*href\s*=\s*['"][^'"]*style\.css(?:[?#][^'"]*)?['"][^>]*>/i.test(finalHtml);
  const hasJsScript = /<script\b[^>]*src\s*=\s*['"][^'"]*script\.js(?:[?#][^'"]*)?['"][^>]*>\s*<\/script>/i.test(finalHtml);

  if (!hasCssLink) {
    if (/<\/head>/i.test(finalHtml)) {
      finalHtml = finalHtml.replace(/<\/head>/i, '  <link rel="stylesheet" href="style.css" />\n</head>');
    } else {
      finalHtml = `<link rel="stylesheet" href="style.css" />\n${finalHtml}`;
    }
  }

  if (!hasJsScript) {
    if (/<\/body>/i.test(finalHtml)) {
      finalHtml = finalHtml.replace(/<\/body>/i, '  <script src="script.js"></script>\n</body>');
    } else {
      finalHtml = `${finalHtml}\n<script src="script.js"></script>`;
    }
  }

  return finalHtml;
}

function createPreviewDocument(htmlRaw, cssRaw, jsRaw) {
  let previewHtml = ensureRequiredLinks(htmlRaw || '');

  previewHtml = previewHtml.replace(
    /<link\b[^>]*href\s*=\s*['"][^'"]*style\.css(?:[?#][^'"]*)?['"][^>]*>\s*/gi,
    ''
  );
  previewHtml = previewHtml.replace(
    /<script\b[^>]*src\s*=\s*['"][^'"]*script\.js(?:[?#][^'"]*)?['"][^>]*>\s*<\/script>\s*/gi,
    ''
  );

  const safeCss = cssRaw || '';
  const safeJs = (jsRaw || '').replace(/<\/script>/gi, '<\\/script>');
  const styleTag = `<style>\n${safeCss}\n</style>`;
  const scriptTag = `<script>\n${safeJs}\n<\/script>`;

  if (/<\/head>/i.test(previewHtml)) {
    previewHtml = previewHtml.replace(/<\/head>/i, `${styleTag}\n</head>`);
  } else {
    previewHtml = `${styleTag}\n${previewHtml}`;
  }

  if (/<\/body>/i.test(previewHtml)) {
    previewHtml = previewHtml.replace(/<\/body>/i, `${scriptTag}\n</body>`);
  } else {
    previewHtml = `${previewHtml}\n${scriptTag}`;
  }

  return previewHtml;
}

function openPreviewWindow(previewDocument) {
  const previewWindow = window.open('', '_blank');
  if (!previewWindow) {
    throw new Error('Popup blocked by browser. Allow popups and try again.');
  }

  previewWindow.document.open();
  previewWindow.document.write(previewDocument);
  previewWindow.document.close();
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function confirmDiscard(message) {
  return typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm(message);
}

function resetAll() {
  if (hasProjectContent() && !confirmDiscard('Reset the compiler? All code and uploaded media files will be cleared.')) {
    return;
  }
  state.code['index.html'] = '';
  state.code['style.css'] = '';
  state.code['script.js'] = '';
  renderEditorForSelectedFile();
  fileInput.value = '';
  zipInput.value = '';
  codeFileInput.value = '';
  state.files = [];
  state.hasUnsavedChanges = false;
  state.pathPromptShown = { 'index.html': false, 'style.css': false, 'script.js': false };
  renderFileList();
  updateAssetPathChecker();
  setStatus('Form reset.', 'success');
}

function clearMediaFiles() {
  if (state.files.length > 0 && !confirmDiscard(`Remove all ${state.files.length} uploaded media file(s)?`)) {
    return;
  }
  state.files = [];
  fileInput.value = '';
  renderFileList();
  updateAssetPathChecker();
  setStatus('Media files cleared.', 'success');
}

function clearCodeFiles() {
  const hasCode = Object.values(state.code).some((content) => content.trim().length > 0);
  if (hasCode && !confirmDiscard('Clear the code in index.html, style.css and script.js?')) {
    return;
  }
  state.code['index.html'] = '';
  state.code['style.css'] = '';
  state.code['script.js'] = '';
  renderEditorForSelectedFile();
  updateAssetPathChecker();
  setStatus('Code cleared.', 'success');
}

function setStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.classList.remove('error', 'success');
  if (type === 'error' || type === 'success') {
    statusMessage.classList.add(type);
  }
}

// showAlert is false while typing, so the pop-up only appears when code is loaded.
function updateAssetPathChecker({ showAlert = true } = {}) {
  if (!pathSnippetList || !pathErrorList) {
    return;
  }

  syncEditorToState();
  const refsByFile = collectMediaReferencesByFile();
  const invalidRefs = refsByFile.filter((item) => !isMainFolderMediaReference(item.snippet));
  const selectedFile = getSelectedCodeFile();
  const selectedCode = state.code[selectedFile] || '';
  const selectedSnippets = extractMediaReferences(selectedCode);
  const selectedInvalidSnippets = selectedSnippets.filter((snippet) => !isMainFolderMediaReference(snippet));
  const selectedMismatchSnippets = getMismatchedMediaSnippets(selectedSnippets);
  const selectedErrorSnippets = Array.from(new Set([...selectedInvalidSnippets, ...selectedMismatchSnippets]));

  codeEditor.classList.toggle('code-editor-error', selectedErrorSnippets.length > 0);
  renderCodeHighlights();

  pathSnippetList.innerHTML = '';
  if (refsByFile.length === 0) {
    pathSnippetList.innerHTML = '<li class="muted">No media detected.</li>';
  } else {
    const fragment = document.createDocumentFragment();
    refsByFile.forEach((entry) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${escapeHtml(entry.file)}:</strong> <span class="path-snippet">${escapeHtml(entry.snippet)}</span>`;
      fragment.appendChild(li);
    });
    pathSnippetList.appendChild(fragment);
  }

  pathErrorList.innerHTML = '';
  if (refsByFile.length === 0) {
    pathErrorList.innerHTML = '<li class="muted">No media detected.</li>';
    pathErrorBox?.classList.remove('has-errors');
  } else if (invalidRefs.length === 0) {
    pathErrorList.innerHTML = '<li class="muted">No main folder path errors detected.</li>';
    pathErrorBox?.classList.remove('has-errors');
  } else {
    pathErrorBox?.classList.add('has-errors');
    const fragment = document.createDocumentFragment();
    invalidRefs.forEach((entry) => {
      const snippet = entry.snippet;
      const li = document.createElement('li');
      li.className = 'path-error-text';
      if (/^[.]{1,2}[\\/]/.test(stripMediaQueryAndHash(snippet)) || /[\\/]/.test(stripMediaQueryAndHash(snippet))) {
        li.innerHTML = `<strong>${escapeHtml(entry.file)}:</strong> <span class="path-snippet">${escapeHtml(snippet)}</span> is not in the main folder. Use only the filename (for example, <code>image.jpg</code>).`;
      } else {
        li.innerHTML = `<strong>${escapeHtml(entry.file)}:</strong> <span class="path-snippet">${escapeHtml(snippet)}</span> is not a valid main folder reference. Use only the filename (for example, <code>image.jpg</code>).`;
      }
      fragment.appendChild(li);
    });
    pathErrorList.appendChild(fragment);
  }

  if (selectedInvalidSnippets.length === 0) {
    state.pathPromptShown[selectedFile] = false;
  } else if (showAlert && !state.pathPromptShown[selectedFile]) {
    state.pathPromptShown[selectedFile] = true;
    const snippetPreview = selectedInvalidSnippets.slice(0, 3).join(', ');
    window.alert(
      `Detected media reference error in ${selectedFile}: ${snippetPreview}\n\nPlease change to a main folder reference using only the filename (for example, image.jpg).`
    );
  }

  updateMediaNameChecker();
}

function getReferenceFilename(reference) {
  const rawPath = getDecodedMediaPath(reference);
  if (!rawPath) {
    return '';
  }

  const normalized = rawPath
    .replace(/^\.\/+/, '')
    .replace(/^\.\\+/, '');

  return getBasename(normalized);
}

function getUploadedNameMaps() {
  const uploadedNames = state.files.map((file) => file.name);
  const uploadedSet = new Set(uploadedNames);
  const lowerToUploaded = new Map();

  uploadedNames.forEach((name) => {
    const key = name.toLowerCase();
    if (!lowerToUploaded.has(key)) {
      lowerToUploaded.set(key, []);
    }
    lowerToUploaded.get(key).push(name);
  });

  return { uploadedNames, uploadedSet, lowerToUploaded };
}

function getMismatchedMediaSnippets(snippets) {
  const { uploadedNames, uploadedSet, lowerToUploaded } = getUploadedNameMaps();
  if (uploadedNames.length === 0) {
    return [];
  }

  const mismatched = [];
  snippets.forEach((snippet) => {
    if (!isMainFolderMediaReference(snippet)) {
      return;
    }

    const refName = getReferenceFilename(snippet);
    if (!refName) {
      return;
    }

    if (uploadedSet.has(refName)) {
      return;
    }

    mismatched.push(snippet);
  });

  return Array.from(new Set(mismatched));
}

function updateMediaNameChecker() {
  if (!mediaNameErrorList || !mediaNameMatchList) {
    return;
  }

  const refsByFile = collectMediaReferencesByFile();
  const referencedNames = Array.from(new Set(
    refsByFile
      .map((entry) => getReferenceFilename(entry.snippet))
      .filter(Boolean)
  ));
  const { uploadedNames, uploadedSet, lowerToUploaded } = getUploadedNameMaps();

  mediaNameErrorList.innerHTML = '';
  mediaNameMatchList.innerHTML = '';

  if (referencedNames.length === 0) {
    mediaNameErrorList.innerHTML = '<li class="muted">No media filenames detected in the code.</li>';
    mediaNameMatchList.innerHTML = '<li class="muted">No matches to show.</li>';
    mediaNameErrorBox?.classList.remove('has-errors');
    return;
  }

  if (uploadedNames.length === 0) {
    mediaNameErrorList.innerHTML = '<li class="path-error-text">No media files uploaded yet. Upload media files to check name consistency.</li>';
    mediaNameMatchList.innerHTML = '<li class="muted">No matches to show.</li>';
    mediaNameErrorBox?.classList.add('has-errors');
    return;
  }

  const matched = [];
  const missing = [];
  const caseMismatch = [];

  referencedNames.forEach((name) => {
    if (uploadedSet.has(name)) {
      matched.push(name);
      return;
    }

    const lowerMatches = lowerToUploaded.get(name.toLowerCase()) || [];
    if (lowerMatches.length > 0) {
      caseMismatch.push({ expected: name, uploaded: lowerMatches[0] });
      return;
    }

    missing.push(name);
  });

  const referencedSet = new Set(referencedNames);
  const extraUploaded = uploadedNames.filter((name) => !referencedSet.has(name));

  if (missing.length === 0 && caseMismatch.length === 0) {
    mediaNameErrorList.innerHTML = '<li class="muted">No filename mismatch detected.</li>';
    mediaNameErrorBox?.classList.remove('has-errors');
  } else {
    mediaNameErrorBox?.classList.add('has-errors');
    const fragment = document.createDocumentFragment();

    missing.forEach((name) => {
      const li = document.createElement('li');
      li.className = 'path-error-text';
      li.innerHTML = `<code>${escapeHtml(name)}</code> is referenced in code but not uploaded.`;
      fragment.appendChild(li);
    });

    caseMismatch.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'path-error-text';
      li.innerHTML = `Case mismatch: code uses <code>${escapeHtml(entry.expected)}</code>, but uploaded file is <code>${escapeHtml(entry.uploaded)}</code>.`;
      fragment.appendChild(li);
    });

    mediaNameErrorList.appendChild(fragment);
  }

  extraUploaded.forEach((name) => {
    const li = document.createElement('li');
    li.className = 'muted';
    li.innerHTML = `<code>${escapeHtml(name)}</code> is included in the ZIP but not referenced in the code.`;
    mediaNameErrorList.appendChild(li);
  });

  if (matched.length === 0) {
    mediaNameMatchList.innerHTML = '<li class="muted">No matching filenames yet.</li>';
  } else {
    const fragment = document.createDocumentFragment();
    matched.forEach((name) => {
      const li = document.createElement('li');
      li.innerHTML = `<code>${escapeHtml(name)}</code>`;
      fragment.appendChild(li);
    });
    mediaNameMatchList.appendChild(fragment);
  }
}

function stripMediaQueryAndHash(value) {
  return value.split(/[?#]/, 1)[0] || '';
}

function getDecodedMediaPath(reference) {
  const path = stripMediaQueryAndHash(reference).trim();
  try {
    return decodeURIComponent(path);
  } catch (_error) {
    return path;
  }
}

function isMainFolderMediaReference(reference) {
  const rawPath = getDecodedMediaPath(reference);
  if (!rawPath) {
    return false;
  }

  const normalized = rawPath
    .replace(/^\.\/+/, '')
    .replace(/^\.\\+/, '');

  return normalized.length > 0 && !/[\\/<>:"|?*\u0000-\u001f]/.test(normalized);
}

function getMediaReferenceMatches(text) {
  const results = [];
  const comments = [];
  const extension = /[^\\/]\.(?:jpg|jpeg|png|gif|webp|svg|mp3|wav|ogg|m4a|mp4|webm|mov)(?:[?#][^\r\n]*)?$/i;

  function add(raw, start, contextStart = start) {
    if (comments.some(([from, to]) => contextStart >= from && contextStart < to)) return;
    const trimmed = raw.trim();
    const snippet = trimmed
      .replace(/\\(["'`\\ ()])/g, '$1')
      .replace(/&(?:amp|apos|quot|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
        const named = { '&amp;': '&', '&apos;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>' };
        if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
        const hex = /^&#x/i.test(entity);
        const point = parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
        return point <= 0x10ffff ? String.fromCodePoint(point) : entity;
      });
    if (!extension.test(snippet) || /[\r\n<>{}]|:\s/.test(snippet)) return;
    const offset = start + raw.length - raw.trimStart().length;
    results.push({ snippet, start: offset, end: offset + trimmed.length });
  }

  // Read complete quoted filenames, rather than breaking at spaces or brackets.
  // Consume comments and non-media strings so filenames in messages are not errors.
  const tokens = /<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|(["'`])((?:\\[\s\S]|(?!\1)[^\\\r\n])*)\1/g;
  for (const match of text.matchAll(tokens)) {
    if (!match[1]) {
      comments.push([match.index, match.index + match[0].length]);
      continue;
    }
    const preceding = text.slice(Math.max(0, match.index - 100), match.index);
    if (/(?:textContent|innerText|innerHTML|alt|title|srcset|message|description|hint|feedback)\s*(?:=|:)\s*$/i.test(preceding)) continue;
    add(match[2], match.index + 1);
  }

  const attributes = /\b(?:src|poster|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  for (const match of text.matchAll(attributes)) {
    const raw = match[1] ?? match[2] ?? match[3];
    add(raw, match.index + match[0].indexOf(raw, match[0].indexOf('=') + 1), match.index);
  }

  const sourceSets = /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  for (const match of text.matchAll(sourceSets)) {
    const raw = match[1] ?? match[2];
    const start = match.index + match[0].indexOf(raw, match[0].indexOf('=') + 1);
    for (const entry of raw.matchAll(/(?:^|,)\s*([^,\s]+)(?:\s+[^,]*)?/g)) {
      add(entry[1], start + entry.index + entry[0].indexOf(entry[1]), match.index);
    }
  }

  const urls = /\burl\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|((?:\\.|[^\s)\\])+))\s*\)/gi;
  for (const match of text.matchAll(urls)) {
    const raw = match[1] ?? match[2] ?? match[3];
    add(raw, match.index + match[0].indexOf(raw), match.index);
  }

  const seen = new Set();
  return results.sort((a, b) => a.start - b.start).filter((match) => {
    const key = `${match.start}:${match.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractMediaReferences(text) {
  return Array.from(new Set(getMediaReferenceMatches(text).map((match) => match.snippet)));
}

function collectMediaReferencesByFile() {
  const entries = [];
  const files = ['index.html', 'style.css', 'script.js'];

  files.forEach((file) => {
    const refs = extractMediaReferences(state.code[file] || '');
    refs.forEach((snippet) => {
      entries.push({ file, snippet });
    });
  });

  return entries;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderCodeHighlights() {
  if (!codeHighlightLayer) {
    return;
  }

  const source = state.code[getSelectedCodeFile()] || '';
  const mismatchSnippetSet = new Set(getMismatchedMediaSnippets(extractMediaReferences(source)));
  let cursor = 0;
  let html = '';
  for (const match of getMediaReferenceMatches(source)) {
    const { snippet: token, start, end } = match;
    if (start < cursor) continue;
    const originalToken = source.slice(start, end);

    html += escapeHtml(source.slice(cursor, start));
    const hasPathError = !isMainFolderMediaReference(token);
    const hasNameMismatch = mismatchSnippetSet.has(token);
    if (hasPathError || hasNameMismatch) {
      html += `<span class="invalid-ref">${escapeHtml(originalToken)}</span>`;
    } else {
      html += escapeHtml(originalToken);
    }

    cursor = end;
  }

  html += escapeHtml(source.slice(cursor));
  // A <pre> drops a final empty line, which would misalign it with the textarea.
  if (source.endsWith('\n')) {
    html += ' ';
  }
  codeHighlightLayer.innerHTML = html.length > 0 ? html : ' ';
}

function syncCodeOverlayScroll() {
  if (!codeHighlightLayer) {
    return;
  }
  codeHighlightLayer.scrollTop = codeEditor.scrollTop;
  codeHighlightLayer.scrollLeft = codeEditor.scrollLeft;
}
