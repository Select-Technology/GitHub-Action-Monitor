# GitHub Actions Monitor - Extension Plan
## Complete GitHub Integration

### Overview
Transform the GitHub Actions Monitor into a comprehensive GitHub desktop client that provides:
- **Repository Management**: Create, clone, pull, push, and publish repositories
- **Enhanced Actions**: Workflow logs, re-runs, and artifact management
- **Pull Request Monitoring**: Status tracking, reviews, and merge readiness
- **Issue Management**: Track, filter, and manage issues across repositories
- **Notifications**: Real-time desktop alerts for GitHub activities
- **Advanced Search**: Custom queries and saved filters

---

# Part A: Repository Management Features

---

## 1. Create New Repositories

### Features
- **New Repository Dialog**
  - Repository name input
  - Description (optional)
  - Visibility (public/private)
  - Initialize with README option
  - .gitignore template selection
  - License selection
  - Default branch name configuration

### API Integration
- **Endpoint**: `POST /user/repos`
- **Permissions Required**: `repo` scope (already required)

### UI Components
- "New Repository" button in header
- Modal dialog with form fields
- Validation for repository name (alphanumeric, hyphens, underscores)
- Success notification with option to clone immediately

### Implementation Notes
```javascript
// GitHub API call
POST https://api.github.com/user/repos
{
  "name": "repo-name",
  "description": "Repository description",
  "private": false,
  "auto_init": true,
  "gitignore_template": "Node",
  "license_template": "mit"
}
```

---

## 2. Clone Repositories

### Features
- **Clone Dialog**
  - Repository selector (dropdown of user's repos)
  - Local destination path picker
  - Clone progress indicator
  - Option to open in VS Code or other editors after cloning

### Technical Requirements
- **Git Integration**: Use `nodegit` or `simple-git` npm packages
- **File System Access**: Dialog for selecting local directory
- **Progress Tracking**: Show clone progress (file count, bytes transferred)

### UI Components
- "Clone Repository" button or context menu action
- Path selector using Electron's `dialog.showOpenDialog`
- Progress bar with cancel option
- Success notification with "Open Folder" action

### Implementation
```javascript
// Using simple-git
const simpleGit = require('simple-git');
const git = simpleGit();

await git.clone(
  `https://github.com/${owner}/${repo}.git`,
  localPath,
  ['--progress']
);
```

---

## 3. Pull Changes

### Features
- **Repository List View**
  - Display cloned repositories with local paths
  - Show sync status (ahead/behind remote)
  - "Pull" button for each repository
  - Bulk pull option for multiple repos

### Technical Requirements
- **Local Repository Discovery**: Scan user-configured paths for .git folders
- **Git Status Check**: Compare local with remote branches
- **Conflict Detection**: Alert user to merge conflicts
- **Credential Management**: Store and use GitHub credentials securely

### UI Components
- "Local Repositories" tab/section
- Repository cards showing:
  - Repository name and path
  - Current branch
  - Commits ahead/behind
  - Last pull timestamp
  - Pull button with loading state
- Settings for watched directories

### Implementation
```javascript
// Check if pull needed
const status = await git.fetch();
const log = await git.log(['HEAD..origin/main']);
const behindCount = log.total;

// Pull changes
await git.pull('origin', 'main');
```

---

## 4. Push Changes

### Features
- **Commit & Push Workflow**
  - View uncommitted changes
  - Stage files (select which files to commit)
  - Commit message input
  - Push to remote
  - Branch selection

### Technical Requirements
- **Change Detection**: Monitor working directory for modifications
- **Staging Area**: Allow selective file staging
- **Authentication**: Handle SSH keys or HTTPS tokens
- **Push Options**: Force push option (with warning), push tags

### UI Components
- "Changes" panel for each local repository
- File list with checkboxes (staged/unstaged)
- Commit message text area with character count
- Commit history view
- Push button with branch selector

### Implementation
```javascript
// Stage files
await git.add(['file1.js', 'file2.js']);

// Commit
await git.commit('Commit message');

// Push
await git.push('origin', 'main');
```

---

## 5. Publish Repositories

### Features
- **Publish Local Repository**
  - Select local folder that's not yet pushed to GitHub
  - Create remote repository automatically
  - Initial push with all commits
  - Configure remote tracking

### Workflow
1. User selects local Git repository (initialized but no remote)
2. App prompts for remote repository details:
   - Repository name (default: local folder name)
   - Visibility (public/private)
   - Description
3. App creates remote repository via GitHub API
4. App adds remote origin to local repo
5. App pushes all commits to new remote

### UI Components
- "Publish Repository" button in local repos view
- Wizard-style dialog for configuration
- Progress indicator for push operation
- Success message with link to GitHub repository

### Implementation
```javascript
// Create remote repository
const response = await createGitHubRepo({
  name: repoName,
  private: isPrivate,
  description: description
});

