(() => {
  const tabs = Array.from(document.querySelectorAll('.video-step-tab'));
  const panels = Array.from(document.querySelectorAll('.video-step-panel'));

  if (tabs.length === 0 || panels.length === 0) {
    return;
  }

  // Link each tab to its panel for screen readers.
  tabs.forEach((tab, index) => {
    const panel = document.getElementById(tab.dataset.videoTarget);
    if (!tab.id) tab.id = `videoTab${index + 1}`;
    tab.setAttribute('aria-controls', tab.dataset.videoTarget);
    tab.tabIndex = tab.classList.contains('is-active') ? 0 : -1;
    panel?.setAttribute('aria-labelledby', tab.id);
  });

  tabs.forEach((tab, index) => {
    // Arrow keys move between steps, as expected for a tab list.
    tab.addEventListener('keydown', (event) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      let next = null;
      if (event.key in keys) next = tabs[(index + keys[event.key] + tabs.length) % tabs.length];
      if (event.key === 'Home') next = tabs[0];
      if (event.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      next.focus();
      next.click();
    });

    tab.addEventListener('click', () => {
      const targetId = tab.dataset.videoTarget;
      if (!targetId) return;

      tabs.forEach((item) => {
        const isActive = item === tab;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        item.tabIndex = isActive ? 0 : -1;
      });

      panels.forEach((panel) => {
        const isActive = panel.id === targetId;
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;

        if (!isActive) {
          const video = panel.querySelector('video');
          if (video && !video.paused) {
            video.pause();
          }
        }
      });
    });
  });
})();
