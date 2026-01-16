const simpleGit = require('simple-git');
const { dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const authService = require('../utils/auth');

/**
 * Git operations service for repository management
 */
class GitOperations {
  constructor() {
    this.git = simpleGit();
  }

  /**
   * Clone a repository
   * @param {string} repoUrl - Repository URL
   * @param {string} localPath - Local destination path
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>} Local path of cloned repo
   */
  async cloneRepository(repoUrl, localPath, progressCallback = null) {
    try {
      // Add authentication to URL if using HTTPS
      const token = await authService.getValidToken();
      if (token && repoUrl.startsWith('https://')) {
        const urlWithAuth = repoUrl.replace(
          'https://',
          `https://oauth2:${token}@`
        );
        
        const options = progressCallback ? ['--progress'] : [];
        
        await this.git.clone(urlWithAuth, localPath, options, (err, result) => {
          if (progressCallback && result) {
            progressCallback(result);
          }
        });
      } else {
        await this.git.clone(repoUrl, localPath);
      }

      return localPath;
    } catch (error) {
      console.error('Clone failed:', error);
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Pull changes from remote
   * @param {string} repoPath - Local repository path
   * @param {string} remote - Remote name (default: origin)
   * @param {string} branch - Branch name
   * @returns {Promise<Object>} Pull result
   */
  async pull(repoPath, remote = 'origin', branch = null) {
    try {
      const git = simpleGit(repoPath);
      
      // Get current branch if not specified
      if (!branch) {
        const status = await git.status();
        branch = status.current;
      }

      // Set up authentication
      await this.setupGitCredentials(repoPath);

      // Fetch first to check status
      await git.fetch();

      // Pull changes
      const result = await git.pull(remote, branch);
      
      return {
        success: true,
        files: result.files,
        insertions: result.insertions,
        deletions: result.deletions,
        summary: result.summary
      };
    } catch (error) {
      console.error('Pull failed:', error);
      
      // Check if it's a merge conflict
      if (error.message.includes('CONFLICT')) {
        return {
          success: false,
          hasConflicts: true,
          message: 'Merge conflicts detected. Please resolve manually.'
        };
      }
      
      throw new Error(`Failed to pull: ${error.message}`);
    }
  }

  /**
   * Push changes to remote
   * @param {string} repoPath - Local repository path
   * @param {string} remote - Remote name (default: origin)
   * @param {string} branch - Branch name
   * @param {boolean} force - Force push
   * @returns {Promise<Object>} Push result
   */
  async push(repoPath, remote = 'origin', branch = null, force = false) {
    try {
      const git = simpleGit(repoPath);
      
      // Get current branch if not specified
      if (!branch) {
        const status = await git.status();
        branch = status.current;
      }

      // Set up authentication
      await this.setupGitCredentials(repoPath);

      // Push changes
      const options = force ? ['--force'] : [];
      const result = await git.push(remote, branch, options);
      
      return {
        success: true,
        pushed: result.pushed,
        branch: result.branch
      };
    } catch (error) {
      console.error('Push failed:', error);
      throw new Error(`Failed to push: ${error.message}`);
    }
  }

  /**
   * Stage files
   * @param {string} repoPath - Local repository path
   * @param {Array<string>} files - Files to stage (empty array for all)
   * @returns {Promise<void>}
   */
  async stage(repoPath, files = []) {
    try {
      const git = simpleGit(repoPath);
      
      if (files.length === 0) {
        await git.add('.');
      } else {
        await git.add(files);
      }
    } catch (error) {
      console.error('Stage failed:', error);
      throw new Error(`Failed to stage files: ${error.message}`);
    }
  }

  /**
   * Commit changes
   * @param {string} repoPath - Local repository path
   * @param {string} message - Commit message
   * @returns {Promise<Object>} Commit result
   */
  async commit(repoPath, message) {
    try {
      const git = simpleGit(repoPath);
      const result = await git.commit(message);
      
      return {
        success: true,
        commit: result.commit,
        summary: result.summary
      };
    } catch (error) {
      console.error('Commit failed:', error);
      throw new Error(`Failed to commit: ${error.message}`);
    }
  }

  /**
   * Get repository status
   * @param {string} repoPath - Local repository path
   * @returns {Promise<Object>} Repository status
   */
  async getStatus(repoPath) {
    try {
      const git = simpleGit(repoPath);
      const status = await git.status();
      
      return {
        current: status.current,
        tracking: status.tracking,
        ahead: status.ahead,
        behind: status.behind,
        modified: status.modified,
        created: status.created,
        deleted: status.deleted,
        renamed: status.renamed,
        staged: status.staged,
        conflicted: status.conflicted
      };
    } catch (error) {
      console.error('Get status failed:', error);
      throw new Error(`Failed to get status: ${error.message}`);
    }
  }

  /**
   * Add remote repository
   * @param {string} repoPath - Local repository path
   * @param {string} remoteName - Remote name
   * @param {string} remoteUrl - Remote URL
   * @returns {Promise<void>}
   */
  async addRemote(repoPath, remoteName, remoteUrl) {
    try {
      const git = simpleGit(repoPath);
      await git.addRemote(remoteName, remoteUrl);
    } catch (error) {
      console.error('Add remote failed:', error);
      throw new Error(`Failed to add remote: ${error.message}`);
    }
  }

  /**
   * Initialize a new git repository
   * @param {string} repoPath - Path to initialize
   * @returns {Promise<void>}
   */
  async init(repoPath) {
    try {
      const git = simpleGit(repoPath);
      await git.init();
    } catch (error) {
      console.error('Init failed:', error);
      throw new Error(`Failed to initialize repository: ${error.message}`);
    }
  }

  /**
   * Get commit log
   * @param {string} repoPath - Local repository path
   * @param {Object} options - Log options
   * @returns {Promise<Array>} Commit history
   */
  async getLog(repoPath, options = {}) {
    try {
      const git = simpleGit(repoPath);
      const log = await git.log({
        maxCount: options.maxCount || 50,
        ...options
      });
      
      return log.all;
    } catch (error) {
      console.error('Get log failed:', error);
      throw new Error(`Failed to get log: ${error.message}`);
    }
  }

  /**
   * Check if directory is a git repository
   * @param {string} dirPath - Directory path
   * @returns {Promise<boolean>} True if git repo
   */
  async isGitRepository(dirPath) {
    try {
      const git = simpleGit(dirPath);
      await git.status();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Setup Git credentials using OAuth token
   * @param {string} repoPath - Repository path
   * @returns {Promise<void>}
   */
  async setupGitCredentials(repoPath) {
    try {
      const token = await authService.getValidToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const git = simpleGit(repoPath);
      
      // Configure credential helper to use OAuth token
      await git.addConfig('credential.helper', 'store');
      
      // Get remote URL
      const remotes = await git.getRemotes(true);
      if (remotes.length > 0) {
        const remote = remotes[0];
        if (remote.refs.fetch.startsWith('https://')) {
          // Update remote URL with token
          const urlWithAuth = remote.refs.fetch.replace(
            'https://',
            `https://oauth2:${token}@`
          );
          await git.remote(['set-url', remote.name, urlWithAuth]);
        }
      }
    } catch (error) {
      console.error('Setup credentials failed:', error);
      // Don't throw - credential setup is best effort
    }
  }

  /**
   * Find all git repositories in a directory
   * @param {string} searchPath - Path to search
   * @returns {Promise<Array<string>>} List of repository paths
   */
  async findRepositories(searchPath) {
    const repositories = [];
    
    try {
      const entries = await fs.readdir(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const fullPath = path.join(searchPath, entry.name);
        
        // Check if it's a git repository
        if (await this.isGitRepository(fullPath)) {
          repositories.push(fullPath);
        }
      }
    } catch (error) {
      console.error('Find repositories failed:', error);
    }
    
    return repositories;
  }
}

module.exports = new GitOperations();
