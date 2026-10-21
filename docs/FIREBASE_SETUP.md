# Firebase setup for vulnerability reports

The report form stores submissions in the `vulnerabilityReports` Firestore collection. The browser can create validated reports but cannot read, edit, or delete any report. The Firebase web app configuration is in `assets/js/firebase-config.js`.

## Configure Firebase

1. Create or select a Firebase project and register a Web app.
2. Create a Cloud Firestore database.
3. Firebase web configuration is public; never put service-account credentials or private keys in the client-side files.
4. Deploy the rules in `firestore.rules` from the Firebase console or with the Firebase CLI:

   ```sh
   firebase deploy --only firestore:rules
   ```

5. Do not leave Firestore in test mode. Restrict the Firebase API key to the production website referrer and required Firebase APIs.
6. Serve the site over HTTP(S), for example with `npm start`, and test a report submission. Module imports do not work reliably from a `file://` URL.

## Review and privacy

Report contents and contact emails are private Firestore documents. Review them in the Firebase console or through a trusted server-side process with Admin SDK credentials. Never add client-side read rules for the collection. Restrict Firebase console access to trusted maintainers, set a retention policy, and configure quota and budget alerts.

The form does not use App Check or server-side rate limiting. Its Firestore rules validate the report shape and prohibit client reads, but anyone can still attempt many valid creates. Monitor usage and billing. If spam becomes a problem, add App Check or route submissions through a trusted backend with rate limiting.
