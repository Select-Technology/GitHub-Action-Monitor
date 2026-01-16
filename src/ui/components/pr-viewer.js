/**
 * Pull Request Viewer Component
 * View PR details, files changed, and manage reviews
 */
class PRViewer {
  constructor() {
    this.currentPR = null;
    this.currentOwner = null;
    this.currentRepo = null;
    this.files = [];
    this.currentTab = 'conversation';
  }

  /**
   * Show PR details
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   */
  async show(owner, repo, prNumber) {
    this.currentOwner = owner;
    this.currentRepo = repo;
    
    // Create modal
    const modal = this.createModal();
    document.body.appendChild(modal);
    
    // Load PR details
    await this.loadPR(owner, repo, prNumber);
  }

  /**
   * Create PR viewer modal
   * @returns {HTMLElement} Modal element
   */
  createModal() {
    const modal = document.createElement('div');
    modal.id = 'pr-viewer-modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('pr-viewer-modal').remove()"></div>
      <div class="modal-content pr-viewer">
        <div class="modal-header">
          <h2>🔀 Loading Pull Request...</h2>
          <div class="modal-actions">
            <button class="btn-icon" onclick="prViewer.openInGitHub()" title="Open in GitHub">🌐</button>
            <button class="btn-icon" onclick="document.getElementById('pr-viewer-modal').remove()" title="Close">✕</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="loading-container">
            <div class="loading"></div>
            <p class="text-muted">Loading pull request...</p>
          </div>
        </div>
      </div>
    `;
    return modal;
  }

  /**
   * Load PR details
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   */
  async loadPR(owner, repo, prNumber) {
    try {
      // Get PR details
      this.currentPR = await window.electronAPI.getPRDetails(owner, repo, prNumber);
      
      // Get PR files
      this.files = await window.electronAPI.getPRFiles(owner, repo, prNumber);
      
      // Update header
      this.updateHeader();
      
      // Display content
      this.displayContent();
      
    } catch (error) {
      console.error('Failed to load PR:', error);
      const modalBody = document.querySelector('#pr-viewer-modal .modal-body');
      modalBody.innerHTML = `
        <div class="error-message">
          <h3>⚠️ Failed to load pull request</h3>
          <p>${this.escapeHtml(error.message)}</p>
        </div>
      `;
    }
  }

  /**
   * Update modal header with PR info
   */
  updateHeader() {
    const header = document.querySelector('#pr-viewer-modal .modal-header h2');
    const statusIcon = this.getStatusIcon(this.currentPR);
    header.innerHTML = `${statusIcon} #${this.currentPR.number}: ${this.escapeHtml(this.currentPR.title)}`;
  }

  /**
   * Display PR content
   */
  displayContent() {
    const modalBody = document.querySelector('#pr-viewer-modal .modal-body');
    
    modalBody.innerHTML = `
      <div class="pr-tabs">
        <button class="pr-tab ${this.currentTab === 'conversation' ? 'active' : ''}" 
                onclick="prViewer.switchTab('conversation')">💬 Conversation</button>
        <button class="pr-tab ${this.currentTab === 'files' ? 'active' : ''}" 
                onclick="prViewer.switchTab('files')">📄 Files Changed (${this.files.length})</button>
        <button class="pr-tab ${this.currentTab === 'checks' ? 'active' : ''}" 
                onclick="prViewer.switchTab('checks')">✓ Checks</button>
      </div>
      <div class="pr-content">
        ${this.renderTabContent()}
      </div>
      ${this.renderActions()}
    `;
  }

  /**
   * Switch between tabs
   * @param {string} tab - Tab name
   */
  switchTab(tab) {
    this.currentTab = tab;
    this.displayContent();
  }

  /**
   * Render tab content
   * @returns {string} HTML content
   */
  renderTabContent() {
    switch (this.currentTab) {
      case 'conversation':
        return this.renderConversation();
      case 'files':
        return this.renderFiles();
      case 'checks':
        return this.renderChecks();
      default:
        return '';
    }
  }