// Add remote and push
await git.addRemote('origin', response.data.clone_url);
await git.push('origin', 'main', {'--set-upstream': null});
```

---

## 6. Architecture Changes

### New Dependencies
```json
{
  "dependencies": {
    "simple-git": "^3.22.0",           // Git operations
    "electron-store": "^8.1.0",        // Persistent settings storage
    "marked": "^12.0.0",               // Markdown rendering
    "diff2html": "^3.4.47",            // Diff viewer
    "monaco-editor": "^0.45.0",        // Code editor for reviews
    "node-notifier": "^10.0.1",        // Enhanced desktop notifications
    "date-fns": "^3.0.0",              // Date formatting
    "lodash": "^4.17.21",              // Utility functions
    "express": "^4.18.2",              // OAuth callback server
    "axios": "^1.6.0"                  // HTTP client for API calls
  }
}
```

### Application Structure
```
GitHub-Action-Monitor/
├── main.js                    (Electron main process)
├── preload.js                 (Security bridge)
├── index.html                 (Main UI shell)
├── src/
│   ├── api/
│   │   ├── github-api.js      (GitHub REST API wrapper)
│   │   ├── git-operations.js  (Git operations using simple-git)
│   │   ├── webhooks.js        (GitHub webhooks handler)
│   │   └── cache.js           (API response caching)
│   ├── ui/
│   │   ├── views/
│   │   │   ├── actions-view.js       (Enhanced Actions monitoring)
│   │   │   ├── repos-view.js         (Repository management)
│   │   │   ├── pulls-view.js         (Pull Request dashboard)
│   │   │   ├── issues-view.js        (Issue tracking)
│   │   │   ├── notifications-view.js (Notification center)
│   │   │   └── dashboard-view.js     (Overview/insights)
│   │   ├── components/
│   │   │   ├── diff-viewer.js        (Code diff component)
│   │   │   ├── markdown-renderer.js  (Markdown preview)
│   │   │   ├── log-viewer.js         (Workflow logs)
│   │   │   └── search.js             (Search interface)
│   │   └── dialogs.js                (Modal dialogs)
│   ├── services/
│   │   ├── notification-service.js   (Desktop notifications)
│   │   ├── sync-service.js           (Background sync)
│   │   └── search-service.js         (Search indexing)
│   └── utils/
│       ├── auth.js            (Token management)
│       ├── storage.js         (Settings persistence)
│       ├── formatters.js      (Date/text formatting)
│       └── helpers.js         (Common utilities)
└── package.json
```

### UI Navigation
- **Tab-based Layout**:
  - 🚀 Actions (current view + enhancements)
  - 📁 Repositories (new repository management)
  - 🔀 Pull Requests (new PR monitoring)
  - 🐛 Issues (new issue tracking)
  - 🔔 Notifications (new notification center)
  - ⚙️ Settings

---

# Part B: Enhanced GitHub Actions Features

---

## 11. Workflow Logs & Details

### Features
- **Log Viewer**
  - View complete workflow run logs
  - Filter by job and step
  - Search within logs
  - Syntax highlighting for errors
  - Download logs as text file
  - Real-time log streaming for running workflows

### API Integration
- **Endpoint**: `GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs`
- **Stream**: Use Server-Sent Events or polling for live logs

### UI Components
- Click workflow run to open log viewer
- Split pane: job list (left) | log content (right)
- Filter toolbar (show all, errors only, warnings)
- Line numbers and timestamp columns
- Search box with regex support
- "Download Logs" button

### Implementation
```javascript
// Fetch logs
const response = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/logs`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json'
    }
  }
);
const logsZip = await response.blob();
// Extract and parse zip file
```

---

## 12. Re-run Workflows

### Features
- **Re-run Actions**
  - Re-run failed jobs only
  - Re-run entire workflow
  - Confirm dialog before re-running
  - Show re-run history

### API Integration
- **Endpoint**: `POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun`
- **Failed Jobs**: `POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs`

### UI Components
- "Re-run" button on failed workflows
- Dropdown menu:
  - Re-run failed jobs
  - Re-run all jobs
- Confirmation dialog with cost estimate (for private repos)
- Success notification

### Implementation
```javascript
// Re-run failed jobs
await fetch(
  `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/rerun-failed-jobs`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json'
    }
  }
);
```

---

## 13. Artifact Management

### Features
- **Artifact Browser**
  - List all artifacts from workflow runs
  - Download artifacts
  - View artifact metadata (size, expiration)
  - Delete expired artifacts
  - Search artifacts across repositories

### API Integration
- **List**: `GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts`
- **Download**: `GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip`
- **Delete**: `DELETE /repos/{owner}/{repo}/actions/artifacts/{artifact_id}`

