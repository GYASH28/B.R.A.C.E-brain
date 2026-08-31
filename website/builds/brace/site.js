(() => {
  "use strict";
  const current = document.currentScript;
  const script = document.createElement("script");
  script.src = new URL("site-v5.js", current?.src || location.href).href;
  script.async = false;
  script.addEventListener("load", () => {
    document.documentElement.dataset.braceRuntime = "v5";
    const fieldScript = document.createElement("script");
    fieldScript.src = new URL("site-v6.js", current?.src || location.href).href;
    fieldScript.async = false;
    document.body.append(fieldScript);
  }, { once: true });
  script.addEventListener("error", () => {
    document.body.classList.remove("has-opening-film");
    document.querySelector("#opening-film")?.remove();
    console.error("BRACE V5 runtime failed to load.");
  }, { once: true });
  current?.after(script);
})();
