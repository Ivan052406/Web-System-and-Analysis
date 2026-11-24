/* ==========================================================================
   CASIA login page — needs assets/auth.js loaded first.
   Handles: sliding panels, "Sign In / Create an account" links, show-password
   eyes, remember my account, sign up, sign in, and the social buttons.
   ========================================================================== */

const container = document.getElementById('container');

// ---------- Sliding panels (desktop buttons + the links under each form) ----------
document.getElementById('register').addEventListener('click', () => container.classList.add('active'));
document.getElementById('login').addEventListener('click', () => container.classList.remove('active'));

document.querySelectorAll('[data-switch]').forEach((link) => {
    link.addEventListener('click', (e) => {
        e.preventDefault();   // stay on this page and just switch forms
        container.classList.toggle('active', link.dataset.switch === 'register');
    });
});

// ---------- Show / hide password eyes ----------
document.querySelectorAll('.toggle-password').forEach((icon) => {
    icon.addEventListener('click', () => {
        const input = document.getElementById(icon.dataset.target);
        const hidden = input.type === 'password';
        input.type = hidden ? 'text' : 'password';
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });
});

// ---------- Small message line inside a form ----------
function showMessage(form, text, type) {
    let box = form.querySelector('.form-message');
    if (!box) {
        box = document.createElement('div');
        box.className = 'form-message';
        box.style.cssText = 'font-size:12px;line-height:1.4;margin:4px 0 0;text-align:center;';
        form.querySelector('button[type="submit"]').before(box);
    }
    box.textContent = text;
    box.style.color = type === 'error' ? '#c0392b' : '#2e7d32';
}

// ---------- Remember my account (email only, never the password) ----------
const REMEMBER_KEY = 'rememberedAccountEmail';
const signinForm = document.querySelector('.sign-in form');
const signupForm = document.querySelector('.sign-up form');
const signinEmail = document.getElementById('signinEmail');
const rememberBox = document.getElementById('rememberAccount');

const savedEmail = localStorage.getItem(REMEMBER_KEY);
if (savedEmail) {
    signinEmail.value = savedEmail;
    rememberBox.checked = true;
}

// ---------- Sign up ----------
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = signupForm.elements['name'].value.trim();
    const email = signupForm.elements['email'].value.trim();
    const password = signupForm.elements['password'].value;
    const confirm = signupForm.elements['confirm_password'].value;

    if (!name) return showMessage(signupForm, 'Please enter your name.', 'error');
    if (!isValidEmail(email)) return showMessage(signupForm, 'Please enter a valid email address.', 'error');
    if (password.length < 6) return showMessage(signupForm, 'Password must be at least 6 characters.', 'error');
    if (password !== confirm) return showMessage(signupForm, 'Passwords do not match.', 'error');
    if (CASIA.findUser(email)) return showMessage(signupForm, 'An account with that email already exists. Try signing in.', 'error');

    CASIA.addUser({ name, email, password, provider: 'email' });
    showMessage(signupForm, 'Account created! Taking you to sign in…', 'success');

    setTimeout(() => {
        signupForm.reset();
        signupForm.querySelector('.form-message').textContent = '';
        signinEmail.value = email;
        container.classList.remove('active');
        showMessage(signinForm, 'Account created. Sign in with your new password.', 'success');
    }, 900);
});

// ---------- Sign in ----------
signinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = signinEmail.value.trim();
    const password = signinForm.elements['password'].value;

    if (!isValidEmail(email)) return showMessage(signinForm, 'Please enter a valid email address.', 'error');

    const user = CASIA.findUser(email);
    if (!user) return showMessage(signinForm, 'No account found with that email. Create one first.', 'error');
    if (!user.password) return showMessage(signinForm, `This account uses ${user.provider} sign-in. Use the ${user.provider} button above.`, 'error');
    if (user.password !== password) return showMessage(signinForm, 'Incorrect password.', 'error');

    if (rememberBox.checked) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);

    showMessage(signinForm, 'Signing you in…', 'success');
    CASIA.startSession(user);
});

// ---------- Social buttons that are not connected yet (Facebook / LinkedIn) ----------
document.querySelectorAll('.social-icons a[href="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const form = link.closest('form');
        showMessage(form, `${link.getAttribute('aria-label').replace(/^Sign (in|up) with /, '')} sign-in isn't available yet.`, 'error');
    });
});