### UI Components
- "Artifacts" tab in workflow run details
- Artifact list with:
  - Name and size
  - Created date
  - Expiration countdown
  - Download button
  - Delete button (if expired)
- Save location picker for downloads

### Implementation
```javascript
// List artifacts
const artifacts = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`
).then(r => r.json());

// Download artifact
const artifactBlob = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`,
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.blob());
```

---

## 14. Workflow Triggers

### Features
- **Manual Workflow Dispatch**
  - Trigger workflows with `workflow_dispatch` event
  - Input parameters for workflow
  - Select branch/tag to run on
  - Show trigger history

### API Integration
- **Endpoint**: `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`

### UI Components
- "Run Workflow" button for dispatch-enabled workflows
- Modal with:
  - Branch/tag selector
  - Input fields (based on workflow definition)
  - Validate before triggering
- Confirmation and link to new run

### Implementation
```javascript
// Trigger workflow
await fetch(
  `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json'
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        name: 'value'
      }
    })
  }
);
```

---

# Part C: Pull Request Monitoring

---

## 15. Pull Request Dashboard

### Features
- **PR List View**
  - All open PRs across repositories
  - Filter by: assigned to me, created by me, review requested
  - Status badges (draft, ready, approved, changes requested)
  - Check status (pending, passing, failing)
  - Review status with avatars
  - Merge readiness indicator

### API Integration
- **Search**: `GET /search/issues?q=type:pr+state:open+involves:${username}`
- **PR Details**: `GET /repos/{owner}/{repo}/pulls/{pull_number}`
- **Reviews**: `GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews`
- **Checks**: `GET /repos/{owner}/{repo}/commits/{ref}/check-runs`

### UI Components
- PR cards with:
  - Title and description preview
  - Repository name
  - Author and creation date
  - Status badges
  - Check status icons
  - Review summary
  - Comment count
  - Labels
- Filter toolbar
- Sort options (newest, oldest, recently updated)

---

## 16. PR Details & Actions

### Features
- **PR Detail View**
  - Full description and conversation
  - File changes (diff viewer)
  - Commits list
  - Review comments
  - Check/status details
  - Merge button (when ready)
  - Request reviewers
  - Add labels
  - Close/reopen PR

### API Integration
- **Files**: `GET /repos/{owner}/{repo}/pulls/{pull_number}/files`
- **Commits**: `GET /repos/{owner}/{repo}/pulls/{pull_number}/commits`
- **Comments**: `GET /repos/{owner}/{repo}/issues/{issue_number}/comments`
- **Merge**: `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge`

### UI Components
- Three-tab layout:
  - Conversation (timeline view)
  - Files changed (diff viewer)
  - Commits
- Action buttons:
  - Merge (squash, rebase, or merge commit)
  - Close PR
  - Request changes
  - Approve
  - Comment
- Sidebar with metadata (reviewers, labels, assignees)

---

## 17. Code Review Features

### Features
- **Review Workflow**
  - Inline diff viewer
  - Add review comments
  - Start/submit review
  - Approve or request changes
  - View existing review threads

### API Integration
- **Start Review**: `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews`
- **Add Comment**: `POST /repos/{owner}/{repo}/pulls/{pull_number}/comments`
- **Submit Review**: `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/events`

### UI Components
- Diff viewer with line numbers
- "+" button on lines to add comment
- Review comment editor
- Review summary form:
  - Comment/Approve/Request Changes
  - Summary text
  - Submit button

---

# Part D: Issue Management

---

## 18. Issues Dashboard

### Features
- **Issue List View**
  - Open issues across all repositories
  - Filter by: assigned to me, created by me, mentioned
  - Sort by: newest, oldest, most commented, recently updated
  - Label filtering
  - Milestone filtering
  - Search within issues

### API Integration
- **Search**: `GET /search/issues?q=type:issue+state:open+involves:${username}`
- **Issue Details**: `GET /repos/{owner}/{repo}/issues/{issue_number}`

### UI Components
- Issue cards showing:
  - Title
  - Repository name
  - Issue number
  - Labels
  - Assignees
  - Comment count
  - Creation date
  - Last updated
- Filter panel (left sidebar)
- Search bar with advanced syntax support

---

## 19. Issue Details & Management

### Features
- **Issue Detail View**
  - Full description
  - Comment thread
  - Timeline (events, labels, assignments)
  - Edit issue
  - Add comments
  - Close/reopen issue
  - Manage labels
  - Assign/unassign users
  - Link to PRs

### API Integration
- **Comments**: `GET /repos/{owner}/{repo}/issues/{issue_number}/comments`
- **Add Comment**: `POST /repos/{owner}/{repo}/issues/{issue_number}/comments`
- **Update Issue**: `PATCH /repos/{owner}/{repo}/issues/{issue_number}`
- **Timeline**: `GET /repos/{owner}/{repo}/issues/{issue_number}/timeline`

### UI Components
- Issue header with metadata
- Comment thread with markdown rendering
- Comment editor with preview
- Action buttons:
  - Close issue
  - Lock conversation
  - Pin issue
  - Transfer issue
- Sidebar: labels, assignees, projects, milestone

---

## 20. Create Issues

### Features
- **New Issue Form**
  - Select repository
  - Title and description
  - Apply labels
  - Assign users
  - Set milestone
  - Use issue templates (if available)

### API Integration
- **Create**: `POST /repos/{owner}/{repo}/issues`
- **Templates**: `GET /repos/{owner}/{repo}/contents/.github/ISSUE_TEMPLATE`

### UI Components
- "New Issue" button
- Modal/page with form:
  - Repository selector
  - Template selector (if templates exist)
  - Title field
  - Description editor (markdown with preview)
  - Labels multi-select
  - Assignees multi-select
  - Milestone selector
- Create button

---

# Part E: Notification System

---

## 21. GitHub Notifications

### Features
- **Notification Center**
  - Unread GitHub notifications
  - Filter by: repository, reason (mention, review request, etc.)
  - Mark as read/unread
  - Navigate to source (issue, PR, discussion)
  - Mute thread notifications

### API Integration
- **List**: `GET /notifications`
- **Mark Read**: `PATCH /notifications/{thread_id}`
- **Thread Details**: `GET /notifications/threads/{thread_id}`

### UI Components
- Notification badge with unread count
- Notification panel/tab showing:
  - Notification type icon
  - Title
  - Repository
  - Reason for notification
  - Time
- Context menu: mark read, mute, view on GitHub

---

## 22. Desktop Notifications

### Features
- **Real-time Alerts**
  - Desktop notification for new workflow failures
  - PR review requests
  - New mentions
  - CI status changes
  - Customizable notification preferences

### Technical Requirements
- Use Electron's `Notification` API
- Poll or webhook for real-time updates
- Respect system Do Not Disturb settings

### UI Components
- Settings panel for notification preferences:
  - Enable/disable by type
  - Sound preferences
  - Do Not Disturb hours
  - Notification frequency (immediate, batched)
- Native system notifications with:
  - Icon
  - Title
  - Body
  - Action buttons (view, dismiss)

### Implementation
```javascript
// Desktop notification
const notification = new Notification('Workflow Failed', {
  body: 'Build failed in repository/name',
  icon: 'path/to/icon.png',
  actions: [
    { action: 'view', title: 'View Details' },
    { action: 'dismiss', title: 'Dismiss' }
  ]
});
```

---

## 23. Activity Feed

### Features
- **Timeline View**
  - Recent activity across all watched repositories
  - Filter by activity type (commits, PRs, issues, releases)
  - Quick actions from feed items

### API Integration
- **Events**: `GET /users/{username}/events`
- **Repo Events**: `GET /repos/{owner}/{repo}/events`

### UI Components
- Scrollable activity feed
- Activity cards with:
  - Avatar
  - Activity type icon
  - Description
  - Timestamp
  - Quick action buttons
- Filter chips (all, pushes, PRs, issues, stars)

---

# Part F: Repository Health & Insights

---

## 24. Repository Dashboard

### Features
- **Repository Overview**
  - Health score
  - Recent activity summary
  - Open issues/PRs count
  - Contributors
  - Language breakdown
  - Star/fork/watch counts

### API Integration
- **Repo Info**: `GET /repos/{owner}/{repo}`
- **Contributors**: `GET /repos/{owner}/{repo}/contributors`
- **Languages**: `GET /repos/{owner}/{repo}/languages`
- **Traffic**: `GET /repos/{owner}/{repo}/traffic/views`

### UI Components
- Dashboard cards:
  - Quick stats
  - Activity graph
  - Top contributors
  - Language pie chart
  - Traffic insights

---

## 25. Security Alerts

### Features
- **Dependabot Alerts**
  - List vulnerable dependencies
  - Severity levels
  - Available fixes
  - Dismiss alerts
  - View dependency graph

### API Integration
- **Alerts**: `GET /repos/{owner}/{repo}/dependabot/alerts`
- **Vulnerability**: `GET /repos/{owner}/{repo}/vulnerability-alerts`

### UI Components
- Security tab showing:
  - Alert count by severity
  - Alert list with:
    - Package name
    - Vulnerability description
    - Severity badge
    - Fix version
    - Dismiss button
- Filter by severity

---

## 26. Deployment Status

### Features
- **Deployment Tracking**
  - Active deployments
  - Deployment history
  - Environment status
  - Rollback capability (if supported)

### API Integration
- **Deployments**: `GET /repos/{owner}/{repo}/deployments`
- **Status**: `GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses`

### UI Components
- Deployments view:
  - Environment cards (production, staging, etc.)
  - Current version/commit
  - Last deployment time
  - Status indicator
  - View logs button

---

# Part G: Advanced Features

---

## 27. Search & Filters

### Features
- **Advanced Search**
  - Search across repos, issues, PRs, code
  - Custom query builder
  - Save frequent searches
  - Search history

### API Integration
- **Search API**: `GET /search/{type}?q={query}`
- Types: repositories, issues, code, commits, users

### UI Components
- Global search bar with autocomplete
- Search filters panel
- Query builder UI
- Saved searches dropdown
- Search results with preview

---

## 28. Custom Views & Workspaces

### Features
- **Personalized Dashboards**
  - Create custom views
  - Pin repositories
  - Arrange widgets
  - Save workspace layouts
  - Quick switch between workspaces

### Technical Requirements
- Store layout preferences in `electron-store`
- Drag-and-drop widget arrangement
- Export/import workspace configurations

### UI Components
- Workspace selector dropdown
- "Customize Layout" mode
- Widget library
- Save/load workspace dialogs

---

## 29. Collaboration Tools

### Features
- **Team Features**
  - View organization members
  - Team management
  - Team discussion threads
  - Project boards

### API Integration
- **Orgs**: `GET /user/orgs`
- **Teams**: `GET /orgs/{org}/teams`
- **Members**: `GET /orgs/{org}/members`
- **Projects**: `GET /repos/{owner}/{repo}/projects`

---

## 30. Batch Operations

### Features
- **Multi-select Actions**
  - Bulk label management
  - Bulk issue closing
  - Bulk PR operations
  - Bulk repository operations

### UI Components
- Checkbox selection mode
- Bulk action toolbar
- Progress indicator for batch operations
- Undo functionality

---

## 7. Authentication Architecture Migration

### Current State: Personal Access Token (PAT)
**Limitations:**
- Requires manual token generation
- User must understand scope requirements
- No expiration/refresh mechanism
- Full account access (security risk)
- No fine-grained permissions
- Difficult to revoke per-app

### Target State: GitHub OAuth App

**Benefits:**
- Standard OAuth 2.0 flow (familiar to users)
- Automatic token refresh
- Fine-grained permissions
- Per-installation revocation
- Better security model
- Professional user experience
- Audit trail in GitHub settings

### OAuth Implementation

#### 1. Register GitHub OAuth App
```
Application name: GitHub Actions Monitor
Homepage URL: https://github.com/[your-org]/GitHub-Action-Monitor
Authorization callback URL: http://127.0.0.1:3000/callback
```

#### 2. OAuth Flow in Electron

**Step 1: Initiate OAuth**
```javascript
// Generate random state for CSRF protection
const state = crypto.randomBytes(16).toString('hex');
const clientId = 'YOUR_CLIENT_ID';

