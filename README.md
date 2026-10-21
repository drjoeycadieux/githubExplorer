# GitHub Explorer

A static web application for exploring GitHub profiles, repositories, followers, and following. It also includes a private vulnerability-report form with a live Markdown preview and a browser-based GraphQL Explorer.

## Features

- Search for GitHub users by username and inspect profile details and activity counts.
- Browse public repositories with filtering, sorting, and pagination.
- Browse a user's followers and following list.
- Search GitHub users from a natural-language prompt. This is keyword-based discovery; it does not call an AI model.
- Optionally use a GitHub personal access token to increase API rate limits. The token is stored in browser `localStorage` and sent directly to GitHub from the browser.
- Switch between light and dark themes.
- Submit vulnerability reports with severity, affected asset, contact email, and Markdown-formatted technical details.
- Run GraphQL queries against the GitHub GraphQL API from a browser-based GraphiQL editor using your own token.

## Run locally

You need Node.js and npm. From the project directory, run:

```sh
npm install
npm start
```

Open the local URL printed by the server. Use HTTP rather than opening `index.html` or `vulnerability-report.html` with a `file://` URL; the report page loads ES modules from external sources.

## End-to-end tests

Cypress covers the explorer, the vulnerability-report form, and the GraphQL Explorer. The tests stub the GitHub API, the report page's Firebase modules, and the GraphiQL CDN bundles, so they run offline and never write to the real Firestore project or call GitHub.

```sh
npm run test:e2e        # headless run
npm run cypress:open    # interactive runner
```

Cypress starts the local server automatically on port 4173. If you already have `npm start` running on port 8080, it is left untouched. The suite also runs in GitHub Actions on pushes to `main` and on pull requests.

## Project structure

```text
.
├── .github/
│   └── workflows/
│       └── e2e.yml             # GitHub Actions Cypress run
├── index.html                  # GitHub Explorer interface
├── vulnerability-report.html   # Private report form
├── graphql.html                # Browser-based GraphQL Explorer
├── assets/
│   ├── css/
│   │   ├── main.css            # Explorer styles
│   │   ├── report.css          # Report form and shared page styles
│   │   └── graphql.css         # GraphQL Explorer styles
│   └── js/
│       ├── main.js             # Explorer logic and GitHub API calls
│       ├── report.js           # Report form, Firebase and Markdown preview
│       ├── graphql.js          # GraphQL Explorer token and editor setup
│       └── firebase-config.js  # Firebase web app configuration
├── cypress/
│   ├── e2e/                    # End-to-end specs
│   ├── fixtures/               # GitHub API responses
│   └── support/                # Shared Cypress commands
├── docs/
│   └── FIREBASE_SETUP.md       # Firebase deployment and privacy guidance
├── cypress.config.js           # Cypress and local web server configuration
├── firestore.rules             # Firestore access rules
├── package.json
└── README.md
```

## GraphQL Explorer

Open [`graphql.html`](graphql.html) from the footer link or the **GraphQL** button in the header. The page renders a [GraphiQL](https://github.com/graphql/graphiql) editor that sends queries directly from the browser to `https://api.github.com/graphql`.

GitHub requires authentication for GraphQL, so a personal access token is required. The token is stored in the same `localStorage` key as the main explorer (`github_explorer_token`) and is sent only to GitHub. There is no backend proxy and no shared token, so the page is safe to host on any static host, including production.

Notes:

- Use a read-only token with the minimum scopes needed for the data you query.
- GitHub GraphQL uses point-based rate limits. Run the **Viewer and rate limit** example to inspect the remaining budget.
- If you need to query data without asking each visitor for a token, you would need a server-side proxy that holds the token. That is intentionally not part of this static site.

## Vulnerability reports

The report form is linked from the main page footer. Reports are written to the `vulnerabilityReports` collection in Cloud Firestore. The collection and its first document are created automatically on the first successful submission; no table or collection needs to be created manually.

Before submissions can succeed:

1. Create a Cloud Firestore database in the Firebase project.
2. Deploy the rules in [`firestore.rules`](firestore.rules). They allow validated report creation and deny client reads, updates, and deletes.
3. Confirm the web app settings in [`assets/js/firebase-config.js`](assets/js/firebase-config.js) match the Firebase project.

See [`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md) for setup and privacy details. The public form does not use App Check or server-side rate limiting, so monitor Firestore usage and billing for abuse.

## GitHub API token

Unauthenticated GitHub API requests have a lower rate limit. You can optionally add a personal access token using the **API Token** control in the page header. Use a token with only the permissions required for public profile data. The token stays in that browser's local storage; do not commit it or share it.
