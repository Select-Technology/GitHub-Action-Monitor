# GitView

A comprehensive GitHub desktop client built with Electron. Monitor Actions, manage repositories, browse code, track pull requests and issues — all from a native desktop application.

![Electron](https://img.shields.io/badge/Electron-33.x-47848F?logo=electron&logoColor=white)
![Version](https://img.shields.io/badge/Version-2.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)

## ✨ Features

### 🚀 GitHub Actions Monitoring
- **Real-time Dashboard** — View workflow runs across all your repositories
- **Configurable Refresh** — Auto-refresh interval from 15 seconds to 5 minutes
- **Repository Selection** — Choose which repositories to monitor
- **Status Indicators** — Color-coded status for running, success, failed, and queued jobs

### 📁 Repository Management
- **Repository Browser** — View all your repositories with stats (stars, forks, language)
- **Create Repositories** — Create new repos with optional local clone
- **Repository Details** — Deep dive into any repository with:
  - **Commits Tab** — Visual commit history with graph
  - **Branches Tab** — View local and remote branches
  - **Files Tab** — Browse local and remote files with syntax highlighting
  - **Actions Tab** — View and trigger workflows for the repository

### 🔀 Pull Requests
- **PR Dashboard** — View open PRs across all repositories
- **PR Details** — Review changes, view diffs, and manage PRs
- **Quick Actions** — Merge, approve, or request changes

### 🐛 Issues
- **Issue Tracker** — View and manage issues across repositories
- **Create Issues** — Quick issue creation with labels
- **Comments** — View and add comments to issues

### 🔔 Notifications
- **Notification Center** — View GitHub notifications
- **Mark as Read** — Manage notification state
- **Quick Navigation** — Jump to related items

### 📊 Insights & Analytics
- **Activity Feed** — Recent activity across your account
- **Contribution Stats** — PRs, issues, and commits overview

### 🔧 Advanced Features
- **OAuth Authentication** — Secure GitHub OAuth 2.0 with PKCE
- **Local Repository Integration** — Link local clones to remote repos
- **Syntax Highlighting** — View file contents with language-aware highlighting
- **Keyboard Shortcuts** — Quick navigation and actions
- **Auto-launch** — Optional startup with Windows

## 📸 Screenshots

### Actions Dashboard
Monitor workflow runs with status indicators and quick actions.

### Repository Detail View
Browse commits, branches, files, and trigger workflows.

### File Viewer
View file contents with syntax highlighting for 40+ languages.

## 🚀 Installation

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or higher
- A GitHub account

### From Release (Recommended)
1. Download the latest release from [Releases](https://github.com/Select-Technology/GitHub-Action-Monitor/releases)
2. Run the installer (Windows) or portable executable
3. Connect your GitHub account via OAuth

### From Source
```bash
# Clone the repository
git clone https://github.com/Select-Technology/GitHub-Action-Monitor.git
cd GitHub-Action-Monitor

# Install dependencies
npm install

# Start the application
npm start
```

### Building for Distribution
```bash
# Build Windows installer and portable
npm run build:win
```

## 🔐 Authentication

GitView uses **OAuth 2.0 with PKCE** for secure authentication:

1. Click "Connect with GitHub" on the login screen
2. Authorize the application in your browser
3. You'll be redirected back to the app automatically

### Required Scopes
- `repo` — Access repositories
- `workflow` — Manage GitHub Actions
- `read:org` — Read organization membership
- `notifications` — Access notifications
- `read:user` — Read user profile

### OAuth App Setup (For Developers)

If running from source, you'll need to configure OAuth:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App:
   - **Application name**: GitView
   - **Homepage URL**: `http://localhost`
   - **Authorization callback URL**: `http://127.0.0.1:3000/callback`
3. Create a `.env` file:
   ```env
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   ```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` - `Ctrl+7` | Switch between tabs |
| `Ctrl+R` | Refresh current view |
| `Ctrl+N` | Create new repository |
| `Ctrl+K` | Quick search |
| `Ctrl+,` | Open settings |
| `Esc` | Close dialogs |

## 🛠️ Technical Details

- **Framework**: Electron 33.x
- **Backend**: Node.js with Express (for OAuth callback)
- **API**: GitHub REST API v3
- **Storage**: localStorage for preferences, electron-store for credentials
- **Git Integration**: simple-git for local repository operations

### Dependencies
- `axios` — HTTP client
- `simple-git` — Git operations
- `electron-store` — Secure storage
- `marked` — Markdown rendering
- `diff2html` — Diff visualization
- `date-fns` — Date formatting
- `lodash` — Utility functions

## 📋 Changelog

### v2.0.0 (2026-01-16)
- 🎨 **Complete UI Redesign** — Modern interface with tabbed navigation
- 🔐 **OAuth Authentication** — Replaced PAT with secure OAuth 2.0 + PKCE
- 📁 **Repository Management** — Full repository browser and creation
- 📄 **File Browser** — Browse local and remote files with syntax highlighting
- ⚡ **Actions Tab** — Per-repository workflow management and triggering
- 🔀 **Pull Requests** — View and manage PRs across all repos
- 🐛 **Issues** — Track and manage issues
- 🔔 **Notifications** — GitHub notification center
- 📊 **Insights** — Activity feed and contribution stats
- 🌿 **Branch Management** — View local and remote branches
- 📜 **Commit History** — Visual commit graph
- ⚙️ **Settings** — Configurable refresh interval and preferences

### v1.0.0
- Initial release with basic Actions monitoring

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- GitHub API documentation
- [Highlight.js](https://highlightjs.org/) for syntax highlighting

---

Made with ❤️ by [Select Technology](https://github.com/Select-Technology)