const authUrl = `https://github.com/login/oauth/authorize?` +
  `client_id=${clientId}&` +
  `scope=repo,workflow,read:org,notifications,read:discussion,read:packages&` +
  `state=${state}`;

// Open in system browser or BrowserWindow
shell.openExternal(authUrl);
```

**Step 2: Handle Callback**
```javascript
// Start local server to receive callback
const express = require('express');
const app = express();

app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Verify state matches
  if (state !== savedState) {
    return res.status(400).send('Invalid state');
  }
  
  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: code
    })
  });
  
  const { access_token, refresh_token } = await tokenResponse.json();
  
  // Store tokens securely
  await storeTokens(access_token, refresh_token);
  
  res.send('Authentication successful! You can close this window.');
  server.close();
});

const server = app.listen(3000);
```

**Step 3: Token Storage**
```javascript
const Store = require('electron-store');
const { safeStorage } = require('electron');

// Encrypt tokens using OS keychain
const store = new Store({
  encryptionKey: 'your-encryption-key'
});

async function storeTokens(accessToken, refreshToken) {
  const encrypted = safeStorage.encryptString(JSON.stringify({
    accessToken,
    refreshToken,
    expiresAt: Date.now() + (8 * 60 * 60 * 1000) // 8 hours
  }));
  
  store.set('github.tokens', encrypted.toString('base64'));
}
```

**Step 4: Token Refresh**
```javascript
async function getValidToken() {
  const encryptedData = store.get('github.tokens');
  const decrypted = safeStorage.decryptString(
    Buffer.from(encryptedData, 'base64')
  );
  const { accessToken, refreshToken, expiresAt } = JSON.parse(decrypted);
  
  // Check if token is expired
  if (Date.now() >= expiresAt) {
    return await refreshAccessToken(refreshToken);
  }
  
  return accessToken;
}

