/**
 * Artifact Browser Component
 * Browse and download workflow artifacts
 */
class ArtifactBrowser {
  constructor() {
    this.currentOwner = null;
    this.currentRepo = null;
    this.currentRunId = null;
    this.artifacts = [];
  }

  /**
   * Show artifact browser for a workflow run
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Workflow run ID
   */
  async show(owner, repo, runId) {
    this.currentOwner = owner;
    this.currentRepo = repo;
    this.currentRunId = runId;
    
    // Create modal
    const modal = this.createModal();
    document.body.appendChild(modal);
    
    // Load artifacts
    await this.loadArtifacts(owner, repo, runId);
  }

  /**
   * Create artifact browser modal
   * @returns {HTMLElement} Modal element
   */
  createModal() {
    const modal = document.createElement('div');
    modal.id = 'artifact-browser-modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('artifact-browser-modal').remove()"></div>
      <div class="modal-content artifact-browser">
        <div class="modal-header">
          <h2>📦 Workflow Artifacts</h2>
          <button class="btn-icon" onclick="document.getElementById('artifact-browser-modal').remove()" title="Close">✕</button>
        </div>
        <div class="modal-body">
          <div id="artifact-list" class="artifact-list">
            <div class="loading-container">
              <div class="loading"></div>
              <p class="text-muted">Loading artifacts...</p>
            </div>
          </div>
        </div>
      </div>
    `;
    return modal;
  }

  /**
   * Load artifacts for workflow run
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Workflow run ID
   */
  async loadArtifacts(owner, repo, runId) {
    try {
      const result = await window.electronAPI.getArtifacts(owner, repo, runId);
      this.artifacts = result.artifacts || [];
      this.displayArtifacts();
    } catch (error) {
      console.error('Failed to load artifacts:', error);
      document.getElementById('artifact-list').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Failed to load artifacts</h3>
          <p class="text-muted">${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * Display artifacts
   */
  displayArtifacts() {
    const container = document.getElementById('artifact-list');
    
    if (this.artifacts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <h3>No artifacts</h3>
          <p class="text-muted">This workflow run has no artifacts</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.artifacts.map(artifact => {
      const size = this.formatSize(artifact.size_in_bytes);
      const expiresAt = new Date(artifact.expires_at);
      const isExpired = expiresAt < new Date();
      const expiresIn = this.formatExpiresIn(expiresAt);
      
      return `
        <div class="artifact-item ${isExpired ? 'expired' : ''}">
          <div class="artifact-icon">📄</div>
          <div class="artifact-info">
            <div class="artifact-name">${artifact.name}</div>
            <div class="artifact-meta">
              <span class="text-muted">${size}</span>
              <span class="text-muted">•</span>
              <span class="text-muted ${isExpired ? 'expired-text' : ''}">
                ${isExpired ? 'Expired' : expiresIn}
              </span>
            </div>
          </div>
          <div class="artifact-actions">
            ${isExpired ? 
              '<button class="btn-small" disabled>Expired</button>' :
              `<button class="btn-small" onclick="artifactBrowser.download(${artifact.id}, '${artifact.name}')">
                ⬇️ Download
              </button>`
            }
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Download artifact
   * @param {number} artifactId - Artifact ID
   * @param {string} name - Artifact name
   */
  async download(artifactId, name) {
    try {
      const btn = event.target;
      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span> Downloading...';
      
      const blob = await window.electronAPI.downloadArtifact(this.currentOwner, this.currentRepo, artifactId);
      
      // Save the blob to disk
      const result = await window.electronAPI.saveFile(blob, `${name}.zip`);
      
      if (result.success) {
        btn.innerHTML = '✅ Downloaded';
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = '⬇️ Download';
        }, 2000);
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download artifact: ' + error.message);
      event.target.disabled = false;
      event.target.innerHTML = '⬇️ Download';
    }
  }

  /**
   * Format file size
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  /**
   * Format expiration time
   * @param {Date} expiresAt - Expiration date
   * @returns {string} Formatted expiration
   */
  formatExpiresIn(expiresAt) {
    const now = new Date();
    const diff = expiresAt - now;
    
    if (diff < 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `Expires in ${days} day${days > 1 ? 's' : ''}`;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `Expires in ${hours} hour${hours > 1 ? 's' : ''}`;
    
    const minutes = Math.floor(diff / (1000 * 60));
    return `Expires in ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}
