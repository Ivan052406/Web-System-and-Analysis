/* Shared browser helpers. */
window.CASIA_UTILS = Object.freeze({
  escapeHTML(value) { return String(value ?? "").replace(/[&<>\"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;", "'":"&#39;"}[ch])); },
  formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(); }
});
