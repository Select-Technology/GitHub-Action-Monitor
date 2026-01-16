const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auto-launch
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  
  // Authentication
  checkAuth: () => ipcRenderer.invoke('check-auth'),
  startOAuth: () => ipcRenderer.invoke('start-oauth'),
  logout: () => ipcRenderer.invoke('logout'),
  getUserProfile: () => ipcRenderer.invoke('get-user-profile'),
  
  // GitHub API
  getWorkflowRuns: (options) => ipcRenderer.invoke('get-workflow-runs', options),
  getWorkflowRunDetails: (owner, repo, runId) => ipcRenderer.invoke('get-workflow-run-details', owner, repo, runId),
  getWorkflowRunLogs: (owner, repo, runId) => ipcRenderer.invoke('get-workflow-run-logs', owner, repo, runId),
  getArtifacts: (owner, repo, runId) => ipcRenderer.invoke('get-artifacts', owner, repo, runId),
  downloadArtifact: (owner, repo, artifactId) => ipcRenderer.invoke('download-artifact', owner, repo, artifactId),
  rerunWorkflow: (owner, repo, runId) => ipcRenderer.invoke('rerun-workflow', owner, repo, runId),
  triggerWorkflow: (owner, repo, workflowId, ref, inputs) => ipcRenderer.invoke('trigger-workflow', owner, repo, workflowId, ref, inputs),
  cancelWorkflowRun: (owner, repo, runId) => ipcRenderer.invoke('cancel-workflow-run', owner, repo, runId),
  listWorkflows: (owner, repo) => ipcRenderer.invoke('list-workflows', owner, repo),
  listRepoWorkflowRuns: (owner, repo, options) => ipcRenderer.invoke('list-repo-workflow-runs', owner, repo, options),
  searchIssues: (query, options) => ipcRenderer.invoke('search-issues', query, options),
  getRepositories: (options) => ipcRenderer.invoke('get-repositories', options),
  getPullRequests: (options) => ipcRenderer.invoke('get-pull-requests', options),
  getPRDetails: (owner, repo, prNumber) => ipcRenderer.invoke('get-pr-details', owner, repo, prNumber),
  getPRFiles: (owner, repo, prNumber) => ipcRenderer.invoke('get-pr-files', owner, repo, prNumber),
  mergePR: (owner, repo, prNumber, options) => ipcRenderer.invoke('merge-pr', owner, repo, prNumber, options),
  getIssues: (options) => ipcRenderer.invoke('get-issues', options),
  getIssueDetails: (owner, repo, issueNumber) => ipcRenderer.invoke('get-issue-details', owner, repo, issueNumber),
  getIssueComments: (owner, repo, issueNumber) => ipcRenderer.invoke('get-issue-comments', owner, repo, issueNumber),
  createIssue: (owner, repo, data) => ipcRenderer.invoke('create-issue', owner, repo, data),
  updateIssue: (owner, repo, issueNumber, data) => ipcRenderer.invoke('update-issue', owner, repo, issueNumber, data),
  addIssueComment: (owner, repo, issueNumber, body) => ipcRenderer.invoke('add-issue-comment', owner, repo, issueNumber, body),
  getNotifications: (options) => ipcRenderer.invoke('get-notifications', options),
  markNotificationAsRead: (notificationId) => ipcRenderer.invoke('mark-notification-as-read', notificationId),
  markAllNotificationsAsRead: () => ipcRenderer.invoke('mark-all-notifications-as-read'),
  
  // Repository Management
  listUserRepositories: (options) => ipcRenderer.invoke('list-user-repositories', options),
  getRepository: (owner, repo) => ipcRenderer.invoke('get-repository', owner, repo),
  createRepository: (data) => ipcRenderer.invoke('create-repository', data),
  updateRepository: (owner, repo, data) => ipcRenderer.invoke('update-repository', owner, repo, data),
  deleteRepository: (owner, repo) => ipcRenderer.invoke('delete-repository', owner, repo),
  starRepository: (owner, repo) => ipcRenderer.invoke('star-repository', owner, repo),
  unstarRepository: (owner, repo) => ipcRenderer.invoke('unstar-repository', owner, repo),
  isRepositoryStarred: (owner, repo) => ipcRenderer.invoke('is-repository-starred', owner, repo),
  listRepositoryTopics: (owner, repo) => ipcRenderer.invoke('list-repository-topics', owner, repo),
  replaceRepositoryTopics: (owner, repo, topics) => ipcRenderer.invoke('replace-repository-topics', owner, repo, topics),
  listGitignoreTemplates: () => ipcRenderer.invoke('list-gitignore-templates'),
  listLicenses: () => ipcRenderer.invoke('list-licenses'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getRepoStatus: (repoPath) => ipcRenderer.invoke('get-repo-status', repoPath),
  
  // Analytics
  getUserEvents: (username, options) => ipcRenderer.invoke('get-user-events', username, options),
  getRepositoryTrafficViews: (owner, repo) => ipcRenderer.invoke('get-repository-traffic-views', owner, repo),
  getRepositoryTrafficClones: (owner, repo) => ipcRenderer.invoke('get-repository-traffic-clones', owner, repo),
  getRepositoryTrafficPaths: (owner, repo) => ipcRenderer.invoke('get-repository-traffic-paths', owner, repo),
  getRepositoryTrafficReferrers: (owner, repo) => ipcRenderer.invoke('get-repository-traffic-referrers', owner, repo),
  getRepositoryContributors: (owner, repo) => ipcRenderer.invoke('get-repository-contributors', owner, repo),
  getRepositoryCommitActivity: (owner, repo) => ipcRenderer.invoke('get-repository-commit-activity', owner, repo),
  getRepositoryCodeFrequency: (owner, repo) => ipcRenderer.invoke('get-repository-code-frequency', owner, repo),
  getRepositoryParticipation: (owner, repo) => ipcRenderer.invoke('get-repository-participation', owner, repo),
  getRepositoryPunchCard: (owner, repo) => ipcRenderer.invoke('get-repository-punch-card', owner, repo),
  getRepositoryLanguages: (owner, repo) => ipcRenderer.invoke('get-repository-languages', owner, repo),
  getUserContributionStats: (username, options) => ipcRenderer.invoke('get-user-contribution-stats', username, options),
  
  // Git Operations
  cloneRepo: (url, path) => ipcRenderer.invoke('clone-repo', url, path),
  pullRepo: (path) => ipcRenderer.invoke('pull-repo', path),
  pushRepo: (path) => ipcRenderer.invoke('push-repo', path),
  
  // Branches and Commits
  listBranches: (owner, repo) => ipcRenderer.invoke('list-branches', owner, repo),
  listCommits: (owner, repo, options) => ipcRenderer.invoke('list-commits', owner, repo, options),
  getRepoContents: (owner, repo, path, ref) => ipcRenderer.invoke('get-repo-contents', owner, repo, path, ref),
  
  // Local Git Operations
  getLocalBranches: (repoPath) => ipcRenderer.invoke('get-local-branches', repoPath),
  listLocalFiles: (dirPath) => ipcRenderer.invoke('list-local-files', dirPath),
  isGitRepository: (dirPath) => ipcRenderer.invoke('is-git-repository', dirPath),
  readLocalFile: (filePath) => ipcRenderer.invoke('read-local-file', filePath),
  
  // Dialogs and File Operations
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  openPath: (filePath) => shell.openPath(filePath),
  
  // File operations
  saveFile: (data, filename) => ipcRenderer.invoke('save-file', data, filename),
  
  // External links
  openExternal: (url) => shell.openExternal(url)
});

