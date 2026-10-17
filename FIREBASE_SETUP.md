# Firebase setup for vulnerability reports

The report form stores submissions in the `vulnerabilityReports` Firestore collection. The browser can create validated reports but cannot read, edit, or delete any report. There are no Firebase project credentials in this repository, so submissions stay disabled until the project is configured.

## Configure Firebase

1. Create or select a Firebase project and register a Web app.
2. Create a Cloud Firestore database.
3. Copy the Web app configuration into `firebase-config.js`, replacing every `YOUR_...` value. Firebase web configuration is public; never put service-account credentials or private keys in this file.
4. In Firebase App Check, register the web app with reCAPTCHA v3. Add the public site key to `appCheckSiteKey` in `firebase-config.js`, and add the deployed site's hostname to the reCAPTCHA allowed domains.
5. Deploy the rules in `firestore.rules` from the Firebase console or with the Firebase CLI:

   ```sh
   firebase deploy --only firestore:rules
   ```

6. In Firebase App Check, monitor valid requests, then enforce App Check for Cloud Firestore. Do not leave Firestore in test mode. Restrict the Firebase API key to the production website referrer and required Firebase APIs.
7. Serve the site over HTTP(S), for example with `npm start`, and test a report submission. Module imports and Firebase App Check do not work reliably from a `file://` URL.

## Review and privacy

Report contents and contact emails are private Firestore documents. Review them in the Firebase console or through a trusted server-side process with Admin SDK credentials. Never add client-side read rules for the collection. Restrict Firebase console access to trusted maintainers, set a retention policy, and review App Check metrics for abuse. App Check reduces automated abuse but is not a substitute for monitoring and quota/budget alerts.
