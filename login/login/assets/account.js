/* ==========================================================================
   Shared by googleacct.html and appleacct.html — needs assets/auth.js first.
   The page's <body data-provider="google|apple"> decides which one it is.

   DEMO MODE: this does NOT talk to Google or Apple. It lets you pick or enter
   an account and signs that account in on this device. To make it real, use
   Google Identity Services / Sign in with Apple on your backend and call
   CASIA.startSession(...) with the verified profile instead.
   ========================================================================== */

const provider = document.body.dataset.provider;               // 'google' or 'apple'
const providerName = provider === 'google' ? 'Google' : 'Apple';

const form = document.getElementById('accountForm');
const message = document.getElementById('accountMessage');
const savedBox = document.getElementById('savedAccounts');

// Sign in an existing account, or create it first
function continueAs(name, email) {
    let user = CASIA.findUser(email);
    if (!user) user = CASIA.addUser({ name, email, provider });
    CASIA.startSession(user);
}

// Accounts already used with this provider on this device
const saved = CASIA.users().filter((u) => u.provider === provider);
if (saved.length) {
    savedBox.innerHTML = '<h2>Choose an account</h2>';
    saved.forEach((u) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'saved-account';
        btn.innerHTML = '<span class="saved-avatar"></span><div><strong></strong><span></span></div>';
        btn.querySelector('.saved-avatar').textContent = (u.name || u.email)[0].toUpperCase();
        btn.querySelector('strong').textContent = u.name;
        btn.querySelector('div > span').textContent = u.email;
        btn.addEventListener('click', () => continueAs(u.name, u.email));
        savedBox.appendChild(btn);
    });
    const divider = document.createElement('p');
    divider.className = 'divider';
    divider.textContent = 'or use another account';
    savedBox.appendChild(divider);
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.elements['name'].value.trim();
    const email = form.elements['email'].value.trim();

    if (!name) { message.textContent = 'Please enter your name.'; return; }
    if (!isValidEmail(email)) { message.textContent = `Please enter a valid ${providerName} email.`; return; }

    // An email account that already exists keeps its own name
    const existing = CASIA.findUser(email);
    continueAs(existing ? existing.name : name, email);
});