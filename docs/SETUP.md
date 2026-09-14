# External setup owned by Harshit

These actions need account access and can run independently while the application is built.

## AWS and Strands

1. Choose the AWS account and deployment region. Use `us-east-1` unless the selected Bedrock model requires another region.
2. Enable access to the Bedrock model used by the Strands agent in that region.
3. Create an IAM principal for Aven with least privilege access to invoke that model. Grant the Bedrock `InvokeModel` and `InvokeModelWithResponseStream` actions only for the selected model resource.
4. For local development, authenticate with an AWS profile or export `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`, and `AWS_REGION`.
5. For hosting, add those values to the server environment. Never expose them through variables prefixed with `NEXT_PUBLIC_`.

## Google Calendar

1. Create a Google Cloud project and enable Google Calendar API.
2. Configure the OAuth consent screen and add the demo Google accounts as test users.
3. Create a Web application OAuth client.
4. Add `http://localhost:3699/api/integrations/google/callback` and `https://YOUR_DOMAIN/api/integrations/google/callback` as authorized redirect URIs.
5. Provide `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the server environment.

## Groq, database, and application secrets

1. Create a Groq API key for transcription.
2. Provision PostgreSQL and run `db/schema.sql`.
3. Generate `VOICE_INBOX_TOKEN` with `openssl rand -hex 32`.
4. Generate `SHORTCUT_SETUP_TOKEN` with `openssl rand -base64 36`. This protects the browser page that reveals the Apple Shortcut bearer token during setup.
5. Generate `INTEGRATION_ENCRYPTION_KEY` with `openssl rand -base64 32`.
6. Set `APP_URL` to the exact deployment origin, without a trailing slash.

## Web Push

1. Run `npx web-push generate-vapid-keys` after dependencies are installed.
2. Set the public result as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
3. Set the private result as `VAPID_PRIVATE_KEY`.
4. Set `VAPID_SUBJECT=mailto:harshitsingh@iitb.ac.in`.

## Deployment and submission

1. Connect the repository and PostgreSQL database to the deployment host.
2. Add every server environment variable before the first production build.
3. Make the repository public and confirm no local environment files or credentials are tracked.
4. Record a demo shorter than five minutes using the path in `docs/SUBMISSION.md`.
5. Supply the final repository, deployed app, and video URLs in Devpost.