  /**
   * Render conversation tab
   * @returns {string} HTML content
   */
  renderConversation() {
    const pr = this.currentPR;
    const statusBadge = this.getStatusBadge(pr);
    
    return `
      <div class="pr-info">
        <div class="pr-meta">
          <img src="${pr.user.avatar_url}" alt="${pr.user.login}" class="avatar-small">
          <div>
            <strong>${this.escapeHtml(pr.user.login)}</strong> wants to merge 
            <code>${this.escapeHtml(pr.head.ref)}</code> into <code>${this.escapeHtml(pr.base.ref)}</code>
          </div>
          ${statusBadge}
        </div>
        <div class="pr-stats">
          <span class="stat">📝 ${pr.commits} commit${pr.commits !== 1 ? 's' : ''}</span>
          <span class="stat">💬 ${pr.comments} comment${pr.comments !== 1 ? 's' : ''}</span>
          <span class="stat">+${pr.additions} −${pr.deletions}</span>
          <span class="stat">📄 ${this.files.length} file${this.files.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="pr-description">
        <h3>Description</h3>
        ${pr.body ? `<div class="markdown-content">${this.renderMarkdown(pr.body)}</div>` : 
                    '<p class="text-muted">No description provided</p>'}
      </div>
      ${this.renderReviewers()}
      ${this.renderLabels()}
    `;
  }

