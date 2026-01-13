# GitHub Actions Monitor

A desktop application for monitoring GitHub Actions workflow runs across all your repositories in real-time.

![Electron](https://img.shields.io/badge/Electron-33.x-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Real-time Dashboard** - View all workflow runs from the last 30 minutes across all accessible repositories
- **Status Overview** - See running, successful, failed, and queued actions at a glance
- **Repository Grouping** - Workflow runs organised by repository for easy scanning
- **Auto-refresh** - Dashboard updates automatically every 45 seconds
- **Clean Interface** - Frameless desktop window without browser chrome

## Screenshot

The dashboard displays workflow runs grouped by repository with colour-coded status indicators:
- Blue (pulsing): In progress
- Green: Success
- Red: Failed
- Yellow: Queued

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- GitHub Personal Access Token with `repo` and `workflow` scopes

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Select-Technology/GitHub-Action-Monitor.git
   cd GitHub-Action-Monitor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

4. Enter your GitHub Personal Access Token when prompted

### Getting a Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens/new)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Actions Monitor")
4. Select these scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
5. Click "Generate token" and copy it immediately

## Usage

Once running, the application will:

1. Fetch all repositories you have access to
2. Query each repository for workflow runs from the last 30 minutes
3. Display runs grouped by repository, sorted by most recent activity
4. Auto-refresh every 45 seconds

Click the gear icon to update your token at any time.

## Configuration

The application stores your GitHub token in the browser's localStorage for persistence between sessions. No other configuration is required.

## Technical Details

- **Framework**: Electron
- **Architecture**: Single HTML file with embedded CSS and JavaScript
- **API**: GitHub REST API v3
- **Rate Limits**: Uses authenticated requests (5,000/hour) - sufficient for monitoring hundreds of repositories

## License

MIT
