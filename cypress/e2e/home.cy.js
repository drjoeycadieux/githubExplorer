function searchForTorvalds() {
  cy.get('#searchInput').type('torvalds');
  cy.get('#searchForm').submit();
  cy.get('#profileContainer').should('not.have.class', 'hidden');
}

describe('GitHub Explorer', () => {
  beforeEach(() => {
    cy.stubExternalAssets();
    cy.stubGitHubApi();
    cy.visit('/');
  });

  it('renders the landing page and current rate limit', () => {
    cy.title().should('eq', 'GitHub Explorer');
    cy.contains('h1', 'Explore GitHub profiles');
    cy.get('#rateLimitText').should('contain', '4999/5000 remaining');
    cy.get('#maintenanceBanner').should('be.visible');
    cy.get('#profileContainer').should('have.class', 'hidden');
  });

  it('searches a user and renders profile, repositories and social lists', () => {
    searchForTorvalds();

    cy.get('#profileName').should('have.text', 'Linus Torvalds');
    cy.get('#profileUsername')
      .should('have.text', '@torvalds')
      .and('have.attr', 'href', 'https://github.com/torvalds');
    cy.get('#profileBio').should('have.text', 'Creator of Linux and Git');
    cy.get('#statRepos').should('have.text', '7');
    cy.get('#statFollowers').should('have.text', '200000');
    cy.get('#statFollowing').should('have.text', '0');

    cy.get('#reposGrid .repo-card').should('have.length', 6);
    cy.get('#repoPageInfo').should('have.text', 'Page 1 of 2');

    cy.get('#nextRepoPage').click();
    cy.get('#reposGrid .repo-card').should('have.length', 1);
    cy.contains('#reposGrid .repo-card', 'eta');
    cy.get('#repoPageInfo').should('have.text', 'Page 2 of 2');

    cy.get('#tabBtnFollowers').click();
    cy.get('#sectionFollowers').should('not.have.class', 'hidden');
    cy.contains('#followersGrid .user-card', 'octocat');

    cy.get('#tabBtnFollowing').click();
    cy.get('#sectionFollowing').should('not.have.class', 'hidden');
    cy.contains('#followingGrid .user-card', 'gaearon');
  });

  it('filters and sorts repositories', () => {
    searchForTorvalds();

    cy.get('#repoSearchInput').type('beta');
    cy.get('#reposGrid .repo-card').should('have.length', 1);
    cy.contains('#reposGrid .repo-card', 'beta');

    cy.get('#repoSearchInput').clear();
    cy.get('#repoSortSelect').select('stars');
    cy.get('#reposGrid .repo-card').first().should('contain', 'zeta');
  });

  it('runs an AI-style natural-language search', () => {
    cy.get('#modeBtnAI').click();
    cy.get('#aiSearchForm').should('not.have.class', 'hidden');
    cy.get('#searchForm').should('have.class', 'hidden');

    cy.get('#aiInput').type('Top Linux kernel developer');
    cy.get('#aiSearchForm').submit();

    cy.get('#aiResultsContainer').should('not.have.class', 'hidden');
    cy.get('#aiQuerySummary').should('contain', 'Top Linux kernel developer');
    cy.get('#aiDevGrid .user-card').should('have.length', 2);
    cy.contains('#aiDevGrid .user-card', 'torvalds');

    cy.contains('button', 'Back to profile').click();
    cy.get('#aiResultsContainer').should('have.class', 'hidden');
    cy.get('#profileContainer').should('not.have.class', 'hidden');
  });

  it('shows a not-found error for an unknown user', () => {
    cy.intercept('GET', /\/users\/not-a-real-user$/, {
      statusCode: 404,
      body: { message: 'Not Found' },
    });

    cy.get('#searchInput').type('not-a-real-user');
    cy.get('#searchForm').submit();

    cy.get('#errorState').should('not.have.class', 'hidden');
    cy.get('#errorTitle').should('have.text', 'User not found');
    cy.get('#errorDesc').should('contain', 'not-a-real-user');
  });

  it('toggles the color theme', () => {
    cy.get('html').should('have.class', 'dark');

    cy.get('button[aria-label="Toggle theme"]').click();
    cy.get('html').should('not.have.class', 'dark');
    cy.get('#themeIcon').should('have.class', 'fa-sun');

    cy.get('button[aria-label="Toggle theme"]').click();
    cy.get('html').should('have.class', 'dark');
    cy.get('#themeIcon').should('have.class', 'fa-moon');
  });

  it('saves a GitHub token and restores it after reload', () => {
    cy.get('header button[aria-label="API token"]').click();
    cy.get('#tokenModal').should('not.have.class', 'hidden');

    cy.get('#tokenInput').type('ghp_testtoken123');
    cy.contains('button', 'Save token').click();

    cy.get('#tokenModal').should('have.class', 'hidden');
    cy.get('#tokenStatusDot').should('have.class', 'green');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('github_explorer_token')).to.eq('ghp_testtoken123');
    });

    cy.reload();
    cy.get('#tokenInput').should('have.value', 'ghp_testtoken123');
    cy.get('#tokenStatusDot').should('have.class', 'green');
  });

  it('dismisses the maintenance banner for the session', () => {
    cy.get('#maintenanceBanner').should('be.visible');
    cy.get('.maintenance-close').click();
    cy.get('#maintenanceBanner').should('have.class', 'hidden');

    cy.reload();
    cy.get('#maintenanceBanner').should('have.class', 'hidden');
  });
});
