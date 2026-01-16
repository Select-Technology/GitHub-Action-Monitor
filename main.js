// Load environment variables from .env file
require('dotenv').config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const AutoLaunch = require('auto-launch');
const authService = require('./src/utils/auth');
const githubAPI = require('./src/api/github-api');
const gitOps = require('./src/api/git-operations');
const storage = require('./src/utils/storage');

// Set a consistent userData path so localStorage persists
app.setPath('userData', path.join(app.getPath('appData'), 'GitHubActionsMonitor'));

const autoLauncher = new AutoLaunch({
  name: 'GitView',
  path: app.getPath('exe')
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the new UI
  win.loadFile('index-new.html');
  
  // Open DevTools in development (uncomment if needed)
  // if (!app.isPackaged) {
  //   win.webContents.openDevTools();
  // }
}

// Enable auto-launch by default on first run
app.whenReady().then(async () => {
  // Enable auto-launch if not in dev mode
  if (app.isPackaged) {
    const isEnabled = await autoLauncher.isEnabled();
    if (!isEnabled) {
      await autoLauncher.enable();
    }
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// ==================== IPC Handlers ====================

// Auto-launch handlers
ipcMain.handle('get-auto-launch', async () => {
  if (!app.isPackaged) return false;
  return await autoLauncher.isEnabled();
});

ipcMain.handle('set-auto-launch', async (event, enabled) => {
  if (!app.isPackaged) return false;
  if (enabled) {
    await autoLauncher.enable();
  } else {
    await autoLauncher.disable();
  }
  return enabled;
});

// Authentication handlers
ipcMain.handle('check-auth', async () => {
  return await authService.isAuthenticated();
});

ipcMain.handle('start-oauth', async () => {
  return new Promise((resolve, reject) => {
    authService.startOAuthFlow(
      (result) => {
        console.log('OAuth success:', result.profile.login);
        resolve({ success: true, user: result.profile });
      },
      (error) => {
        console.error('OAuth failed:', error);
        reject(error);
      }
    );
  });
});

ipcMain.handle('logout', async () => {
  await authService.logout();
  return { success: true };
});

ipcMain.handle('get-user-profile', async () => {
  return authService.getCurrentUser();
});

// GitHub API handlers
ipcMain.handle('get-workflow-runs', async (event, options = {}) => {
  try {
    console.log('=== get-workflow-runs handler called ===');
    console.log('Received options:', JSON.stringify(options));
    
    // Get selected repos from options (passed from renderer which reads localStorage)
    const selectedRepos = options.selectedRepos || [];
    console.log(`Selected repos: ${selectedRepos.length}`, selectedRepos);
    
    if (selectedRepos.length === 0) {
      console.log('No repos selected - returning empty');
      return [];
    }
    
    // Get workflow runs from selected repos
    const allRuns = [];
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    for (const repoFullName of selectedRepos) {
      try {
        const [owner, repo] = repoFullName.split('/');
        console.log(`Checking ${repoFullName}...`);
        
        const result = await githubAPI.listWorkflowRuns(owner, repo, { per_page: 30 });
        
        if (result.workflow_runs) {
          const recentRuns = result.workflow_runs.filter(run => {
            return new Date(run.created_at) >= thirtyMinutesAgo;
          });
          
          console.log(`  ${repoFullName}: ${recentRuns.length} runs in last 30 min`);
          allRuns.push(...recentRuns);
        }
      } catch (error) {
        console.error(`Failed to get runs for ${repoFullName}:`, error.message);
      }
    }
    
    console.log(`Total runs found: ${allRuns.length}`);
    
    // Sort by created date
    allRuns.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return allRuns;
  } catch (error) {
    console.error('Failed to get workflow runs:', error);
    throw error;
  }
});

ipcMain.handle('get-repositories', async (event, options = {}) => {
  try {
    return await githubAPI.listRepositories(options);
  } catch (error) {
    console.error('Failed to get repositories:', error);
    throw error;
  }
});

ipcMain.handle('get-pull-requests', async (event, options = {}) => {
  try {
    // Get all repos and their PRs
    const repos = await githubAPI.listRepositories({ per_page: 50 });
    const allPRs = [];
    
    for (const repo of repos) {
      try {
        const prs = await githubAPI.listPullRequests(
          repo.owner.login,
          repo.name,
          options
        );
        allPRs.push(...prs);
      } catch (error) {
        console.error(`Failed to get PRs for ${repo.full_name}:`, error.message);
      }
    }
    
    return allPRs;
  } catch (error) {
    console.error('Failed to get pull requests:', error);
    throw error;
  }
});

ipcMain.handle('get-pr-details', async (event, owner, repo, prNumber) => {
  try {
    return await githubAPI.getPullRequest(owner, repo, prNumber);
  } catch (error) {
    console.error('Failed to get PR details:', error);
    throw error;
  }
});

ipcMain.handle('get-pr-files', async (event, owner, repo, prNumber) => {
  try {
    return await githubAPI.getPullRequestFiles(owner, repo, prNumber);
  } catch (error) {
    console.error('Failed to get PR files:', error);
    throw error;
  }
});

ipcMain.handle('merge-pr', async (event, owner, repo, prNumber, options) => {
  try {
    return await githubAPI.mergePullRequest(owner, repo, prNumber, options);
  } catch (error) {
    console.error('Failed to merge PR:', error);
    throw error;
  }
});

ipcMain.handle('get-issues', async (event, options = {}) => {
  try {
    // Use search API for user's issues
    const query = 'is:issue is:open involves:@me';
    return await githubAPI.searchIssues(query, options);
  } catch (error) {
    console.error('Failed to get issues:', error);
    throw error;
  }
});

ipcMain.handle('get-issue-details', async (event, owner, repo, issueNumber) => {
  try {
    return await githubAPI.getIssue(owner, repo, issueNumber);
  } catch (error) {
    console.error('Failed to get issue details:', error);
    throw error;
  }
});

ipcMain.handle('get-issue-comments', async (event, owner, repo, issueNumber) => {
  try {
    return await githubAPI.getIssueComments(owner, repo, issueNumber);
  } catch (error) {
    console.error('Failed to get issue comments:', error);
    throw error;
  }
});

ipcMain.handle('create-issue', async (event, owner, repo, data) => {
  try {
    return await githubAPI.createIssue(owner, repo, data);
  } catch (error) {
    console.error('Failed to create issue:', error);
    throw error;
  }
});

ipcMain.handle('update-issue', async (event, owner, repo, issueNumber, data) => {
  try {
    return await githubAPI.updateIssue(owner, repo, issueNumber, data);
  } catch (error) {
    console.error('Failed to update issue:', error);
    throw error;
  }
});

ipcMain.handle('add-issue-comment', async (event, owner, repo, issueNumber, body) => {
  try {
    return await githubAPI.createIssueComment(owner, repo, issueNumber, body);
  } catch (error) {
    console.error('Failed to add issue comment:', error);
    throw error;
  }
});

ipcMain.handle('get-notifications', async (event, options = {}) => {
  try {
    return await githubAPI.listNotifications(options);
  } catch (error) {
    console.error('Failed to get notifications:', error);
    throw error;
  }
});

ipcMain.handle('mark-notification-as-read', async (event, notificationId) => {
  try {
    return await githubAPI.markNotificationAsRead(notificationId);
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
});

ipcMain.handle('mark-all-notifications-as-read', async (event) => {
  try {
    return await githubAPI.markAllNotificationsAsRead();
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    throw error;
  }
});

// Repository management handlers
ipcMain.handle('list-user-repositories', async (event, options = {}) => {
  try {
    return await githubAPI.listUserRepositories(options);
  } catch (error) {
    console.error('Failed to list user repositories:', error);
    throw error;
  }
});

ipcMain.handle('get-repository', async (event, owner, repo) => {
  try {
    return await githubAPI.getRepository(owner, repo);
  } catch (error) {
    console.error('Failed to get repository:', error);
    throw error;
  }
});

ipcMain.handle('create-repository', async (event, data) => {
  try {
    return await githubAPI.createRepository(data);
  } catch (error) {
    console.error('Failed to create repository:', error);
    throw error;
  }
});

ipcMain.handle('update-repository', async (event, owner, repo, data) => {
  try {
    return await githubAPI.updateRepository(owner, repo, data);
  } catch (error) {
    console.error('Failed to update repository:', error);
    throw error;
  }
});

ipcMain.handle('delete-repository', async (event, owner, repo) => {
  try {
    return await githubAPI.deleteRepository(owner, repo);
  } catch (error) {
    console.error('Failed to delete repository:', error);
    throw error;
  }
});

ipcMain.handle('star-repository', async (event, owner, repo) => {
  try {
    return await githubAPI.starRepository(owner, repo);
  } catch (error) {
    console.error('Failed to star repository:', error);
    throw error;
  }
});

ipcMain.handle('unstar-repository', async (event, owner, repo) => {
  try {
    return await githubAPI.unstarRepository(owner, repo);
  } catch (error) {
    console.error('Failed to unstar repository:', error);
    throw error;
  }
});

ipcMain.handle('is-repository-starred', async (event, owner, repo) => {
  try {
    return await githubAPI.isRepositoryStarred(owner, repo);
  } catch (error) {
    console.error('Failed to check if repository is starred:', error);
    throw error;
  }
});

ipcMain.handle('list-repository-topics', async (event, owner, repo) => {
  try {
    return await githubAPI.listRepositoryTopics(owner, repo);
  } catch (error) {
    console.error('Failed to list repository topics:', error);
    throw error;
  }
});

ipcMain.handle('replace-repository-topics', async (event, owner, repo, topics) => {
  try {
    return await githubAPI.replaceRepositoryTopics(owner, repo, topics);
  } catch (error) {
    console.error('Failed to replace repository topics:', error);
    throw error;
  }
});

ipcMain.handle('list-gitignore-templates', async (event) => {
  try {
    return await githubAPI.listGitignoreTemplates();
  } catch (error) {
    console.error('Failed to list gitignore templates:', error);
    throw error;
  }
});

ipcMain.handle('list-licenses', async (event) => {
  try {
    return await githubAPI.listLicenses();
  } catch (error) {
    console.error('Failed to list licenses:', error);
    throw error;
  }
});

ipcMain.handle('select-directory', async (event) => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  } catch (error) {
    console.error('Failed to select directory:', error);
    throw error;
  }
});

ipcMain.handle('get-repo-status', async (event, repoPath) => {
  try {
    return await gitOps.getStatus(repoPath);
  } catch (error) {
    console.error('Failed to get repo status:', error);
    throw error;
  }
});

// Git operations handlers
ipcMain.handle('clone-repo', async (event, url, localPath) => {
  try {
    return await gitOps.cloneRepository(url, localPath);
  } catch (error) {
    console.error('Clone failed:', error);
    throw error;
  }
});

ipcMain.handle('pull-repo', async (event, repoPath) => {
  try {
    return await gitOps.pull(repoPath);
  } catch (error) {
    console.error('Pull failed:', error);
    throw error;
  }
});

ipcMain.handle('push-repo', async (event, repoPath) => {
  try {
    return await gitOps.push(repoPath);
  } catch (error) {
    console.error('Push failed:', error);
    throw error;
  }
});

// Branches and Commits handlers
ipcMain.handle('list-branches', async (event, owner, repo) => {
  try {
    return await githubAPI.listBranches(owner, repo);
  } catch (error) {
    console.error('Failed to list branches:', error);
    throw error;
  }
});

ipcMain.handle('list-commits', async (event, owner, repo, options) => {
  try {
    return await githubAPI.listCommits(owner, repo, options);
  } catch (error) {
    console.error('Failed to list commits:', error);
    throw error;
  }
});

ipcMain.handle('get-repo-contents', async (event, owner, repo, path, ref) => {
  try {
    return await githubAPI.getRepoContents(owner, repo, path, ref);
  } catch (error) {
    console.error('Failed to get repo contents:', error);
    throw error;
  }
});

// Local Git and File handlers
ipcMain.handle('get-local-branches', async (event, repoPath) => {
  try {
    const git = require('simple-git')(repoPath);
    const result = await git.branchLocal();
    return result.all.map(name => ({
      name,
      current: name === result.current
    }));
  } catch (error) {
    console.error('Failed to get local branches:', error);
    throw error;
  }
});

ipcMain.handle('list-local-files', async (event, dirPath) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(e => !e.name.startsWith('.')) // Hide hidden files
      .map(e => ({
        name: e.name,
        isDirectory: e.isDirectory(),
        path: path.join(dirPath, e.name)
      }));
  } catch (error) {
    console.error('Failed to list local files:', error);
    throw error;
  }
});

ipcMain.handle('is-git-repository', async (event, dirPath) => {
  try {
    const git = require('simple-git')(dirPath);
    return await git.checkIsRepo();
  } catch (error) {
    return false;
  }
});

ipcMain.handle('read-local-file', async (event, filePath) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Check file size first (limit to 5MB for display)
    const stats = await fs.stat(filePath);
    if (stats.size > 5 * 1024 * 1024) {
      return { error: 'File too large to display (>5MB)', size: stats.size };
    }
    
    // Check if file is binary
    const ext = path.extname(filePath).toLowerCase();
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', 
                        '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
                        '.exe', '.dll', '.so', '.dylib', '.bin',
                        '.mp3', '.mp4', '.avi', '.mov', '.wav',
                        '.woff', '.woff2', '.ttf', '.eot'];
    
    if (binaryExts.includes(ext)) {
      return { error: 'Binary file cannot be displayed', binary: true };
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    return { content, size: stats.size };
  } catch (error) {
    console.error('Failed to read file:', error);
    return { error: error.message };
  }
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const { dialog } = require('electron');
  return await dialog.showOpenDialog(options);
});

