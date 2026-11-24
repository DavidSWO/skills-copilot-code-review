---
applyTo: "**/*.py"
---

## Backend Guidelines

- Define feature and business API endpoints in the `routers` folder; application-wide routes such as the root/static redirect may remain in `src/app.py`.
- Keep database connection and initialization logic in `src/backend/database.py`. Load seed data and configuration from the database or a non-committed configuration source rather than hard-coding credentials or seed content in tracked code.
- Keep sensitive and internal error details in server logs, but return appropriate HTTP status codes and safe, actionable error messages to API clients.
- Ensure all APIs are explained in the documentation.
- Verify changes in the backend are reflected in the frontend (`src/static/**`). If possible breaking changes are found, mention them to the developer.
