# Cook Device Notifications

Cook home checks notifications only after authenticating the user and loading their cook profile. Web and Android opt-in save the real FCM token through `/api/cook/push-device`. The API resolves the cook profile itself; clients never select an owner.

## Prerequisites

- Apply `cook-devices-multi-device.sql` if not already applied. The `cook_devices` table must have `cook_profile_id`, `push_token`, `platform`, `is_active`, and `last_seen_at` columns. Token uniqueness must not restrict a cook to one device.
- Set `NEXT_PUBLIC_FIREBASE_VAPID_KEY` to the public Web Push certificate key from the matching Firebase project's Cloud Messaging settings. No key was recovered locally. Rebuild after setting it. Do not use a private key here.
- Public web Firebase configuration defaults were restored from the old worker. Optional overrides: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID`. The app passes the same public configuration to its worker.
- Web push needs HTTPS (or localhost), service workers, and a supported browser. Blocked permissions must be changed in device/browser settings.
- The API uses the existing Supabase server configuration. No new server credential is introduced.
- Android's public Google Services configuration matches `com.biyyu.app`. Use Node 22 and Java 21 when running `npx cap sync android` and Gradle.

## Scope

This restores receiving and device registration, not a notification sender. Notification payloads are displayed by FCM; the worker displays data-only payloads itself to avoid duplicates. Native permission requests happen only on opt-in, with registration listeners installed before `register` and removed after success, failure, or timeout.

Capacitor currently loads the remote URL configured in `capacitor.config.ts`. Android will use the new cook-home flow only after that remote site serves this code. No deployment or live notification test is performed by this restoration.

Firebase Functions and service-account credentials remain removed. Do not add them to this workspace.