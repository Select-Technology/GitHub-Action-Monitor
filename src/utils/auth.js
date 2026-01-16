const crypto = require('crypto');
const express = require('express');
const { shell } = require('electron');
const axios = require('axios');
const storage = require('../utils/storage');

/**
 * GitHub OAuth authentication service
 * Handles OAuth flow with PKCE for enhanced security
 */
class AuthService {
  constructor() {
    // OAuth credentials - hardcoded for packaged app distribution
    this.clientId = 'Ov23libY99pSHCALp1Ul';
    this.clientSecret = '97e6cf3c5de9b171ca090d842af488980d14d631';
    this.redirectUri = 'http://127.0.0.1:3000/callback';
    this.callbackServer = null;
    
    // Required OAuth scopes
    this.scopes = [
      'repo',              // Full control of private repositories
      'workflow',          // Update GitHub Action workflows
      'read:org',          // Read organization data
      'notifications',     // Access notifications
      'read:discussion',   // Read discussions
      'read:packages'      // Read packages (for dependency alerts)
    ];
  }

  /**
   * Generate PKCE code verifier and challenge
   * @returns {Object} Contains verifier and challenge
   */
  generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
    
    return { verifier, challenge };
  }

  /**
   * Generate random state for CSRF protection
   * @returns {string} Random state string
   */
  generateState() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Start OAuth authentication flow
   * @param {Function} onSuccess - Callback on successful auth
   * @param {Function} onError - Callback on error
   * @returns {Promise<void>}
   */
  async startOAuthFlow(onSuccess, onError) {
    try {
      // Generate PKCE and state
      const { verifier, challenge } = this.generatePKCE();
      const state = this.generateState();

      // Store for later verification
      storage.storePKCEVerifier(verifier);
      storage.storeOAuthState(state);

      // Start callback server
      await this.startCallbackServer(onSuccess, onError);

      // Build authorization URL
      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.append('client_id', this.clientId);
      authUrl.searchParams.append('redirect_uri', this.redirectUri);
      authUrl.searchParams.append('scope', this.scopes.join(' '));
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('code_challenge', challenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');

      // Open in default browser
      console.log('Opening OAuth URL:', authUrl.toString());
      console.log('Client ID:', this.clientId);
      console.log('Redirect URI:', this.redirectUri);
      await shell.openExternal(authUrl.toString());

      console.log('OAuth flow started, waiting for callback...');
    } catch (error) {
      console.error('Failed to start OAuth flow:', error);
      if (onError) onError(error);
    }
  }

  /**
   * Start local server to handle OAuth callback
   * @param {Function} onSuccess - Success callback
   * @param {Function} onError - Error callback
   * @returns {Promise<void>}
   */
  startCallbackServer(onSuccess, onError) {
    return new Promise((resolve, reject) => {
      const app = express();

      app.get('/callback', async (req, res) => {
        try {
          const { code, state, error, error_description } = req.query;

          // Check for OAuth error
          if (error) {
            res.send(`
              <html>
                <head><title>Authentication Failed</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1>❌ Authentication Failed</h1>
                  <p>${error_description || error}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            this.stopCallbackServer();
            if (onError) onError(new Error(error_description || error));
            return;
          }

          // Verify state
          if (!storage.verifyOAuthState(state)) {
            res.status(400).send(`
              <html>
                <head><title>Invalid State</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1>⚠️ Invalid Authentication State</h1>
                  <p>Please try again.</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            this.stopCallbackServer();
            if (onError) onError(new Error('Invalid state parameter'));
            return;
          }

          // Exchange code for token
          const tokenData = await this.exchangeCodeForToken(code);

          // Store tokens
          await storage.storeTokens(
            tokenData.access_token,
            tokenData.refresh_token,
            tokenData.expires_in || 28800
          );

          // Fetch user profile
          const profile = await this.fetchUserProfile(tokenData.access_token);
          storage.storeUserProfile(profile);

          // Success response
          res.send(`
            <html>
              <head><title>Authentication Successful</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>✅ Authentication Successful!</h1>
                <p>Welcome, <strong>${profile.login}</strong>!</p>
                <p>You can close this window and return to the app.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
            </html>
          `);

          // Stop server and notify success
          setTimeout(() => {
            this.stopCallbackServer();
            if (onSuccess) onSuccess({ profile, token: tokenData.access_token });
          }, 1000);

        } catch (error) {
          console.error('Callback error:', error);
          res.status(500).send(`
            <html>
              <head><title>Authentication Error</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>⚠️ Authentication Error</h1>
                <p>Please try again.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          this.stopCallbackServer();
          if (onError) onError(error);
        }
      });

      this.callbackServer = app.listen(3000, () => {
        console.log('OAuth callback server listening on port 3000');
        resolve();
      });

      this.callbackServer.on('error', (err) => {
        console.error('Callback server error:', err);
        reject(err);
      });
    });
  }

  /**
   * Stop the callback server
   */
  stopCallbackServer() {
    if (this.callbackServer) {
      this.callbackServer.close();
      this.callbackServer = null;
      console.log('OAuth callback server stopped');
    }
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code
   * @returns {Promise<Object>} Token data
   */
  async exchangeCodeForToken(code) {
    const verifier = storage.getPKCEVerifier();
    if (!verifier) {
      throw new Error('PKCE verifier not found');
    }

    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        code_verifier: verifier
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.error) {
      throw new Error(response.data.error_description || response.data.error);
    }

    return response.data;
  }

  /**
   * Refresh access token
   * @returns {Promise<string>} New access token
   */
  async refreshAccessToken() {
    const tokens = await storage.getTokens();
    if (!tokens || !tokens.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.error) {
        throw new Error(response.data.error_description || response.data.error);
      }

      // Store new tokens
      await storage.storeTokens(
        response.data.access_token,
        response.data.refresh_token,
        response.data.expires_in || 28800
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   * @returns {Promise<string|null>} Access token or null if not authenticated
   */
  async getValidToken() {
    const token = await storage.getValidAccessToken();
    if (token) {
      return token;
    }

    // Try to refresh if expired
    const isExpired = await storage.isTokenExpired();
    if (isExpired) {
      try {
        return await this.refreshAccessToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
        return null;
      }
    }

    return null;
  }

  /**
   * Fetch GitHub user profile
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} User profile
   */
  async fetchUserProfile(accessToken) {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    return response.data;
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    const token = await this.getValidToken();
    return token !== null;
  }

  /**
   * Logout user
   */
  async logout() {
    this.stopCallbackServer();
    storage.clearAllUserData();
  }

  /**
   * Get current user profile
   * @returns {Object|null} User profile
   */
  getCurrentUser() {
    return storage.getUserProfile();
  }
}

module.exports = new AuthService();
