const container = document.getElementById("container");

// Side panel buttons
document.getElementById("register").addEventListener("click", () => {
    container.classList.add("active");
});

document.getElementById("login").addEventListener("click", () => {
    container.classList.remove("active");
});

// =====================================================
// NEW: Makes "Already have an account? Sign In"
// and "New Admin? Sign Up" links work
// =====================================================
document.querySelectorAll("[data-switch]").forEach((link) => {
    link.addEventListener("click", (e) => {
        e.preventDefault();

        if (link.dataset.switch === "register") {
            container.classList.add("active");
        } else {
            container.classList.remove("active");
        }
    });
});

// Show / Hide Password
document.querySelectorAll(".toggle-password").forEach((icon) => {
    icon.addEventListener("click", () => {
        const input = document.getElementById(icon.dataset.target);
        const show = input.type === "password";

        input.type = show ? "text" : "password";

        icon.classList.toggle("fa-eye", !show);
        icon.classList.toggle("fa-eye-slash", show);
    });
});

// Confirm password check on admin sign up
document.querySelector(".sign-up form").addEventListener("submit", (e) => {
    const pw = document.getElementById("adminSignupPassword").value;
    const confirm = document.getElementById("adminSignupConfirm").value;

    if (pw !== confirm) {
        e.preventDefault();
        alert("Passwords do not match.");
    }
});