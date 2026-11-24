
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("resetPasswordForm");

    const passwordInput = document.getElementById("newPassword");
    const confirmInput = document.getElementById("confirmPassword");

    const message = document.getElementById("resetMessage");
    const submitButton = document.getElementById("resetButton");

    function showMessage(text, type) {
        message.textContent = text;
        message.className = "form-message";

        if (text) {
            message.classList.add(type);
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;

        if (password.length < 8) {
            showMessage(
                "Your new password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        if (password !== confirmPassword) {
            showMessage(
                "Your passwords do not match.",
                "error"
            );
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

        showMessage("", "");

        try {
            const response = await fetch("/api/auth/update-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify({
                    password,
                    confirm_password: confirmPassword
                })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to update your password."
                );
            }

            showMessage(
                "Your password has been updated successfully. Redirecting to login...",
                "success"
            );

            form.reset();

            const role = new URLSearchParams(window.location.search).get("role") === "admin"
                ? "admin"
                : "user";
            setTimeout(() => {
                window.location.replace(
                    role === "admin"
                        ? "/student/pages/login.html?role=admin&passwordReset=1"
                        : "/student/pages/login.html?passwordReset=1"
                );
            }, 1800);

        } catch (error) {
            console.error("Password reset error:", error);

            showMessage(
                error.message || "Unable to update your password. Your reset link may have expired.",
                "error"
            );

            submitButton.disabled = false;
            submitButton.innerHTML =
                '<i class="fa-solid fa-key"></i> Update Password';
        }
    });
});
