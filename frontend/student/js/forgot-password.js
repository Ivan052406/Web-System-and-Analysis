
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("forgotPasswordForm");
    const emailInput = document.getElementById("email");
    const message = document.getElementById("forgotMessage");
    const submitButton = document.getElementById("sendResetButton");

    function showMessage(text, type) {
        message.textContent = text;
        message.className = "form-message";

        if (text) {
            message.classList.add(type);
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const email = emailInput.value.trim().toLowerCase();
        const requestedRole = new URLSearchParams(window.location.search).get("role") === "admin"
            ? "admin"
            : "user";

        if (!email) {
            showMessage("Please enter your email address.", "error");
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

        showMessage("", "");

        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify({ email, role: requestedRole })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to process your request."
                );
            }

            showMessage(
                "If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.",
                "success"
            );

            form.reset();

        } catch (error) {
            console.error("Forgot password error:", error);

            showMessage(
                error.message || "Unable to send the reset link. Please try again.",
                "error"
            );
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML =
                '<i class="fa-solid fa-paper-plane"></i> Send Reset Link';
        }
    });
});
