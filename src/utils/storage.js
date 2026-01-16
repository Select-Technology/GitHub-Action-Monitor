const Store = require('electron-store');
const { safeStorage } = require('electron');
const crypto = require('crypto');

/**
 * Secure storage utility for sensitive data like OAuth tokens
 * Uses electron-store with OS-level encryption via safeStorage
 */
class SecureStorage {
  constructor() {
    this.store = new Store({
      name: 'github-actions-monitor',
      encryptionKey: 'github-actions-monitor-secure-key'
    });
  }

  /**
   * Store OAuth tokens securely using OS keychain
   * @param {string} accessToken - GitHub OAuth access token
   * @param {string} refreshToken - GitHub OAuth refresh token (optional)
   * @param {number} expiresIn - Token expiry time in seconds (default 8 hours)
   */
  async storeTokens(accessToken, refreshToken = null, expiresIn = 28800) {
    try {
      const tokenData = {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + (expiresIn * 1000),
        storedAt: Date.now()
      };

      // Encrypt using OS keychain if available
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(JSON.stringify(tokenData));
        this.store.set('github.tokens', encrypted.toString('base64'));
      } else {
        // Fallback to electron-store's encryption
        console.warn('OS encryption not available, using fallback encryption');
        this.store.set('github.tokens', tokenData);
      }

      return true;
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  /**
   * Retrieve stored tokens
   * @returns {Object|null} Token data or null if not found
   */
  async getTokens() {
    try {
      const encryptedData = this.store.get('github.tokens');
      if (!encryptedData) {
        return null;
      }

      // Decrypt if using OS keychain
      if (safeStorage.isEncryptionAvailable() && typeof encryptedData === 'string') {
        const decrypted = safeStorage.decryptString(
          Buffer.from(encryptedData, 'base64')
        );
        return JSON.parse(decrypted);
      }

      // Return directly if using electron-store encryption
      return encryptedData;
    } catch (error) {
      console.error('Failed to retrieve tokens:', error);
      return null;
    }
  }

  /**
   * Check if tokens are expired
   * @returns {boolean} True if tokens are expired or don't exist
   */
  async isTokenExpired() {
    const tokens = await this.getTokens();
    if (!tokens || !tokens.expiresAt) {
      return true;
    }
    return Date.now() >= tokens.expiresAt;
  }

  /**
   * Get valid access token, returns null if expired
   * @returns {string|null} Access token or null
   */
  async getValidAccessToken() {
    const tokens = await this.getTokens();
    if (!tokens) {
      return null;
    }

    // Check if expired
    if (Date.now() >= tokens.expiresAt) {
      return null;
    }

    return tokens.accessToken;
  }

  /**
   * Clear stored tokens (logout)
   */
  clearTokens() {
    this.store.delete('github.tokens');
  }

  /**
   * Store general application settings
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   */
  set(key, value) {
    this.store.set(key, value);
  }

  /**
   * Get application setting
   * @param {string} key - Setting key
   * @param {any} defaultValue - Default value if not found
   * @returns {any} Setting value
   */
  get(key, defaultValue = null) {
    return this.store.get(key, defaultValue);
  }

  /**
   * Delete a setting
   * @param {string} key - Setting key
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * Store OAuth state for CSRF protection
   * @param {string} state - Random state string
   */
  storeOAuthState(state) {
    this.store.set('oauth.state', {
      value: state,
      createdAt: Date.now()
    });
  }

  /**
   * Verify and consume OAuth state
   * @param {string} state - State to verify
   * @returns {boolean} True if valid
   */
  verifyOAuthState(state) {
    const stored = this.store.get('oauth.state');
    if (!stored) {
      return false;
    }

    // State should be used within 10 minutes
    const isValid = stored.value === state && 
                   (Date.now() - stored.createdAt) < 600000;

    if (isValid) {
      this.store.delete('oauth.state');
    }

    return isValid;
  }

  /**
   * Store code verifier for PKCE flow
   * @param {string} verifier - Code verifier
   */
  storePKCEVerifier(verifier) {
    this.store.set('oauth.pkce.verifier', {
      value: verifier,
      createdAt: Date.now()
    });
  }

  /**
   * Get and consume PKCE verifier
   * @returns {string|null} Code verifier
   */
  getPKCEVerifier() {
    const stored = this.store.get('oauth.pkce.verifier');
    if (!stored) {
      return null;
    }

    // Verifier should be used within 10 minutes
    if (Date.now() - stored.createdAt > 600000) {
      this.store.delete('oauth.pkce.verifier');
      return null;
    }

    this.store.delete('oauth.pkce.verifier');
    return stored.value;
  }

  /**
   * Store user profile information
   * @param {Object} profile - GitHub user profile
   */
  storeUserProfile(profile) {
    this.store.set('user.profile', profile);
  }

  /**
   * Get stored user profile
   * @returns {Object|null} User profile
   */
  getUserProfile() {
    return this.store.get('user.profile', null);
  }

  /**
   * Clear all user data (full logout)
   */
  clearAllUserData() {
    this.clearTokens();
    this.store.delete('user.profile');
    this.store.delete('oauth.state');
    this.store.delete('oauth.pkce.verifier');
  }
}

module.exports = new SecureStorage();
