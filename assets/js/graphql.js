(function () {
  'use strict';

  const TOKEN_KEY = 'github_explorer_token';
  const ENDPOINT = 'https://api.github.com/graphql';

  const EXAMPLES = {
    profile: `query Profile {
  user(login: "torvalds") {
    name
    login
    bio
    followers {
      totalCount
    }
    repositories(first: 5, orderBy: { field: STARGAZERS, direction: DESC }) {
      nodes {
        name
        stargazerCount
        primaryLanguage {
          name
        }
      }
    }
  }
}`,
    viewer: `query ViewerAndRateLimit {
  viewer {
    login
    name
  }
  rateLimit {
    limit
    cost
    remaining
    resetAt
  }
}`,
    search: `query SearchRepositories {
  search(query: "language:javascript stars:>10000", type: REPOSITORY, first: 10) {
    repositoryCount
    nodes {
      ... on Repository {
        nameWithOwner
        stargazerCount
        url
      }
    }
  }
}`,
  };

  const tokenInput = document.getElementById('graphqlToken');
  const saveButton = document.getElementById('saveTokenButton');
  const clearButton = document.getElementById('clearTokenButton');
  const tokenStatus = document.getElementById('tokenStatus');
  const tokenStateDot = document.getElementById('tokenStateDot');
  const tokenStateText = document.getElementById('tokenStateText');
  const setupPanel = document.getElementById('graphqlSetup');
  const editorSection = document.getElementById('graphqlEditor');
  const editorHost = document.getElementById('graphiql');
  const exampleSelect = document.getElementById('exampleSelect');

  let token = readStoredToken();
  let currentQuery = EXAMPLES.profile;
  let reactRoot = null;

  function readStoredToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function storeToken(value) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  function setStatus(message, kind) {
    tokenStatus.textContent = message;
    tokenStatus.className = `form-status ${kind || ''}`.trim();
  }

  function librariesReady() {
    return Boolean(
      window.React &&
        window.ReactDOM &&
        typeof window.GraphiQL === 'function' &&
        typeof window.GraphiQL.createFetcher === 'function'
    );
  }

  function renderDashboard() {
    const hasToken = Boolean(token);

    tokenStateDot.className = `status-dot ${hasToken ? 'green' : 'red'}`;
    tokenStateText.textContent = hasToken ? 'Token saved' : 'No token';
    setupPanel.hidden = hasToken;
    editorSection.hidden = !hasToken;

    if (!hasToken) {
      if (reactRoot) reactRoot.render(null);
      return;
    }

    if (!librariesReady()) {
      setStatus('The GraphQL editor libraries could not be loaded. Check your connection and reload.', 'error');
      return;
    }

    if (!reactRoot) {
      reactRoot = window.ReactDOM.createRoot(editorHost);
    }

    const fetcher = window.GraphiQL.createFetcher({
      url: ENDPOINT,
      headers: { Authorization: `Bearer ${token}` },
    });

    reactRoot.render(
      window.React.createElement(window.GraphiQL, {
        fetcher,
        defaultQuery: currentQuery,
        isHeadersEditorEnabled: false,
        shouldPersistHeaders: false,
      })
    );
  }

  function saveToken() {
    const value = tokenInput.value.trim();
    if (!value) {
      setStatus('Enter a GitHub token first.', 'error');
      return;
    }

    token = value;
    const persisted = storeToken(token);
    tokenInput.value = token;
    setStatus(
      persisted
        ? 'Token saved. Requests are sent directly to GitHub from this browser.'
        : 'Token active for this page only; browser storage is unavailable.',
      persisted ? 'success' : 'error'
    );
    renderDashboard();
  }

  function clearToken() {
    token = '';
    storeToken('');
    tokenInput.value = '';
    setStatus('Token removed from this browser.', '');
    renderDashboard();
  }

  saveButton.addEventListener('click', saveToken);
  clearButton.addEventListener('click', clearToken);
  tokenInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveToken();
    }
  });

  exampleSelect.addEventListener('change', () => {
    currentQuery = EXAMPLES[exampleSelect.value] || EXAMPLES.profile;
    setStatus('', '');
    renderDashboard();
  });

  tokenInput.value = token;
  renderDashboard();
})();