async function refreshAccessToken(refreshToken) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  
  const { access_token, refresh_token: new_refresh_token } = await response.json();
  await storeTokens(access_token, new_refresh_token);
  
  return access_token;
}
```

### OAuth App vs GitHub App

**GitHub OAuth App** (Recommended for this use case)
- ✅ User-centric (acts on behalf of user)
- ✅ Simpler implementation
- ✅ Standard OAuth 2.0 flow
- ✅ Works with personal and org repos
- ❌ No fine-grained repository permissions

**GitHub App** (Alternative)
- ✅ Installation-based
- ✅ Fine-grained repository permissions
- ✅ Can act independently
- ✅ Better audit trail
- ❌ More complex implementation
- ❌ Requires installation per repository

**Decision: Use GitHub OAuth App** for user-centric desktop application.

### Migration Strategy

#### Phase 1: Dual Support (v2.0)
- Support both PAT and OAuth
- OAuth as recommended method
- PAT for backward compatibility
- Migration wizard for existing users

#### Phase 2: OAuth Preferred (v2.5)
- OAuth as default
- PAT shown as "Advanced" option
- Deprecation notice for PAT

#### Phase 3: OAuth Only (v3.0)
- Remove PAT support
- Force migration for remaining users
- 6-month advance notice

### User Experience

**First Launch:**
```
┌─────────────────────────────────────────┐
│  Welcome to GitHub Actions Monitor     │
│                                         │
│  Connect your GitHub account to        │
│  get started                            │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  [GitHub Logo] Connect with       │ │
│  │        GitHub                     │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Advanced: Use Personal Access Token   │
└─────────────────────────────────────────┘
```

**OAuth Flow:**
1. User clicks "Connect with GitHub"
2. Browser opens to GitHub authorization page
3. User reviews and approves permissions
4. Browser redirects to localhost callback
5. App receives token and stores securely
6. Success message and app loads

### Security Improvements

**Client Secret Protection:**
```javascript
// Store client secret in environment variable or secure config
// Never commit to repository
const clientSecret = process.env.GITHUB_CLIENT_SECRET || 
                     app.isPackaged ? getSecureConfig('client_secret') : null;