// Enhanced Actions handlers
ipcMain.handle('get-workflow-run-details', async (event, owner, repo, runId) => {
  try {
    return await githubAPI.getWorkflowRun(owner, repo, runId);
  } catch (error) {
    console.error('Failed to get workflow run details:', error);
    throw error;
  }
});

ipcMain.handle('get-workflow-run-logs', async (event, owner, repo, runId) => {
  try {
    return await githubAPI.getWorkflowRunLogs(owner, repo, runId);
  } catch (error) {
    console.error('Failed to get workflow run logs:', error);
    throw error;
  }
});

ipcMain.handle('get-artifacts', async (event, owner, repo, runId) => {
  try {
    return await githubAPI.listArtifacts(owner, repo, runId);
  } catch (error) {
    console.error('Failed to get artifacts:', error);
    throw error;
  }
});

ipcMain.handle('download-artifact', async (event, owner, repo, artifactId) => {
  try {
    const blob = await githubAPI.downloadArtifact(owner, repo, artifactId);
    // Convert blob to Buffer
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Failed to download artifact:', error);
    throw error;
  }
});

ipcMain.handle('rerun-workflow', async (event, owner, repo, runId) => {
  try {
    return await githubAPI.rerunWorkflow(owner, repo, runId);
  } catch (error) {
    console.error('Failed to rerun workflow:', error);
    throw error;
  }
});

