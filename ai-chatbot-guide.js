(() => {
  'use strict';

  const form = document.getElementById('activityBrief');
  const prompt = document.getElementById('starterMarkdown');
  const status = document.getElementById('promptStatus');
  const briefStatus = document.getElementById('briefStatus');
  const activityTypeSuggestions = document.getElementById('activityTypeSuggestions');
  const customActivityType = document.getElementById('activityType');
  const customActivityTypeField = document.getElementById('customActivityTypeField');
  // Read the original template, not a generated value the browser may restore.
  const basePrompt = prompt.defaultValue.trim();
  const [promptTitle, ...instructionLines] = basePrompt.split('\n');
  const promptInstructions = instructionLines.join('\n').trim();
  const fields = [
    ['topic', 'Subject / topic'],
    ['level', 'Learner level'],
    ['goal', 'Learning objective'],
    ['type', 'Activity type'],
    ['actions', 'What students will do'],
    ['details', 'Feedback for students'],
    ['media', 'Media files and how to use them']
  ];

  function updatePrompt() {
    const isCustomType = activityTypeSuggestions.value === '__custom__';
    customActivityTypeField.hidden = !isCustomType;
    customActivityType.disabled = !isCustomType;
    const brief = fields.map(([name, label]) => {
      const field = name === 'type' && isCustomType ? customActivityType : form.elements.namedItem(name);
      const value = field.value.trim();
      return value ? `### ${label}\n${value}` : '';
    }).filter(Boolean);
    prompt.value = brief.length
      ? `${promptTitle}\n\n## My teacher brief\n\n${brief.join('\n\n')}\n\n${promptInstructions}`
      : basePrompt;
  }

  activityTypeSuggestions.addEventListener('change', () => {
    updatePrompt();
    if (activityTypeSuggestions.value === '__custom__') customActivityType.focus();
  });

  form.addEventListener('submit', (event) => event.preventDefault());
  function handleBriefChange() {
    updatePrompt();
    status.textContent = '';
    briefStatus.textContent = '';
  }

  form.addEventListener('input', handleBriefChange);
  form.addEventListener('change', handleBriefChange);
  form.addEventListener('reset', () => {
    // The reset event fires before the browser restores the field values.
    setTimeout(() => {
      updatePrompt();
      briefStatus.textContent = 'Details cleared.';
      status.textContent = '';
    }, 0);
  });

  document.getElementById('loadExample').addEventListener('click', () => {
    const example = {
      topic: 'English — action words',
      level: 'Primary 2',
      goal: 'Use sleeping and jumping to complete simple sentences about a cat.',
      type: 'Fill in the blanks (type an answer)',
      actions: 'Show the sleeping cat picture, then let students play the jumping cat video. For each, ask students to complete "The cat is ___." by typing sleeping or jumping into a text box, then clicking Check answer. Add a Hear the cat button for the meow sound.',
      details: 'Show "Well done!" for a correct answer. Ignore capital letters and extra spaces when checking. For an incorrect answer, give a simple hint and let students try again. If the text box is empty, ask them to type an answer. Include a Start again button.',
      media: 'sleeping-cat.jpg — image — show before the first question; alt text: A cat sleeping.\njumping-cat.mp4 — video — show before the second question with player controls; text summary: A cat is jumping.\nmeow.mp3 — sound — play only when students click Hear the cat; text equivalent: A cat meows.'
    };
    for (const [name, value] of Object.entries(example)) form.elements.namedItem(name).value = value;
    updatePrompt();
    briefStatus.textContent = 'Primary 2 English example added. Edit any field to make it yours.';
    status.textContent = '';
  });

  document.querySelectorAll('[data-copy-target]').forEach((button) => {
    button.addEventListener('click', async () => {
      updatePrompt();
      const source = document.getElementById(button.dataset.copyTarget);
      const content = source.value;
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(content);
          copied = true;
        }
      } catch (_error) {
        // Local files and some browser settings require the selection fallback.
      }
      if (!copied) {
        const details = source.closest('details');
        const wasOpen = details?.open;
        if (details) details.open = true;
        const scrollPosition = source.scrollTop;
        source.focus({ preventScroll: true });
        source.select();
        try {
          copied = document.execCommand('copy');
        } catch (_error) {
          copied = false;
        }
        source.scrollTop = scrollPosition;
        if (copied && details && !wasOpen) details.open = false;
      }
      if (copied) {
        button.focus({ preventScroll: true });
        status.textContent = 'Copied. Paste it into your chatbot.';
      } else {
        status.textContent = 'Prompt selected. Press Ctrl+C or Command+C to copy.';
      }
      const originalLabel = button.dataset.originalLabel || button.textContent;
      button.dataset.originalLabel = originalLabel;
      button.textContent = copied ? 'Copied!' : 'Selected — copy manually';
      clearTimeout(button.copyLabelTimer);
      button.copyLabelTimer = setTimeout(() => { button.textContent = originalLabel; }, 2200);
    });
  });

  document.getElementById('downloadMarkdown').addEventListener('click', () => {
    updatePrompt();
    const blob = new Blob([prompt.value + '\n'], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sls-interactive-chatbot-prompt.md';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Prompt download started.';
  });

  // Include any fields restored by the browser when revisiting the page.
  updatePrompt();
  window.addEventListener('pageshow', updatePrompt);
})();
