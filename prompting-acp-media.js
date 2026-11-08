(() => {
  const featureSections = Array.from(document.querySelectorAll('.feature'));
  const featureJump = document.getElementById('featureJump');
  const backToTop = document.getElementById('backToTop');

  groupPromptLines();
  const promptEntries = collectPromptEntries();

  if (featureJump) {
    promptEntries.forEach((entry) => {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.label;
      featureJump.appendChild(option);
    });

    featureJump.addEventListener('change', (event) => {
      const selectedId = event.target.value;
      if (!selectedId) return;
      const target = document.getElementById(selectedId);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Reset so the same prompt can be chosen again after scrolling away.
      featureJump.value = '';
    });
  }

  promptEntries.forEach((entry) => {
    const h3 = entry.heading;
    const promptBox = entry.promptBox;
    if (!promptBox) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'section-copy-btn';
    button.textContent = 'Copy Prompt';
    h3.appendChild(button);

    button.setAttribute('aria-label', `Copy prompt: ${entry.label}`);
    button.addEventListener('click', async () => {
      const textToCopy = collectPromptBlockText(h3);
      if (!textToCopy) return;
      await copyText(textToCopy, button, 'Copied!');
    });
  });

  if (backToTop) {
    const updateBackToTop = () => {
      backToTop.style.display = window.scrollY > 320 ? 'inline-block' : 'none';
    };
    window.addEventListener('scroll', updateBackToTop, { passive: true });
    updateBackToTop();

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function collectPromptBlockText(heading) {
    const lines = [];
    let next = heading.nextElementSibling;

    while (next && next.tagName !== 'H3') {
      if (next.classList.contains('prompt-box')) {
        const promptLines = Array.from(next.querySelectorAll('.prompt-line'));
        promptLines.forEach((line) => lines.push(line.innerText.trim()));
        break;
      }
      if (next.classList.contains('prompt-line')) {
        lines.push(next.innerText.trim());
      }
      next = next.nextElementSibling;
    }

    return lines.filter(Boolean).join('\n');
  }

  async function copyText(content, button, doneLabel) {
    const originalLabel = button.textContent;

    let copied = false;
    try {
      await navigator.clipboard.writeText(content);
      copied = true;
    } catch (_error) {
      // Opened from a local file or blocked by the browser: use a hidden text box.
      const tempArea = document.createElement('textarea');
      tempArea.value = content;
      tempArea.setAttribute('readonly', '');
      tempArea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
      document.body.appendChild(tempArea);
      tempArea.select();
      try {
        copied = document.execCommand('copy');
      } catch (_copyError) {
        copied = false;
      }
      document.body.removeChild(tempArea);
      button.focus({ preventScroll: true });
    }

    button.textContent = copied ? doneLabel : 'Copy failed - select the text and press Ctrl+C';
    clearTimeout(button.copyLabelTimer);
    button.copyLabelTimer = setTimeout(() => {
      button.textContent = originalLabel;
    }, copied ? 1200 : 3500);
  }

  function groupPromptLines() {
    const sections = Array.from(document.querySelectorAll('.feature'));
    sections.forEach((section) => {
      const lines = Array.from(section.querySelectorAll('.prompt-line'));
      lines.forEach((line) => {
        if (!line.parentElement || line.parentElement.classList.contains('prompt-box')) {
          return;
        }

        const prev = line.previousElementSibling;
        const startsGroup = !prev || !prev.classList.contains('prompt-line');
        if (!startsGroup) {
          return;
        }

        const box = document.createElement('div');
        box.className = 'prompt-box';
        line.parentNode.insertBefore(box, line);

        let current = line;
        while (current && current.classList.contains('prompt-line')) {
          const next = current.nextElementSibling;
          box.appendChild(current);
          current = next;
        }
      });
    });
  }

  function collectPromptEntries() {
    const headings = Array.from(document.querySelectorAll('.feature h3'));
    const entries = [];

    headings.forEach((heading, index) => {
      let next = heading.nextElementSibling;
      let promptBox = null;
      while (next && next.tagName !== 'H3') {
        if (next.classList.contains('prompt-box')) {
          promptBox = next;
          break;
        }
        next = next.nextElementSibling;
      }
      if (!promptBox) return;

      const id = `prompt-${index + 1}`;
      heading.id = id;
      const raw = heading.childNodes[0]?.textContent?.trim() || heading.textContent.trim();
      const label = raw.replace(/^\d+\.\s*/, '').trim();

      entries.push({ id, label, heading, promptBox });
    });

    return entries;
  }
})();
