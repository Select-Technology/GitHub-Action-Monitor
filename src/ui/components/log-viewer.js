/**
 * Workflow Log Viewer Component
 * Displays detailed logs for workflow runs
 */
class LogViewer {
  constructor() {
    this.currentRun = null;
    this.logs = null;
  }

  /**
   * Open log viewer for a workflow run
   * @param {Object} run - Workflow run object
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   */
  async open(run, owner, repo) {
    this.currentRun = run;
    
    // Create modal
    const modal = this.createModal();
    document.body.appendChild(modal);
    
    // Load logs
    await this.loadLogs(owner, repo, run.id);
  }

  /**
   * Create log viewer modal
   * @returns {HTMLElement} Modal element
   */
  createModal() {
    const modal = document.createElement('div');
    modal.id = 'log-viewer-modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('log-viewer-modal').remove()"></div>
      <div class="modal-content log-viewer">
        <div class="modal-header">
          <h2>📋 Workflow Logs: ${this.currentRun.name}</h2>
          <div class="modal-actions">
            <button class="btn-icon" onclick="logViewer.downloadLogs()" title="Download Logs">⬇️</button>
            <button class="btn-icon" onclick="document.getElementById('log-viewer-modal').remove()" title="Close">✕</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="log-sidebar" id="log-jobs">
            <div class="loading-container">
              <div class="loading"></div>
              <p class="text-muted">Loading jobs...</p>
            </div>
          </div>
          <div class="log-content">
            <div class="log-toolbar">
              <input type="text" id="log-search" placeholder="Search logs..." class="search-input">
              <label class="checkbox-label">
                <input type="checkbox" id="log-errors-only">
                Show errors only
              </label>
              <button class="btn-small" onclick="logViewer.copyLogs()">📋 Copy</button>
            </div>
            <div id="log-display" class="log-display">
              <div class="loading-container">
                <div class="loading"></div>
                <p class="text-muted">Loading logs...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    return modal;
  }

  /**
   * Load workflow logs
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} runId - Workflow run ID
   */
  async loadLogs(owner, repo, runId) {
    try {
      // Get workflow run details including jobs
      const run = await window.electronAPI.getWorkflowRunDetails(owner, repo, runId);
      
      // Display jobs in sidebar
      this.displayJobs(run.jobs || []);
      
      // Load logs (they come as a zip file)
      const logsBlob = await window.electronAPI.getWorkflowRunLogs(owner, repo, runId);
      this.logs = logsBlob;
      
      // Parse and display logs
      await this.parseLogs(logsBlob);
      
    } catch (error) {
      console.error('Failed to load logs:', error);
      document.getElementById('log-display').innerHTML = `
        <div class="error-message">
          <h3>⚠️ Failed to load logs</h3>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * Display jobs in sidebar
   * @param {Array} jobs - List of jobs
   */
  displayJobs(jobs) {
    const sidebar = document.getElementById('log-jobs');
    
    if (jobs.length === 0) {
      sidebar.innerHTML = '<p class="text-muted">No jobs found</p>';
      return;
    }
    
    sidebar.innerHTML = jobs.map(job => {
      const statusIcon = this.getJobStatusIcon(job);
      const duration = this.formatDuration(job.started_at, job.completed_at);
      
      return `
        <div class="job-item" onclick="logViewer.selectJob('${job.id}')">
          <div class="job-header">
            <span>${statusIcon}</span>
            <span class="job-name">${job.name}</span>
          </div>
          <div class="job-meta">
            <span class="text-muted">${duration}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Parse and display logs
   * @param {Blob} logsBlob - Logs zip blob
   */
  async parseLogs(logsBlob) {
    const display = document.getElementById('log-display');
    
    // For now, show a message that logs need to be extracted
    // In a full implementation, we'd use JSZip to extract and parse
    display.innerHTML = `
      <div class="log-info">
        <h3>📦 Logs Available</h3>
        <p>Workflow logs are available for download as a ZIP file.</p>
        <p class="text-muted">Size: ${(logsBlob.size / 1024).toFixed(2)} KB</p>
        <button class="btn-primary" onclick="logViewer.downloadLogs()">
          ⬇️ Download Logs
        </button>
      </div>
    `;
  }

  /**
   * Get status icon for job
   * @param {Object} job - Job object
   * @returns {string} Status icon
   */
  getJobStatusIcon(job) {
    if (job.status === 'completed' && job.conclusion === 'success') return '✅';
    if (job.status === 'completed' && job.conclusion === 'failure') return '❌';
    if (job.status === 'in_progress') return '⏳';
    if (job.status === 'queued') return '⏸️';
    return '⚪';
  }

  /**
   * Format duration
   * @param {string} start - Start time
   * @param {string} end - End time
   * @returns {string} Formatted duration
   */
  formatDuration(start, end) {
    if (!start || !end) return 'N/A';
    const duration = new Date(end) - new Date(start);
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  }

  /**
   * Download logs
   */
  async downloadLogs() {
    if (!this.logs) {
      alert('No logs available');
      return;
    }
    
    try {
      await window.electronAPI.saveFile(this.logs, `workflow-logs-${this.currentRun.id}.zip`);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download logs');
    }
  }

  /**
   * Copy logs to clipboard
   */
  copyLogs() {
    const logContent = document.getElementById('log-display').innerText;
    navigator.clipboard.writeText(logContent);
    alert('Logs copied to clipboard!');
  }

  /**
   * Select a specific job
   * @param {string} jobId - Job ID
   */
  selectJob(jobId) {
    document.querySelectorAll('.job-item').forEach(item => {
      item.classList.remove('active');
    });
    event.target.closest('.job-item')?.classList.add('active');
    // TODO: Load specific job logs
  }
}
