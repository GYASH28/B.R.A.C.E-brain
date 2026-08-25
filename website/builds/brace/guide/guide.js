(() => {
  "use strict";

  document.querySelectorAll(".copy-code").forEach((button) => {
    button.addEventListener("click", async () => {
      const code = button.parentElement.querySelector("code")?.textContent || "";
      let copied = false;
      try {
        await navigator.clipboard.writeText(code.trim());
        copied = true;
      } catch {
        const range = document.createRange();
        range.selectNodeContents(button.parentElement.querySelector("code"));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        copied = document.execCommand("copy");
        selection.removeAllRanges();
      }
      button.textContent = copied ? "Copied" : "Selected";
      window.setTimeout(() => { button.textContent = "Copy"; }, 1800);
    });
  });

  const tocLinks = Array.from(document.querySelectorAll(".guide-toc a"));
  const observer = new IntersectionObserver((entries) => {
    const active = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (!active) return;
    tocLinks.forEach((link) => link.setAttribute("aria-current", String(link.hash === `#${active.target.id}`)));
  }, { rootMargin: "-20% 0px -66%", threshold: [0, 0.15, 0.45] });
  document.querySelectorAll(".guide-step").forEach((section) => observer.observe(section));
})();
