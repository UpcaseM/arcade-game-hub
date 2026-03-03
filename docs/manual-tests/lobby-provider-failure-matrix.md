# Lobby Provider Failure Matrix

- Checklist id: `lobby-provider-failure-matrix`
- Status: `Pending`
- Last run date: `TBD`
- Environment: `TBD`

## Scenarios

| ID | Failure setup | Expected UX | Fallback expected | Status | Evidence | Notes |
|---|---|---|---|---|---|---|
| PF-01 | Invalid provider URL | Clear user-facing error; no crash | Yes | Pending | TBD |  |
| PF-02 | Browser offline mode | Clear user-facing error; no crash | Yes | Pending | TBD |  |
| PF-03 | Blocked request / CORS-like failure | Clear user-facing error; no crash | Yes | Pending | TBD |  |
| PF-04 | HTTP 401/403 from provider | Permission/auth error shown | No | Pending | TBD |  |
| PF-05 | HTTP 5xx from provider | Provider unavailable message shown | Yes | Pending | TBD |  |

## Required capture

- Screenshot of user-visible message.
- DevTools Network row showing status/error.
- Console snippet for failure event (if emitted).

