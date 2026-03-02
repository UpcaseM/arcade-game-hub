# Arcade Hub Auth MVP

This project uses a demo-only local account system:

- Credentials are stored in `localStorage` under `arcade_auth_store_v1`.
- Passwords are hashed with PBKDF2-SHA256 and per-user random salts.
- Login session is stored in `arcade_auth_session_v1`.
- Active identity is mirrored to `arcade_active_user_v1` for game UIs.

Default seeded account on first run:

- Username: `admin`
- Password: `admin123`

Admin UI capabilities:

- Create user (`username`, `password`, `role`)
- Update role/password
- Delete user
- Guardrail: cannot remove or demote the last remaining admin

Security limitations:

- This is not production authentication.
- Local users can tamper with browser storage.
- No server verification, MFA, brute-force throttling, or secure cookie/session handling.
- To hard reset the auth store, clear browser localStorage keys above.
