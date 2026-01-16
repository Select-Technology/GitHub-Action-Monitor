const axios = require('axios');
const authService = require('../utils/auth');

/**
 * GitHub REST API wrapper with automatic token refresh and rate limiting
 */
class GitHubAPI {
  constructor() {
    this.baseURL = 'https://api.github.com';
    this.rateLimit = {
      limit: 5000,
      remaining: 5000,
      reset: null
    };
  }

  /**
   * Create axios instance with authentication
   * @returns {Promise<Object>} Configured axios instance
   */
  async createClient() {
    const token = await authService.getValidToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    return axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
  }

  /**
   * Make API request with automatic retry and rate limit handling
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @param {Object} config - Additional axios config
   * @returns {Promise<Object>} Response data
   */
  async request(method, endpoint, data = null, config = {}) {
    try {
      const client = await this.createClient();
      
      const response = await client.request({
        method,
        url: endpoint,
        data,
        ...config
      });

      // Update rate limit info
      this.updateRateLimit(response.headers);

      return response.data;
    } catch (error) {
      // Handle rate limiting
      if (error.response?.status === 429) {
        const resetTime = error.response.headers['x-ratelimit-reset'];
        const waitTime = (resetTime * 1000) - Date.now();
        throw new Error(`Rate limit exceeded. Resets in ${Math.ceil(waitTime / 1000)} seconds`);
      }

      // Handle authentication errors
      if (error.response?.status === 401) {
        // Try to refresh token
        try {
          await authService.refreshAccessToken();
          // Retry request
          return this.request(method, endpoint, data, config);
        } catch (refreshError) {
          throw new Error('Authentication failed. Please log in again.');
        }
      }

      throw error;
    }
  }

  /**
   * Update rate limit information from response headers
   * @param {Object} headers - Response headers
   */
  updateRateLimit(headers) {
    if (headers['x-ratelimit-limit']) {
      this.rateLimit.limit = parseInt(headers['x-ratelimit-limit']);
      this.rateLimit.remaining = parseInt(headers['x-ratelimit-remaining']);
      this.rateLimit.reset = new Date(parseInt(headers['x-ratelimit-reset']) * 1000);
    }
  }

  /**
   * Get current rate limit status
   * @returns {Object} Rate limit info
   */
  getRateLimit() {
    return this.rateLimit;
  }

  // ==================== User & Authentication ====================

  /**
   * Get authenticated user
   * @returns {Promise<Object>} User data
   */
  async getAuthenticatedUser() {
    return this.request('GET', '/user');
  }

  // ==================== Repositories ====================

  /**
   * List user repositories
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of repositories
   */
  async listRepositories(options = {}) {
    const params = {
      per_page: options.perPage || 100,
      sort: options.sort || 'updated',
      direction: options.direction || 'desc',
      ...options
    };

    return this.request('GET', '/user/repos', null, { params });
  }