// For distributed desktop apps, consider:
// 1. Server-side token exchange proxy
// 2. PKCE (Proof Key for Code Exchange) flow
```

**PKCE Flow (More Secure):**
```javascript
// Generate code verifier and challenge
const codeVerifier = crypto.randomBytes(32).toString('base64url');
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

// Authorization URL with PKCE
const authUrl = `https://github.com/login/oauth/authorize?` +
  `client_id=${clientId}&` +
  `scope=repo,workflow,read:org,notifications&` +
  `state=${state}&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256`;

// Exchange code with verifier (no client secret needed)
const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
  method: 'POST',
  body: JSON.stringify({
    client_id: clientId,
    code: code,
    code_verifier: codeVerifier
  })
});
```

### Required Scopes

**Core Functionality:**
- `repo` - Full control of private repositories
- `workflow` - Update GitHub Action workflows

**Extended Features:**
- `read:org` - Read organization data
- `notifications` - Access notifications
- `read:discussion` - Read discussions
- `read:packages` - Read packages (for dependency alerts)
- `admin:org` - Full control of orgs (optional, for team features)
- `delete_repo` - Delete repositories (optional, with confirmation)

### Token Management UI

**Settings Panel:**
```
Account Settings
├─ Connected as: @username
├─ Token expires: in 7 days
├─ Scopes: repo, workflow, read:org...
├─ [Refresh Token]
├─ [Revoke Access]
└─ [Switch Account]
```

---

## 8. Security Considerations

### Token Storage
- **Encryption**: Use `electron.safeStorage` (OS keychain/credential manager)
- **Secure Store**: `electron-store` with encryption for additional data
- **Memory Safety**: Clear tokens from memory after use
- **No Logging**: Never log tokens or sensitive data

### Git Credentials
- **HTTPS with OAuth Token**: Use OAuth token as Git credential
- **SSH Support**: Allow users to configure SSH keys for Git operations
- **Credential Helper**: Implement Git credential helper for seamless auth
- **Per-repository Auth**: Support different credentials per repository

### File System Access
- **Sandboxing**: Use Electron's dialog APIs for safe file selection
- **Validation**: Verify paths are within user's home directory
- **Permissions**: Request only necessary file system permissions
- **No Arbitrary Execution**: Validate and sanitize all Git commands

### Network Security
- **HTTPS Only**: All API calls over HTTPS
- **Certificate Validation**: Verify SSL certificates
- **Proxy Support**: Respect system proxy settings
- **Rate Limiting**: Implement client-side rate limiting

---

## 8. Implementation Phases

### Phase 1: Foundation & Repository Management (Weeks 1-3)
- [ ] Add all required dependencies
- [ ] **Implement GitHub OAuth App registration and flow**
- [ ] **Build OAuth callback handler with PKCE**
- [ ] **Implement secure token storage with refresh logic**
- [ ] Create migration wizard from PAT to OAuth
- [ ] Restructure application with new UI architecture
- [ ] Implement GitHub API wrapper with caching and auto-refresh
- [ ] Create navigation system (tabs/views)
- [ ] Add repository management (create, clone, pull, push, publish)
- [ ] Create modal dialog system

### Phase 2: Enhanced Actions Features (Weeks 4-5)
- [ ] Implement workflow log viewer
- [ ] Add re-run workflow capabilities
- [ ] Create artifact browser and downloader
- [ ] Add manual workflow dispatch feature
- [ ] Enhance current actions view with new features

### Phase 3: Pull Request Integration (Weeks 6-7)
- [ ] Build PR dashboard with filters
- [ ] Implement PR detail view
- [ ] Add diff viewer component
- [ ] Create review workflow UI
- [ ] Add merge capabilities
- [ ] Implement check status tracking

### Phase 4: Issue Management (Weeks 8-9)
- [ ] Build issues dashboard
- [ ] Implement issue detail view with comments
- [ ] Add issue creation form
- [ ] Implement label/assignee management
- [ ] Add issue search and filters
- [ ] Link issues with PRs

### Phase 5: Notifications System (Weeks 10-11)
- [ ] Implement GitHub notifications API integration
- [ ] Create notification center UI
- [ ] Add desktop notification service
- [ ] Build notification preferences
- [ ] Implement activity feed
- [ ] Add real-time polling/webhook support

### Phase 6: Repository Insights (Weeks 12-13)
- [ ] Build repository dashboard
- [ ] Add security alerts view
- [ ] Implement deployment status tracking
- [ ] Create contributor insights
- [ ] Add traffic analytics
- [ ] Build language/code statistics

### Phase 7: Advanced Features (Weeks 14-15)
- [ ] Implement advanced search
- [ ] Add saved searches/filters
- [ ] Create custom dashboards/workspaces
- [ ] Build batch operation tools
- [ ] Add collaboration features
- [ ] Implement project board integration

### Phase 8: Polish, Testing & Release (Weeks 16-18)
- [ ] Comprehensive error handling
- [ ] Performance optimization
- [ ] UI/UX refinements
- [ ] Unit and integration testing
- [ ] Documentation (user guide, API docs)
- [ ] Beta testing with users
- [ ] Bug fixes and refinements
- [ ] Release v2.0

---

## 9. User Experience Enhancements

### Quick Actions
- **Right-click Context Menus**
  - Clone repository
  - Open in file explorer
  - Open in VS Code
  - View on GitHub
  - Copy clone URL

### Keyboard Shortcuts
- `Ctrl+N`: New repository
- `Ctrl+Shift+C`: Clone repository
- `Ctrl+P`: Pull all repositories
- `Ctrl+Shift+P`: Push changes
- `Ctrl+R`: Refresh all
- `Ctrl+F`: Search
- `Ctrl+Shift+F`: Advanced search
- `Ctrl+1-6`: Switch between tabs
- `Ctrl+L`: View workflow logs
- `Ctrl+Shift+I`: Create new issue
- `Ctrl+Shift+N`: View notifications
- `Alt+Enter`: Quick actions menu

### Status Indicators
- **Repository Health**
  - ✅ Up to date
  - ⬆️ Ahead (unpushed commits)
  - ⬇️ Behind (pull needed)
  - ⚠️ Diverged (conflicts possible)
  - 📝 Uncommitted changes

---

## 10. Future Enhancements (Beyond Initial Scope)

### Advanced Git Operations
- Branch management (create, switch, merge, delete)
- Stash operations
- Tag management
- Cherry-pick commits
- Interactive rebase
- Submodule management
- Git hooks configuration

### GitHub Advanced Features
- GitHub Discussions integration
- GitHub Packages/Container Registry browser
- GitHub Codespaces launcher
- GitHub Pages deployment management
- Wiki editing
- Repository templates management
- Code scanning and security analysis

### Collaboration & Team
- View and manage collaborators
- Fork repositories
- Organization administration
- Team discussion boards
- Project board automation
- Advanced code review features
- Code owners integration

### Developer Tools
- Integrated terminal
- Code editor for quick fixes
- Merge conflict resolver
- Commit graph visualization
- Blame view
- File history browser

### Integrations
- VS Code integration (open in VS Code)
- Slack notifications
- Jira/Linear issue linking
- CI/CD platform integrations
- Custom webhook endpoints

### Repository Insights & Analytics
- Commit history visualization
- Contributor statistics and graphs
- File change heatmap
- Code frequency graphs
- Pulse/insights dashboard
- Dependency graph visualization
- Community health metrics

### AI Features
- GitHub Copilot integration
- Automated code review suggestions
- Commit message generation
- Issue triage automation
- Smart search with natural language

---

# Part H: Technical Implementation Details

---

## 31. API Rate Limiting Strategy

### Approach
- **Rate Limit Tracking**
  - Monitor remaining API calls
  - Display rate limit status
  - Warn user when approaching limit
  - Implement exponential backoff

### Implementation
```javascript
// Track rate limits from response headers
const rateLimit = {
  limit: parseInt(response.headers.get('X-RateLimit-Limit')),
  remaining: parseInt(response.headers.get('X-RateLimit-Remaining')),
  reset: parseInt(response.headers.get('X-RateLimit-Reset'))
};

