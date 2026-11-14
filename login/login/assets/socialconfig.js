/* ==========================================================================
   Sign-in keys for Google, Apple and Facebook.
   Paste your own values below (steps are in README-social-login.md).
   Until a value is pasted, that provider's page shows a "not set up yet"
   message instead of a sign-in button.

   These IDs are meant to be public (they are not secrets). Never put an
   "app secret" or "client secret" in this file.
   ========================================================================== */

const SOCIAL_CONFIG = {

    // Google Cloud Console -> APIs & Services -> Credentials -> OAuth client ID (Web application)
    google: {
        clientId: 'PASTE_GOOGLE_CLIENT_ID.apps.googleusercontent.com'
    },

    // developers.facebook.com -> your app -> Settings -> Basic -> App ID
    facebook: {
        appId: 'PASTE_FACEBOOK_APP_ID',
        apiVersion: 'v19.0'
    },

    // Apple Developer -> Identifiers -> Services ID (this is the "client ID"), plus the
    // https:// address of appleacct.html that you registered as the Return URL
    apple: {
        clientId: 'PASTE_APPLE_SERVICES_ID',
        redirectURI: 'PASTE_HTTPS_URL_OF_appleacct.html'
    }
};