let currentUserData = null;
let allRepos = [];
let filteredRepos = [];
let currentRepoPage = 1;
const reposPerPage = 6;
let githubToken = localStorage.getItem('github_explorer_token') || '';
let searchMode = 'username';

// Maintenance banner: stays dismissed for the rest of the browsing session
const maintenanceKey = 'github_explorer_maintenance_dismissed';
const maintenanceBanner = document.getElementById('maintenanceBanner');
try {
  if (sessionStorage.getItem(maintenanceKey) === '1') maintenanceBanner.classList.add('hidden');
} catch (e) { /* storage unavailable */ }

function dismissMaintenanceBanner() {
  maintenanceBanner.classList.add('hidden');
  try { sessionStorage.setItem(maintenanceKey, '1'); } catch (e) { /* ignore */ }
}

const langColors = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', HTML: '#e34c26',
  CSS: '#563d7c', Java: '#b07219', 'C++': '#f34b7d', Ruby: '#701516', Go: '#00ADD8',
  Rust: '#dea584', PHP: '#4F5D95', 'C#': '#178600', Swift: '#ffac45', Kotlin: '#A97BFF',
  Dart: '#00B4AB', Shell: '#89e051',
};

// Escape any text coming from the GitHub API before inserting it as HTML
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

window.addEventListener('DOMContentLoaded', () => {
  if (githubToken) document.getElementById('tokenInput').value = githubToken;
  updateTokenIndicator(!!githubToken);
  checkRateLimit();
});

async function fetchGitHub(url) {
  const headers = {};
  if (githubToken) headers['Authorization'] = `token ${githubToken}`;
  const res = await fetch(url, { headers });
  const remaining = res.headers.get('X-RateLimit-Remaining');
  const limit = res.headers.get('X-RateLimit-Limit');
  if (remaining !== null && limit !== null) updateRateLimitDisplay(remaining, limit);
  return res;
}

function updateRateLimitDisplay(remaining, limit) {
  document.getElementById('rateLimitText').innerText = `Rate limit: ${remaining}/${limit} remaining`;
}

async function checkRateLimit() {
  try {
    const res = await fetchGitHub('https://api.github.com/rate_limit');
    if (res.ok) {
      const core = (await res.json()).resources.core;
      updateRateLimitDisplay(core.remaining, core.limit);
    }
  } catch (e) {
    console.error('Could not check rate limit', e);
  }
}

function toggleTokenModal() {
  document.getElementById('tokenModal').classList.toggle('hidden');
}

function saveToken() {
  githubToken = document.getElementById('tokenInput').value.trim();
  if (githubToken) {
    localStorage.setItem('github_explorer_token', githubToken);
    updateTokenIndicator(true);
  } else {
    clearToken();
    return;
  }
  toggleTokenModal();
  checkRateLimit();
}

function clearToken() {
  githubToken = '';
  localStorage.removeItem('github_explorer_token');
  document.getElementById('tokenInput').value = '';
  updateTokenIndicator(false);
  toggleTokenModal();
  checkRateLimit();
}

function updateTokenIndicator(hasToken) {
  document.getElementById('tokenStatusDot').className = `status-dot ${hasToken ? 'green' : 'red'}`;
}

function toggleTheme() {
  const html = document.documentElement;
  const icon = document.getElementById('themeIcon');
  const isDark = html.classList.toggle('dark');
  icon.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  icon.style.color = isDark ? '' : '#f59e0b';
}

