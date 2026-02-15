const ALLOWED_MEDIA_EXTENSIONS = new Set([
  'mp3', 'mp4', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'wav', 'ogg', 'webm', 'mov', 'm4a'
]);
const CORE_FILENAME_SET = new Set(['index.html', 'style.css', 'styles.css', 'script.js']);
const CANONICAL_CORE_FILENAMES = new Set(['index.html', 'style.css', 'script.js']);

const state = {
  files: [],
  code: {
    'index.html': '',
    'style.css': '',
    'script.js': ''
  },
  activeCodeFile: 'index.html',
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
  updateAssetPathChecker();
});
codeEditor.addEventListener('scroll', syncCodeOverlayScroll);
codeFileInput.addEventListener('change', async (event) => {
  await loadSingleCodeInput(event.target.files?.[0], getSelectedCodeFile());
  codeFileInput.value = '';
});
fileInput.addEventListener('change', async (event) => {
  await addFiles(event.target.files);
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

  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
}

async function addFiles(fileCollection) {
  if (!fileCollection || fileCollection.length === 0) {
    return;
  }

  const incomingFiles = Array.from(fileCollection);
  let loadedCodeCount = 0;
  let addedMediaCount = 0;
  let importedZipCount = 0;
  const rejected = [];

  for (const file of incomingFiles) {
    const extension = getFileExtension(file.name);
    const lowerName = file.name.toLowerCase();

    if (extension === 'zip') {
      const imported = await importProjectZip(file, true);
      if (imported) {
        importedZipCount += 1;
      } else {
        rejected.push(file.name);
      }
      continue;
    }

    if (CORE_FILENAME_SET.has(lowerName)) {
      const loaded = await loadCodeFile(file, lowerName);
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

    const uniqueName = getUniqueFilename(file.name, state.files.map((item) => item.name));
    const fileToStore = uniqueName === file.name
      ? file
      : new File([file], uniqueName, { type: file.type, lastModified: file.lastModified });

    state.files.push(fileToStore);
    addedMediaCount += 1;
  }

  renderFileList();
  updateAssetPathChecker();
  setStatus(buildUploadStatusMessage(loadedCodeCount, addedMediaCount, importedZipCount, rejected.length), rejected.length > 0 ? 'error' : 'success');
  fileInput.value = '';
}

function buildUploadStatusMessage(codeCount, mediaCount, zipCount, rejectedCount) {
  const parts = [];
  if (codeCount > 0) {
    parts.push(`${codeCount} code file(s) loaded`);
  }
  if (mediaCount > 0) {
    parts.push(`${mediaCount} media file(s) added`);
  }
  if (zipCount > 0) {
    parts.push(`${zipCount} ZIP file(s) imported`);
  }
  if (rejectedCount > 0) {
    parts.push(`${rejectedCount} unsupported file(s) skipped`);
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
    const allEntries = Object.values(zip.files).filter((entry) => !entry.dir);
    if (allEntries.length === 0) {
      if (!isSilent) {
        setStatus('ZIP import failed: no files found inside the archive.', 'error');
      }
      return false;
    }

    const byCoreFile = new Map();
    for (const entry of allEntries) {
      const basename = getBasename(entry.name).toLowerCase();
      if (!CORE_FILENAME_SET.has(basename)) {
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

    if (htmlEntry) {
      state.code['index.html'] = await htmlEntry.async('string');
      loadedCodeCount += 1;
    }
    if (cssEntry) {
      state.code['style.css'] = await cssEntry.async('string');
      loadedCodeCount += 1;
    }
    if (jsEntry) {
      state.code['script.js'] = await jsEntry.async('string');
      loadedCodeCount += 1;
    }
    renderEditorForSelectedFile();

    const importedAssets = [];

    for (const entry of allEntries) {
      const baseName = getBasename(entry.name);
      if (!baseName) {
        continue;
      }
      if (CORE_FILENAME_SET.has(baseName.toLowerCase())) {
        continue;
      }

      const blob = await entry.async('blob');
      const uniqueName = getUniqueFilename(baseName, importedAssets.map((item) => item.name));
      importedAssets.push(new File([blob], uniqueName, { type: blob.type }));
    }

    state.files = importedAssets;
    renderFileList();
    updateAssetPathChecker();

    if (!isSilent) {
      setStatus(`ZIP imported: ${loadedCodeCount} code file(s) loaded and ${importedAssets.length} media file(s) staged in the main folder.`, 'success');
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
    li.textContent = `${file.name} (${formatFileSize(file.size)})`;
    fragment.appendChild(li);
  }

  fileList.appendChild(fragment);
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
  if (typeof JSZip === 'undefined') {
    setStatus('ZIP library failed to load. Check your local jszip.min.js file and reload.', 'error');
    return;
  }

  setStatus('Generating ZIP...', '');

  try {
    const zip = new JSZip();

    syncEditorToState();
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
    setStatus('ZIP generated and download started.', 'success');
  } catch (error) {
    console.error(error);
    setStatus(`Failed to generate ZIP: ${error.message}`, 'error');
  }
}

function previewProject() {
  try {
    syncEditorToState();
    const htmlRaw = state.code['index.html'] || '';
    const cssRaw = state.code['style.css'] || '';
    const jsRaw = state.code['script.js'] || '';

    const previewDocument = createPreviewDocument(htmlRaw, cssRaw, jsRaw);
    openPreviewWindow(previewDocument);
    setStatus('', '');
  } catch (error) {
    console.error(error);
    setStatus(`Preview failed: ${error.message}`, 'error');
  }
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
  URL.revokeObjectURL(url);
}

function resetAll() {
  state.code['index.html'] = '';
  state.code['style.css'] = '';
  state.code['script.js'] = '';
  renderEditorForSelectedFile();
  fileInput.value = '';
  zipInput.value = '';
  codeFileInput.value = '';
  state.files = [];
  renderFileList();
  updateAssetPathChecker();
  setStatus('Form reset.', 'success');
}

function clearMediaFiles() {
  state.files = [];
  fileInput.value = '';
  renderFileList();
  updateAssetPathChecker();
  setStatus('Media files cleared.', 'success');
}

function clearCodeFiles() {
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

function updateAssetPathChecker() {
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
  } else if (!state.pathPromptShown[selectedFile]) {
    state.pathPromptShown[selectedFile] = true;
    const snippetPreview = selectedInvalidSnippets.slice(0, 3).join(', ');
    window.alert(
      `Detected media reference error in ${selectedFile}: ${snippetPreview}\n\nPlease change to a main folder reference using only the filename (for example, image.jpg).`
    );
  }

  updateMediaNameChecker();
}

function getReferenceFilename(reference) {
  const rawPath = stripMediaQueryAndHash(reference).trim();
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
    mediaNameErrorList.innerHTML = '<li class="muted">No media filenames detected in code base.</li>';
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

  if (missing.length === 0 && caseMismatch.length === 0 && extraUploaded.length === 0) {
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

    extraUploaded.forEach((name) => {
      const li = document.createElement('li');
      li.className = 'path-error-text';
      li.innerHTML = `<code>${escapeHtml(name)}</code> is uploaded but not referenced in code.`;
      fragment.appendChild(li);
    });

    mediaNameErrorList.appendChild(fragment);
  }

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

function isMainFolderMediaReference(reference) {
  const rawPath = stripMediaQueryAndHash(reference).trim();
  if (!rawPath) {
    return false;
  }

  const normalized = rawPath
    .replace(/^\.\/+/, '')
    .replace(/^\.\\+/, '');

  return normalized.length > 0 && !normalized.includes('/') && !normalized.includes('\\');
}

function extractMediaReferences(text) {
  const matches = text.match(/\b[\w./-]+\.(?:jpg|jpeg|png|gif|webp|svg|mp3|wav|ogg|m4a|mp4|webm|mov)(?:[?#][^\s"'`)\]}<>]*)?/gi) || [];
  const unique = new Set();

  matches.forEach((raw) => {
    const cleaned = raw.replace(/[.,;:!?]+$/g, '');
    if (cleaned) {
      unique.add(cleaned);
    }
  });

  return Array.from(unique);
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
  const regex = /\b[\w./-]+\.(?:jpg|jpeg|png|gif|webp|svg|mp3|wav|ogg|m4a|mp4|webm|mov)(?:[?#][^\s"'`)\]}<>]*)?/gi;
  const mismatchSnippetSet = new Set(getMismatchedMediaSnippets(extractMediaReferences(source)));
  let cursor = 0;
  let html = '';
  let match = regex.exec(source);

  while (match) {
    const token = match[0];
    const start = match.index;
    const end = start + token.length;

    html += escapeHtml(source.slice(cursor, start));
    const hasPathError = !isMainFolderMediaReference(token);
    const hasNameMismatch = mismatchSnippetSet.has(token);
    if (hasPathError || hasNameMismatch) {
      html += `<span class="invalid-ref">${escapeHtml(token)}</span>`;
    } else {
      html += escapeHtml(token);
    }

    cursor = end;
    match = regex.exec(source);
  }

  html += escapeHtml(source.slice(cursor));
  codeHighlightLayer.innerHTML = html.length > 0 ? html : ' ';
}

function syncCodeOverlayScroll() {
  if (!codeHighlightLayer) {
    return;
  }
  codeHighlightLayer.scrollTop = codeEditor.scrollTop;
  codeHighlightLayer.scrollLeft = codeEditor.scrollLeft;
}
