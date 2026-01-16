# Changelog

All notable changes to GitView will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-16

### 🎉 Major Release - Complete Rewrite

This release transforms GitHub Actions Monitor into **GitView**, a comprehensive GitHub desktop client.

### Added

#### Authentication
- OAuth 2.0 authentication with PKCE for secure login
- Automatic token refresh and session management
- User profile display in header

#### Actions Monitoring
- Real-time workflow run monitoring dashboard
- Configurable auto-refresh (15s to 5 minutes)
- Repository selector to filter monitored repos
- Status indicators with color coding
- Re-run and cancel workflow actions
- View workflow logs

#### Repository Management
- Full repository browser with grid layout
- Create new repositories with GitHub API
- Clone repositories to local path on creation
- Repository detail view with multiple tabs
- Star/unstar repositories

#### Repository Detail View
- **Commits Tab**: Visual commit history with author info and commit graph
- **Branches Tab**: View local and remote branches
- **Files Tab**: Browse local and remote file trees
- **Actions Tab**: Per-repository workflow runs and triggering

#### File Browser
- Expandable folder tree for local and remote files
- Syntax highlighting for 40+ programming languages
- File viewer modal with line numbers
- Binary file detection
- Open files with default application

#### Pull Requests
- PR dashboard across all repositories
- PR details with diff viewing
- Merge, approve, and comment actions

#### Issues
- Issue tracker across all repositories
- Create new issues
- View and add comments
- Label management

#### Notifications
- GitHub notification center
- Mark as read functionality
- Quick navigation to related items

#### Insights & Analytics
- Activity feed with recent events
- Contribution statistics

#### User Interface
- Complete UI redesign with modern dark theme
- Tabbed navigation (Actions, Repos, PRs, Issues, Notifications, Insights, Settings)
- Keyboard shortcuts for common actions
- Settings dialog for preferences
- Auto-launch on Windows startup option

### Changed
- Renamed from "GitHub Actions Monitor" to "GitView"
- Replaced Personal Access Token with OAuth authentication
- Improved error handling throughout the application
- Better loading states and user feedback

### Technical
- Added Express server for OAuth callback handling
- Integrated simple-git for local repository operations
- Added electron-store for secure credential storage
- Modular code architecture with separate components

---

## [1.0.0] - 2024-XX-XX

### Added
- Initial release
- Basic GitHub Actions workflow monitoring
- Personal Access Token authentication
- Auto-refresh every 45 seconds
- Repository grouping
- Status color coding

---

[2.0.0]: https://github.com/Select-Technology/GitHub-Action-Monitor/releases/tag/v2.0.0
[1.0.0]: https://github.com/Select-Technology/GitHub-Action-Monitor/releases/tag/v1.0.0