function resetApp() {
  currentUserData = null;
  allRepos = [];
  filteredRepos = [];
  document.getElementById('searchInput').value = '';
  ['profileContainer', 'errorState', 'aiResultsContainer'].forEach((id) => document.getElementById(id).classList.add('hidden'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleSearchSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('searchInput').value.trim();
  if (username) fetchUserProfile(username);
}

function searchUserDirect(username) {
  document.getElementById('searchInput').value = username;
  fetchUserProfile(username);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchSearchMode(mode) {
  searchMode = mode;
  const isUser = mode === 'username';
  document.getElementById('modeBtnUsername').className = `seg-btn ${isUser ? 'active' : ''}`;
  document.getElementById('modeBtnAI').className = `seg-btn ai ${isUser ? '' : 'active'}`;
  document.getElementById('searchForm').classList.toggle('hidden', !isUser);
  document.getElementById('aiSearchForm').classList.toggle('hidden', isUser);
}

function setAIPrompt(text) {
  document.getElementById('aiInput').value = text;
}

function closeAIResults() {
  document.getElementById('aiResultsContainer').classList.add('hidden');
  if (currentUserData) document.getElementById('profileContainer').classList.remove('hidden');
}

async function handleAISearchSubmit(e) {
  e.preventDefault();
  const prompt = document.getElementById('aiInput').value.trim();
  if (!prompt) return;

  showLoading(true, 'AI is analyzing your query and searching GitHub developers...');
  hideError();
  document.getElementById('profileContainer').classList.add('hidden');
  document.getElementById('aiResultsContainer').classList.add('hidden');

  const lower = prompt.toLowerCase();
  let target;
  if (lower.includes('linux') || lower.includes('kernel') || lower.includes('torvalds')) target = 'torvalds';
  else if (lower.includes('react') || lower.includes('gaearon')) target = 'gaearon';
  else if (lower.includes('vue') || lower.includes('yyx')) target = 'yyx990803';
  else if (lower.includes('frontend') || lower.includes('javascript') || lower.includes('ui')) target = 'sindresorhus';
  else if (lower.includes('python') || lower.includes('data')) target = 'kennethreitz';

  try {
    if (target) {
      await fetchUserProfile(target);
      await searchGitHubUsersAPI(target, prompt);
    } else {
      const keywords = prompt.split(' ').filter((w) => w.length > 2);
      await searchGitHubUsersAPI(keywords[0] || 'octocat', prompt);
    }
  } catch (err) {
    console.error(err);
    showLoading(false);
    showError('AI search error', 'Failed to process the natural language query.');
  }
}

async function searchGitHubUsersAPI(keyword, originalPrompt) {
  try {
    const res = await fetchGitHub(`https://api.github.com/search/users?q=${encodeURIComponent(keyword)}&per_page=6`);
    showLoading(false);
    if (!res.ok) {
      showError('API limit', 'GitHub search rate limit reached or the query is invalid.');
      return;
    }
    const items = (await res.json()).items || [];
    if (items.length === 0) {
      showError('No developers found', `AI could not find developers matching "${originalPrompt}".`);
      return;
    }
    if (!currentUserData) await fetchUserProfile(items[0].login);
    renderAIDevGrid(items, originalPrompt);
  } catch (e) {
    showLoading(false);
    showError('Error', 'Could not complete the AI search query.');
  }
}

function renderAIDevGrid(users, promptText) {
  document.getElementById('aiQuerySummary').innerText = `Results for: "${promptText}"`;
  document.getElementById('aiDevGrid').innerHTML = users.map((user) => `
    <div class="card user-card" onclick="searchUserDirect('${esc(user.login)}'); document.getElementById('aiResultsContainer').classList.add('hidden');">
      <img src="${esc(user.avatar_url)}" alt="${esc(user.login)}" />
      <div>
        <h4>${esc(user.login)}</h4>
        <span style="color: var(--ai); font-size: 0.75rem; font-weight: 500">Match &middot; Inspect &rarr;</span>
      </div>
    </div>`).join('');
  document.getElementById('aiResultsContainer').classList.remove('hidden');
}

async function fetchUserProfile(username) {
  showLoading(true, 'Fetching GitHub profile data...');
  hideError();
  document.getElementById('profileContainer').classList.add('hidden');

  try {
    const response = await fetchGitHub(`https://api.github.com/users/${encodeURIComponent(username)}`);
    if (!response.ok) {
      if (response.status === 404) showError('User not found', `We couldn't find a GitHub profile for "${username}". Check the spelling and try again.`);
      else if (response.status === 403) showError('Rate limit exceeded', 'Add a personal access token using the API Token button to continue.');
      else showError('Error fetching data', `GitHub API returned status ${response.status}.`);
      showLoading(false);
      return;
    }

    currentUserData = await response.json();
    renderProfileOverview(currentUserData);
    await Promise.all([fetchRepositories(username), fetchFollowers(username), fetchFollowing(username)]);
    showLoading(false);
    document.getElementById('profileContainer').classList.remove('hidden');
    switchTab('repos');
  } catch (err) {
    console.error(err);
    showLoading(false);
    showError('Network error', 'Unable to connect to the GitHub API.');
  }
}

function renderProfileOverview(user) {
  document.getElementById('profileAvatar').src = user.avatar_url || '';
  document.getElementById('profileName').innerText = user.name || user.login;

  const handle = document.getElementById('profileUsername');
  handle.innerText = `@${user.login}`;
  handle.href = user.html_url;

  const bio = document.getElementById('profileBio');
  bio.innerText = user.bio || 'No public bio available.';

  toggleMeta('profileCompanyContainer', 'profileCompany', user.company);
  toggleMeta('profileLocationContainer', 'profileLocation', user.location);

  const blogContainer = document.getElementById('profileBlogContainer');
  if (user.blog) {
    const blogLink = document.getElementById('profileBlog');
    blogLink.href = user.blog.startsWith('http') ? user.blog : `https://${user.blog}`;
    blogLink.innerText = user.blog.replace(/^https?:\/\//, '');
    blogContainer.classList.remove('hidden');
  } else {
    blogContainer.classList.add('hidden');
  }

  const joined = new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  document.getElementById('profileJoined').innerText = `Joined ${joined}`;
  document.getElementById('profileGithubLink').href = user.html_url;

  const counts = { Repos: user.public_repos || 0, Followers: user.followers || 0, Following: user.following || 0 };
  document.getElementById('statRepos').innerText = counts.Repos;
  document.getElementById('statFollowers').innerText = counts.Followers;
  document.getElementById('statFollowing').innerText = counts.Following;
  document.getElementById('badgeRepos').innerText = counts.Repos;
  document.getElementById('badgeFollowers').innerText = counts.Followers;
  document.getElementById('badgeFollowing').innerText = counts.Following;
}

function toggleMeta(containerId, textId, value) {
  const container = document.getElementById(containerId);
  if (value) {
    document.getElementById(textId).innerText = value;
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

async function fetchRepositories(username) {
  try {
    const res = await fetchGitHub(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`);
    allRepos = res.ok ? await res.json() : [];
  } catch (e) {
    allRepos = [];
  }
  filteredRepos = [...allRepos];
  currentRepoPage = 1;
  document.getElementById('repoSearchInput').value = '';
  sortRepositories();
}

function filterRepositories() {
  const q = document.getElementById('repoSearchInput').value.toLowerCase();
  filteredRepos = allRepos.filter((r) =>
    r.name.toLowerCase().includes(q) ||
    (r.description || '').toLowerCase().includes(q) ||
    (r.language || '').toLowerCase().includes(q));
  currentRepoPage = 1;
  sortRepositories();
}

function sortRepositories() {
  const sortBy = document.getElementById('repoSortSelect').value;
  const sorters = {
    updated: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
    stars: (a, b) => b.stargazers_count - a.stargazers_count,
    forks: (a, b) => b.forks_count - a.forks_count,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  filteredRepos.sort(sorters[sortBy]);
  renderRepositories();
}

function renderRepositories() {
  const grid = document.getElementById('reposGrid');
  const pagination = document.getElementById('reposPagination');

  if (filteredRepos.length === 0) {
    grid.innerHTML = `<div class="empty"><i class="fa-regular fa-folder-open"></i><p>No repositories match your search.</p></div>`;
    pagination.classList.add('hidden');
    return;
  }

  const totalPages = Math.ceil(filteredRepos.length / reposPerPage);
  currentRepoPage = Math.min(Math.max(currentRepoPage, 1), totalPages);
  const start = (currentRepoPage - 1) * reposPerPage;

  grid.innerHTML = filteredRepos.slice(start, start + reposPerPage).map((repo) => {
    const color = langColors[repo.language] || '#8c959f';
    const updated = new Date(repo.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `
      <div class="card repo-card">
        <div>
          <div class="repo-title">
            <a href="${esc(repo.html_url)}" target="_blank" rel="noopener"><i class="fa-solid fa-book-bookmark" style="font-size: 0.75rem; color: var(--text-3)"></i><span>${esc(repo.name)}</span></a>
            <span class="pill">${repo.private ? 'Private' : 'Public'}</span>
          </div>
          <p class="repo-desc">${esc(repo.description || 'No description provided.')}</p>
        </div>
        <div class="repo-foot">
          <div class="left">
            ${repo.language ? `<div class="item"><span class="lang-dot" style="background:${color}"></span>${esc(repo.language)}</div>` : ''}
            <div class="item"><i class="fa-regular fa-star"></i>${repo.stargazers_count}</div>
            <div class="item"><i class="fa-solid fa-code-fork"></i>${repo.forks_count}</div>
          </div>
          <span>Updated ${updated}</span>
        </div>
      </div>`;
  }).join('');

  if (totalPages > 1) {
    pagination.classList.remove('hidden');
    document.getElementById('repoPageInfo').innerText = `Page ${currentRepoPage} of ${totalPages}`;
    document.getElementById('prevRepoPage').disabled = currentRepoPage === 1;
    document.getElementById('nextRepoPage').disabled = currentRepoPage === totalPages;
  } else {
    pagination.classList.add('hidden');
  }
}

function changeRepoPage(direction) {
  currentRepoPage += direction;
  renderRepositories();
}

async function fetchFollowers(username) {
  await loadUserList(`https://api.github.com/users/${encodeURIComponent(username)}/followers?per_page=30`, 'followersGrid', 'No followers found.', 'Unable to load followers.');
}

async function fetchFollowing(username) {
  await loadUserList(`https://api.github.com/users/${encodeURIComponent(username)}/following?per_page=30`, 'followingGrid', 'Not following anyone.', 'Unable to load following list.');
}

async function loadUserList(url, containerId, emptyMessage, errorMessage) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<div class="empty"><div class="spinner" style="width:28px;height:28px;margin:0 auto 0.6rem;border-width:3px"></div><p>Loading list...</p></div>`;
  try {
    const res = await fetchGitHub(url);
    if (!res.ok) throw new Error('bad response');
    renderUserCards(await res.json(), container, emptyMessage);
  } catch (e) {
    container.innerHTML = `<div class="empty"><p>${errorMessage}</p></div>`;
  }
}

function renderUserCards(users, container, emptyMessage) {
  if (!users || users.length === 0) {
    container.innerHTML = `<div class="empty"><i class="fa-solid fa-users-slash"></i><p>${emptyMessage}</p></div>`;
    return;
  }
  container.innerHTML = users.map((user) => `
    <div class="card user-card" onclick="searchUserDirect('${esc(user.login)}')">
      <img src="${esc(user.avatar_url)}" alt="${esc(user.login)}" />
      <div>
        <h4>${esc(user.login)}</h4>
        <a href="${esc(user.html_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">View on GitHub &rarr;</a>
      </div>
    </div>`).join('');
}

function switchTab(tabName) {
  ['repos', 'followers', 'following'].forEach((t) => {
    const cap = t.charAt(0).toUpperCase() + t.slice(1);
    document.getElementById(`tabBtn${cap}`).className = `tab ${t === tabName ? 'active' : ''}`;
    document.getElementById(`section${cap}`).classList.toggle('hidden', t !== tabName);
  });
}

function showLoading(show, text = 'Fetching GitHub profile data...') {
  document.getElementById('loadingText').innerText = text;
  document.getElementById('loadingState').classList.toggle('hidden', !show);
}

function showError(title, desc) {
  document.getElementById('errorTitle').innerText = title;
  document.getElementById('errorDesc').innerText = desc;
  document.getElementById('errorState').classList.remove('hidden');
}

function hideError() {
  document.getElementById('errorState').classList.add('hidden');
}