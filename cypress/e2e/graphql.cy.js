const TOKEN_KEY = 'github_explorer_token';

describe('GraphQL Explorer', () => {
  beforeEach(() => {
    cy.stubExternalAssets();
    cy.stubGraphiQL();
    cy.visit('/graphql.html');
  });

  it('requires a token before showing the editor', () => {
    cy.title().should('eq', 'GraphQL Explorer | GitHub Explorer');
    cy.contains('h1', 'GraphQL Explorer');
    cy.get('.back-link').should('have.attr', 'href', 'index.html');
    cy.get('#graphqlSetup').should('be.visible');
    cy.get('#graphqlEditor').should('be.hidden');
    cy.get('#tokenStateText').should('have.text', 'No token');
    cy.get('#tokenStateDot').should('have.class', 'red');
  });

  it('saves a token and mounts GraphiQL against the GitHub endpoint', () => {
    cy.get('#graphqlToken').type('ghp_graphqltest');
    cy.get('#saveTokenButton').click();

    cy.get('#graphqlSetup').should('be.hidden');
    cy.get('#graphqlEditor').should('not.be.hidden');
    cy.get('#tokenStateText').should('have.text', 'Token saved');
    cy.get('#tokenStateDot').should('have.class', 'green');
    cy.get('#tokenStatus').should('contain', 'Token saved');

    cy.window().then((win) => {
      expect(win.localStorage.getItem(TOKEN_KEY)).to.eq('ghp_graphqltest');
      expect(win.__graphiqlFetcher.url).to.eq('https://api.github.com/graphql');
      expect(win.__graphiqlFetcher.headers.Authorization).to.eq('Bearer ghp_graphqltest');
      expect(win.__graphiqlNode.props.defaultQuery).to.contain('user(login: "torvalds")');
    });
  });

  it('restores a stored token after reload', () => {
    cy.window().then((win) => {
      win.localStorage.setItem(TOKEN_KEY, 'ghp_restored');
    });

    cy.reload();

    cy.get('#graphqlToken').should('have.value', 'ghp_restored');
    cy.get('#graphqlEditor').should('not.be.hidden');
    cy.get('#tokenStateText').should('have.text', 'Token saved');
    cy.window().its('__graphiqlFetcher.headers.Authorization').should('eq', 'Bearer ghp_restored');
  });

  it('removes the token and hides the editor', () => {
    cy.get('#graphqlToken').type('ghp_removeme');
    cy.get('#saveTokenButton').click();
    cy.get('#clearTokenButton').click();

    cy.get('#graphqlEditor').should('be.hidden');
    cy.get('#graphqlSetup').should('be.visible');
    cy.get('#tokenStateText').should('have.text', 'No token');
    cy.get('#graphqlToken').should('have.value', '');
    cy.window().then((win) => {
      expect(win.localStorage.getItem(TOKEN_KEY)).to.be.null;
    });
  });

  it('loads the selected example query', () => {
    cy.get('#graphqlToken').type('ghp_example');
    cy.get('#saveTokenButton').click();

    cy.get('#exampleSelect').select('search');
    cy.window().its('__graphiqlNode.props.defaultQuery').should('contain', 'search(query:');

    cy.get('#exampleSelect').select('viewer');
    cy.window().its('__graphiqlNode.props.defaultQuery').should('contain', 'rateLimit');
  });

  it('is linked from the explorer page', () => {
    cy.stubGitHubApi();
    cy.visit('/');
    cy.get('a[aria-label="GraphQL Explorer"]').should('have.attr', 'href', 'graphql.html');
    cy.get('footer a[href="graphql.html"]').should('exist');
  });
});
