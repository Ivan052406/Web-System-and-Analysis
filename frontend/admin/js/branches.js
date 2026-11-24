const BRANCH_API = "/api/branches";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("branchForm")?.addEventListener("submit", createBranch);
  loadBranches();
});

async function branchRequest(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options, headers: { "Accept": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

function showBranchMessage(message, type = "success") {
  const el = document.getElementById("branchMessage");
  el.textContent = message;
  el.className = `branch-message ${message ? type : ""}`;
}

async function loadBranches() {
  const table = document.getElementById("branchesTable");
  table.innerHTML = '<tr><td colspan="4">Loading branches...</td></tr>';
  try {
    const result = await branchRequest(BRANCH_API);
    const branches = result.branches || [];
    document.getElementById("branchCount").textContent = `${branches.length} branch${branches.length === 1 ? "" : "es"}`;
    if (!branches.length) { table.innerHTML = '<tr><td colspan="4">No branches found.</td></tr>'; return; }
    table.innerHTML = branches.map(branch => `
      <tr>
        <td><strong>${escapeBranchHTML(branch.branch_name)}</strong></td>
        <td>${escapeBranchHTML(branch.address || "—")}</td>
        <td><span class="branch-status ${branch.status === "inactive" ? "inactive" : ""}">${escapeBranchHTML(branch.status)}</span></td>
        <td>${branch.branch_name === "Main Branch" ? '<small>Primary</small>' : `<button class="branch-action" data-id="${Number(branch.branch_id)}" data-status="${branch.status}" type="button">${branch.status === "active" ? "Deactivate" : "Activate"}</button>`}</td>
      </tr>`).join("");
    table.querySelectorAll("button[data-id]").forEach(button => button.addEventListener("click", () => updateBranchStatus(button)));
  } catch (error) {
    table.innerHTML = '<tr><td colspan="4">Unable to load branches. Apply migration 003 and refresh.</td></tr>';
    showBranchMessage(error.message, "error");
  }
}

async function createBranch(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const result = await branchRequest(BRANCH_API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch_name: form.elements.branch_name.value.trim(),
        address: form.elements.address.value.trim(),
        contact: form.elements.contact.value.trim()
      })
    });
    form.reset();
    showBranchMessage(result.message || "Branch created.", "success");
    await loadBranches();
  } catch (error) { showBranchMessage(error.message, "error"); }
  finally { submit.disabled = false; }
}

async function updateBranchStatus(button) {
  const id = Number(button.dataset.id);
  const nextStatus = button.dataset.status === "active" ? "inactive" : "active";
  const action = nextStatus === "inactive" ? "deactivate" : "activate";
  if (!confirm(`Are you sure you want to ${action} this branch? ${nextStatus === "inactive" ? "Current staff sessions for this branch will be revoked." : "Staff will be able to choose it again."}`)) return;
  button.disabled = true;
  try {
    const result = await branchRequest(`${BRANCH_API}/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus })
    });
    showBranchMessage(result.message, "success");
    await loadBranches();
  } catch (error) { showBranchMessage(error.message, "error"); button.disabled = false; }
}

function escapeBranchHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