ipcMain.handle('trigger-workflow', async (event, owner, repo, workflowId, ref, inputs) => {
  try {
    return await githubAPI.triggerWorkflow(owner, repo, workflowId, ref, inputs);
  } catch (error) {
    console.error('Failed to trigger workflow:', error);
    throw error;
  }
});

ipcMain.handle('list-workflows', async (event, owner, repo) => {
  try {
    return await githubAPI.listWorkflows(owner, repo);
  } catch (error) {
    console.error('Failed to list workflows:', error);
    throw error;
  }
});

ipcMain.handle('list-repo-workflow-runs', async (event, owner, repo, options = {}) => {
  try {
    return await githubAPI.listWorkflowRuns(owner, repo, options);
  } catch (error) {
    console.error('Failed to list repo workflow runs:', error);
    throw error;
  }
});

ipcMain.handle('cancel-workflow-run', async (event, owner, repo, runId) => {
  try {
    return await githubAPI.cancelWorkflowRun(owner, repo, runId);
  } catch (error) {
    console.error('Failed to cancel workflow run:', error);
    throw error;
  }
});

ipcMain.handle('search-issues', async (event, query, options = {}) => {
  try {
    return await githubAPI.searchIssues(query, options);
  } catch (error) {
    console.error('Failed to search issues:', error);
    throw error;
  }
});

