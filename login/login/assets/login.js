const container = document.getElementById("container");

// Toggle using the side panel buttons
document.getElementById("register").addEventListener("click", () => {
    container.classList.add("active");
});

document.getElementById("login").addEventListener("click", () => {
    container.classList.remove("active");
});

// Toggle using text links
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

        if (input.type === "password") {
            input.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        } else {
            input.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    });
});