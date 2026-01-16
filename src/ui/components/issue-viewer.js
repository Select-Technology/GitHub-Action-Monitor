/**
 * Issue Viewer Component
 * View and manage GitHub issues
 */
class IssueViewer {
  constructor() {
    this.currentIssue = null;
    this.currentOwner = null;
    this.currentRepo = null;
    this.comments = [];
  }

  /**
   * Show issue details
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} issueNumber - Issue number
   */
  async show(owner, repo, issueNumber) {
    this.currentOwner = owner;
    this.currentRepo = repo;
    
    // Create modal
    const modal = this.createModal();
    document.body.appendChild(modal);
    
    // Load issue details
    await this.loadIssue(owner, repo, issueNumber);
  }

  /**
   * Create issue viewer modal
   * @returns {HTMLElement} Modal element
   */
  createModal() {
    const modal = document.createElement('div');
    modal.id = 'issue-viewer-modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('issue-viewer-modal').remove()"></div>
      <div class="modal-content issue-viewer">
        <div class="modal-header">
          <h2>🐛 Loading Issue...</h2>
          <div class="modal-actions">
            <button class="btn-icon" onclick="issueViewer.openInGitHub()" title="Open in GitHub">🌐</button>
            <button class="btn-icon" onclick="document.getElementById('issue-viewer-modal').remove()" title="Close">✕</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="loading-container">
            <div class="loading"></div>
            <p class="text-muted">Loading issue...</p>
          </div>
        </div>
      </div>
    `;
    return modal;
  }

  /**
   * Load issue details
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} issueNumber - Issue number
   */
  async loadIssue(owner, repo, issueNumber) {
    try {
      // Get issue details
      this.currentIssue = await window.electronAPI.getIssueDetails(owner, repo, issueNumber);
      
      // Get issue comments
      this.comments = await window.electronAPI.getIssueComments(owner, repo, issueNumber);
      
      // Update header
      this.updateHeader();
      
      // Display content
      this.displayContent();
      
    } catch (error) {
      console.error('Failed to load issue:', error);
      const modalBody = document.querySelector('#issue-viewer-modal .modal-body');
      modalBody.innerHTML = `
        <div class="error-message">
          <h3>⚠️ Failed to load issue</h3>
          <p>${this.escapeHtml(error.message)}</p>
        </div>
      `;
    }
  }

  /**
   * Update modal header with issue info
   */
  updateHeader() {
    const header = document.querySelector('#issue-viewer-modal .modal-header h2');
    const statusIcon = this.getStatusIcon(this.currentIssue);
    header.innerHTML = `${statusIcon} #${this.currentIssue.number}: ${this.escapeHtml(this.currentIssue.title)}`;
  }

