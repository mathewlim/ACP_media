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
  const blockedTags = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT"]);

  function injectStyles() {
    if (document.getElementById("glossary-hover-styles")) return;

    const style = document.createElement("style");
    style.id = "glossary-hover-styles";
    style.textContent = `
      .glossary-term {
        position: relative;
        cursor: help;
        text-decoration: underline dotted rgba(173, 216, 255, 0.95);
        text-underline-offset: 0.14em;
      }

      .glossary-term::after {
        content: attr(data-glossary-definition);
        position: absolute;
        left: 0;
        bottom: calc(100% + 8px);
        z-index: 999;
        width: max-content;
        max-width: min(360px, 82vw);
        padding: 0.5rem 0.62rem;
        border-radius: 8px;
        border: 1px solid #6fbff0;
        background: #0b1b35;
        color: #eaf4ff;
        font-size: 0.86rem;
        line-height: 1.35;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
        white-space: normal;
        opacity: 0;
        visibility: hidden;
        transform: translateY(4px);
        transition: opacity 120ms ease, transform 120ms ease, visibility 120ms ease;
        pointer-events: none;
      }

      .glossary-term:hover::after {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
    `;

    document.head.appendChild(style);
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
      term.setAttribute("data-glossary-definition", GLOSSARY[matchedText.toLowerCase()]);
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
  });
})();
