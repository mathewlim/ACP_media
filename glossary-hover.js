(() => {
  const GLOSSARY = {
    "codebase": "Codebase: all the code in the HTML, CSS, and JavaScript files.",
    "placeholder": "Placeholder: A temporary element that marks where media or content will be inserted later.",
    "script.js": "script.js: The JavaScript file that controls behavior and interactivity.",
    "index.html": "index.html: The main HTML file that defines page structure and content.",
    "style.css": "style.css: The CSS file that controls visual styling such as layout, colors, and spacing."
  };

  const termPattern = /(?<![\w.])(index\.html|script\.js|style\.css|codebase|placeholder)(?![\w.])/gi;
  const testPattern = /index\.html|script\.js|style\.css|codebase|placeholder/i;
  const blockedTags = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "BUTTON", "SELECT", "OPTION", "PRE"]);

  let tooltip = null;
  let activeTerm = null;

  function injectStyles() {
    if (document.getElementById("glossary-hover-styles")) return;

    const style = document.createElement("style");
    style.id = "glossary-hover-styles";
    // One shared, fixed-position tooltip: hidden tooltips no longer widen the
    // page, and the tooltip is kept inside the screen near the edges.
    style.textContent = `
      .glossary-term {
        cursor: help;
        text-decoration: underline dotted rgba(173, 216, 255, 0.95);
        text-underline-offset: 0.14em;
      }

      .glossary-tooltip {
        position: fixed;
        z-index: 999;
        max-width: min(360px, calc(100vw - 16px));
        padding: 0.5rem 0.62rem;
        border-radius: 8px;
        border: 1px solid #6fbff0;
        background: #0b1b35;
        color: #eaf4ff;
        font-size: 0.86rem;
        font-weight: 500;
        line-height: 1.35;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
        pointer-events: none;
      }

      .glossary-tooltip[hidden] {
        display: none;
      }
    `;

    document.head.appendChild(style);
  }

  function showTooltip(term) {
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "glossary-tooltip";
      tooltip.id = "glossary-tooltip";
      tooltip.setAttribute("role", "tooltip");
      document.body.appendChild(tooltip);
    }
    activeTerm = term;
    tooltip.textContent = term.dataset.glossaryDefinition;
    tooltip.hidden = false;

    const gap = 8;
    const rect = term.getBoundingClientRect();
    const tip = tooltip.getBoundingClientRect();
    const left = Math.min(Math.max(gap, rect.left), window.innerWidth - tip.width - gap);
    let top = rect.top - tip.height - gap;
    if (top < gap) top = rect.bottom + gap;
    tooltip.style.left = `${Math.max(gap, left)}px`;
    tooltip.style.top = `${top}px`;
  }

  function hideTooltip() {
    activeTerm = null;
    if (tooltip) tooltip.hidden = true;
  }

  function bindTooltipEvents() {
    let lastPointerType = "mouse";
    document.addEventListener("pointerdown", (event) => {
      lastPointerType = event.pointerType || "mouse";
    });
    // Hover only for a real mouse: a tap also fires hover events, which used
    // to open the pop-up just before the tap closed it again.
    document.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse") return;
      const term = event.target.closest?.(".glossary-term");
      if (term && term !== activeTerm) showTooltip(term);
      else if (!term && activeTerm) hideTooltip();
    });
    // Tap a term to show its pop-up, tap it again (or anywhere else) to close.
    document.addEventListener("click", (event) => {
      const term = event.target.closest?.(".glossary-term");
      if (term && (term !== activeTerm || lastPointerType === "mouse")) showTooltip(term);
      else if (activeTerm) hideTooltip();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideTooltip();
    });
    // Phones scroll slightly during a tap (the address bar moves), so keep the
    // pop-up next to its word and close it only once the word is off screen.
    const followTerm = () => {
      if (!activeTerm) return;
      const rect = activeTerm.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) hideTooltip();
      else showTooltip(activeTerm);
    };
    window.addEventListener("scroll", followTerm, { passive: true });
    window.addEventListener("resize", followTerm);
  }

  function isBlocked(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    if (parent.closest(".glossary-term")) return true;

    let current = parent;
    while (current) {
      if (blockedTags.has(current.tagName)) return true;
      current = current.parentElement;
    }

    return false;
  }

  function replaceTermsInTextNode(textNode) {
    const text = textNode.nodeValue;
    if (!text || !testPattern.test(text)) return;

    termPattern.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = termPattern.exec(text)) !== null) {
      const matchedText = match[0];
      const start = match.index;

      if (start > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }

      const term = document.createElement("span");
      term.className = "glossary-term";
      term.textContent = matchedText;
      term.dataset.glossaryDefinition = GLOSSARY[matchedText.toLowerCase()];
      frag.appendChild(term);

      lastIndex = start + matchedText.length;
    }

    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.replaceWith(frag);
  }

  function applyGlossary() {
    if (!document.body) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node = walker.nextNode();

    while (node) {
      if (!isBlocked(node)) {
        textNodes.push(node);
      }
      node = walker.nextNode();
    }

    textNodes.forEach(replaceTermsInTextNode);
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    applyGlossary();
    bindTooltipEvents();
  });
})();