  /**
   * Display issue content
   */
  displayContent() {
    const modalBody = document.querySelector('#issue-viewer-modal .modal-body');
    const issue = this.currentIssue;
    const statusBadge = this.getStatusBadge(issue);
    
    modalBody.innerHTML = `
      <div class="issue-content">
        <div class="issue-info">
          <div class="issue-meta">
            <img src="${issue.user.avatar_url}" alt="${issue.user.login}" class="avatar-small">
            <div>
              <strong>${this.escapeHtml(issue.user.login)}</strong> opened this issue ${this.formatTimeAgo(new Date(issue.created_at))}
            </div>
            ${statusBadge}
          </div>
          <div class="issue-stats">
            <span class="stat">💬 ${issue.comments} comment${issue.comments !== 1 ? 's' : ''}</span>
            ${issue.milestone ? `<span class="stat">🎯 ${this.escapeHtml(issue.milestone.title)}</span>` : ''}
            ${issue.assignees && issue.assignees.length > 0 ? `<span class="stat">👤 ${issue.assignees.length} assignee${issue.assignees.length !== 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>
        
        <div class="issue-body">
          <h3>Description</h3>
          ${issue.body ? `<div class="markdown-content">${this.renderMarkdown(issue.body)}</div>` : 
                        '<p class="text-muted">No description provided</p>'}
        </div>
        
        ${this.renderSidebar()}
        
        ${this.renderComments()}
        
        ${this.renderCommentForm()}
      </div>
      
      ${this.renderActions()}
    `;
  }

  /**
   * Render sidebar with labels, assignees, milestone
   * @returns {string} HTML content
   */
  renderSidebar() {
    const issue = this.currentIssue;
    
    return `
      <div class="issue-sidebar">
        ${issue.labels && issue.labels.length > 0 ? `
          <div class="sidebar-section">
            <h4>Labels</h4>
            <div class="label-list">
              ${issue.labels.map(label => `
                <span class="label" style="background-color: #${label.color};">
                  ${this.escapeHtml(label.name)}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${issue.assignees && issue.assignees.length > 0 ? `
          <div class="sidebar-section">
            <h4>Assignees</h4>
            <div class="assignee-list">
              ${issue.assignees.map(assignee => `
                <div class="assignee-item">
                  <img src="${assignee.avatar_url}" alt="${assignee.login}" class="avatar-small">
                  <span>${this.escapeHtml(assignee.login)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${issue.milestone ? `
          <div class="sidebar-section">
            <h4>Milestone</h4>
            <div class="milestone-item">
              🎯 ${this.escapeHtml(issue.milestone.title)}
              ${issue.milestone.due_on ? `<div class="text-muted" style="font-size: 12px;">Due ${this.formatTimeAgo(new Date(issue.milestone.due_on))}</div>` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render comments
   * @returns {string} HTML content
   */
  renderComments() {
    if (this.comments.length === 0) {
      return '';
    }

    return `
      <div class="issue-comments">
        <h3>Comments (${this.comments.length})</h3>
        ${this.comments.map(comment => this.renderComment(comment)).join('')}
      </div>
    `;
  }

  /**
   * Render single comment
   * @param {Object} comment - Comment object
   * @returns {string} HTML content
   */
  renderComment(comment) {
    return `
      <div class="comment-item">
        <div class="comment-header">
          <img src="${comment.user.avatar_url}" alt="${comment.user.login}" class="avatar-small">
          <strong>${this.escapeHtml(comment.user.login)}</strong>
          <span class="text-muted">commented ${this.formatTimeAgo(new Date(comment.created_at))}</span>
        </div>
        <div class="comment-body">
          ${this.renderMarkdown(comment.body)}
        </div>
      </div>
    `;
  }

  /**
   * Render comment form
   * @returns {string} HTML content
   */
  renderCommentForm() {
    return `
      <div class="comment-form">
        <h4>Add a comment</h4>
        <textarea id="new-comment-text" placeholder="Leave a comment..." rows="4"></textarea>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="btn-primary" onclick="issueViewer.addComment()">💬 Comment</button>
        </div>
      </div>
    `;
  }

  /**
   * Render action buttons
   * @returns {string} HTML content
   */
  renderActions() {
    const issue = this.currentIssue;
    
    if (issue.state === 'closed') {
      return `
        <div class="issue-actions">
          <button class="btn-secondary" onclick="issueViewer.reopenIssue()">
            ↩️ Reopen Issue
          </button>
        </div>
      `;
    }
    
    return `
      <div class="issue-actions">
        <button class="btn-secondary" onclick="issueViewer.closeIssue()">
          ✓ Close Issue
        </button>
      </div>
    `;
  }

  /**
   * Add comment to issue
   */
  async addComment() {
    const textarea = document.getElementById('new-comment-text');
    const body = textarea.value.trim();
    
    if (!body) {
      alert('Please enter a comment');
      return;
    }
    
    try {
      await window.electronAPI.addIssueComment(
        this.currentOwner,
        this.currentRepo,
        this.currentIssue.number,
        body
      );
      
      // Reload issue to show new comment
      await this.loadIssue(this.currentOwner, this.currentRepo, this.currentIssue.number);
      
    } catch (error) {
      alert(`Failed to add comment: ${error.message}`);
    }
  }

  /**
   * Close issue
   */
  async closeIssue() {
    if (!confirm('Are you sure you want to close this issue?')) {
      return;
    }
    
    try {
      await window.electronAPI.updateIssue(
        this.currentOwner,
        this.currentRepo,
        this.currentIssue.number,
        { state: 'closed' }
      );
      
      alert('Issue closed successfully!');
      document.getElementById('issue-viewer-modal').remove();
      
      // Refresh issues list if on issues tab
      if (typeof loadIssuesView === 'function') {
        loadIssuesView();
      }
    } catch (error) {
      alert(`Failed to close issue: ${error.message}`);
    }
  }

  /**
   * Reopen issue
   */
  async reopenIssue() {
    try {
      await window.electronAPI.updateIssue(
        this.currentOwner,
        this.currentRepo,
        this.currentIssue.number,
        { state: 'open' }
      );
      
      alert('Issue reopened successfully!');
      document.getElementById('issue-viewer-modal').remove();
      
      // Refresh issues list
      if (typeof loadIssuesView === 'function') {
        loadIssuesView();
      }
    } catch (error) {
      alert(`Failed to reopen issue: ${error.message}`);
    }
  }

  /**
   * Open issue in GitHub
   */
  openInGitHub() {
    if (this.currentIssue) {
      window.electronAPI.openExternal(this.currentIssue.html_url);
    }
  }

  /**
   * Get status icon
   * @param {Object} issue - Issue object
   * @returns {string} Icon
   */
  getStatusIcon(issue) {
    return issue.state === 'open' ? '🐛' : '✓';
  }

  /**
   * Get status badge
   * @param {Object} issue - Issue object
   * @returns {string} HTML badge
   */
  getStatusBadge(issue) {
    if (issue.state === 'closed') {
      return '<span class="badge badge-closed">Closed</span>';
    }
    return '<span class="badge badge-open">Open</span>';
  }

  /**
   * Format time ago
   * @param {Date} date - Date object
   * @returns {string} Time ago string
   */
  formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  /**
   * Render markdown (basic)
   * @param {string} text - Markdown text
   * @returns {string} HTML
   */
  renderMarkdown(text) {
    return this.escapeHtml(text)
      .replace(/\n/g, '<br>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  /**
   * Escape HTML
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
