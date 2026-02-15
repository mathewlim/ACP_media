(() => {
  const tabs = Array.from(document.querySelectorAll('.video-step-tab'));
  const panels = Array.from(document.querySelectorAll('.video-step-panel'));

  if (tabs.length === 0 || panels.length === 0) {
    return;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.videoTarget;
      if (!targetId) return;

      tabs.forEach((item) => {
        const isActive = item === tab;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
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