  /**
   * Get repository details
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Repository data
   */
  async getRepository(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}`);
  }

  /**
   * Create new repository
   * @param {Object} data - Repository data
   * @returns {Promise<Object>} Created repository
   */
  async createRepository(data) {
    return this.request('POST', '/user/repos', data);
  }

  // ==================== GitHub Actions ====================

  /**
   * List workflows for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Workflows data
   */
  async listWorkflows(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}/actions/workflows`);
  }

  /**
   * List workflow runs for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Workflow runs data
   */
  async listWorkflowRuns(owner, repo, options = {}) {
    const params = {
      per_page: options.perPage || 30,
      ...options
    };

    return this.request('GET', `/repos/${owner}/${repo}/actions/runs`, null, { params });
  }

  /**
   * Get workflow run details
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Run ID
   * @returns {Promise<Object>} Workflow run data
   */
  async getWorkflowRun(owner, repo, runId) {
    return this.request('GET', `/repos/${owner}/${repo}/actions/runs/${runId}`);
  }

  /**
   * Get workflow run logs
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Run ID
   * @returns {Promise<Blob>} Logs as zip file
   */
  async getWorkflowRunLogs(owner, repo, runId) {
    const client = await this.createClient();
    const response = await client.get(
      `/repos/${owner}/${repo}/actions/runs/${runId}/logs`,
      { responseType: 'blob' }
    );
    return response.data;
  }

  /**
   * Re-run workflow
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Run ID
   * @returns {Promise<Object>} Response
   */
  async rerunWorkflow(owner, repo, runId) {
    return this.request('POST', `/repos/${owner}/${repo}/actions/runs/${runId}/rerun`);
  }

  /**
   * Re-run failed jobs
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Run ID
   * @returns {Promise<Object>} Response
   */
  async rerunFailedJobs(owner, repo, runId) {
    return this.request('POST', `/repos/${owner}/${repo}/actions/runs/${runId}/rerun-failed-jobs`);
  }

  /**
   * List workflow run artifacts
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Run ID
   * @returns {Promise<Object>} Artifacts data
   */
  async listArtifacts(owner, repo, runId) {
    return this.request('GET', `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`);
  }

  /**
   * Download artifact
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} artifactId - Artifact ID
   * @returns {Promise<Blob>} Artifact as zip file
   */
  async downloadArtifact(owner, repo, artifactId) {
    const client = await this.createClient();
    const response = await client.get(
      `/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`,
      { responseType: 'blob' }
    );
    return response.data;
  }

  /**
   * Trigger a workflow
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} workflowId - Workflow ID or filename
   * @param {string} ref - Branch or tag to run on
   * @param {Object} inputs - Workflow inputs
   * @returns {Promise<void>}
   */
  async triggerWorkflow(owner, repo, workflowId, ref = 'main', inputs = {}) {
    return this.request('POST', `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
      ref,
      inputs
    });
  }

  /**
   * Cancel a workflow run
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Run ID
   * @returns {Promise<void>}
   */
  async cancelWorkflowRun(owner, repo, runId) {
    return this.request('POST', `/repos/${owner}/${repo}/actions/runs/${runId}/cancel`);
  }

  // ==================== Pull Requests ====================

  /**
   * List pull requests
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of pull requests
   */
  async listPullRequests(owner, repo, options = {}) {
    const params = {
      state: options.state || 'open',
      per_page: options.perPage || 30,
      ...options
    };

    return this.request('GET', `/repos/${owner}/${repo}/pulls`, null, { params });
  }

  /**
   * Get pull request details
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - Pull request number
   * @returns {Promise<Object>} Pull request data
   */
  async getPullRequest(owner, repo, pullNumber) {
    return this.request('GET', `/repos/${owner}/${repo}/pulls/${pullNumber}`);
  }

  /**
   * Get pull request files
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - Pull request number
   * @returns {Promise<Array>} List of changed files
   */
  async getPullRequestFiles(owner, repo, pullNumber) {
    return this.request('GET', `/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
  }

  /**
   * Merge pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - Pull request number
   * @param {Object} data - Merge data
   * @returns {Promise<Object>} Merge result
   */
  async mergePullRequest(owner, repo, pullNumber, data = {}) {
    return this.request('PUT', `/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, data);
  }

  // ==================== Issues ====================

  /**
   * List issues
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of issues
   */
  async listIssues(owner, repo, options = {}) {
    const params = {
      state: options.state || 'open',
      per_page: options.perPage || 30,
      ...options
    };

    return this.request('GET', `/repos/${owner}/${repo}/issues`, null, { params });
  }

  /**
   * Get issue details
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} issueNumber - Issue number
   * @returns {Promise<Object>} Issue data
   */
  async getIssue(owner, repo, issueNumber) {
    return this.request('GET', `/repos/${owner}/${repo}/issues/${issueNumber}`);
  }

  /**
   * Create issue
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} data - Issue data
   * @returns {Promise<Object>} Created issue
   */
  async createIssue(owner, repo, data) {
    return this.request('POST', `/repos/${owner}/${repo}/issues`, data);
  }

  /**
   * Add comment to issue
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} issueNumber - Issue number
   * @param {string} body - Comment body
   * @returns {Promise<Object>} Created comment
   */
  async addIssueComment(owner, repo, issueNumber, body) {
    return this.request('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body });
  }

  // ==================== Notifications ====================

  /**
   * List notifications
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of notifications
   */
  async listNotifications(options = {}) {
    const params = {
      all: options.all || false,
      per_page: options.perPage || 50,
      ...options
    };

    return this.request('GET', '/notifications', null, { params });
  }

  /**
   * Mark notification as read
   * @param {string} threadId - Thread ID
   * @returns {Promise<void>}
   */
  async markNotificationAsRead(threadId) {
    return this.request('PATCH', `/notifications/threads/${threadId}`);
  }

  /**
   * Mark all notifications as read
   * @returns {Promise<void>}
   */
  async markAllNotificationsAsRead() {
    return this.request('PUT', '/notifications');
  }

  // ==================== Repositories ====================

  /**
   * List user repositories
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of repositories
   */
  async listUserRepositories(options = {}) {
    const params = {
      per_page: options.perPage || 100,
      sort: options.sort || 'updated',
      direction: options.direction || 'desc',
      type: options.type || 'all', // all, owner, public, private, member
      ...options
    };

    return this.request('GET', '/user/repos', null, { params });
  }

  /**
   * Get a specific repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Repository details
   */
  async getRepository(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}`);
  }

  /**
   * Create a new repository
   * @param {Object} data - Repository data
   * @returns {Promise<Object>} Created repository
   */
  async createRepository(data) {
    const payload = {
      name: data.name,
      description: data.description || '',
      private: data.private || false,
      auto_init: data.autoInit !== false, // Default to true
      gitignore_template: data.gitignoreTemplate || null,
      license_template: data.licenseTemplate || null,
      ...data
    };

    return this.request('POST', '/user/repos', payload);
  }

  /**
   * Update repository settings
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated repository
   */
  async updateRepository(owner, repo, data) {
    return this.request('PATCH', `/repos/${owner}/${repo}`, data);
  }

  /**
   * Delete a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<void>}
   */
  async deleteRepository(owner, repo) {
    return this.request('DELETE', `/repos/${owner}/${repo}`);
  }

  /**
   * List repository topics
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Topics
   */
  async listRepositoryTopics(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}/topics`, null, {
      headers: { Accept: 'application/vnd.github.mercy-preview+json' }
    });
  }

  /**
   * Replace repository topics
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Array<string>} topics - New topics
   * @returns {Promise<Object>} Updated topics
   */
  async replaceRepositoryTopics(owner, repo, topics) {
    return this.request('PUT', `/repos/${owner}/${repo}/topics`, { names: topics }, {
      headers: { Accept: 'application/vnd.github.mercy-preview+json' }
    });
  }

  /**
   * Star a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<void>}
   */
  async starRepository(owner, repo) {
    return this.request('PUT', `/user/starred/${owner}/${repo}`);
  }

  /**
   * Unstar a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<void>}
   */
  async unstarRepository(owner, repo) {
    return this.request('DELETE', `/user/starred/${owner}/${repo}`);
  }

  /**
   * Check if repository is starred
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<boolean>} True if starred
   */
  async isRepositoryStarred(owner, repo) {
    try {
      await this.request('GET', `/user/starred/${owner}/${repo}`);
      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * List available .gitignore templates
   * @returns {Promise<Array<string>>} List of template names
   */
  async listGitignoreTemplates() {
    return this.request('GET', '/gitignore/templates');
  }

  /**
   * List available licenses
   * @returns {Promise<Array>} List of licenses
   */
  async listLicenses() {
    return this.request('GET', '/licenses');
  }

  // ==================== Search ====================

  /**
   * Search repositories
   * @param {string} query - Search query
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Search results
   */
  async searchRepositories(query, options = {}) {
    const params = {
      q: query,
      per_page: options.perPage || 30,
      ...options
    };

    return this.request('GET', '/search/repositories', null, { params });
  }

  /**
   * Search issues and pull requests
   * @param {string} query - Search query
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Search results
   */
  async searchIssues(query, options = {}) {
    const params = {
      q: query,
      per_page: options.perPage || 30,
      ...options
    };

    return this.request('GET', '/search/issues', null, { params });
  }

  // ==================== Analytics ====================

  /**
   * Get user activity events
   * @param {string} username - GitHub username
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of events
   */
  async getUserEvents(username, options = {}) {
    const params = {
      per_page: options.perPage || 100,
      ...options
    };

    return this.request('GET', `/users/${username}/events`, null, { params });
  }

  /**
   * Get repository traffic views
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Traffic views data
   */
  async getRepositoryTrafficViews(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}/traffic/views`);
  }

  /**
   * Get repository traffic clones
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Traffic clones data
   */
  async getRepositoryTrafficClones(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}/traffic/clones`);
  }

  /**
   * Get repository traffic popular paths
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} Popular paths
   */
  async getRepositoryTrafficPopularPaths(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}/traffic/popular/paths`);
  }

  /**
   * Get repository traffic referrers
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} Traffic referrers
   */
  async getRepositoryTrafficReferrers(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}/traffic/popular/referrers`);
  }

  /**
   * Get repository contributors
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} List of contributors
   */
  async getRepositoryContributors(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}/contributors`, null, {
      params: { per_page: 100 }
    });
  }

  /**
   * Get repository commit activity
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} Commit activity by week
   */
  async getRepositoryCommitActivity(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}/stats/commit_activity`);
  }

  /**
   * Get repository code frequency
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} Code frequency (additions/deletions per week)
   */
  async getRepositoryCodeFrequency(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}/stats/code_frequency`);
  }

  /**
   * Get repository participation
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Owner and all participation data
   */
  async getRepositoryParticipation(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}/stats/participation`);
  }

  /**
   * Get repository punch card
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} Commit count per hour of day
   */
  async getRepositoryPunchCard(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}/stats/punch_card`);
  }

  /**
   * Get repository languages
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Language breakdown (bytes)
   */
  async getRepositoryLanguages(owner, repo) {
    return this.request('GET', `/repos/${owner}/${repo}/languages`);
  }

  /**
   * List repository branches
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Pagination options
   * @returns {Promise<Array>} List of branches
   */
  async listBranches(owner, repo, options = {}) {
    const { per_page = 100, page = 1 } = options;
    return this.request('GET', `/repos/${owner}/${repo}/branches`, null, {
      params: { per_page, page }
    });
  }

  /**
   * List repository commits
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} List of commits
   */
  async listCommits(owner, repo, options = {}) {
    const { sha, path, author, since, until, per_page = 30, page = 1 } = options;
    return this.request('GET', `/repos/${owner}/${repo}/commits`, null, {
      params: { sha, path, author, since, until, per_page, page }
    });
  }

  /**
   * Get repository contents
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - Path to file or directory
   * @param {string} ref - Branch, tag, or commit SHA
   * @returns {Promise<Array|Object>} File or directory contents
   */
  async getRepoContents(owner, repo, path = '', ref = null) {
    const params = ref ? { ref } : {};
    return this.request('GET', `/repos/${owner}/${repo}/contents/${path}`, null, { params });
  }

  /**
   * Get user's contribution stats (via search)
   * @param {string} username - GitHub username
   * @param {Object} options - Date range options
   * @returns {Promise<Object>} Contribution statistics
   */
  async getUserContributionStats(username, options = {}) {
    const { since, until } = options;
    const dateRange = since && until ? `${since}..${until}` : '';
    
    // Search for user's commits, PRs, and issues
    const [commits, prs, issues] = await Promise.all([
      this.searchIssues(`author:${username} is:pr ${dateRange}`, { perPage: 1 }),
      this.searchIssues(`author:${username} is:pr is:merged ${dateRange}`, { perPage: 1 }),
      this.searchIssues(`author:${username} is:issue ${dateRange}`, { perPage: 1 })
    ]);

    return {
      totalPRs: commits.total_count,
      mergedPRs: prs.total_count,
      totalIssues: issues.total_count
    };
  }
}

module.exports = new GitHubAPI();
