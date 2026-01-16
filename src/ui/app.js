/**
 * Main application UI controller
 * Handles authentication, navigation, and view management
 */

console.log('=== app.js loaded ===');

// ==================== State Management ====================
const app = {
  currentView: 'actions',
  isAuthenticated: false,
  user: null,
  settings: {
    refreshInterval: 60000, // 60 seconds (1 minute)
    theme: 'dark',
    notifications: true,
    autoRefresh: true,
    defaultView: 'actions',
    searchFilters: {}
  },
  shortcuts: {},
  searchQuery: ''
};

// ==================== Initialization ====================
window.addEventListener('DOMContentLoaded', async () => {
  console.log('Application starting...');
  
  try {
    // Check if electronAPI is available
    if (!window.electronAPI) {
      console.error('electronAPI is not available! Check preload.js');
      document.body.innerHTML = '<div style="color: white; padding: 20px;">Error: electronAPI not loaded. Check console.</div>';
      return;
    }
    
    console.log('electronAPI loaded successfully');
    
    // Load settings
    await loadSettings();
    console.log('Settings loaded');
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    console.log('Keyboard shortcuts setup');
    
    // Check authentication status
    const isAuth = await window.electronAPI.checkAuth();
    console.log('Auth check result:', isAuth);
    
    if (isAuth) {
      await showMainApp();
    } else {
      showAuthScreen();
    }
    
    // Setup event listeners
    setupEventListeners();
    console.log('Event listeners setup complete');
  } catch (error) {
    console.error('Error during initialization:', error);
    document.body.innerHTML = `<div style="color: white; padding: 20px;">
      <h2>Initialization Error</h2>
      <pre>${error.message}\n${error.stack}</pre>
    </div>`;
  }
});

// ==================== Authentication ====================
function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
  app.isAuthenticated = false;
}

async function showMainApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  app.isAuthenticated = true;
  
  // Load user profile
  const user = await window.electronAPI.getUserProfile();
  if (user) {
    displayUserInfo(user);
    app.user = user;
  }
  
  // Load initial data
  await loadCurrentView();
}

function displayUserInfo(user) {
  document.getElementById('user-info').classList.remove('hidden');
  document.getElementById('user-avatar').src = user.avatar_url;
  document.getElementById('user-name').textContent = `@${user.login}`;
}

async function handleConnect() {
  console.log('handleConnect called');
  const btn = document.getElementById('btn-connect-github');
  
  if (!btn) {
    console.error('Connect button not found!');
    return;
  }
  
  console.log('Button found, starting OAuth...');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> Connecting...';
  
  try {
    console.log('Calling electronAPI.startOAuth()...');
    const result = await window.electronAPI.startOAuth();
    console.log('OAuth result:', result);
    
    if (result.success) {
      console.log('OAuth successful, showing main app');
      await showMainApp();
    } else {
      console.error('OAuth returned success: false');
      alert('Authentication failed. Please check the console for details.');
    }
  } catch (error) {
    console.error('Authentication error:', error);
    alert(`Authentication failed: ${error.message}\n\nPlease check:\n1. Your .env file has correct credentials\n2. The OAuth app callback URL is http://localhost:3000/callback\n3. Check the console for more details`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>🔗</span> Connect with GitHub';
  }
}

async function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    await window.electronAPI.logout();
    showAuthScreen();
  }
}

// ==================== Navigation ====================
function setupEventListeners() {
  // Auth button
  const connectBtn = document.getElementById('btn-connect-github');
  if (connectBtn) {
    console.log('Connect button found, adding event listener');
    connectBtn.addEventListener('click', handleConnect);
  } else {
    console.error('Connect button NOT found in DOM!');
  }
  
  // Refresh button
  document.getElementById('btn-refresh')?.addEventListener('click', () => loadCurrentView());
  
  // Settings button
  document.getElementById('btn-settings')?.addEventListener('click', showSettings);
  
  // Filter/Repository selector button
  document.getElementById('btn-filter')?.addEventListener('click', showRepoSelector);
  
  // Tab navigation
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      switchView(view);
    });
  });
}

function switchView(viewName) {
  // Update tab active state
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });
  
  // Update view active state
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  document.getElementById(`view-${viewName}`).classList.add('active');
  
  // Update app state
  app.currentView = viewName;
  
  // Load view data
  loadCurrentView();
}

async function loadCurrentView() {
  if (!app.isAuthenticated) return;
  
  switch (app.currentView) {
    case 'actions':
      await loadActionsView();
      break;
    case 'repositories':
      await loadRepositoriesView();
      break;
    case 'pulls':
      await loadPullRequestsView();
      break;
    case 'issues':
      await loadIssuesView();
      break;
    case 'notifications':
      await loadNotificationsView();
      break;
    case 'insights':
      await loadInsightsView();
      break;
  }
}

