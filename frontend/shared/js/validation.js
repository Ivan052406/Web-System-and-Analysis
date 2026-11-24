/* Shared client-side validation helpers; server-side validation remains authoritative. */
window.CASIA_VALIDATION = Object.freeze({
  isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim()); },
  isNonEmpty(value) { return String(value ?? "").trim().length > 0; },
  minLength(value, length) { return String(value ?? "").length >= Number(length); }
});