// Analytics handlers
ipcMain.handle('get-user-events', async (event, username, options = {}) => {
  try {
    return await githubAPI.getUserEvents(username, options);
  } catch (error) {
    console.error('Failed to get user events:', error);
    throw error;
  }
});

ipcMain.handle('get-repository-traffic-views', async (event, owner, repo) => {
  try {
    return await githubAPI.getRepositoryTrafficViews(owner, repo);
  } catch (error) {
    console.error('Failed to get traffic views:', error);
    throw error;
  }
});

ipcMain.handle('get-repository-traffic-clones', async (event, owner, repo) => {
  try {
    return await githubAPI.getRepositoryTrafficClones(owner, repo);
  } catch (error) {
    console.error('Failed to get traffic clones:', error);
    throw error;
  }
});

ipcMain.handle('get-repository-traffic-paths', async (event, owner, repo) => {
  try {
    return await githubAPI.getRepositoryTrafficPopularPaths(owner, repo);
  } catch (error) {
    console.error('Failed to get popular paths:', error);
    throw error;
  }
});

ipcMain.handle('get-repository-traffic-referrers', async (event, owner, repo) => {
  try {
    return await githubAPI.getRepositoryTrafficReferrers(owner, repo);
  } catch (error) {
    console.error('Failed to get traffic referrers:', error);
    throw error;
  }
});

