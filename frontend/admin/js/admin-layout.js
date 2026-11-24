/* Shared admin navigation: loads the menu and wires its controls once. */
const LOGIN_URL = "/student/pages/login.html?role=admin";
const SIGNOUT_URL = "/api/auth/signout";

const NAV_ASSETS = [
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
    "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap"
];

const BRANCH_STORAGE_KEY = "casia_selected_branch_id";
let currentBranchSelection = null;

function installBranchHeaderFetch() {
    if (window.__casiaBranchFetchInstalled) return;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
        const requestUrl = typeof input === "string" ? input : input?.url || "";
        let pathname = "";
        try { pathname = new URL(requestUrl, window.location.href).pathname; } catch (_) {}
        if (!pathname.startsWith("/api/")) return nativeFetch(input, init);
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        let savedBranch = localStorage.getItem(BRANCH_STORAGE_KEY);
        const currentPath = window.location.pathname.toLowerCase();
        const branchSpecificPage = currentPath.includes("/inventory.html") || currentPath.includes("/restocking.html");
        // Inventory and Restocking must never issue an all-branches request.
        // Clear a stale "all" selection before their first page API call; the
        // backend then resolves the request to the business's default branch.
        if (branchSpecificPage && savedBranch === "all") {
            savedBranch = "";
            localStorage.removeItem(BRANCH_STORAGE_KEY);
        }
        if (savedBranch) headers.set("X-CASIA-Branch-Id", savedBranch);
        return nativeFetch(input, { ...init, headers });
    };
    window.__casiaBranchFetchInstalled = true;
}

async function initializeOwnerBranchSelector() {
    const selector = document.getElementById("ownerBranchSelect");
    if (!selector) return;
    document.body.classList.add("admin-with-branchbar");
    const path = window.location.pathname.toLowerCase();
    const branchRequiredPage = path.includes("/inventory.html") || path.includes("/restocking.html");
    try {
        const response = await fetch("/api/branches", { credentials: "same-origin", cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(result.branches)) throw new Error(result.message || "Unable to load branches.");
        const branches = result.branches.filter(branch => branch.status === "active");
        selector.replaceChildren();
        selector.add(new Option("All Branches (Reports)", "all"));
        branches.forEach(branch => selector.add(new Option(branch.branch_name, String(branch.branch_id))));
        if (!branches.length) {
            selector.replaceChildren(new Option("No active branches", ""));
            return;
        }
        let saved = localStorage.getItem(BRANCH_STORAGE_KEY);
        const validSaved = saved === "all" || branches.some(branch => String(branch.branch_id) === saved);
        if (!validSaved || (branchRequiredPage && saved === "all")) {
            saved = String(branches.find(branch => branch.branch_name === "Main Branch")?.branch_id || branches[0].branch_id);
            localStorage.setItem(BRANCH_STORAGE_KEY, saved);
        }
        selector.value = saved;
        currentBranchSelection = saved;
        selector.addEventListener("change", () => {
            const next = selector.value;
            if (branchRequiredPage && next === "all") {
                alert("Choose a specific branch to view or change its inventory and restocking records.");
                selector.value = currentBranchSelection;
                return;
            }
            currentBranchSelection = next;
            localStorage.setItem(BRANCH_STORAGE_KEY, next);
            window.location.reload();
        });
    } catch (error) {
        console.error("Branch selector:", error);
        selector.replaceChildren(new Option("Branches unavailable", ""));
        const status = document.createElement("span");
        status.className = "branch-selector-error";
        status.textContent = "Run database migration 003 and refresh.";
        selector.insertAdjacentElement("afterend", status);
    }
}

function loadNavAssets() {
    NAV_ASSETS.forEach((url) => {
        if (document.querySelector(`link[href="${url}"]`)) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        document.head.appendChild(link);
    });
}

function initializeSidebar() {
    const sidebar = document.getElementById("sidebar");
    const toggleButton = document.getElementById("sidebarToggle");
    if (!sidebar || !toggleButton) {
        console.error("CASIA navigation is missing its sidebar controls.");
        return;
    }

    toggleButton.addEventListener("click", () => {
        const collapsed = sidebar.classList.toggle("collapsed");
        document.body.classList.toggle("sidebar-collapsed", collapsed);
        toggleButton.setAttribute("aria-expanded", String(!collapsed));
        toggleButton.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    });

    const logoutButton = document.getElementById("logoutBtn");
    if (logoutButton) {
        logoutButton.addEventListener("click", async (event) => {
            event.preventDefault();
            if (logoutButton.dataset.signingOut === "true") return;
            logoutButton.dataset.signingOut = "true";
            logoutButton.setAttribute("aria-disabled", "true");

            try {
                await fetch(SIGNOUT_URL, {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Accept": "application/json" }
                });
            } catch (error) {
                console.warn("CASIA sign-out request failed:", error);
            } finally {
                sessionStorage.clear();
                localStorage.removeItem("casiaSession");
                window.location.replace(LOGIN_URL);
            }
        });
    }

    const currentPath = decodeURIComponent(window.location.pathname).toLowerCase();
    sidebar.querySelectorAll(".nav-link").forEach((link) => {
        const linkPath = decodeURIComponent(new URL(link.href).pathname).toLowerCase();
        link.classList.toggle("active", linkPath === currentPath);
        if (linkPath === currentPath) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
    });
}

async function loadNavigation() {
    installBranchHeaderFetch();
    const placeholder = document.getElementById("nav-placeholder");
    if (!placeholder) return;

    try {
        const accessResponse = await fetch("/api/admin/me", {
            credentials: "same-origin",
            headers: { "Accept": "application/json" },
            cache: "no-store"
        });
        if (!accessResponse.ok) {
            if (accessResponse.status === 401 || accessResponse.status === 403) {
                window.location.replace("/student/pages/login.html?role=admin&error=admin_required");
                return;
            }

            // A server/database error is not proof that the user's session expired.
            // Keep the page visible and show an actionable message instead of
            // creating a misleading login redirect loop.
            placeholder.textContent = `CASIA could not verify the Admin session (HTTP ${accessResponse.status}). Check the backend terminal, then refresh this page.`;
            placeholder.classList.add("navigation-error");
            console.error("Admin session verification failed with HTTP", accessResponse.status);
            return;
        }

        loadNavAssets();
        const response = await fetch("/shared/components/nav.html", {
            credentials: "same-origin",
            headers: { "Accept": "text/html" }
        });
        if (!response.ok) throw new Error(`Navigation request failed (${response.status}).`);
        placeholder.innerHTML = await response.text();
        initializeSidebar();
        await initializeOwnerBranchSelector();
        document.dispatchEvent(new CustomEvent("casia:navigation-ready", {
            detail: { sidebar: document.getElementById("sidebar") }
        }));
    } catch (error) {
        console.error("Unable to load CASIA navigation:", error);
        document.dispatchEvent(new CustomEvent("casia:navigation-error", { detail: error }));
    }
}

document.addEventListener("DOMContentLoaded", loadNavigation, { once: true });