// Show warning at 10% remaining
if (rateLimit.remaining < rateLimit.limit * 0.1) {
  showRateLimitWarning(rateLimit);
}
```

---

## 32. Offline Mode

### Features
- **Offline Capabilities**
  - Cache recently viewed data
  - View cached workflows, PRs, issues
  - Queue operations for when online
  - Offline indicator in UI
  - Sync when connection restored

### Technical Requirements
- IndexedDB for local storage
- Service worker for offline handling
- Background sync API
- Connection monitoring

---

## 33. Data Synchronization

### Strategy
- **Smart Sync**
  - Incremental updates
  - Delta sync for large datasets
  - Conflict resolution
  - Last-write-wins for simple data
  - User choice for complex conflicts

### Implementation
- WebSocket connections for real-time updates
- Polling fallback with adaptive intervals
- ETags for conditional requests
- Optimistic UI updates

---

## Technical Considerations

### Performance
- **Lazy Loading**: Load repository details on demand
- **Background Operations**: Run Git operations in worker threads
- **Caching**: Cache repository metadata to reduce API calls
- **Throttling**: Respect GitHub API rate limits

### Error Handling
- **Network Failures**: Retry logic with exponential backoff
- **Git Errors**: User-friendly error messages with recovery suggestions
- **Validation**: Pre-validate operations before executing
- **Rollback**: Ability to undo destructive operations

### Testing Strategy
- Unit tests for Git operations
- Integration tests with local test repositories
- Mock GitHub API for offline testing
- End-to-end tests for complete workflows

---

---

## Success Metrics

### Repository Management
- User can create and publish a new repository in < 1 minute
- Clone operation provides clear progress feedback
- Pull/push operations complete without user confusion
- Error messages are actionable and clear
- No data loss during Git operations

### GitHub Actions
- Workflow logs load in < 2 seconds
- Re-run workflow completes in < 3 seconds
- Artifact downloads show progress accurately

### Pull Requests & Issues
- PR/issue list loads in < 3 seconds for 100+ items
- Diff viewer renders large files smoothly
- Comments post instantly with optimistic updates
- Search returns results in < 1 second

### Notifications
- Desktop notifications appear within 10 seconds of event
- Notification center syncs in < 2 seconds
- Zero missed critical notifications

### Overall Experience
- App startup in < 3 seconds
- View transitions in < 500ms
- No UI blocking during background operations
- < 1% error rate on API calls
- 95%+ user satisfaction rating

---

## Release Strategy

### Version 2.0 (Initial Extended Release)
- Core repository management
- Enhanced actions features
- Basic PR and issue support
- Notification system

### Version 2.1 (Refinement)
- Performance improvements
- User feedback implementation
- Bug fixes
- Additional keyboard shortcuts

### Version 2.5 (Advanced Features)
- Repository insights
- Security alerts
- Deployment tracking
- Advanced search

### Version 3.0 (Full Platform)
- All planned features
- Custom dashboards
- Team collaboration tools
- AI-powered features

---

## Documentation Requirements

### User Documentation
- Getting started guide
- Feature tutorials (video + written)
- Keyboard shortcuts reference
- Troubleshooting guide
- FAQ

### Developer Documentation
- Architecture overview
- API documentation
- Contributing guide
- Build instructions
- Testing guide

### Release Notes
- What's new in each version
- Breaking changes
- Migration guides
- Known issues

---

## Community & Support

### Support Channels
- GitHub Discussions for questions
- GitHub Issues for bugs
- Discord/Slack community
- Email support for critical issues

### Community Involvement
- Open source contribution guidelines
- Feature request process
- Beta testing program
- User feedback surveys

---

## Conclusion

This comprehensive extension plan transforms the GitHub Actions Monitor from a focused workflow monitoring tool into a full-featured GitHub desktop client. The phased approach ensures:

1. **Incremental value delivery** - Users get features progressively
2. **Risk mitigation** - Each phase can be tested before proceeding
3. **Resource flexibility** - Development can scale based on capacity
4. **User feedback integration** - Early phases inform later development

The result will be a powerful, native desktop experience that brings GitHub's most important features into a fast, offline-capable, notification-rich application that developers can use as their primary GitHub interface.