// ==================== Actions View ====================
async function loadActionsView(silentRefresh = false) {
  console.log('Loading actions view...', silentRefresh ? '(silent)' : '');
  const container = document.getElementById('workflow-runs');
  
  try {
    // Only show loading indicator if not a silent refresh
    if (!silentRefresh) {
      container.innerHTML = '<div class="empty-state"><div class="loading"></div><p>Loading workflow runs...</p></div>';
    }
    
    // Get selected repos from localStorage (same as original app)
    const selectedRepos = JSON.parse(localStorage.getItem('selected_repos')) || [];
    console.log('Selected repos from localStorage:', selectedRepos.length);
    
    if (selectedRepos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📂</div>
          <h3>No repositories selected</h3>
          <p class="text-muted">Use the original app to select which repositories to monitor, or go to Repositories tab to configure.</p>
        </div>
      `;
      updateStatusCounts(0, 0, 0, 0);
      return;
    }
    
    console.log('Calling getWorkflowRuns with selected repos...');
    const runs = await window.electronAPI.getWorkflowRuns({ selectedRepos });
    console.log('Received runs:', runs ? runs.length : 0, 'runs');
    
    if (!runs || runs.length === 0) {
      console.log('No runs found or empty array');
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🚀</div>
          <h3>No recent workflow runs</h3>
          <p class="text-muted">Workflow runs from the last 30 minutes will appear here</p>
        </div>
      `;
      updateStatusCounts(0, 0, 0, 0);
      return;
    }
    
    // Group by repository
    const groupedRuns = groupRunsByRepo(runs);
    
    // Render
    container.innerHTML = '';
    for (const [repoName, repoRuns] of Object.entries(groupedRuns)) {
      container.innerHTML += renderRepoCard(repoName, repoRuns);
    }
    
    // Update status counts
    const counts = calculateStatusCounts(runs);
    updateStatusCounts(counts.running, counts.success, counts.failure, counts.queued);
    
  } catch (error) {
    console.error('Failed to load workflow runs:', error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Failed to load workflow runs</h3>
        <p class="text-muted">${error.message}</p>
      </div>
    `;
  }
}

function groupRunsByRepo(runs) {
  const grouped = {};
  runs.forEach(run => {
    const repoName = run.repository.full_name;
    if (!grouped[repoName]) {
      grouped[repoName] = [];
    }
    grouped[repoName].push(run);
  });
  return grouped;
}

function calculateStatusCounts(runs) {
  return runs.reduce((acc, run) => {
    if (run.status === 'in_progress') acc.running++;
    else if (run.conclusion === 'success') acc.success++;
    else if (run.conclusion === 'failure') acc.failure++;
    else if (run.status === 'queued') acc.queued++;
    return acc;
  }, { running: 0, success: 0, failure: 0, queued: 0 });
}

function updateStatusCounts(running, success, failure, queued) {
  document.getElementById('count-running').textContent = running;
  document.getElementById('count-success').textContent = success;
  document.getElementById('count-failure').textContent = failure;
  document.getElementById('count-queued').textContent = queued;
}

function renderRepoCard(repoName, runs) {
  const [owner, repo] = repoName.split('/');
  const runsList = runs.map(run => {
    const statusClass = getStatusClass(run);
    const statusIcon = getStatusIcon(run);
    const timeAgo = formatTimeAgo(new Date(run.created_at));
    
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
          <span class="status-dot ${statusClass}"></span>
          <div style="flex: 1;">
            <div style="font-weight: 500;">${run.name}</div>
            <div class="text-muted" style="font-size: 12px;">${run.head_branch} • ${timeAgo}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="margin-right: 8px;">${statusIcon}</span>
          <button class="btn-action" onclick="openLogs('${owner}', '${repo}', ${run.id})" title="View Logs">📋</button>
          <button class="btn-action" onclick="openArtifacts('${owner}', '${repo}', ${run.id})" title="View Artifacts">📦</button>
          ${run.conclusion === 'failure' || run.conclusion === 'cancelled' ? 
            `<button class="btn-action" onclick="rerunWorkflow('${owner}', '${repo}', ${run.id})" title="Re-run Workflow">🔄</button>` : 
            ''}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="repo-card">
      <div class="repo-header">
        <div class="repo-name">📁 ${repoName}</div>
        <div class="repo-actions">
          <button class="btn-small" onclick="openInGitHub('${repoName}')">View on GitHub</button>
        </div>
      </div>
      ${runsList}
    </div>
  `;
}

function getStatusClass(run) {
  if (run.status === 'in_progress') return 'running';
  if (run.conclusion === 'success') return 'success';
  if (run.conclusion === 'failure') return 'failure';
  if (run.status === 'queued') return 'queued';
  return '';
}

function getStatusIcon(run) {
  if (run.status === 'in_progress') return '⏳';
  if (run.conclusion === 'success') return '✅';
  if (run.conclusion === 'failure') return '❌';
  if (run.status === 'queued') return '⏸️';
  return '⚪';
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Render single notification
function renderNotification(notif) {
  const icon = getNotificationIcon(notif.subject.type);
  const isUnread = notif.unread;
  const timeAgo = formatTimeAgo(new Date(notif.updated_at));
  const repoName = notif.repository.full_name;
  
  return `
    <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${notif.id}" data-reason="${notif.reason}">
      <div class="notification-icon">${icon}</div>
      <div class="notification-content">
        <div class="notification-title">
          ${escapeHtml(notif.subject.title)}
        </div>
        <div class="notification-meta">
          <span class="notification-repo">📁 ${escapeHtml(repoName)}</span>
          <span class="notification-reason">${getReasonLabel(notif.reason)}</span>
          <span class="text-muted">${timeAgo}</span>
        </div>
      </div>
      <div class="notification-actions">
        ${isUnread ? `<button class="btn-icon" onclick="markNotificationAsRead('${notif.id}')" title="Mark as read">✓</button>` : ''}
        <button class="btn-icon" onclick="openNotification('${notif.id}', '${notif.subject.url}')" title="Open">→</button>
      </div>
    </div>
  `;
}

// Get notification icon
function getNotificationIcon(type) {
  const icons = {
    'PullRequest': '🔀',
    'Issue': '🐛',
    'Commit': '📝',
    'Release': '🚀',
    'Discussion': '💬',
    'CheckSuite': '✅',
    'default': '🔔'
  };
  return icons[type] || icons.default;
}

// Get reason label
function getReasonLabel(reason) {
  const labels = {
    'assign': '👤 Assigned',
    'author': '✍️ Author',
    'comment': '💬 Comment',
    'invitation': '📨 Invitation',
    'manual': '🔖 Subscribed',
    'mention': '@ Mentioned',
    'review_requested': '👁️ Review',
    'security_alert': '🔒 Security',
    'state_change': '🔄 State',
    'subscribed': '🔔 Watching',
    'team_mention': '👥 Team'
  };
  return labels[reason] || reason;
}

// Filter notifications
let allNotifications = [];

async function filterNotifications(filter) {
  // Update active button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Get notifications
  const notifications = await window.electronAPI.getNotifications({ all: filter === 'all' });
  allNotifications = notifications;
  
  // Filter
  let filtered = notifications;
  if (filter === 'unread') {
    filtered = notifications.filter(n => n.unread);
  } else if (filter === 'participating') {
    filtered = notifications.filter(n => n.reason === 'mention' || n.reason === 'review_requested' || n.reason === 'assign');
  }
  
  // Render
  const list = document.getElementById('notification-list');
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔔</div>
        <h3>No notifications</h3>
        <p class="text-muted">No notifications match this filter</p>
      </div>
    `;
  } else {
    list.innerHTML = filtered.map(n => renderNotification(n)).join('');
  }
}

// Mark notification as read
async function markNotificationAsRead(notificationId) {
  try {
    await window.electronAPI.markNotificationAsRead(notificationId);
    
    // Remove unread class
    const item = document.querySelector(`[data-id="${notificationId}"]`);
    if (item) {
      item.classList.remove('unread');
      item.querySelector('.notification-actions').innerHTML = `
        <button class="btn-icon" onclick="openNotification('${notificationId}', '')" title="Open">→</button>
      `;
    }
  } catch (error) {
    console.error('Failed to mark as read:', error);
  }
}

// Mark all as read
async function markAllAsRead() {
  if (!confirm('Mark all notifications as read?')) {
    return;
  }
  
  try {
    await window.electronAPI.markAllNotificationsAsRead();
    await loadNotificationsView();
  } catch (error) {
    alert(`Failed to mark all as read: ${error.message}`);
  }
}

// Open notification
async function openNotification(notificationId, subjectUrl) {
  // Mark as read
  await markNotificationAsRead(notificationId);
  
  // Parse subject URL to get details
  if (subjectUrl) {
    // Extract owner, repo, and number from API URL
    const match = subjectUrl.match(/repos\/([^\/]+)\/([^\/]+)\/(pulls|issues)\/(\d+)/);
    if (match) {
      const [, owner, repo, type, number] = match;
      if (type === 'pulls') {
        await openPRDetails(owner, repo, parseInt(number));
      } else if (type === 'issues') {
        await openIssueDetails(owner, repo, parseInt(number));
      }
    }
  }
}

// ==================== Repositories View ====================
let allRepositories = [];
let currentRepoFilter = 'all';
let currentRepoSort = 'updated';

async function loadRepositoriesView() {
  console.log('Loading repositories view...');
  const container = document.getElementById('repositories-list');
  
  container.innerHTML = '<div class="loading">Loading repositories...</div>';
  
  try {
    const repos = await window.electronAPI.listUserRepositories({
      type: currentRepoFilter,
      sort: currentRepoSort,
      direction: 'desc'
    });
    
    allRepositories = repos;
    
    if (!repos || repos.length === 0) {
      container.innerHTML = '<div class="empty-state">No repositories found</div>';
      return;
    }
    
    container.innerHTML = repos.map(repo => renderRepository(repo)).join('');
  } catch (error) {
    console.error('Failed to load repositories:', error);
    container.innerHTML = `<div class="error">Failed to load repositories: ${escapeHtml(error.message)}</div>`;
  }
}

function renderRepository(repo) {
  const updatedAt = formatTimeAgo(new Date(repo.updated_at));
  const visibility = repo.private ? '🔒 Private' : '🌐 Public';
  const language = repo.language ? `<span class="repo-language">${escapeHtml(repo.language)}</span>` : '';
  const stars = repo.stargazers_count > 0 ? `<span class="repo-stat">⭐ ${repo.stargazers_count}</span>` : '';
  const forks = repo.forks_count > 0 ? `<span class="repo-stat">🔀 ${repo.forks_count}</span>` : '';
  const topicsHtml = repo.topics && repo.topics.length > 0 
    ? repo.topics.map(t => `<span class="topic-tag">${escapeHtml(t)}</span>`).join('') 
    : '';
  
  return `
    <div class="repo-item" data-owner="${escapeHtml(repo.owner.login)}" data-repo="${escapeHtml(repo.name)}">
      <div class="repo-header">
        <h3 class="repo-name">
          <a href="#" onclick="event.preventDefault(); openRepoDetail('${escapeHtml(repo.owner.login)}', '${escapeHtml(repo.name)}')">
            ${escapeHtml(repo.full_name)}
          </a>
        </h3>
        <span class="repo-visibility">${visibility}</span>
      </div>
      <p class="repo-description">${repo.description ? escapeHtml(repo.description) : '<span class="text-muted">No description</span>'}</p>
      <div class="repo-topics">${topicsHtml}</div>
      <div class="repo-meta">
        ${language}
        ${stars}
        ${forks}
        <span class="text-muted">Updated ${updatedAt}</span>
      </div>
      <div class="repo-actions">
        <button class="btn-secondary" onclick="cloneRepository('${repo.clone_url}', '${escapeHtml(repo.name)}')">
          📥 Clone
        </button>
        <button class="btn-secondary" onclick="viewRepositorySettings('${escapeHtml(repo.owner.login)}', '${escapeHtml(repo.name)}')">
          ⚙️ Settings
        </button>
        <button class="btn-icon" onclick="toggleStar('${escapeHtml(repo.owner.login)}', '${escapeHtml(repo.name)}', ${repo.stargazers_count})" title="Star">
          ${repo.viewerHasStarred ? '⭐' : '☆'}
        </button>
      </div>
    </div>
  `;
}

function filterRepositories(filter) {
  currentRepoFilter = filter;
  
  // Update button states
  document.querySelectorAll('.repo-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  
  loadRepositoriesView();
}

function sortRepositories(sort) {
  currentRepoSort = sort;
  
  // Update button states
  document.querySelectorAll('.repo-sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === sort);
  });
  
  loadRepositoriesView();
}

// ==================== Create Repository ====================
function showCreateRepositoryDialog() {
  const dialog = document.getElementById('create-repo-dialog');
  dialog.style.display = 'flex';
  
  // Load templates
  loadRepositoryTemplates();
}

function closeCreateRepositoryDialog() {
  const dialog = document.getElementById('create-repo-dialog');
  dialog.style.display = 'none';
  
  // Reset form
  document.getElementById('create-repo-form').reset();
}

async function browseCreateRepoPath() {
  try {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select folder for new repository'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      document.getElementById('create-repo-local-path').value = result.filePaths[0];
    }
  } catch (error) {
    console.error('Failed to open folder dialog:', error);
  }
}

async function loadRepositoryTemplates() {
  try {
    const [gitignoreTemplates, licenses] = await Promise.all([
      window.electronAPI.listGitignoreTemplates(),
      window.electronAPI.listLicenses()
    ]);
    
    // Populate gitignore select
    const gitignoreSelect = document.getElementById('repo-gitignore');
    gitignoreSelect.innerHTML = '<option value="">None</option>' + 
      gitignoreTemplates.map(t => `<option value="${t}">${t}</option>`).join('');
    
    // Populate license select
    const licenseSelect = document.getElementById('repo-license');
    licenseSelect.innerHTML = '<option value="">None</option>' + 
      licenses.map(l => `<option value="${l.key}">${escapeHtml(l.name)}</option>`).join('');
  } catch (error) {
    console.error('Failed to load templates:', error);
  }
}

async function createRepository() {
  const form = document.getElementById('create-repo-form');
  const formData = new FormData(form);
  
  const data = {
    name: formData.get('name'),
    description: formData.get('description'),
    private: formData.get('private') === 'on',
    autoInit: formData.get('autoInit') === 'on',
    gitignoreTemplate: formData.get('gitignoreTemplate') || null,
    licenseTemplate: formData.get('licenseTemplate') || null
  };
  
  const localPath = formData.get('localPath')?.trim();
  
  if (!data.name) {
    alert('Repository name is required');
    return;
  }
  
  try {
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';
    
    const repo = await window.electronAPI.createRepository(data);
    
    // If local path is specified, clone the repository there
    if (localPath) {
      submitBtn.textContent = 'Cloning locally...';
      const clonePath = `${localPath}/${data.name}`;
      
      try {
        await window.electronAPI.cloneRepo(repo.clone_url, clonePath);
        // Store the local path
        setLocalRepoPath(repo.full_name, clonePath);
      } catch (cloneError) {
        console.error('Failed to clone:', cloneError);
        alert(`Repository created on GitHub, but failed to clone locally: ${cloneError.message}`);
      }
    }
    
    closeCreateRepositoryDialog();
    alert(`Repository "${repo.full_name}" created successfully!${localPath ? `\nCloned to: ${localPath}/${data.name}` : ''}`);
    
    // Reload repositories
    await loadRepositoriesView();
  } catch (error) {
    alert(`Failed to create repository: ${error.message}`);
  } finally {
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Repository';
  }
}

// ==================== Clone Repository ====================
async function cloneRepository(cloneUrl, repoName) {
  try {
    const directory = await window.electronAPI.selectDirectory();
    if (!directory) return; // User cancelled
    
    const localPath = `${directory}/${repoName}`;
    
    const result = await window.electronAPI.cloneRepo(cloneUrl, localPath);
    alert(`Repository cloned successfully to:\n${localPath}`);
  } catch (error) {
    alert(`Failed to clone repository: ${error.message}`);
  }
}

// ==================== Repository Settings ====================
function viewRepositorySettings(owner, repo) {
  const dialog = document.getElementById('repo-settings-dialog');
  dialog.style.display = 'flex';
  
  // Load repository details
  loadRepositorySettings(owner, repo);
}

function closeRepositorySettingsDialog() {
  const dialog = document.getElementById('repo-settings-dialog');
  dialog.style.display = 'none';
}

async function loadRepositorySettings(owner, repo) {
  const container = document.getElementById('repo-settings-content');
  container.innerHTML = '<div class="loading">Loading repository settings...</div>';
  
  try {
    const [repoData, topicsData] = await Promise.all([
      window.electronAPI.getRepository(owner, repo),
      window.electronAPI.listRepositoryTopics(owner, repo)
    ]);
    
    const starred = await window.electronAPI.isRepositoryStarred(owner, repo);
    
    container.innerHTML = `
      <div class="settings-section">
        <h3>Basic Information</h3>
        <form id="repo-settings-form" onsubmit="event.preventDefault(); updateRepositorySettings('${owner}', '${repo}')">
          <div class="form-group">
            <label>Repository Name</label>
            <input type="text" name="name" value="${escapeHtml(repoData.name)}" class="form-control" disabled>
            <small>Repository names cannot be changed</small>
          </div>
          
          <div class="form-group">
            <label>Description</label>
            <textarea name="description" class="form-control" rows="3">${escapeHtml(repoData.description || '')}</textarea>
          </div>
          
          <div class="form-group">
            <label>Homepage</label>
            <input type="url" name="homepage" value="${escapeHtml(repoData.homepage || '')}" class="form-control">
          </div>
          
          <div class="form-group">
            <label>Topics</label>
            <input type="text" name="topics" value="${topicsData.names.join(', ')}" class="form-control" placeholder="topic1, topic2, topic3">
            <small>Comma-separated list</small>
          </div>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" name="private" ${repoData.private ? 'checked' : ''} disabled>
              Private repository
            </label>
            <small>Visibility settings require GitHub Pro</small>
          </div>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" name="has_issues" ${repoData.has_issues ? 'checked' : ''}>
              Enable issues
            </label>
          </div>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" name="has_projects" ${repoData.has_projects ? 'checked' : ''}>
              Enable projects
            </label>
          </div>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" name="has_wiki" ${repoData.has_wiki ? 'checked' : ''}>
              Enable wiki
            </label>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn-primary">Save Changes</button>
            <button type="button" class="btn-secondary" onclick="closeRepositorySettingsDialog()">Cancel</button>
          </div>
        </form>
      </div>
      
      <div class="settings-section danger-zone">
        <h3>Danger Zone</h3>
        <div class="danger-actions">
          ${starred 
            ? `<button class="btn-secondary" onclick="unstarRepositoryInSettings('${owner}', '${repo}')">Unstar Repository</button>`
            : `<button class="btn-secondary" onclick="starRepositoryInSettings('${owner}', '${repo}')">Star Repository</button>`
          }
          ${repoData.archived 
            ? '<button class="btn-secondary" disabled>Repository is archived</button>'
            : `<button class="btn-danger" onclick="deleteRepositoryWithConfirmation('${owner}', '${repo}')">Delete Repository</button>`
          }
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="error">Failed to load settings: ${escapeHtml(error.message)}</div>`;
  }
}

async function updateRepositorySettings(owner, repo) {
  const form = document.getElementById('repo-settings-form');
  const formData = new FormData(form);
  
  const data = {
    description: formData.get('description'),
    homepage: formData.get('homepage'),
    has_issues: formData.get('has_issues') === 'on',
    has_projects: formData.get('has_projects') === 'on',
    has_wiki: formData.get('has_wiki') === 'on'
  };
  
  // Handle topics
  const topicsInput = formData.get('topics');
  const topics = topicsInput ? topicsInput.split(',').map(t => t.trim()).filter(t => t) : [];
  
  try {
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    
    await Promise.all([
      window.electronAPI.updateRepository(owner, repo, data),
      window.electronAPI.replaceRepositoryTopics(owner, repo, topics)
    ]);
    
    alert('Repository settings updated successfully!');
    closeRepositorySettingsDialog();
    await loadRepositoriesView();
  } catch (error) {
    alert(`Failed to update settings: ${error.message}`);
  } finally {
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';
  }
}

async function starRepositoryInSettings(owner, repo) {
  try {
    await window.electronAPI.starRepository(owner, repo);
    await loadRepositorySettings(owner, repo);
  } catch (error) {
    alert(`Failed to star repository: ${error.message}`);
  }
}

async function unstarRepositoryInSettings(owner, repo) {
  try {
    await window.electronAPI.unstarRepository(owner, repo);
    await loadRepositorySettings(owner, repo);
  } catch (error) {
    alert(`Failed to unstar repository: ${error.message}`);
  }
}

async function toggleStar(owner, repo, currentStars) {
  try {
    const starred = await window.electronAPI.isRepositoryStarred(owner, repo);
    if (starred) {
      await window.electronAPI.unstarRepository(owner, repo);
    } else {
      await window.electronAPI.starRepository(owner, repo);
    }
    await loadRepositoriesView();
  } catch (error) {
    alert(`Failed to toggle star: ${error.message}`);
  }
}

async function deleteRepositoryWithConfirmation(owner, repo) {
  const confirmation = prompt(
    `This action CANNOT be undone. This will permanently delete the ${owner}/${repo} repository.\n\n` +
    `Please type the repository name to confirm:`
  );
  
  if (confirmation !== repo) {
    alert('Repository name did not match. Deletion cancelled.');
    return;
  }
  
  try {
    await window.electronAPI.deleteRepository(owner, repo);
    alert('Repository deleted successfully.');
    closeRepositorySettingsDialog();
    await loadRepositoriesView();
  } catch (error) {
    alert(`Failed to delete repository: ${error.message}`);
  }
}

async function loadPullRequestsView() {
  console.log('Loading pull requests view...');
  const container = document.getElementById('pull-requests-view');
  
  try {
    // Show loading
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading"></div>
        <p class="text-muted">Loading pull requests...</p>
      </div>
    `;
    
    // Get PRs
    const prs = await window.electronAPI.getPullRequests({ state: 'open' });
    
    if (prs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔀</div>
          <h2>No Open Pull Requests</h2>
          <p class="text-muted">You don't have any open pull requests</p>
        </div>
      `;
      return;
    }
    
    // Group PRs by repository
    const prsByRepo = {};
    prs.forEach(pr => {
      const repoName = pr.base.repo.full_name;
      if (!prsByRepo[repoName]) {
        prsByRepo[repoName] = [];
      }
      prsByRepo[repoName].push(pr);
    });
    
    // Render grouped PRs
    const repoCards = Object.entries(prsByRepo).map(([repoName, repoPRs]) => {
      return renderPRRepoCard(repoName, repoPRs);
    }).join('');
    
    container.innerHTML = repoCards;
    
  } catch (error) {
    console.error('Failed to load pull requests:', error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Failed to load pull requests</h3>
        <p class="text-muted">${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

async function loadIssuesView() {
  console.log('Loading issues view...');
  const container = document.getElementById('issues-view');
  
  try {
    // Show loading
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading"></div>
        <p class="text-muted">Loading issues...</p>
      </div>
    `;
    
    // Get issues
    const issues = await window.electronAPI.getIssues({ state: 'open' });
    
    if (issues.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🐛</div>
          <h2>No Open Issues</h2>
          <p class="text-muted">You don't have any open issues</p>
          <button class="btn-primary" onclick="showCreateIssueDialog()">✨ Create Issue</button>
        </div>
      `;
      return;
    }
    
    // Group issues by repository
    const issuesByRepo = {};
    issues.forEach(issue => {
      const repoName = issue.repository_url ? issue.repository_url.split('/').slice(-2).join('/') : 'Unknown';
      if (!issuesByRepo[repoName]) {
        issuesByRepo[repoName] = [];
      }
      issuesByRepo[repoName].push(issue);
    });
    
    // Render grouped issues
    const repoCards = Object.entries(issuesByRepo).map(([repoName, repoIssues]) => {
      return renderIssueRepoCard(repoName, repoIssues);
    }).join('');
    
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 style="margin: 0;">Open Issues</h2>
        <button class="btn-primary" onclick="showCreateIssueDialog()">✨ Create Issue</button>
      </div>
      ${repoCards}
    `;
    
  } catch (error) {
    console.error('Failed to load issues:', error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Failed to load issues</h3>
        <p class="text-muted">${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

async function loadNotificationsView() {
  console.log('Loading notifications view...');
  const container = document.getElementById('notifications-view');
  
  try {
    // Show loading
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading"></div>
        <p class="text-muted">Loading notifications...</p>
      </div>
    `;
    
    // Get notifications
    const notifications = await window.electronAPI.getNotifications({ all: false });
    
    if (notifications.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔔</div>
          <h2>No New Notifications</h2>
          <p class="text-muted">You're all caught up!</p>
        </div>
      `;
      return;
    }
    
    // Render notifications with filter bar
    container.innerHTML = `
      <div class="notifications-header">
        <h2>Notifications (${notifications.length})</h2>
        <div class="notification-filters">
          <button class="filter-btn active" onclick="filterNotifications('all')">All</button>
          <button class="filter-btn" onclick="filterNotifications('unread')">Unread</button>
          <button class="filter-btn" onclick="filterNotifications('participating')">Participating</button>
        </div>
        <button class="btn-small" onclick="markAllAsRead()">✓ Mark all as read</button>
      </div>
      <div id="notification-list" class="notification-list">
        ${notifications.map(notif => renderNotification(notif)).join('')}
      </div>
    `;
    
  } catch (error) {
    console.error('Failed to load notifications:', error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Failed to load notifications</h3>
        <p class="text-muted">${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

// ==================== Utilities ====================
function showSettings() {
  alert('Settings coming soon!');
}

function openInGitHub(repoName) {
  window.electronAPI.openExternal(`https://github.com/${repoName}/actions`);
}

// Initialize component instances
let logViewer = null;
let artifactBrowser = null;

// Render PR repository card
function renderPRRepoCard(repoName, prs) {
  const [owner, repo] = repoName.split('/');
  const prList = prs.map(pr => {
    const statusIcon = getPRStatusIcon(pr);
    const timeAgo = formatTimeAgo(new Date(pr.updated_at));
    const reviewStatus = getPRReviewStatus(pr);
    
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;" onclick="openPRDetails('${owner}', '${repo}', ${pr.number})">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
          <span style="font-size: 20px;">${statusIcon}</span>
          <div style="flex: 1;">
            <div style="font-weight: 500;">#${pr.number}: ${escapeHtml(pr.title)}</div>
            <div class="text-muted" style="font-size: 12px;">
              ${escapeHtml(pr.user.login)} • ${escapeHtml(pr.head.ref)} → ${escapeHtml(pr.base.ref)} • ${timeAgo}
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${reviewStatus}
          <div class="text-muted" style="font-size: 12px;">
            <span title="Comments">💬 ${pr.comments || 0}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="repo-card">
      <div class="repo-header">
        <div class="repo-name">📁 ${repoName}</div>
        <div class="repo-actions">
          <button class="btn-small" onclick="openInGitHub('${repoName}/pulls')">View on GitHub</button>
        </div>
      </div>
      ${prList}
    </div>
  `;
}

// Get PR status icon
function getPRStatusIcon(pr) {
  if (pr.merged) return '✓';
  if (pr.state === 'closed') return '❌';
  if (pr.draft) return '📝';
  return '🔀';
}

// Get PR review status
function getPRReviewStatus(pr) {
  // This would require additional API call for review status
  // For now, just show if it has reviews
  return '';
}

// Open PR details
async function openPRDetails(owner, repo, prNumber) {
  if (!prViewer) {
    prViewer = new PRViewer();
  }
  await prViewer.show(owner, repo, prNumber);
}

// Render issue repository card
function renderIssueRepoCard(repoName, issues) {
  const [owner, repo] = repoName.split('/');
  const issueList = issues.map(issue => {
    const statusIcon = getIssueStatusIcon(issue);
    const timeAgo = formatTimeAgo(new Date(issue.updated_at));
    
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;" onclick="openIssueDetails('${owner}', '${repo}', ${issue.number})">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
          <span style="font-size: 20px;">${statusIcon}</span>
          <div style="flex: 1;">
            <div style="font-weight: 500;">#${issue.number}: ${escapeHtml(issue.title)}</div>
            <div class="text-muted" style="font-size: 12px;">
              ${escapeHtml(issue.user.login)} • ${timeAgo}
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${issue.labels && issue.labels.length > 0 ? `
            <div style="display: flex; gap: 4px;">
              ${issue.labels.slice(0, 3).map(label => `
                <span class="label" style="background-color: #${label.color}; font-size: 11px;">
                  ${escapeHtml(label.name)}
                </span>
              `).join('')}
            </div>
          ` : ''}
          <div class="text-muted" style="font-size: 12px;">
            <span title="Comments">💬 ${issue.comments || 0}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="repo-card">
      <div class="repo-header">
        <div class="repo-name">📁 ${repoName}</div>
        <div class="repo-actions">
          <button class="btn-small" onclick="openInGitHub('${repoName}/issues')">View on GitHub</button>
        </div>
      </div>
      ${issueList}
    </div>
  `;
}

// Get issue status icon
function getIssueStatusIcon(issue) {
  return issue.state === 'open' ? '🐛' : '✓';
}

// Open issue details
async function openIssueDetails(owner, repo, issueNumber) {
  if (!issueViewer) {
    issueViewer = new IssueViewer();
  }
  await issueViewer.show(owner, repo, issueNumber);
}

// Show create issue dialog
function showCreateIssueDialog() {
  const modal = document.createElement('div');
  modal.id = 'create-issue-modal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="document.getElementById('create-issue-modal').remove()"></div>
    <div class="modal-content" style="width: 600px; max-width: 90%;">
      <div class="modal-header">
        <h2>✨ Create New Issue</h2>
        <button class="btn-icon" onclick="document.getElementById('create-issue-modal').remove()" title="Close">✕</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Repository</label>
          <input type="text" id="issue-repo" placeholder="owner/repo" style="width: 100%; padding: 8px; background: #16213e; border: 1px solid #0f3460; border-radius: 4px; color: #fff;">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Title *</label>
          <input type="text" id="issue-title" placeholder="Brief summary of the issue" style="width: 100%; padding: 8px; background: #16213e; border: 1px solid #0f3460; border-radius: 4px; color: #fff;">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Description</label>
          <textarea id="issue-body" placeholder="Detailed description..." rows="6" style="width: 100%; padding: 8px; background: #16213e; border: 1px solid #0f3460; border-radius: 4px; color: #fff; resize: vertical;"></textarea>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn-secondary" onclick="document.getElementById('create-issue-modal').remove()">Cancel</button>
          <button class="btn-primary" onclick="createIssue()">✨ Create Issue</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('issue-title').focus();
}

// Create issue
async function createIssue() {
  const repoInput = document.getElementById('issue-repo').value.trim();
  const title = document.getElementById('issue-title').value.trim();
  const body = document.getElementById('issue-body').value.trim();
  
  if (!repoInput || !title) {
    alert('Please fill in repository and title');
    return;
  }
  
  const [owner, repo] = repoInput.split('/');
  if (!owner || !repo) {
    alert('Repository must be in format: owner/repo');
    return;
  }
  
  try {
    await window.electronAPI.createIssue(owner, repo, { title, body });
    alert('Issue created successfully!');
    document.getElementById('create-issue-modal').remove();
    
    // Refresh issues view if on issues tab
    if (currentView === 'issues') {
      await loadIssuesView();
    }
  } catch (error) {
    alert(`Failed to create issue: ${error.message}`);
  }
}

// Action button handlers
async function openLogs(owner, repo, runId) {
  if (!logViewer) {
    logViewer = new LogViewer();
  }
  await logViewer.show(owner, repo, runId);
}

async function openArtifacts(owner, repo, runId) {
  if (!artifactBrowser) {
    artifactBrowser = new ArtifactBrowser();
  }
  await artifactBrowser.show(owner, repo, runId);
}

async function rerunWorkflow(owner, repo, runId) {
  if (!confirm('Are you sure you want to re-run this workflow?')) {
    return;
  }
  
  try {
    await window.electronAPI.rerunWorkflow(owner, repo, runId);
    alert('Workflow re-run initiated successfully!');
    // Refresh the actions view
    if (currentView === 'actions') {
      await loadActionsView();
    }
  } catch (error) {
    console.error('Failed to re-run workflow:', error);
    alert(`Failed to re-run workflow: ${error.message}`);
  }
}

// ==================== Insights View ====================
let selectedInsightRepo = null;

async function loadInsightsView() {
  console.log('Loading insights view...');
  
  // Show activity dashboard by default
  await loadActivityDashboard();
}

async function loadActivityDashboard() {
  const container = document.getElementById('insights-dashboard');
  container.innerHTML = '<div class="loading">Loading activity...</div>';
  
  try {
    const user = app.currentUser;
    if (!user) return;
    
    const events = await window.electronAPI.getUserEvents(user.login, { perPage: 100 });
    
    // Process events for activity stats
    const stats = processActivityStats(events);
    
    container.innerHTML = `
      <div class="insights-section">
        <h3>Recent Activity</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats.commits}</div>
            <div class="stat-label">Commits</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.prs}</div>
            <div class="stat-label">Pull Requests</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.issues}</div>
            <div class="stat-label">Issues</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.reviews}</div>
            <div class="stat-label">Reviews</div>
          </div>
        </div>
      </div>
      
      <div class="insights-section">
        <h3>Activity Feed</h3>
        <div class="activity-feed">
          ${events.slice(0, 20).map(event => renderActivityEvent(event)).join('')}
        </div>
      </div>
      
      <div class="insights-section">
        <h3>Repository Insights</h3>
        <div class="repo-selector">
          <select id="insights-repo-select" class="form-control" onchange="loadRepositoryInsights(this.value)">
            <option value="">Select a repository...</option>
          </select>
        </div>
        <div id="repo-insights-content"></div>
      </div>
    `;
    
    // Load user repos for selector
    const repos = await window.electronAPI.listUserRepositories({ perPage: 100, type: 'owner' });
    const select = document.getElementById('insights-repo-select');
    select.innerHTML = '<option value="">Select a repository...</option>' +
      repos.map(r => `<option value="${r.full_name}">${r.full_name}</option>`).join('');
    
  } catch (error) {
    console.error('Failed to load activity dashboard:', error);
    container.innerHTML = `<div class="error">Failed to load activity: ${escapeHtml(error.message)}</div>`;
  }
}

function processActivityStats(events) {
  const stats = {
    commits: 0,
    prs: 0,
    issues: 0,
    reviews: 0
  };
  
  events.forEach(event => {
    switch (event.type) {
      case 'PushEvent':
        stats.commits += event.payload.commits?.length || 0;
        break;
      case 'PullRequestEvent':
        stats.prs++;
        break;
      case 'IssuesEvent':
        stats.issues++;
        break;
      case 'PullRequestReviewEvent':
      case 'PullRequestReviewCommentEvent':
        stats.reviews++;
        break;
    }
  });
  
  return stats;
}

function renderActivityEvent(event) {
  const icon = getActivityIcon(event.type);
  const description = getActivityDescription(event);
  const timeAgo = formatTimeAgo(new Date(event.created_at));
  
  return `
    <div class="activity-item">
      <div class="activity-icon">${icon}</div>
      <div class="activity-content">
        <div class="activity-description">${description}</div>
        <div class="activity-meta">
          <span class="activity-repo">${escapeHtml(event.repo.name)}</span>
          <span class="text-muted">${timeAgo}</span>
        </div>
      </div>
    </div>
  `;
}

function getActivityIcon(type) {
  const icons = {
    'PushEvent': '📝',
    'PullRequestEvent': '🔀',
    'IssuesEvent': '🐛',
    'PullRequestReviewEvent': '👁️',
    'CreateEvent': '✨',
    'DeleteEvent': '🗑️',
    'ForkEvent': '🔱',
    'WatchEvent': '⭐',
    'ReleaseEvent': '🚀',
    'PublicEvent': '🌐'
  };
  return icons[type] || '•';
}

function getActivityDescription(event) {
  const repo = escapeHtml(event.repo.name);
  
  switch (event.type) {
    case 'PushEvent':
      const commits = event.payload.commits?.length || 0;
      return `Pushed ${commits} commit${commits !== 1 ? 's' : ''} to ${repo}`;
    case 'PullRequestEvent':
      const action = event.payload.action;
      return `${action.charAt(0).toUpperCase() + action.slice(1)} pull request in ${repo}`;
    case 'IssuesEvent':
      return `${event.payload.action.charAt(0).toUpperCase() + event.payload.action.slice(1)} issue in ${repo}`;
    case 'PullRequestReviewEvent':
      return `Reviewed pull request in ${repo}`;
    case 'CreateEvent':
      return `Created ${event.payload.ref_type} in ${repo}`;
    case 'WatchEvent':
      return `Starred ${repo}`;
    case 'ForkEvent':
      return `Forked ${repo}`;
    case 'ReleaseEvent':
      return `Published release in ${repo}`;
    default:
      return `Activity in ${repo}`;
  }
}

async function loadRepositoryInsights(fullName) {
  if (!fullName) return;
  
  const [owner, repo] = fullName.split('/');
  selectedInsightRepo = { owner, repo };
  
  const container = document.getElementById('repo-insights-content');
  container.innerHTML = '<div class="loading">Loading repository insights...</div>';
  
  try {
    const [
      traffic,
      clones,
      paths,
      referrers,
      contributors,
      languages,
      commitActivity
    ] = await Promise.all([
      window.electronAPI.getRepositoryTrafficViews(owner, repo).catch(() => null),
      window.electronAPI.getRepositoryTrafficClones(owner, repo).catch(() => null),
      window.electronAPI.getRepositoryTrafficPaths(owner, repo).catch(() => []),
      window.electronAPI.getRepositoryTrafficReferrers(owner, repo).catch(() => []),
      window.electronAPI.getRepositoryContributors(owner, repo).catch(() => []),
      window.electronAPI.getRepositoryLanguages(owner, repo).catch(() => {}),
      window.electronAPI.getRepositoryCommitActivity(owner, repo).catch(() => [])
    ]);
    
    // Calculate total commits from activity
    const totalCommits = commitActivity.reduce((sum, week) => sum + week.total, 0);
    
    container.innerHTML = `
      ${traffic ? `
        <div class="insights-subsection">
          <h4>📊 Traffic</h4>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${traffic.count}</div>
              <div class="stat-label">Total Views</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${traffic.uniques}</div>
              <div class="stat-label">Unique Visitors</div>
            </div>
            ${clones ? `
              <div class="stat-card">
                <div class="stat-value">${clones.count}</div>
                <div class="stat-label">Total Clones</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${clones.uniques}</div>
                <div class="stat-label">Unique Cloners</div>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
      
      ${paths.length > 0 ? `
        <div class="insights-subsection">
          <h4>🔗 Popular Content</h4>
          <div class="list-group">
            ${paths.slice(0, 5).map(path => `
              <div class="list-item">
                <span class="list-item-title">${escapeHtml(path.path)}</span>
                <span class="list-item-badge">${path.count} views</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${referrers.length > 0 ? `
        <div class="insights-subsection">
          <h4>🌐 Top Referrers</h4>
          <div class="list-group">
            ${referrers.slice(0, 5).map(ref => `
              <div class="list-item">
                <span class="list-item-title">${escapeHtml(ref.referrer)}</span>
                <span class="list-item-badge">${ref.count} visits</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${contributors.length > 0 ? `
        <div class="insights-subsection">
          <h4>👥 Top Contributors</h4>
          <div class="list-group">
            ${contributors.slice(0, 10).map(contrib => `
              <div class="list-item">
                <div class="contributor-info">
                  <img src="${contrib.avatar_url}" alt="${contrib.login}" class="contributor-avatar">
                  <span class="list-item-title">${escapeHtml(contrib.login)}</span>
                </div>
                <span class="list-item-badge">${contrib.contributions} commits</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${Object.keys(languages).length > 0 ? `
        <div class="insights-subsection">
          <h4>💻 Languages</h4>
          <div class="language-breakdown">
            ${renderLanguageBreakdown(languages)}
          </div>
        </div>
      ` : ''}
      
      ${commitActivity.length > 0 ? `
        <div class="insights-subsection">
          <h4>📈 Commit Activity (Last 52 Weeks)</h4>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${totalCommits}</div>
              <div class="stat-label">Total Commits</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${Math.round(totalCommits / 52)}</div>
              <div class="stat-label">Avg per Week</div>
            </div>
          </div>
          <div class="commit-activity-chart">
            ${renderCommitActivityChart(commitActivity)}
          </div>
        </div>
      ` : ''}
    `;
  } catch (error) {
    console.error('Failed to load repository insights:', error);
    container.innerHTML = `<div class="error">Failed to load insights: ${escapeHtml(error.message)}</div>`;
  }
}

function renderLanguageBreakdown(languages) {
  const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
  const sorted = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  
  return `
    <div class="language-bars">
      ${sorted.map(([lang, bytes]) => {
        const percentage = ((bytes / total) * 100).toFixed(1);
        return `
          <div class="language-bar-item">
            <div class="language-bar-label">
              <span>${escapeHtml(lang)}</span>
              <span>${percentage}%</span>
            </div>
            <div class="language-bar">
              <div class="language-bar-fill" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderCommitActivityChart(activity) {
  const maxCommits = Math.max(...activity.map(w => w.total));
  
  return `
    <div class="activity-chart">
      ${activity.map(week => {
        const height = maxCommits > 0 ? (week.total / maxCommits) * 100 : 0;
        return `
          <div class="activity-bar" style="height: ${height}%" title="${week.total} commits"></div>
        `;
      }).join('')}
    </div>
  `;
}

// ==================== Auto Refresh ====================
let autoRefreshInterval = null;

function startAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
  
  if (app.settings.autoRefresh) {
    autoRefreshInterval = setInterval(() => {
      if (app.isAuthenticated && app.currentView === 'actions') {
        loadActionsView(true); // Silent refresh - don't clear screen
      }
    }, app.settings.refreshInterval);
  }
}

// Start auto-refresh on load
startAutoRefresh();

// ==================== Settings Management ====================
async function loadSettings() {
  try {
    const stored = localStorage.getItem('github-monitor-settings');
    if (stored) {
      app.settings = { ...app.settings, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

function saveSettings() {
  try {
    localStorage.setItem('github-monitor-settings', JSON.stringify(app.settings));
    startAutoRefresh(); // Restart with new interval
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

function showSettingsDialog() {
  const dialog = document.getElementById('settings-dialog');
  dialog.style.display = 'flex';
  
  // Populate settings form
  document.getElementById('setting-refresh-interval').value = app.settings.refreshInterval / 1000;
  document.getElementById('setting-auto-refresh').checked = app.settings.autoRefresh;
  document.getElementById('setting-notifications').checked = app.settings.notifications;
  document.getElementById('setting-default-view').value = app.settings.defaultView;
}

function closeSettingsDialog() {
  document.getElementById('settings-dialog').style.display = 'none';
}

function applySettings() {
  app.settings.refreshInterval = parseInt(document.getElementById('setting-refresh-interval').value) * 1000;
  app.settings.autoRefresh = document.getElementById('setting-auto-refresh').checked;
  app.settings.notifications = document.getElementById('setting-notifications').checked;
  app.settings.defaultView = document.getElementById('setting-default-view').value;
  
  saveSettings();
  closeSettingsDialog();
  alert('Settings saved successfully!');
}

// ==================== Keyboard Shortcuts ====================
function setupKeyboardShortcuts() {
  app.shortcuts = {
    'ctrl+1': () => switchView('actions'),
    'ctrl+2': () => switchView('repositories'),
    'ctrl+3': () => switchView('pulls'),
    'ctrl+4': () => switchView('issues'),
    'ctrl+5': () => switchView('notifications'),
    'ctrl+6': () => switchView('insights'),
    'ctrl+r': () => loadCurrentView(),
    'ctrl+f': () => showSearchDialog(),
    'ctrl+k': () => showCommandPalette(),
    'ctrl+,': () => showSettingsDialog(),
    'esc': () => closeAllDialogs()
  };
  
  document.addEventListener('keydown', (e) => {
    const key = [];
    if (e.ctrlKey) key.push('ctrl');
    if (e.shiftKey) key.push('shift');
    if (e.altKey) key.push('alt');
    key.push(e.key.toLowerCase());
    
    const combo = key.join('+');
    if (app.shortcuts[combo]) {
      e.preventDefault();
      app.shortcuts[combo]();
    }
  });
}

function showKeyboardShortcuts() {
  const dialog = document.getElementById('shortcuts-dialog');
  dialog.style.display = 'flex';
}

function closeKeyboardShortcuts() {
  document.getElementById('shortcuts-dialog').style.display = 'none';
}

function closeAllDialogs() {
  document.querySelectorAll('.modal-overlay').forEach(dialog => {
    dialog.style.display = 'none';
  });
  // Also close the file viewer
  const fileViewer = document.getElementById('file-viewer-modal');
  if (fileViewer) fileViewer.classList.remove('active');
}

// ==================== Advanced Search ====================
function showSearchDialog() {
  const dialog = document.getElementById('search-dialog');
  dialog.style.display = 'flex';
  document.getElementById('search-input').focus();
}

function closeSearchDialog() {
  document.getElementById('search-dialog').style.display = 'none';
}

async function performAdvancedSearch() {
  const query = document.getElementById('search-input').value;
  const type = document.getElementById('search-type').value;
  const state = document.getElementById('search-state').value;
  const sort = document.getElementById('search-sort').value;
  
  if (!query) {
    alert('Please enter a search query');
    return;
  }
  
  const container = document.getElementById('search-results');
  container.innerHTML = '<div class="loading">Searching...</div>';
  
  try {
    let searchQuery = query;
    
    // Build search query
    if (type === 'pr') {
      searchQuery += ' is:pr';
    } else if (type === 'issue') {
      searchQuery += ' is:issue';
    }
    
    if (state) {
      searchQuery += ` is:${state}`;
    }
    
    // Add user context
    searchQuery += ' involves:@me';
    
    const results = await window.electronAPI.searchIssues(searchQuery, { 
      sort,
      perPage: 50 
    });
    
    if (!results.items || results.items.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No results found</p></div>';
      return;
    }
    
    container.innerHTML = `
      <div class="search-results-header">
        <h4>${results.total_count} results</h4>
      </div>
      <div class="search-results-list">
        ${results.items.map(item => renderSearchResult(item)).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Search failed:', error);
    container.innerHTML = `<div class="error">Search failed: ${escapeHtml(error.message)}</div>`;
  }
}

function renderSearchResult(item) {
  const isPR = item.pull_request !== undefined;
  const icon = isPR ? '🔀' : '🐛';
  const type = isPR ? 'PR' : 'Issue';
  const state = item.state === 'open' ? '🟢 Open' : '🟣 Closed';
  const timeAgo = formatTimeAgo(new Date(item.created_at));
  
  return `
    <div class="search-result-item" onclick="openSearchResult('${item.html_url}')">
      <div class="search-result-icon">${icon}</div>
      <div class="search-result-content">
        <div class="search-result-title">${escapeHtml(item.title)}</div>
        <div class="search-result-meta">
          <span class="search-result-type">${type} #${item.number}</span>
          <span class="search-result-state">${state}</span>
          <span class="search-result-repo">${escapeHtml(item.repository_url.split('/').slice(-2).join('/'))}</span>
          <span class="text-muted">${timeAgo}</span>
        </div>
      </div>
    </div>
  `;
}

function openSearchResult(url) {
  window.electronAPI.openExternal(url);
}

// ==================== Command Palette ====================
function showCommandPalette() {
  const dialog = document.getElementById('command-palette');
  dialog.style.display = 'flex';
  document.getElementById('command-input').focus();
}

function closeCommandPalette() {
  document.getElementById('command-palette').style.display = 'none';
}

function filterCommands() {
  const query = document.getElementById('command-input').value.toLowerCase();
  const commands = [
    { name: 'Go to Actions', action: () => switchView('actions'), key: 'Ctrl+1' },
    { name: 'Go to Repositories', action: () => switchView('repositories'), key: 'Ctrl+2' },
    { name: 'Go to Pull Requests', action: () => switchView('pulls'), key: 'Ctrl+3' },
    { name: 'Go to Issues', action: () => switchView('issues'), key: 'Ctrl+4' },
    { name: 'Go to Notifications', action: () => switchView('notifications'), key: 'Ctrl+5' },
    { name: 'Go to Insights', action: () => switchView('insights'), key: 'Ctrl+6' },
    { name: 'Refresh Current View', action: () => loadCurrentView(), key: 'Ctrl+R' },
    { name: 'Advanced Search', action: () => showSearchDialog(), key: 'Ctrl+F' },
    { name: 'Settings', action: () => showSettingsDialog(), key: 'Ctrl+,' },
    { name: 'Keyboard Shortcuts', action: () => showKeyboardShortcuts(), key: '' },
    { name: 'Create New Repository', action: () => showCreateRepositoryDialog(), key: '' },
    { name: 'Create New Issue', action: () => showCreateIssueDialog(), key: '' },
    { name: 'Logout', action: () => logout(), key: '' }
  ];
  
  const filtered = query 
    ? commands.filter(cmd => cmd.name.toLowerCase().includes(query))
    : commands;
  
  const container = document.getElementById('command-list');
  container.innerHTML = filtered.map((cmd, idx) => `
    <div class="command-item ${idx === 0 ? 'selected' : ''}" onclick="executeCommand(${commands.indexOf(cmd)})">
      <span class="command-name">${escapeHtml(cmd.name)}</span>
      ${cmd.key ? `<span class="command-key">${cmd.key}</span>` : ''}
    </div>
  `).join('');
  
  // Store filtered commands for execution
  window.filteredCommands = filtered;
}

function executeCommand(index) {
  const commands = window.filteredCommands || [];
  if (commands[index]) {
    closeCommandPalette();
    commands[index].action();
  }
}

// ==================== Workflow Triggers ====================
async function showWorkflowTriggerDialog(owner, repo, workflowId) {
  const dialog = document.getElementById('workflow-trigger-dialog');
  dialog.style.display = 'flex';
  
  // Store for later use
  dialog.dataset.owner = owner;
  dialog.dataset.repo = repo;
  dialog.dataset.workflowId = workflowId;
  
  // Load workflow details
  const container = document.getElementById('workflow-inputs-container');
  container.innerHTML = `
    <div class="form-group">
      <label>Branch/Tag</label>
      <input type="text" id="workflow-ref" class="form-control" value="main" placeholder="main">
      <small>The branch or tag to run the workflow on</small>
    </div>
    <div class="form-group">
      <label>Workflow Inputs (JSON)</label>
      <textarea id="workflow-inputs" class="form-control" rows="6" placeholder='{"key": "value"}'></textarea>
      <small>Optional inputs for the workflow in JSON format</small>
    </div>
  `;
}

function closeWorkflowTriggerDialog() {
  document.getElementById('workflow-trigger-dialog').style.display = 'none';
}

async function triggerWorkflow() {
  const dialog = document.getElementById('workflow-trigger-dialog');
  const owner = dialog.dataset.owner;
  const repo = dialog.dataset.repo;
  const workflowId = dialog.dataset.workflowId;
  const ref = document.getElementById('workflow-ref').value || 'main';
  const inputsText = document.getElementById('workflow-inputs').value;
  
  let inputs = {};
  if (inputsText) {
    try {
      inputs = JSON.parse(inputsText);
    } catch (error) {
      alert('Invalid JSON in workflow inputs');
      return;
    }
  }
  
  try {
    await window.electronAPI.triggerWorkflow(owner, repo, workflowId, ref, inputs);
    alert('Workflow triggered successfully!');
    closeWorkflowTriggerDialog();
    if (app.currentView === 'actions') {
      await loadActionsView();
    }
  } catch (error) {
    alert(`Failed to trigger workflow: ${error.message}`);
  }
}

// ==================== Repository Selector ====================
let allRepos = [];
let tempSelectedRepos = [];

async function showRepoSelector() {
  console.log('showRepoSelector called');
  const dialog = document.getElementById('repo-selector-dialog');
  console.log('Dialog element:', dialog);
  const repoList = document.getElementById('repo-list');
  
  if (!dialog) {
    console.error('repo-selector-dialog not found!');
    alert('Repository selector dialog not found');
    return;
  }
  
  dialog.classList.add('active');
  console.log('Dialog classes after adding active:', dialog.className);
  
  // Load current selection
  tempSelectedRepos = JSON.parse(localStorage.getItem('selected_repos')) || [];
  
  // Show loading
  repoList.innerHTML = '<div class="loading-container"><div class="loading"></div><p>Loading repositories...</p></div>';
  
  try {
    // Fetch all repos
    allRepos = await window.electronAPI.listUserRepositories({ per_page: 100, sort: 'pushed' });
    renderRepoList();
    updateRepoCount();
  } catch (error) {
    repoList.innerHTML = `<div class="error-message">Failed to load repositories: ${error.message}</div>`;
  }
}

function closeRepoSelector() {
  document.getElementById('repo-selector-dialog').classList.remove('active');
}

function renderRepoList() {
  const repoList = document.getElementById('repo-list');
  const searchTerm = document.getElementById('repo-search')?.value.toLowerCase() || '';
  
  if (allRepos.length === 0) {
    repoList.innerHTML = '<div class="empty-state">No repositories found</div>';
    return;
  }
  
  repoList.innerHTML = allRepos.map(repo => {
    const isSelected = tempSelectedRepos.includes(repo.full_name);
    const matchesSearch = repo.full_name.toLowerCase().includes(searchTerm);
    const hiddenClass = matchesSearch ? '' : 'hidden';
    
    return `
      <div class="repo-item ${hiddenClass}" data-repo="${repo.full_name}">
        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleRepo('${repo.full_name}')">
        <div class="repo-item-info">
          <div class="repo-item-name">${repo.full_name}</div>
          <div class="repo-item-meta">
            <span>${repo.private ? '🔒 Private' : '🌐 Public'}</span>
            ${repo.language ? `<span>📝 ${repo.language}</span>` : ''}
            <span>⭐ ${repo.stargazers_count || 0}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterRepoList() {
  const searchTerm = document.getElementById('repo-search').value.toLowerCase();
  
  document.querySelectorAll('.repo-item').forEach(item => {
    const repoName = item.dataset.repo.toLowerCase();
    if (repoName.includes(searchTerm)) {
      item.classList.remove('hidden');
    } else {
      item.classList.add('hidden');
    }
  });
}

function toggleRepo(repoName) {
  const index = tempSelectedRepos.indexOf(repoName);
  if (index === -1) {
    tempSelectedRepos.push(repoName);
  } else {
    tempSelectedRepos.splice(index, 1);
  }
  updateRepoCount();
}

function selectAllRepos() {
  const searchTerm = document.getElementById('repo-search').value.toLowerCase();
  
  allRepos.forEach(repo => {
    if (repo.full_name.toLowerCase().includes(searchTerm)) {
      if (!tempSelectedRepos.includes(repo.full_name)) {
        tempSelectedRepos.push(repo.full_name);
      }
    }
  });
  
  renderRepoList();
  updateRepoCount();
}

function selectNoneRepos() {
  tempSelectedRepos = [];
  renderRepoList();
  updateRepoCount();
}

function updateRepoCount() {
  const countEl = document.getElementById('repo-count');
  if (countEl) {
    countEl.textContent = `${tempSelectedRepos.length} repositories selected`;
  }
}

function saveRepoSelection() {
  localStorage.setItem('selected_repos', JSON.stringify(tempSelectedRepos));
  closeRepoSelector();
  
  // Refresh actions view if we're on it
  if (app.currentView === 'actions') {
    loadActionsView();
  }
  
  alert(`Now monitoring ${tempSelectedRepos.length} repositories`);
}

// ==================== Repository Detail View ====================
let currentRepoDetail = null;

function getLocalRepoPaths() {
  return JSON.parse(localStorage.getItem('local_repo_paths') || '{}');
}

function setLocalRepoPath(fullName, path) {
  const paths = getLocalRepoPaths();
  paths[fullName] = path;
  localStorage.setItem('local_repo_paths', JSON.stringify(paths));
}

function getLocalRepoPath(fullName) {
  return getLocalRepoPaths()[fullName] || null;
}

async function openRepoDetail(owner, repo) {
  currentRepoDetail = { owner, repo, fullName: `${owner}/${repo}` };
  
  // Hide repositories view, show detail view
  document.getElementById('view-repositories').classList.remove('active');
  document.getElementById('view-repo-detail').classList.add('active');
  
  // Update nav tabs to show we're in a sub-view
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  
  // Load repo details
  await loadRepoDetailData();
}

function closeRepoDetail() {
  currentRepoDetail = null;
  
  // Hide detail view, show repositories view
  document.getElementById('view-repo-detail').classList.remove('active');
  document.getElementById('view-repositories').classList.add('active');
  
  // Restore repositories tab as active
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === 'repositories');
  });
}

async function loadRepoDetailData() {
  if (!currentRepoDetail) return;
  
  const { owner, repo, fullName } = currentRepoDetail;
  
  // Update header
  document.getElementById('repo-detail-name').textContent = fullName;
  
  try {
    // Fetch repo info
    const repoInfo = await window.electronAPI.getRepository(owner, repo);
    
    document.getElementById('repo-detail-visibility').textContent = 
      repoInfo.private ? '🔒 Private' : '🌐 Public';
    document.getElementById('repo-detail-description').textContent = 
      repoInfo.description || 'No description';
    document.getElementById('repo-detail-language').textContent = 
      repoInfo.language ? `📝 ${repoInfo.language}` : '';
    document.getElementById('repo-detail-stars').textContent = 
      `⭐ ${repoInfo.stargazers_count || 0}`;
    document.getElementById('repo-detail-forks').textContent = 
      `🔀 ${repoInfo.forks_count || 0}`;
    
    // Store repo URL for opening in browser
    currentRepoDetail.htmlUrl = repoInfo.html_url;
    currentRepoDetail.defaultBranch = repoInfo.default_branch;
    
    // Check local path
    const localPath = getLocalRepoPath(fullName);
    const pathIndicator = document.getElementById('repo-detail-local-path');
    if (localPath) {
      pathIndicator.textContent = `📁 ${localPath}`;
      pathIndicator.classList.remove('not-set');
    } else {
      pathIndicator.textContent = '📁 No local path set';
      pathIndicator.classList.add('not-set');
    }
    
    // Load currently active tab (or default to commits)
    const activeTab = document.querySelector('.repo-tab.active');
    const tabName = activeTab ? activeTab.dataset.tab : 'commits';
    
    switch (tabName) {
      case 'commits':
        await loadCommitsTab();
        break;
      case 'branches':
        await loadBranchesTab();
        break;
      case 'files':
        await loadFilesTab();
        break;
      case 'actions':
        await loadActionsTab();
        break;
      default:
        await loadCommitsTab();
    }
    
  } catch (error) {
    console.error('Failed to load repo details:', error);
  }
}

async function refreshRepoDetail() {
  await loadRepoDetailData();
}

function openRepoInBrowser() {
  if (currentRepoDetail?.htmlUrl) {
    window.electronAPI.openExternal(currentRepoDetail.htmlUrl);
  }
}

function switchRepoTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.repo-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.repo-tab-content').forEach(c => {
    c.classList.remove('active');
  });
  document.getElementById(`repo-tab-${tabName}`).classList.add('active');
  
  // Load tab data
  switch (tabName) {
    case 'commits':
      loadCommitsTab();
      break;
    case 'branches':
      loadBranchesTab();
      break;
    case 'files':
      loadFilesTab();
      break;
    case 'actions':
      loadActionsTab();
      break;
  }
}

// ==================== Commits Tab ====================
async function loadCommitsTab() {
  if (!currentRepoDetail) return;
  
  const { owner, repo } = currentRepoDetail;
  const commitList = document.getElementById('commit-list');
  const commitGraph = document.getElementById('commit-graph');
  
  commitList.innerHTML = '<div class="loading">Loading commits...</div>';
  commitGraph.innerHTML = '';
  
  try {
    const commits = await window.electronAPI.listCommits(owner, repo, { per_page: 50 });
    
    if (!commits || commits.length === 0) {
      commitList.innerHTML = '<div class="empty-state">No commits found</div>';
      return;
    }
    
    // Render commit list
    commitList.innerHTML = commits.map((commit, index) => {
      const isMerge = commit.parents && commit.parents.length > 1;
      const sha = commit.sha.substring(0, 7);
      const message = escapeHtml(commit.commit.message.split('\n')[0]);
      const author = commit.commit.author?.name || 'Unknown';
      const date = formatTimeAgo(new Date(commit.commit.author?.date));
      
      return `
        <div class="commit-item" data-sha="${commit.sha}">
          <div class="commit-dot ${isMerge ? 'merge' : ''}"></div>
          <div class="commit-info">
            <div class="commit-message">${message}</div>
            <div class="commit-meta">
              <span class="commit-sha">${sha}</span>
              <span>👤 ${escapeHtml(author)}</span>
              <span>📅 ${date}</span>
              ${isMerge ? '<span>🔀 Merge commit</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Render simple graph
    renderCommitGraph(commits);
    
  } catch (error) {
    commitList.innerHTML = `<div class="error">Failed to load commits: ${error.message}</div>`;
  }
}

function renderCommitGraph(commits) {
  const graph = document.getElementById('commit-graph');
  
  // Simple visual representation
  let html = '<svg width="100" height="' + (commits.length * 40) + '">';
  
  commits.forEach((commit, i) => {
    const y = i * 40 + 20;
    const isMerge = commit.parents && commit.parents.length > 1;
    const color = isMerge ? '#9b59b6' : '#e87722';
    
    // Draw line to next commit
    if (i < commits.length - 1) {
      html += `<line x1="50" y1="${y}" x2="50" y2="${y + 40}" stroke="${color}" stroke-width="2"/>`;
    }
    
    // Draw merge lines for merge commits
    if (isMerge) {
      html += `<line x1="30" y1="${y - 15}" x2="50" y2="${y}" stroke="#9b59b6" stroke-width="2"/>`;
    }
    
    // Draw commit dot
    html += `<circle cx="50" cy="${y}" r="6" fill="${color}"/>`;
  });
  
  html += '</svg>';
  graph.innerHTML = html;
}

// ==================== Branches Tab ====================
async function loadBranchesTab() {
  if (!currentRepoDetail) return;
  
  const { owner, repo, fullName } = currentRepoDetail;
  const localList = document.getElementById('local-branches-list');
  const remoteList = document.getElementById('remote-branches-list');
  
  // Load remote branches
  remoteList.innerHTML = '<div class="loading">Loading branches...</div>';
  
  try {
    const branches = await window.electronAPI.listBranches(owner, repo);
    
    if (!branches || branches.length === 0) {
      remoteList.innerHTML = '<div class="empty-state">No branches found</div>';
    } else {
      remoteList.innerHTML = branches.map(branch => `
        <div class="branch-item ${branch.name === currentRepoDetail.defaultBranch ? 'current' : ''}">
          <span class="branch-name">
            🌿 ${escapeHtml(branch.name)}
            ${branch.name === currentRepoDetail.defaultBranch ? '<span class="branch-tag">default</span>' : ''}
          </span>
          <div class="branch-actions">
            <button class="btn-icon" onclick="viewBranchCommits('${escapeHtml(branch.name)}')" title="View commits">📜</button>
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    remoteList.innerHTML = `<div class="error">Failed to load branches: ${error.message}</div>`;
  }
  
  // Load local branches if path is set
  const localPath = getLocalRepoPath(fullName);
  if (localPath) {
    try {
      const localBranches = await window.electronAPI.getLocalBranches(localPath);
      if (localBranches && localBranches.length > 0) {
        localList.innerHTML = localBranches.map(branch => `
          <div class="branch-item ${branch.current ? 'current' : ''}">
            <span class="branch-name">
              🌿 ${escapeHtml(branch.name)}
              ${branch.current ? '<span class="branch-tag">current</span>' : ''}
            </span>
          </div>
        `).join('');
      } else {
        localList.innerHTML = '<div class="empty-state">No local branches found</div>';
      }
    } catch (error) {
      localList.innerHTML = `<div class="empty-state">Could not read local branches</div>`;
    }
  } else {
    localList.innerHTML = `
      <div class="empty-state">
        <p>No local repository configured</p>
        <button class="btn-secondary" onclick="showLocalPathDialog()">Set Local Path</button>
      </div>
    `;
  }
}

async function viewBranchCommits(branchName) {
  // Could implement branch-specific commit view
  alert(`Viewing commits for branch: ${branchName}`);
}

// ==================== Files Tab ====================
async function loadFilesTab() {
  if (!currentRepoDetail) return;
  
  const { owner, repo, fullName, defaultBranch } = currentRepoDetail;
  const localTree = document.getElementById('local-files-tree');
  const remoteTree = document.getElementById('remote-files-tree');
  const branchSelect = document.getElementById('remote-branch-select');
  const localPathSpan = document.getElementById('local-files-path');
  
  // Populate branch selector
  try {
    const branches = await window.electronAPI.listBranches(owner, repo);
    branchSelect.innerHTML = branches.map(b => 
      `<option value="${escapeHtml(b.name)}" ${b.name === defaultBranch ? 'selected' : ''}>${escapeHtml(b.name)}</option>`
    ).join('');
    
    // Load remote files
    await loadRemoteFiles();
  } catch (error) {
    remoteTree.innerHTML = `<div class="error">Failed to load branches</div>`;
  }
  
  // Load local files if path is set
  const localPath = getLocalRepoPath(fullName);
  if (localPath) {
    localPathSpan.textContent = localPath;
    try {
      const files = await window.electronAPI.listLocalFiles(localPath);
      if (files) {
        renderFileTree(localTree, files, localPath, true);
      } else {
        localTree.innerHTML = '<div class="empty-state">Could not read local files</div>';
      }
    } catch (error) {
      localTree.innerHTML = `<div class="empty-state">Could not read local files</div>`;
    }
  } else {
    localPathSpan.textContent = '';
    localTree.innerHTML = `
      <div class="empty-state">
        <p>No local repository configured</p>
        <button class="btn-secondary" onclick="showLocalPathDialog()">Set Local Path</button>
      </div>
    `;
  }
}

async function loadRemoteFiles() {
  if (!currentRepoDetail) return;
  
  const { owner, repo } = currentRepoDetail;
  const remoteTree = document.getElementById('remote-files-tree');
  const branchSelect = document.getElementById('remote-branch-select');
  const branch = branchSelect.value;
  
  if (!branch) {
    remoteTree.innerHTML = '<div class="empty-state">Select a branch</div>';
    return;
  }
  
  remoteTree.innerHTML = '<div class="loading">Loading files...</div>';
  
  try {
    const contents = await window.electronAPI.getRepoContents(owner, repo, '', branch);
    if (contents && contents.length > 0) {
      renderRemoteFileTree(remoteTree, contents, '');
    } else {
      remoteTree.innerHTML = '<div class="empty-state">No files found</div>';
    }
  } catch (error) {
    remoteTree.innerHTML = `<div class="error">Failed to load files: ${error.message}</div>`;
  }
}

function renderRemoteFileTree(container, items, path, indent = 0) {
  const sorted = items.sort((a, b) => {
    // Folders first, then files
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });
  
  const indentPx = indent * 16;
  
  container.innerHTML = sorted.map(item => {
    const isFolder = item.type === 'dir';
    const icon = isFolder ? '📁' : getFileIcon(item.name);
    const folderId = `remote-folder-${item.path.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    return `
      <div class="file-item ${isFolder ? 'folder' : 'file'}" 
           style="padding-left: ${indentPx + 8}px;"
           data-path="${escapeHtml(item.path)}"
           onclick="${isFolder ? `toggleRemoteFolder(this, '${escapeHtml(item.path)}')` : `viewRemoteFile('${escapeHtml(item.path)}')`}">
        <span class="file-icon">${isFolder ? '📁' : icon}</span>
        <span>${escapeHtml(item.name)}</span>
      </div>
      ${isFolder ? `<div id="${folderId}" class="folder-children" style="display: none;"></div>` : ''}
    `;
  }).join('');
}

function renderFileTree(container, items, basePath, isLocal, indent = 0) {
  const sorted = items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
  
  const indentPx = indent * 16;
  
  container.innerHTML = sorted.map(item => {
    const icon = item.isDirectory ? '📁' : getFileIcon(item.name);
    const fullPath = item.path || `${basePath}\\${item.name}`;
    const safePath = fullPath.replace(/\\/g, '/');
    const folderId = `local-folder-${safePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    return `
      <div class="file-item ${item.isDirectory ? 'folder' : 'file'}"
           style="padding-left: ${indentPx + 8}px;"
           data-path="${escapeHtml(safePath)}"
           onclick="${item.isDirectory ? `toggleLocalFolder(this, '${escapeHtml(safePath)}')` : `openLocalFile('${escapeHtml(safePath)}')`}">
        <span class="file-icon">${icon}</span>
        <span>${escapeHtml(item.name)}</span>
      </div>
      ${item.isDirectory ? `<div id="${folderId}" class="folder-children" style="display: none;"></div>` : ''}
    `;
  }).join('');
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    js: '📜', ts: '📘', jsx: '⚛️', tsx: '⚛️',
    json: '📋', md: '📝', html: '🌐', css: '🎨',
    py: '🐍', rb: '💎', go: '🔵', rs: '🦀',
    java: '☕', cs: '🔷', cpp: '⚙️', c: '⚙️',
    sh: '💻', yml: '⚙️', yaml: '⚙️',
    png: '🖼️', jpg: '🖼️', gif: '🖼️', svg: '🖼️',
    pdf: '📄', zip: '📦', tar: '📦'
  };
  return icons[ext] || '📄';
}

// ==================== Actions Tab ====================
let repoWorkflows = [];

async function loadActionsTab() {
  if (!currentRepoDetail) return;
  
  const { owner, repo, defaultBranch } = currentRepoDetail;
  const workflowSelect = document.getElementById('repo-workflow-select');
  const branchSelect = document.getElementById('repo-workflow-branch');
  const runsList = document.getElementById('repo-workflow-runs');
  
  // Load workflows for the dropdown
  try {
    const workflowsData = await window.electronAPI.listWorkflows(owner, repo);
    repoWorkflows = workflowsData.workflows || [];
    
    workflowSelect.innerHTML = '<option value="">Select workflow...</option>' +
      repoWorkflows.map(w => `<option value="${w.id}" data-path="${escapeHtml(w.path)}">${escapeHtml(w.name)}</option>`).join('');
  } catch (error) {
    console.error('Failed to load workflows:', error);
    workflowSelect.innerHTML = '<option value="">Failed to load workflows</option>';
  }
  
  // Load branches for the dropdown
  try {
    const branches = await window.electronAPI.listBranches(owner, repo);
    branchSelect.innerHTML = branches.map(b => 
      `<option value="${escapeHtml(b.name)}" ${b.name === defaultBranch ? 'selected' : ''}>${escapeHtml(b.name)}</option>`
    ).join('');
  } catch (error) {
    console.error('Failed to load branches:', error);
    branchSelect.innerHTML = '<option value="">Failed to load branches</option>';
  }
  
  // Load recent workflow runs
  await loadRepoWorkflowRuns();
}

async function loadRepoWorkflowRuns() {
  if (!currentRepoDetail) return;
  
  const { owner, repo } = currentRepoDetail;
  const runsList = document.getElementById('repo-workflow-runs');
  
  runsList.innerHTML = '<div class="loading">Loading workflow runs...</div>';
  
  try {
    const runsData = await window.electronAPI.listRepoWorkflowRuns(owner, repo, { per_page: 30 });
    const runs = runsData.workflow_runs || [];
    
    if (runs.length === 0) {
      runsList.innerHTML = '<div class="empty-state">No workflow runs found</div>';
      return;
    }
    
    runsList.innerHTML = runs.map(run => {
      const statusIcon = getRunStatusIcon(run.status, run.conclusion);
      const statusClass = run.conclusion || run.status;
      const duration = run.run_started_at ? formatDuration(new Date(run.run_started_at), run.updated_at ? new Date(run.updated_at) : new Date()) : '';
      
      return `
        <div class="workflow-run-item" data-run-id="${run.id}">
          <div class="workflow-run-status ${statusClass}">${statusIcon}</div>
          <div class="workflow-run-info">
            <div class="workflow-run-name">${escapeHtml(run.name || run.workflow_name || 'Workflow')}</div>
            <div class="workflow-run-meta">
              <span>📌 ${escapeHtml(run.head_branch)}</span>
              <span>🔗 ${escapeHtml(run.head_sha?.substring(0, 7) || '')}</span>
              <span>⏱️ ${formatTimeAgo(new Date(run.created_at))}</span>
              ${duration ? `<span>⏳ ${duration}</span>` : ''}
            </div>
          </div>
          <div class="workflow-run-actions">
            ${run.status === 'in_progress' || run.status === 'queued' ? 
              `<button class="btn-secondary btn-sm" onclick="cancelRepoWorkflowRun(${run.id})">❌ Cancel</button>` : 
              `<button class="btn-secondary btn-sm" onclick="rerunRepoWorkflow(${run.id})">🔄 Re-run</button>`
            }
            <button class="btn-secondary btn-sm" onclick="viewWorkflowRunLogs('${owner}', '${repo}', ${run.id})">📋 Logs</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Failed to load workflow runs:', error);
    runsList.innerHTML = `<div class="error">Failed to load workflow runs: ${escapeHtml(error.message)}</div>`;
  }
}

function getRunStatusIcon(status, conclusion) {
  if (status === 'in_progress') return '🔄';
  if (status === 'queued') return '⏳';
  if (conclusion === 'success') return '✅';
  if (conclusion === 'failure') return '❌';
  if (conclusion === 'cancelled') return '⛔';
  if (conclusion === 'skipped') return '⏭️';
  return '❓';
}

function formatDuration(start, end) {
  const diff = Math.floor((end - start) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

function onWorkflowSelect() {
  // For now, just hide the inputs container as we'd need workflow file parsing for inputs
  const inputsContainer = document.getElementById('workflow-inputs-container');
  inputsContainer.style.display = 'none';
}

async function triggerRepoWorkflow() {
  if (!currentRepoDetail) return;
  
  const { owner, repo } = currentRepoDetail;
  const workflowSelect = document.getElementById('repo-workflow-select');
  const branchSelect = document.getElementById('repo-workflow-branch');
  
  const workflowId = workflowSelect.value;
  const branch = branchSelect.value;
  
  if (!workflowId) {
    alert('Please select a workflow');
    return;
  }
  
  if (!branch) {
    alert('Please select a branch');
    return;
  }
  
  try {
    await window.electronAPI.triggerWorkflow(owner, repo, workflowId, branch, {});
    alert('Workflow triggered successfully! It may take a moment to appear in the list.');
    
    // Reload runs after a short delay
    setTimeout(() => loadRepoWorkflowRuns(), 2000);
  } catch (error) {
    console.error('Failed to trigger workflow:', error);
    alert(`Failed to trigger workflow: ${error.message}`);
  }
}

async function cancelRepoWorkflowRun(runId) {
  if (!currentRepoDetail) return;
  
  const { owner, repo } = currentRepoDetail;
  
  if (!confirm('Are you sure you want to cancel this workflow run?')) return;
  
  try {
    await window.electronAPI.cancelWorkflowRun(owner, repo, runId);
    await loadRepoWorkflowRuns();
  } catch (error) {
    console.error('Failed to cancel workflow:', error);
    alert(`Failed to cancel workflow: ${error.message}`);
  }
}

async function rerunRepoWorkflow(runId) {
  if (!currentRepoDetail) return;
  
  const { owner, repo } = currentRepoDetail;
  
  try {
    await window.electronAPI.rerunWorkflow(owner, repo, runId);
    alert('Workflow re-run triggered!');
    setTimeout(() => loadRepoWorkflowRuns(), 2000);
  } catch (error) {
    console.error('Failed to rerun workflow:', error);
    alert(`Failed to rerun workflow: ${error.message}`);
  }
}

async function viewWorkflowRunLogs(owner, repo, runId) {
  // Open the logs in the log viewer component (if available) or GitHub
  try {
    const url = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
    window.electronAPI.openExternal(url);
  } catch (error) {
    console.error('Failed to open logs:', error);
  }
}

async function toggleRemoteFolder(element, path) {
  event.stopPropagation();
  
  const folderId = `remote-folder-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const childContainer = document.getElementById(folderId);
  
  if (!childContainer) return;
  
  // Toggle visibility
  if (childContainer.style.display === 'none') {
    // Expand - load contents if not already loaded
    const icon = element.querySelector('.file-icon');
    
    if (!childContainer.dataset.loaded) {
      icon.textContent = '⏳';
      
      try {
        const { owner, repo } = currentRepoDetail;
        const branch = document.getElementById('remote-branch-select').value;
        const contents = await window.electronAPI.getRepoContents(owner, repo, path, branch);
        
        if (contents && contents.length > 0) {
          const indent = (parseInt(element.style.paddingLeft) || 8) / 16 + 1;
          renderRemoteFolderContents(childContainer, contents, indent);
        } else {
          childContainer.innerHTML = '<div class="file-item text-muted" style="padding-left: 32px;">Empty folder</div>';
        }
        childContainer.dataset.loaded = 'true';
      } catch (error) {
        childContainer.innerHTML = `<div class="file-item text-muted" style="padding-left: 32px;">Failed to load</div>`;
      }
      
      icon.textContent = '📂';
    } else {
      icon.textContent = '📂';
    }
    
    childContainer.style.display = 'block';
  } else {
    // Collapse
    childContainer.style.display = 'none';
    element.querySelector('.file-icon').textContent = '📁';
  }
}

function renderRemoteFolderContents(container, items, indent) {
  const sorted = items.sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });
  
  const indentPx = indent * 16;
  
  container.innerHTML = sorted.map(item => {
    const isFolder = item.type === 'dir';
    const icon = isFolder ? '📁' : getFileIcon(item.name);
    const folderId = `remote-folder-${item.path.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    return `
      <div class="file-item ${isFolder ? 'folder' : 'file'}" 
           style="padding-left: ${indentPx + 8}px;"
           data-path="${escapeHtml(item.path)}"
           onclick="${isFolder ? `toggleRemoteFolder(this, '${escapeHtml(item.path)}')` : `viewRemoteFile('${escapeHtml(item.path)}')`}">
        <span class="file-icon">${icon}</span>
        <span>${escapeHtml(item.name)}</span>
      </div>
      ${isFolder ? `<div id="${folderId}" class="folder-children" style="display: none;"></div>` : ''}
    `;
  }).join('');
}

async function toggleLocalFolder(element, path) {
  event.stopPropagation();
  
  const folderId = `local-folder-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const childContainer = document.getElementById(folderId);
  
  if (!childContainer) return;
  
  // Toggle visibility
  if (childContainer.style.display === 'none') {
    // Expand - load contents if not already loaded
    const icon = element.querySelector('.file-icon');
    
    if (!childContainer.dataset.loaded) {
      icon.textContent = '⏳';
      
      try {
        const files = await window.electronAPI.listLocalFiles(path);
        
        if (files && files.length > 0) {
          const indent = (parseInt(element.style.paddingLeft) || 8) / 16 + 1;
          renderLocalFolderContents(childContainer, files, path, indent);
        } else {
          childContainer.innerHTML = '<div class="file-item text-muted" style="padding-left: 32px;">Empty folder</div>';
        }
        childContainer.dataset.loaded = 'true';
      } catch (error) {
        childContainer.innerHTML = `<div class="file-item text-muted" style="padding-left: 32px;">Failed to load</div>`;
      }
      
      icon.textContent = '📂';
    } else {
      icon.textContent = '📂';
    }
    
    childContainer.style.display = 'block';
  } else {
    // Collapse
    childContainer.style.display = 'none';
    element.querySelector('.file-icon').textContent = '📁';
  }
}

function renderLocalFolderContents(container, items, basePath, indent) {
  const sorted = items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
  
  const indentPx = indent * 16;
  
  container.innerHTML = sorted.map(item => {
    const icon = item.isDirectory ? '📁' : getFileIcon(item.name);
    const fullPath = item.path || `${basePath}/${item.name}`;
    const safePath = fullPath.replace(/\\/g, '/');
    const folderId = `local-folder-${safePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    return `
      <div class="file-item ${item.isDirectory ? 'folder' : 'file'}"
           style="padding-left: ${indentPx + 8}px;"
           data-path="${escapeHtml(safePath)}"
           onclick="${item.isDirectory ? `toggleLocalFolder(this, '${escapeHtml(safePath)}')` : `openLocalFile('${escapeHtml(safePath)}')`}">
        <span class="file-icon">${icon}</span>
        <span>${escapeHtml(item.name)}</span>
      </div>
      ${item.isDirectory ? `<div id="${folderId}" class="folder-children" style="display: none;"></div>` : ''}
    `;
  }).join('');
}

// ==================== File Viewer ====================
function getLanguageFromFilename(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const langMap = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', pyw: 'python',
    rb: 'ruby', 
    java: 'java',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
    c: 'c', h: 'c',
    swift: 'swift',
    kt: 'kotlin', kts: 'kotlin',
    scala: 'scala',
    r: 'r',
    sql: 'sql',
    html: 'html', htm: 'html',
    css: 'css', scss: 'scss', sass: 'scss', less: 'less',
    json: 'json',
    xml: 'xml', xsl: 'xml', xslt: 'xml',
    yaml: 'yaml', yml: 'yaml',
    md: 'markdown', markdown: 'markdown',
    sh: 'bash', bash: 'bash', zsh: 'bash',
    ps1: 'powershell', psm1: 'powershell',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    cmake: 'cmake',
    gradle: 'gradle',
    groovy: 'groovy',
    lua: 'lua',
    perl: 'perl', pl: 'perl',
    ini: 'ini', toml: 'ini', cfg: 'ini',
    vim: 'vim',
    diff: 'diff', patch: 'diff'
  };
  return langMap[ext] || 'plaintext';
}

function showFileViewer(filename, path, content, isRemote = false) {
  const modal = document.getElementById('file-viewer-modal');
  const iconEl = document.getElementById('file-viewer-icon');
  const nameEl = document.getElementById('file-viewer-name');
  const pathEl = document.getElementById('file-viewer-path');
  const contentEl = document.getElementById('file-viewer-content');
  const openBtn = document.getElementById('file-viewer-open-external');
  
  // Set header info
  iconEl.textContent = getFileIcon(filename);
  nameEl.textContent = filename;
  pathEl.textContent = path;
  
  // Configure open button
  if (isRemote && currentRepoDetail) {
    const { owner, repo } = currentRepoDetail;
    const branch = document.getElementById('remote-branch-select').value;
    const url = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
    openBtn.onclick = () => window.electronAPI.openExternal(url);
    openBtn.style.display = 'inline-block';
  } else if (!isRemote) {
    openBtn.onclick = () => window.electronAPI.openPath(path);
    openBtn.style.display = 'inline-block';
  } else {
    openBtn.style.display = 'none';
  }
  
  // Determine language and display content
  const language = getLanguageFromFilename(filename);
  const escapedContent = escapeHtml(content);
  
  // Split into lines for line numbers
  const lines = content.split('\n');
  const numberedLines = lines.map((line, i) => 
    `<code>${escapeHtml(line)}</code>`
  ).join('\n');
  
  contentEl.innerHTML = `<pre class="line-numbers"><code class="language-${language}">${escapedContent}</code></pre>`;
  
  // Apply syntax highlighting if hljs is available
  if (window.hljs) {
    const codeBlock = contentEl.querySelector('code');
    window.hljs.highlightElement(codeBlock);
  }
  
  modal.classList.add('active');
}

function closeFileViewer() {
  const modal = document.getElementById('file-viewer-modal');
  modal.classList.remove('active');
}

async function viewRemoteFile(path) {
  if (!currentRepoDetail) return;
  const { owner, repo } = currentRepoDetail;
  const branch = document.getElementById('remote-branch-select').value;
  
  // Show loading state
  const modal = document.getElementById('file-viewer-modal');
  const contentEl = document.getElementById('file-viewer-content');
  const nameEl = document.getElementById('file-viewer-name');
  const pathEl = document.getElementById('file-viewer-path');
  const iconEl = document.getElementById('file-viewer-icon');
  
  const filename = path.split('/').pop();
  iconEl.textContent = getFileIcon(filename);
  nameEl.textContent = filename;
  pathEl.textContent = path;
  contentEl.innerHTML = '<div class="file-viewer-loading"><div class="loading"></div><span style="margin-left: 12px;">Loading file...</span></div>';
  modal.classList.add('active');
  
  try {
    // Fetch file content from GitHub
    const fileData = await window.electronAPI.getRepoContents(owner, repo, path, branch);
    
    if (fileData.type === 'file' && fileData.content) {
      // GitHub returns base64 encoded content
      const content = atob(fileData.content);
      showFileViewer(filename, path, content, true);
    } else if (fileData.size > 1024 * 1024) {
      contentEl.innerHTML = '<div class="file-viewer-error"><h3>⚠️ File Too Large</h3><p>This file is too large to display inline.</p><button class="btn-primary" onclick="window.electronAPI.openExternal(`https://github.com/${currentRepoDetail.owner}/${currentRepoDetail.repo}/blob/${document.getElementById(\'remote-branch-select\').value}/${path}`)">Open on GitHub</button></div>';
    } else {
      contentEl.innerHTML = '<div class="file-viewer-error"><h3>⚠️ Cannot Display</h3><p>Unable to load file content.</p></div>';
    }
  } catch (error) {
    console.error('Failed to load remote file:', error);
    contentEl.innerHTML = `<div class="file-viewer-error"><h3>❌ Error</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function openLocalFile(path) {
  const filename = path.split('/').pop().split('\\').pop();
  
  // Show loading state
  const modal = document.getElementById('file-viewer-modal');
  const contentEl = document.getElementById('file-viewer-content');
  const nameEl = document.getElementById('file-viewer-name');
  const pathEl = document.getElementById('file-viewer-path');
  const iconEl = document.getElementById('file-viewer-icon');
  
  iconEl.textContent = getFileIcon(filename);
  nameEl.textContent = filename;
  pathEl.textContent = path;
  contentEl.innerHTML = '<div class="file-viewer-loading"><div class="loading"></div><span style="margin-left: 12px;">Loading file...</span></div>';
  modal.classList.add('active');
  
  try {
    const result = await window.electronAPI.readLocalFile(path);
    
    if (result.error) {
      if (result.binary) {
        contentEl.innerHTML = `<div class="file-viewer-error"><h3>📦 Binary File</h3><p>This is a binary file and cannot be displayed as text.</p><button class="btn-primary" onclick="window.electronAPI.openPath('${escapeHtml(path)}')">Open with Default App</button></div>`;
      } else {
        contentEl.innerHTML = `<div class="file-viewer-error"><h3>❌ Error</h3><p>${escapeHtml(result.error)}</p></div>`;
      }
    } else {
      showFileViewer(filename, path, result.content, false);
    }
  } catch (error) {
    console.error('Failed to load local file:', error);
    contentEl.innerHTML = `<div class="file-viewer-error"><h3>❌ Error</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

// ==================== Local Path Management ====================
function showLocalPathDialog() {
  if (!currentRepoDetail) return;
  
  const dialog = document.getElementById('local-path-dialog');
  const input = document.getElementById('local-path-input');
  const status = document.getElementById('local-path-status');
  
  // Pre-fill with existing path if any
  const existingPath = getLocalRepoPath(currentRepoDetail.fullName);
  input.value = existingPath || '';
  status.textContent = '';
  
  dialog.classList.add('active');
}

function closeLocalPathDialog() {
  document.getElementById('local-path-dialog').classList.remove('active');
}

async function browseLocalPath() {
  try {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Local Repository Folder'
    });
    
    if (result && !result.canceled && result.filePaths.length > 0) {
      document.getElementById('local-path-input').value = result.filePaths[0];
      await validateLocalPath(result.filePaths[0]);
    }
  } catch (error) {
    console.error('Failed to open folder dialog:', error);
  }
}

async function validateLocalPath(path) {
  const status = document.getElementById('local-path-status');
  
  try {
    const isGitRepo = await window.electronAPI.isGitRepository(path);
    if (isGitRepo) {
      status.innerHTML = '<span style="color: #2ecc71;">✓ Valid Git repository</span>';
    } else {
      status.innerHTML = '<span style="color: #f39c12;">⚠ Not a Git repository (but can still be used)</span>';
    }
  } catch (error) {
    status.innerHTML = '<span style="color: #e74c3c;">✗ Could not access path</span>';
  }
}

async function saveLocalPath() {
  if (!currentRepoDetail) return;
  
  const path = document.getElementById('local-path-input').value.trim();
  
  if (path) {
    setLocalRepoPath(currentRepoDetail.fullName, path);
  } else {
    clearLocalPath();
    return;
  }
  
  closeLocalPathDialog();
  await loadRepoDetailData();
}

function clearLocalPath() {
  if (!currentRepoDetail) return;
  
  const paths = getLocalRepoPaths();
  delete paths[currentRepoDetail.fullName];
  localStorage.setItem('local_repo_paths', JSON.stringify(paths));
  
  closeLocalPathDialog();
  loadRepoDetailData();
}

// Expose repo detail functions globally
window.openRepoDetail = openRepoDetail;
window.closeRepoDetail = closeRepoDetail;
window.refreshRepoDetail = refreshRepoDetail;
window.openRepoInBrowser = openRepoInBrowser;
window.switchRepoTab = switchRepoTab;
window.showLocalPathDialog = showLocalPathDialog;
window.closeLocalPathDialog = closeLocalPathDialog;
window.browseLocalPath = browseLocalPath;
window.saveLocalPath = saveLocalPath;
window.clearLocalPath = clearLocalPath;
window.loadRemoteFiles = loadRemoteFiles;
window.toggleRemoteFolder = toggleRemoteFolder;
window.viewRemoteFile = viewRemoteFile;
window.toggleLocalFolder = toggleLocalFolder;
window.openLocalFile = openLocalFile;
window.viewBranchCommits = viewBranchCommits;
window.closeFileViewer = closeFileViewer;

// Expose actions tab functions globally
window.loadActionsTab = loadActionsTab;
window.onWorkflowSelect = onWorkflowSelect;
window.triggerRepoWorkflow = triggerRepoWorkflow;
window.cancelRepoWorkflowRun = cancelRepoWorkflowRun;
window.rerunRepoWorkflow = rerunRepoWorkflow;
window.viewWorkflowRunLogs = viewWorkflowRunLogs;

// Expose repo selector functions globally for onclick handlers
window.showRepoSelector = showRepoSelector;
window.closeRepoSelector = closeRepoSelector;
window.filterRepoList = filterRepoList;
window.toggleRepo = toggleRepo;
window.selectAllRepos = selectAllRepos;
window.selectNoneRepos = selectNoneRepos;
window.saveRepoSelection = saveRepoSelection;

// Expose create repository functions globally
window.showCreateRepositoryDialog = showCreateRepositoryDialog;
window.closeCreateRepositoryDialog = closeCreateRepositoryDialog;
window.createRepository = createRepository;
window.browseCreateRepoPath = browseCreateRepoPath;