ipcMain.handle('get-repository-contributors', async (event, owner, repo) => {
  try {
    return await githubAPI.getRepositoryContributors(owner, repo);
  } catch (error) {
    console.error('Failed to get contributors:', error);
    throw error;
  }
});

ipcMain.handle('get-repository-commit-activity', async (event, owner, repo) => {
  try {
    return await githubAPI.getRepositoryCommitActivity(owner, repo);
  } catch (error) {
    console.error('Failed to get commit activity:', error);
    throw error;
  }
});

ipcMain.handle('get-repository-code-frequency', async (event, owner, repo) => {
  try {
    return await githubAPI.getRepositoryCodeFrequency(owner, repo);
  } catch (error) {
    console.error('Failed to get code frequency:', error);
    throw error;
  }
});

ipcMain.handle('get-repository-participation', async (event, owner, repo) => {
  try {
    return await githubAPI.getRepositoryParticipation(owner, repo);
  } catch (error) {
    console.error('Failed to get participation:', error);
    throw error;
  }
});

ipcMain.handle('get-repository-punch-card', async (event, owner, repo) => {
  try {
    return await githubAPI.getRepositoryPunchCard(owner, repo);
  } catch (error) {
    console.error('Failed to get punch card:', error);
    throw error;
  }
});

ipcMain.handle('get-repository-languages', async (event, owner, repo) => {
  try {
    return await githubAPI.getRepositoryLanguages(owner, repo);
  } catch (error) {
    console.error('Failed to get languages:', error);
    throw error;
  }
});

ipcMain.handle('get-user-contribution-stats', async (event, username, options = {}) => {
  try {
    return await githubAPI.getUserContributionStats(username, options);
  } catch (error) {
    console.error('Failed to get contribution stats:', error);
    throw error;
  }
});

// File operations
const { dialog } = require('electron');
const fs = require('fs').promises;

ipcMain.handle('save-file', async (event, data, filename) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: filename,
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (filePath) {
      await fs.writeFile(filePath, data);
      return { success: true, path: filePath };
    }
    
    return { success: false, cancelled: true };
  } catch (error) {
    console.error('Failed to save file:', error);
    throw error;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

