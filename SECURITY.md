# Security policy

Carewish handles sensitive health wishes, so we take security reports seriously.

## Supported versions

Security fixes go into the latest release. Self-hosters should run the newest image (`ghcr.io/lobojoel2003/carewish:latest`).

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub: **Security → Report a vulnerability** on this repository. Include steps to reproduce and the impact you see. We aim to acknowledge reports within 3 working days and to ship a fix or mitigation within 30 days.

## Design notes

- By default nothing leaves the device: answers live in the browser's IndexedDB.
- Accounts are end-to-end encrypted. The password is stretched with PBKDF2-SHA-256 (600,000 iterations) in the browser and split with HKDF into an authentication key and a non-extractable AES-256-GCM vault key. The server stores ciphertext and a scrypt hash of the authentication key, never the password or the vault key. Passwords cannot be reset.
- Card links store a document encrypted with a random key that exists only in the link's URL fragment, which browsers do not send to servers.
- Wallet cards made without an account contain a readable summary in the QR code. That is intentional, for emergencies, and the app says so.
- Sessions use random 256-bit tokens (stored hashed) in `HttpOnly; SameSite=Strict` cookies; state-changing requests check the `Origin` header; sign-in is rate limited and does not reveal whether an email is registered.
- Responses carry a strict Content Security Policy, `frame-ancestors 'none'`, `no-referrer` and HSTS in production.
