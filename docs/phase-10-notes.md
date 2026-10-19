# Phase 10: Google and Facebook sign-in

Phase 10 implements optional OAuth authorization-code sign-in with Google and Facebook. Successful
provider authentication creates the same server-side session cookie used by password login. OAuth
identities are stored in the existing `OAuthAccount` table; no migration or additional package is
required.

## Provider setup

Set credentials in `backend/.env`. A provider is shown on the login and registration forms only when
its client ID, secret, and callback URL are configured. Callback URLs must use HTTPS, except localhost
HTTP URLs in non-production environments.

Register the exact matching callback URL in the provider console:

| Provider | Callback URL |
|---|---|
| Google | `http://localhost:4000/api/auth/oauth/google/callback` |
| Facebook | `http://localhost:4000/api/auth/oauth/facebook/callback` |

In production, replace these with HTTPS URLs for the deployed API. Google sign-in requests OpenID
Connect `openid`, `email`, and `profile` scopes and requires `email_verified: true`. Facebook
sign-in requests `email` and `public_profile`; a provider email is required. Configure
`FACEBOOK_GRAPH_API_VERSION` if the default `v22.0` is not supported by the app configured for use.

## Flow and account behavior

1. The frontend checks `GET /api/auth/oauth/providers` and renders buttons only for enabled providers.
2. The browser starts at `GET /api/auth/oauth/:provider`. The server redirects to the provider with a
   cryptographically random state value in a ten-minute, HTTP-only, SameSite=Lax cookie.
3. The callback validates state, exchanges the authorization code on the server, and requests a
   verified identity profile from the provider over HTTPS.
4. The provider/account ID is linked to an existing account with the same verified email, or a new
   OWNER/BOARDER account is created according to the registration form. The server never creates an
   ADMIN account via OAuth.
5. The app creates a server-side session and redirects to `/auth/callback`, which loads `/api/auth/me`
   and sends the user to their role dashboard.

When an existing provider identity returns, it signs into its linked account. Provider email is
normalized to lowercase. Password hashes are not created for OAuth-only accounts. Failed provider
responses, missing email, or invalid state return the user to login with a generic error rather than
exposing provider or server details.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/oauth/providers` | Report whether each provider is configured/enabled |
| GET | `/api/auth/oauth/:provider?role=OWNER\|BOARDER` | Start provider authentication; role is optional and defaults to BOARDER |
| GET | `/api/auth/oauth/:provider/callback` | Validate state, complete sign-in, and set the session cookie |

Do not put client secrets in frontend environment variables. Restart the backend after updating its
environment. Automated OAuth tests stub provider HTTP responses and verify state validation, account
creation/reuse, selected roles, and session-cookie authentication.
