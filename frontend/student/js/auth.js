
document.addEventListener("DOMContentLoaded", () => {
    // API and page settings

    const API_BASE_URL = "/api";
    const DASHBOARD_URL = "/admin/pages/dashboard.html";
    const STAFF_DASHBOARD_URL = "/admin/pages/staff-dashboard.html";

    const USER_REMEMBER_KEY = "casia_remembered_email";
    const ADMIN_REMEMBER_KEY = "casia_admin_remembered_email";

    // Page elements

    const userView = document.getElementById("userAuthView");
    const adminView = document.getElementById("adminAuthView");
    const adminModeView = document.getElementById("adminModeView");
    const staffModeView = document.getElementById("staffModeView");
    const adminModeBtn = document.getElementById("adminModeBtn");
    const staffModeBtn = document.getElementById("staffModeBtn");

    const userRoleBtn = document.getElementById("userRoleBtn");
    const adminRoleBtn = document.getElementById("adminRoleBtn");

    const userContainer = document.getElementById("userContainer");
    const adminContainer = document.getElementById("adminContainer");

    const userSignupForm = document.getElementById("userSignupForm");
    const userSigninForm = document.getElementById("userSigninForm");

    const adminSignupForm = document.getElementById("adminSignupForm");
    const adminSigninForm = document.getElementById("adminSigninForm");
    const staffSigninForm = document.getElementById("staffSigninForm");

    const userSigninEmail = document.getElementById("userSigninEmail");
    const userRemember = document.getElementById("userRemember");

    const adminSigninEmail = document.getElementById("adminSigninEmail");
    const adminRemember = document.getElementById("adminRemember");
    const staffAccessCode = document.getElementById("staffAccessCode");
    const findStaffBranchesButton = document.getElementById("findStaffBranches");
    const staffBranchPicker = document.getElementById("staffBranchPicker");
    const staffBranchSelect = document.getElementById("staffBranchSelect");

    // General helpers

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function getField(form, fieldName) {
        const field = form.elements.namedItem(fieldName);

        return field ? field.value.trim() : "";
    }

    function getPassword(form, fieldName) {
        const field = form.elements.namedItem(fieldName);

        return field ? field.value : "";
    }

    function showMessage(elementId, message, type = "error") {
        const element = document.getElementById(elementId);

        if (!element) return;

        element.textContent = message;
        element.className = "form-message";

        if (message) {
            element.classList.add(type);
        }
    }

    function setButtonLoading(button, loading) {
        if (!button) return;

        if (loading) {
            if (!button.dataset.originalText) {
                button.dataset.originalText =
                    button.textContent.trim();
            }

            button.disabled = true;
            button.textContent = "Please wait...";
        } else {
            button.disabled = false;

            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }

    function getSubmitButton(form) {
        return form.querySelector('button[type="submit"]');
    }

    // API request helper

    async function sendRequest(endpoint, payload) {
        const response = await fetch(
            `${API_BASE_URL}${endpoint}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify(payload)
            }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success === false) {
            throw new Error(
                result.message || "The request could not be completed."
            );
        }

        return result;
    }

    // Redirect after successful authentication

    function redirectToDashboard(result = {}) {
        const destination =
            result.redirectUrl || DASHBOARD_URL;

        window.location.replace(destination);
    }

    // The server cookie authenticates the account; casiaSession stores display-only name/email for the student UI.
    function saveStudentSession(user, fallback = {}) {
        const email = user?.email || fallback.email || "";
        const name = user?.name || user?.full_name || fallback.name || email.split("@")[0];
        if (!email) return;
        try {
            localStorage.setItem("casiaSession", JSON.stringify({ email, name }));
        } catch (error) {
            console.error("Unable to save student session:", error);
        }
    }

    function redirectToStudentDashboard() {
        window.location.replace("/student/pages/home.html");
    }

    // Remembered email helpers

    function saveRememberedEmail(key, email, remember) {
        try {
            if (remember) {
                localStorage.setItem(key, email);
            } else {
                localStorage.removeItem(key);
            }
        } catch (error) {
            console.error(
                "Unable to save remembered email:",
                error
            );
        }
    }

    function loadRememberedEmail(key, input, checkbox) {
        if (!input || !checkbox) return;

        try {
            const savedEmail = localStorage.getItem(key);

            if (savedEmail) {
                input.value = savedEmail;
                checkbox.checked = true;
            }
        } catch (error) {
            console.error(
                "Unable to load remembered email:",
                error
            );
        }
    }

    // Switch between user and admin login

    function activateRole(role) {
        const showUser = role === "user";
        const showAdminStaff = role === "admin";

        if (userView) userView.classList.toggle("active", showUser);
        if (adminView) adminView.classList.toggle("active", showAdminStaff);

        [
            [userRoleBtn, showUser],
            [adminRoleBtn, showAdminStaff]
        ].forEach(([button, selected]) => {
            if (!button) return;
            button.classList.toggle("selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
    }

    // Admin and Staff share one login page. Admin has sign-in/sign-up;
    // Staff uses the shared business access code and branch selection.
    function activateAdminStaffMode(mode) {
        const showAdmin = mode !== "staff";
        if (adminModeView) {
            adminModeView.hidden = !showAdmin;
            adminModeView.classList.toggle("active", showAdmin);
        }
        if (staffModeView) {
            staffModeView.hidden = showAdmin;
            staffModeView.classList.toggle("active", !showAdmin);
        }
        [[adminModeBtn, showAdmin], [staffModeBtn, !showAdmin]].forEach(([button, selected]) => {
            if (!button) return;
            button.classList.toggle("selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
    }

    if (userRoleBtn) {
        userRoleBtn.addEventListener("click", () => {
            activateRole("user");
        });
    }

    if (adminRoleBtn) {
        adminRoleBtn.addEventListener("click", () => {
            activateRole("admin");
        });
    }

    if (adminModeBtn) adminModeBtn.addEventListener("click", () => activateAdminStaffMode("admin"));
    if (staffModeBtn) staffModeBtn.addEventListener("click", () => activateAdminStaffMode("staff"));

    // Switch between sign-in and sign-up panels

    document.querySelectorAll("[data-switch]").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();

            const containerId = link.dataset.container;
            const container = document.getElementById(containerId);

            if (!container) return;

            const showRegistration =
                link.dataset.switch === "register";

            container.classList.toggle(
                "active",
                showRegistration
            );
        });
    });

    // Show and hide passwords and access codes

    document.querySelectorAll(".toggle-password").forEach(icon => {
        function togglePassword() {
            const input = document.getElementById(
                icon.dataset.target
            );

            if (!input) return;

            const showPassword = input.type === "password";

            input.type = showPassword ? "text" : "password";

            icon.classList.toggle(
                "fa-eye",
                !showPassword
            );

            icon.classList.toggle(
                "fa-eye-slash",
                showPassword
            );

            icon.setAttribute(
                "aria-label",
                showPassword
                    ? "Hide password"
                    : "Show password"
            );
        }

        icon.addEventListener("click", togglePassword);

        icon.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                togglePassword();
            }
        });
    });

    

    // Register a user account

    if (userSignupForm) {
        userSignupForm.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const form = event.currentTarget;

                const name = getField(form, "name");
                const email = getField(form, "email").toLowerCase();

                const password = getPassword(form, "password");

                const confirmPassword = getPassword(
                    form,
                    "confirm_password"
                );

                const submitButton = getSubmitButton(form);

                showMessage("userSignupMessage", "");

                if (!name) {
                    return showMessage(
                        "userSignupMessage",
                        "Please enter your full name."
                    );
                }

                if (!isValidEmail(email)) {
                    return showMessage(
                        "userSignupMessage",
                        "Please enter a valid email address."
                    );
                }

                if (password.length < 6) {
                    return showMessage(
                        "userSignupMessage",
                        "Password must contain at least 6 characters."
                    );
                }

                if (password !== confirmPassword) {
                    return showMessage(
                        "userSignupMessage",
                        "Passwords do not match."
                    );
                }

                setButtonLoading(submitButton, true);

                try {
                    const result = await sendRequest(
                        "/auth/signup",
                        {
                            name,
                            email,
                            password,
                            confirm_password: confirmPassword
                        }
                    );

                    if (result.authenticated === true) {
                        saveStudentSession(null, { name, email });
                        showMessage(
                            "userSignupMessage",
                            result.message ||
                                "Account created successfully. Redirecting...",
                            "success"
                        );

                        redirectToStudentDashboard();
                        return;
                    }

                    form.reset();

                    if (userSigninEmail) {
                        userSigninEmail.value = email;
                    }

                    if (userContainer) {
                        userContainer.classList.remove("active");
                    }

                    showMessage(
                        "userSigninMessage",
                        result.message ||
                            "Account created. Please confirm your email before signing in.",
                        "success"
                    );

                } catch (error) {
                    console.error(
                        "User registration error:",
                        error
                    );

                    showMessage(
                        "userSignupMessage",
                        error.message ||
                            "Unable to create your account."
                    );
                } finally {
                    setButtonLoading(submitButton, false);
                }
            }
        );
    }

    // Sign in as a user

    if (userSigninForm) {
        userSigninForm.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const form = event.currentTarget;

                const email = getField(form, "email").toLowerCase();
                const password = getPassword(form, "password");

                const submitButton = getSubmitButton(form);

                const remember = userRemember
                    ? userRemember.checked
                    : false;

                showMessage("userSigninMessage", "");

                if (!isValidEmail(email)) {
                    return showMessage(
                        "userSigninMessage",
                        "Please enter a valid email address."
                    );
                }

                if (!password) {
                    return showMessage(
                        "userSigninMessage",
                        "Please enter your password."
                    );
                }

                setButtonLoading(submitButton, true);

                try {
                    const result = await sendRequest(
                        "/auth/signin",
                        {
                            email,
                            password
                        }
                    );

                    saveRememberedEmail(
                        USER_REMEMBER_KEY,
                        email,
                        remember
                    );

                    showMessage(
                        "userSigninMessage",
                        "Sign in successful. Redirecting...",
                        "success"
                    );

                    saveStudentSession(result.user, { email });
                    redirectToStudentDashboard();

                } catch (error) {
                    console.error(
                        "User sign-in error:",
                        error
                    );

                    showMessage(
                        "userSigninMessage",
                        error.message || "Unable to sign in."
                    );
                } finally {
                    setButtonLoading(submitButton, false);
                }
            }
        );
    }

    // Register a business and administrator account

    if (adminSignupForm) {
        adminSignupForm.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const form = event.currentTarget;

                const name = getField(form, "name");

                const companyType = getField(
                    form,
                    "company_type"
                );

                const contact = getField(form, "contact");

                const email = getField(form, "email").toLowerCase();

                const address = getField(form, "address");

                const password = getPassword(form, "password");

                const confirmPassword = getPassword(
                    form,
                    "confirm_password"
                );

                const accessCode = getField(
                    form,
                    "access_code"
                );

                const submitButton = getSubmitButton(form);

                showMessage("adminSignupMessage", "");

                if (
                    !name ||
                    !companyType ||
                    !contact ||
                    !email ||
                    !address
                ) {
                    return showMessage(
                        "adminSignupMessage",
                        "Please complete all business information."
                    );
                }

                if (!isValidEmail(email)) {
                    return showMessage(
                        "adminSignupMessage",
                        "Please enter a valid company email address."
                    );
                }

                if (password.length < 6) {
                    return showMessage(
                        "adminSignupMessage",
                        "Password must contain at least 6 characters."
                    );
                }

                if (password !== confirmPassword) {
                    return showMessage(
                        "adminSignupMessage",
                        "Passwords do not match."
                    );
                }

                if (
                    accessCode.length < 8 ||
                    accessCode.length > 64
                ) {
                    return showMessage(
                        "adminSignupMessage",
                        "Your business access code must contain 8 to 64 characters."
                    );
                }

                setButtonLoading(submitButton, true);

                try {
                    const result = await sendRequest(
                        "/admin/signup",
                        {
                            name,
                            company_type: companyType,
                            contact,
                            email,
                            address,
                            password,
                            confirm_password: confirmPassword,
                            access_code: accessCode
                        }
                    );

                    if (result.authenticated === true) {
                        showMessage(
                            "adminSignupMessage",
                            result.message ||
                                "Business registered successfully. Redirecting...",
                            "success"
                        );

                        redirectToDashboard(result);
                        return;
                    }

                    form.reset();

                    if (adminSigninEmail) {
                        adminSigninEmail.value = email;
                    }

                    if (adminContainer) {
                        adminContainer.classList.remove("active");
                    }

                    showMessage(
                        "adminSigninMessage",
                        result.message ||
                            "Business registered. Please confirm your email before signing in.",
                        "success"
                    );

                } catch (error) {
                    console.error(
                        "Business registration error:",
                        error
                    );

                    showMessage(
                        "adminSignupMessage",
                        error.message ||
                            "Unable to register the business."
                    );
                } finally {
                    setButtonLoading(submitButton, false);
                }
            }
        );
    }

    // Sign in as an administrator

    if (adminSigninForm) {
        adminSigninForm.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const form = event.currentTarget;

                const email = getField(form, "email").toLowerCase();

                const password = getPassword(form, "password");

                const accessCode = getField(
                    form,
                    "access_code"
                );

                const submitButton = getSubmitButton(form);

                const remember = adminRemember
                    ? adminRemember.checked
                    : false;

                showMessage("adminSigninMessage", "");

                if (!isValidEmail(email)) {
                    return showMessage(
                        "adminSigninMessage",
                        "Please enter a valid company email address."
                    );
                }

                if (!password) {
                    return showMessage(
                        "adminSigninMessage",
                        "Please enter your password."
                    );
                }

                if (
                    accessCode.length < 8 ||
                    accessCode.length > 64
                ) {
                    return showMessage(
                        "adminSigninMessage",
                        "Please enter your valid business access code."
                    );
                }

                setButtonLoading(submitButton, true);

                try {
                    const result = await sendRequest(
                        "/admin/login",
                        {
                            email,
                            password,
                            access_code: accessCode
                        }
                    );

                    saveRememberedEmail(
                        ADMIN_REMEMBER_KEY,
                        email,
                        remember
                    );

                    showMessage(
                        "adminSigninMessage",
                        "Administrator sign in successful. Redirecting...",
                        "success"
                    );

                    redirectToDashboard(result);

                } catch (error) {
                    console.error(
                        "Administrator sign-in error:",
                        error
                    );

                    showMessage(
                        "adminSigninMessage",
                        error.message ||
                            "Unable to sign in."
                    );
                } finally {
                    setButtonLoading(submitButton, false);
                }
            }
        );
    }

    // Staff enter the business access code, then choose an active branch.
    let staffBranchesReady = false;
    if (staffAccessCode && staffBranchPicker && staffBranchSelect && findStaffBranchesButton) {
        staffAccessCode.addEventListener("input", () => {
            staffBranchesReady = false;
            staffBranchPicker.hidden = true;
            staffBranchSelect.replaceChildren(new Option("Select branch", ""));
            showMessage("staffSigninMessage", "");
        });

        findStaffBranchesButton.addEventListener("click", async () => {
            const accessCode = staffAccessCode.value.trim();
            showMessage("staffSigninMessage", "");
            if (accessCode.length < 8 || accessCode.length > 64) {
                showMessage("staffSigninMessage", "Enter the access code provided by your Business Owner.");
                return;
            }
            setButtonLoading(findStaffBranchesButton, true);
            try {
                const result = await sendRequest("/staff/branches", { access_code: accessCode });
                staffBranchSelect.replaceChildren(new Option("Select branch", ""));
                (result.branches || []).forEach(branch => {
                    staffBranchSelect.add(new Option(branch.branch_name, String(branch.branch_id)));
                });
                staffBranchesReady = true;
                staffBranchPicker.hidden = false;
                showMessage("staffSigninMessage", `Branches found for ${result.business_name}. Choose your branch to continue.`, "success");
            } catch (error) {
                staffBranchesReady = false;
                staffBranchPicker.hidden = true;
                showMessage("staffSigninMessage", error.message || "Unable to find branches.");
            } finally {
                setButtonLoading(findStaffBranchesButton, false);
            }
        });

        staffSigninForm.addEventListener("submit", async event => {
            event.preventDefault();
            const accessCode = staffAccessCode.value.trim();
            const branchId = Number(staffBranchSelect.value);
            const submitButton = getSubmitButton(staffSigninForm);
            showMessage("staffSigninMessage", "");
            if (!staffBranchesReady) {
                showMessage("staffSigninMessage", "Verify the access code and load branches first.");
                return;
            }
            if (!Number.isSafeInteger(branchId) || branchId < 1) {
                showMessage("staffSigninMessage", "Please choose your branch.");
                return;
            }
            setButtonLoading(submitButton, true);
            try {
                const result = await sendRequest("/staff/access", { access_code: accessCode, branch_id: branchId });
                showMessage("staffSigninMessage", "Access granted. Opening the selected branch...", "success");
                window.location.replace(result.redirectUrl || STAFF_DASHBOARD_URL);
            } catch (error) {
                showMessage("staffSigninMessage", error.message || "Unable to open the staff workspace.");
            } finally {
                setButtonLoading(submitButton, false);
            }
        });
    }

    // Restore remembered email addresses

    loadRememberedEmail(
        USER_REMEMBER_KEY,
        userSigninEmail,
        userRemember
    );

    loadRememberedEmail(
        ADMIN_REMEMBER_KEY,
        adminSigninEmail,
        adminRemember
    );

    // Set the initial login page. ?role=staff opens the combined page
    // with the Staff switch selected; ?role=admin opens the Admin option.
    const requestedRole = new URLSearchParams(window.location.search).get("role");
    const requestedStaff = requestedRole === "staff";
    activateRole(requestedRole === "admin" || requestedStaff ? "admin" : "user");
    activateAdminStaffMode(requestedStaff ? "staff" : "admin");
});
