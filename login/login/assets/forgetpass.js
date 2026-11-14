/* Forgot password — needs auth.js first.
   DEMO MODE: finds the account on this device and lets you set a new password
   right away. A real system emails a reset link instead. */

const findForm = document.getElementById('findForm');
const resetForm = document.getElementById('resetForm');
const forgotEmail = document.getElementById('forgotEmail');
const findMessage = document.getElementById('findMessage');
const resetMessage = document.getElementById('resetMessage');
const forgotText = document.getElementById('forgotText');

// Prefill with the email remembered on the sign-in page
const remembered = localStorage.getItem('rememberedAccountEmail');
if (remembered) forgotEmail.value = remembered;

let targetEmail = null;

findForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = forgotEmail.value.trim();

    if (!isValidEmail(email)) { findMessage.textContent = 'Please enter a valid email address.'; return; }

    const user = CASIA.findUser(email);
    if (!user) { findMessage.textContent = 'No account found with that email.'; return; }

    targetEmail = user.email;
    findMessage.textContent = '';
    findForm.hidden = true;
    resetForm.hidden = false;
    forgotText.textContent = `Account found for ${user.email}. Choose a new password.`;
    document.getElementById('newPassword').focus();
});

resetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmNewPassword').value;

    if (password.length < 6) { resetMessage.textContent = 'Password must be at least 6 characters.'; return; }
    if (password !== confirm) { resetMessage.textContent = 'Passwords do not match.'; return; }

    CASIA.updateUser(targetEmail, { password });
    resetForm.hidden = true;
    forgotText.innerHTML = '<strong style="color:#2e7d32;">Password updated!</strong> You can sign in with your new password now.';
});