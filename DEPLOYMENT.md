# Render Deployment

This project can run as one Render web service: Express serves the frontend and `/api` from the same origin. Render does not provide managed MySQL through Blueprints, so create a MySQL database with an external provider first.

## Prepare the database

Create a database named `carpool_finder` (or choose another name). Configure its network access to allow connections from Render, then keep its host, port, database name, username, and password available for Render's environment settings. The app creates its tables on startup, but does not create the database in production.

## Deploy

1. Push this project to a GitHub repository. Do not commit `backend/.env` or database credentials.
2. In Render, choose **New** then **Blueprint**, and connect the repository containing `render.yaml`.
3. Apply the Blueprint and enter the external MySQL values for `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` when prompted.
4. Keep `DB_AUTO_CREATE` set to `false`. Set `DB_SSL` to `true` if your provider requires TLS; if it supplies a CA certificate, add that as `DB_SSL_CA` in the Render dashboard. The Blueprint generates `JWT_SECRET` for the service.
5. Wait for the deploy, then open the service URL. Check `/api/health` for the API health response.

The root URL serves `frontend/index.html`; API requests use the same-origin `/api` path. If the MySQL provider requires a custom TLS certificate, add its supported TLS configuration before deploying.