  /**
   * Render files tab
   * @returns {string} HTML content
   */
  renderFiles() {
    if (this.files.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">📄</div>
          <h3>No files changed</h3>
          <p class="text-muted">This pull request doesn't change any files</p>
        </div>
      `;
    }

    return `
      <div class="file-list">
        ${this.files.map(file => this.renderFile(file)).join('')}
      </div>
    `;
  }

  /**
   * Render single file
   * @param {Object} file - File object
   * @returns {string} HTML content
   */
  renderFile(file) {
    const statusIcon = this.getFileStatusIcon(file.status);
    const statusClass = file.status.toLowerCase();
    
    return `
      <div class="file-item">
        <div class="file-header ${statusClass}">
          <span class="file-status">${statusIcon} ${file.status}</span>
          <code class="file-path">${this.escapeHtml(file.filename)}</code>
          <span class="file-stats">+${file.additions} −${file.deletions}</span>
        </div>
        ${file.patch ? `
          <div class="file-patch">
            <button class="btn-small" onclick="prViewer.togglePatch('${file.sha}')">
              <span id="patch-toggle-${file.sha}">Show diff</span>
            </button>
            <pre id="patch-content-${file.sha}" class="patch-content" style="display: none;">${this.escapeHtml(file.patch)}</pre>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Toggle patch visibility
   * @param {string} fileSha - File SHA
   */
  togglePatch(fileSha) {
    const content = document.getElementById(`patch-content-${fileSha}`);
    const toggle = document.getElementById(`patch-toggle-${fileSha}`);
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggle.textContent = 'Hide diff';
    } else {
      content.style.display = 'none';
      toggle.textContent = 'Show diff';
    }
  }

  /**
   * Render checks tab
   * @returns {string} HTML content
   */
  renderChecks() {
    // GitHub status checks would be fetched separately
    return `
      <div class="empty-state">
        <div class="empty-state-icon">✓</div>
        <h3>Status Checks</h3>
        <p class="text-muted">Check status information coming soon</p>
      </div>
    `;
  }

  /**
   * Render reviewers section
   * @returns {string} HTML content
   */
  renderReviewers() {
    if (!this.currentPR.requested_reviewers || this.currentPR.requested_reviewers.length === 0) {
      return '';
    }

    return `
      <div class="pr-reviewers">
        <h4>Reviewers</h4>
        <div class="reviewer-list">
          ${this.currentPR.requested_reviewers.map(reviewer => `
            <div class="reviewer-item">
              <img src="${reviewer.avatar_url}" alt="${reviewer.login}" class="avatar-small">
              <span>${this.escapeHtml(reviewer.login)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render labels section
   * @returns {string} HTML content
   */
  renderLabels() {
    if (!this.currentPR.labels || this.currentPR.labels.length === 0) {
      return '';
    }

    return `
      <div class="pr-labels">
        <h4>Labels</h4>
        <div class="label-list">
          ${this.currentPR.labels.map(label => `
            <span class="label" style="background-color: #${label.color};">
              ${this.escapeHtml(label.name)}
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render action buttons
   * @returns {string} HTML content
   */
  renderActions() {
    const pr = this.currentPR;
    
    if (pr.state !== 'open') {
      return '';
    }

    const canMerge = pr.mergeable && !pr.merged;
    
    return `
      <div class="pr-actions">
        ${canMerge ? `
          <button class="btn-primary" onclick="prViewer.mergePR()">
            ✓ Merge Pull Request
          </button>
        ` : ''}
        <button class="btn-secondary" onclick="prViewer.addComment()">
          💬 Add Comment
        </button>
        ${pr.draft ? `
          <button class="btn-secondary" onclick="prViewer.markReady()">
            ✓ Mark as Ready
          </button>
        ` : ''}
      </div>
    `;
  }

  /**
   * Merge PR
   */
  async mergePR() {
    const message = prompt('Merge commit message:', `Merge pull request #${this.currentPR.number}`);
    
    if (!message) return;
    
    try {
      await window.electronAPI.mergePR(
        this.currentOwner,
        this.currentRepo,
        this.currentPR.number,
        { commit_message: message }
      );
      
      alert('Pull request merged successfully!');
      document.getElementById('pr-viewer-modal').remove();
      
      // Refresh PR list if on PRs tab
      if (typeof loadPullRequestsView === 'function') {
        loadPullRequestsView();
      }
    } catch (error) {
      alert(`Failed to merge PR: ${error.message}`);
    }
  }

  /**
   * Add comment
   */
  addComment() {
    const comment = prompt('Enter your comment:');
    if (!comment) return;
    
    // TODO: Implement comment creation
    alert('Comment functionality coming soon!');
  }

  /**
   * Mark PR as ready
   */
  markReady() {
    // TODO: Implement mark as ready
    alert('Mark as ready functionality coming soon!');
  }

  /**
   * Open PR in GitHub
   */
  openInGitHub() {
    if (this.currentPR) {
      window.electronAPI.openExternal(this.currentPR.html_url);
    }
  }

  /**
   * Get status icon
   * @param {Object} pr - PR object
   * @returns {string} Icon
   */
  getStatusIcon(pr) {
    if (pr.merged) return '✓';
    if (pr.state === 'closed') return '❌';
    if (pr.draft) return '📝';
    return '🔀';
  }

  /**
   * Get status badge
   * @param {Object} pr - PR object
   * @returns {string} HTML badge
   */
  getStatusBadge(pr) {
    if (pr.merged) {
      return '<span class="badge badge-merged">Merged</span>';
    }
    if (pr.state === 'closed') {
      return '<span class="badge badge-closed">Closed</span>';
    }
    if (pr.draft) {
      return '<span class="badge badge-draft">Draft</span>';
    }
    return '<span class="badge badge-open">Open</span>';
  }

  /**
   * Get file status icon
   * @param {string} status - File status
   * @returns {string} Icon
   */
  getFileStatusIcon(status) {
    switch (status.toLowerCase()) {
      case 'added': return '✚';
      case 'modified': return '✎';
      case 'removed': return '✖';
      case 'renamed': return '→';
      default: return '•';
    }
  }

  /**
   * Render markdown (basic)
   * @param {string} text - Markdown text
   * @returns {string} HTML
   */
  renderMarkdown(text) {
    // Basic markdown rendering (newlines and code blocks)
    return this.escapeHtml(text)
      .replace(/\n/g, '<br>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  /**
   * Escape HTML
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
