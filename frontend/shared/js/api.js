/* Shared same-origin API client. Pages may use window.CASIA_API.request(). */
(() => {
  async function request(endpoint, options = {}) {
    const url = endpoint.startsWith("/") ? endpoint : `/api/${endpoint}`;
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      const error = new Error(data.message || `Request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
  }
  window.CASIA_API = Object.freeze({ request });
})();
