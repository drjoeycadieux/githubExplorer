const moduleHeaders = {
  'content-type': 'text/javascript',
  'access-control-allow-origin': '*',
};

function moduleResponse(body) {
  return {
    statusCode: 200,
    headers: moduleHeaders,
    body,
  };
}

/**
 * Keep tests offline and deterministic by stubbing third-party CDN assets.
 */
Cypress.Commands.add('stubExternalAssets', () => {
  cy.intercept('GET', /cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/, {
    statusCode: 200,
    headers: { 'content-type': 'text/css' },
    body: '/* Font Awesome stub for tests */',
  });

  cy.intercept('GET', /fonts\.googleapis\.com/, {
    statusCode: 200,
    headers: { 'content-type': 'text/css' },
    body: '/* Google Fonts stub for tests */',
  });
});

/**
 * Stub every GitHub REST endpoint used by the explorer.
 */
Cypress.Commands.add('stubGitHubApi', () => {
  cy.intercept('GET', /\/rate_limit/, {
    resources: { core: { remaining: 4999, limit: 5000 } },
  });
  cy.intercept('GET', /\/users\/torvalds$/, { fixture: 'profile.json' });
  cy.intercept('GET', /\/users\/torvalds\/repos/, { fixture: 'repos.json' });
  cy.intercept('GET', /\/users\/torvalds\/followers/, { fixture: 'followers.json' });
  cy.intercept('GET', /\/users\/torvalds\/following/, { fixture: 'following.json' });
  cy.intercept('GET', /\/search\/users/, { fixture: 'search-users.json' });
});

/**
 * Stub the report page's remote ES modules so no real Firebase write can occur.
 */
Cypress.Commands.add('stubReportModules', () => {
  cy.intercept(
    'GET',
    /gstatic\.com\/firebasejs\/.*\/firebase-app\.js/,
    moduleResponse('export function initializeApp() { return {}; }')
  );

  cy.intercept(
    'GET',
    /gstatic\.com\/firebasejs\/.*\/firebase-firestore\.js/,
    moduleResponse(`
      export function getFirestore() { return {}; }
      export function collection(_db, name) { return { name }; }
      export function serverTimestamp() { return 'SERVER_TIMESTAMP'; }
      export function addDoc(_collectionRef, data) {
        window.__lastReport = data;
        if (window.__failReport) {
          return Promise.reject({ code: 'permission-denied' });
        }
        return Promise.resolve({ id: 'TEST-REPORT-001' });
      }
    `)
  );

  cy.intercept(
    'GET',
    /cdn\.jsdelivr\.net\/npm\/marked@/,
    moduleResponse(`
      export const marked = {
        setOptions() {},
        parse(markdown) {
          return markdown
            .split(/\\n\\n+/)
            .map((block) =>
              block.startsWith('## ')
                ? '<h2>' + block.slice(3) + '</h2>'
                : '<p>' + block + '</p>'
            )
            .join('');
        },
      };
    `)
  );

  cy.intercept(
    'GET',
    /cdn\.jsdelivr\.net\/npm\/dompurify@/,
    moduleResponse(`
      export default {
        sanitize(html) {
          return html.replace(/<script[\\s\\S]*?<\\/script>/gi, '');
        },
      };
    `)
  );
});
