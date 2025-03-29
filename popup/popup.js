document.addEventListener('DOMContentLoaded', function() {
  // Cache DOM elements
  const loginSection = document.getElementById('login-section');
  const passwordManagerSection = document.getElementById('password-manager-section');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const savePasswordForm = document.getElementById('save-password-form');
  const logoutBtn = document.getElementById('logout-btn');
  const passwordStatusMessage = document.getElementById('password-status-message');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const passwordSearch = document.getElementById('password-search');
  const passwordsContainer = document.getElementById('passwords-container');
  
  // Configuration - replace with your Filament backend URL
  const API_BASE_URL = 'http://185.77.96.90/api';
  
  // Check authentication status when the popup opens
  checkAuthStatus();
  
  // Event listeners
  loginForm.addEventListener('submit', handleLogin);
  savePasswordForm.addEventListener('submit', handleSavePassword);
  logoutBtn.addEventListener('click', handleLogout);
  
  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all buttons and tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding tab
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      
      // If switching to password list tab, load passwords
      if (tabId === 'list-tab') {
        loadPasswordsList();
      }
    });
  });
  
  // Search functionality
  passwordSearch.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    filterPasswords(searchTerm);
  });
  
  /**
   * Check authentication status
   */
  function checkAuthStatus() {
    chrome.storage.local.get(['authToken', 'tokenExpiry', 'user_id'], function(result) {
      const currentTime = new Date().getTime();
      
      if (result.authToken && result.tokenExpiry && currentTime < result.tokenExpiry) {
        // Token exists and hasn't expired
        showPasswordManager();
        
        // Prefill form if we're on a login page
        prefillSavePasswordForm();
      } else {
        // No token or expired token, show login
        showLogin();
        
        // Clean up expired tokens
        if (result.authToken) {
          chrome.storage.local.remove(['authToken', 'tokenExpiry', 'user_id']);
        }
      }
    });
  }
  
  /**
   * Handle login form submission
   */
  function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('master-password').value;
    
    // Clear previous errors
    loginError.textContent = '';
    
    // Call authentication API
    fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.message || 'Login failed');
        });
      }
      return response.json();
    })
    .then(data => {
      if (data.token) {
        // Calculate token expiry (e.g., 30 minutes from now)
        const expiryTime = new Date().getTime() + (30 * 60 * 1000);
        
        // Store authentication data
        chrome.storage.local.set({
          authToken: data.token,
          tokenExpiry: expiryTime,
          user_id: data.user.id
        }, function() {
          // Show password manager UI
          showPasswordManager();
          
          // Prefill form if we're on a login page
          prefillSavePasswordForm();
        });
      } else {
        loginError.textContent = 'Authentication failed. Please check your credentials.';
      }
    })
    .catch(error => {
      console.error('Login error:', error);
      loginError.textContent = error.message || 'An error occurred during login.';
    });
  }
  
  /**
   * Handle logout
   */
  function handleLogout() {
    // Remove stored authentication data
    chrome.storage.local.remove(['authToken', 'tokenExpiry', 'user_id'], function() {
      // Show login UI
      showLogin();
    });
  }
  
  /**
   * Show login section
   */
  function showLogin() {
    loginSection.classList.remove('hidden');
    passwordManagerSection.classList.add('hidden');
  }
  
  /**
   * Show password manager section
   */
  function showPasswordManager() {
    loginSection.classList.add('hidden');
    passwordManagerSection.classList.remove('hidden');
    
    // Default to save tab
    document.querySelector('.tab-button[data-tab="save-tab"]').classList.add('active');
    document.getElementById('save-tab').classList.add('active');
    document.querySelector('.tab-button[data-tab="list-tab"]').classList.remove('active');
    document.getElementById('list-tab').classList.remove('active');
  }
  
  /**
   * Prefill save password form with current page info
   */
  function prefillSavePasswordForm() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0]) return;
      
      const currentUrl = tabs[0].url;
      document.getElementById('site-url').value = currentUrl;
      document.getElementById('title').value = tabs[0].title || new URL(currentUrl).hostname;
      
      // Don't try to communicate with content script if not on an HTTP page
      if (!currentUrl.startsWith('http')) return;
      
      // Wrap in try-catch and check for lastError
      try {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          {action: "getCredentials"}, 
          function(response) {
            if (chrome.runtime.lastError) {
              console.log("Content script communication error:", chrome.runtime.lastError);
              return; // Just continue without filling credentials
            }
            
            if (response && response.username) {
              document.getElementById('username').value = response.username;
            }
            if (response && response.password) {
              document.getElementById('site-password').value = response.password;
            }
          }
        );
      } catch (error) {
        console.error("Error sending message:", error);
      }
    });
  }
  
  /**
   * Handle save password form submission
   */
  function handleSavePassword(e) {
    e.preventDefault();
    
    chrome.storage.local.get(['authToken', 'user_id'], function(result) {
      // Verify we have authentication
      if (!result.authToken || !result.user_id) {
        showStatusMessage('You must be logged in to save passwords', 'error');
        return;
      }
      
      const url = document.getElementById('site-url').value;
      const username = document.getElementById('username').value;
      const password = document.getElementById('site-password').value;
      const title = document.getElementById('title').value || new URL(url).hostname;
      const user_id = result.user_id;
      
      showStatusMessage('Saving password...', '');
      
      // Call API to save password
      fetch(`${API_BASE_URL}/store-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${result.authToken}`
        },
        body: JSON.stringify({
          user_id,
          title,
          username,
          password,
          url
        })
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.message || 'Failed to save password');
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          showStatusMessage('Password saved successfully', 'success');
          savePasswordForm.reset();
          
          // Refresh the form with current page info
          setTimeout(prefillSavePasswordForm, 1500);
        } else {
          showStatusMessage(data.message || 'Error saving password', 'error');
        }
      })
      .catch(error => {
        console.error('Error saving password:', error);
        
        // Check if error is due to expired token
        if (error.message && (
            error.message.includes('Unauthenticated') || 
            error.message.includes('token') || 
            error.message.includes('expired'))
        ) {
          // Token might be invalid, force re-login
          handleLogout();
          showStatusMessage('Your session has expired. Please login again.', 'error');
        } else {
          showStatusMessage(error.message || 'An error occurred while saving the password', 'error');
        }
      });
    });
  }
  
  /**
   * Load passwords list from server
   */
  function loadPasswordsList() {
    passwordsContainer.innerHTML = '<div class="loading-message">Loading passwords...</div>';
    
    chrome.storage.local.get(['authToken', 'user_id'], function(result) {
      // Verify we have authentication
      if (!result.authToken || !result.user_id) {
        passwordsContainer.innerHTML = '<div class="empty-state">You must be logged in to view passwords</div>';
        return;
      }
      
      // Call API to get passwords
      fetch(`${API_BASE_URL}/get-passwords`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${result.authToken}`
        }
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.message || 'Failed to load passwords');
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.success && data.passwords && data.passwords.length > 0) {
          displayPasswordsList(data.passwords);
        } else {
          passwordsContainer.innerHTML = '<div class="empty-state">No passwords saved yet</div>';
        }
      })
      .catch(error => {
        console.error('Error loading passwords:', error);
        
        if (error.message && (
            error.message.includes('Unauthenticated') || 
            error.message.includes('token') || 
            error.message.includes('expired'))
        ) {
          handleLogout();
          passwordsContainer.innerHTML = '<div class="empty-state">Your session has expired. Please login again.</div>';
        } else {
          passwordsContainer.innerHTML = `<div class="empty-state">Error loading passwords: ${error.message}</div>`;
        }
      });
    });
  }
  
  function displayPasswordsList(passwords) {
    if (!passwords || passwords.length === 0) {
      passwordsContainer.innerHTML = '<div class="no-passwords">No passwords saved yet</div>';
      return;
    }
    
    passwordsContainer.innerHTML = '';
    
    passwords.forEach(password => {
      const item = document.createElement('div');
      item.className = 'password-item';
      item.dataset.title = password.title.toLowerCase();
      item.dataset.url = password.url.toLowerCase();
      item.dataset.username = password.username.toLowerCase();
      
      item.innerHTML = `
        <div class="password-title">${password.title}</div>
        <div class="password-url">${password.url}</div>
        <div class="password-username"><strong>Username:</strong> ${password.username}</div>
        <div class="password-actions">
          <button class="password-action-btn copy-username" data-username="${password.username}">Copy Username</button>
          <button class="password-action-btn copy-password" data-id="${password.id}">Copy Password</button>
          <button class="password-action-btn fill-password" data-id="${password.id}">Auto Fill</button>
        </div>
      `;
      
      passwordsContainer.appendChild(item);
    });
    
    // Add event listeners for copy and fill buttons
    document.querySelectorAll('.copy-username').forEach(button => {
      button.addEventListener('click', function() {
        const username = this.getAttribute('data-username');
        copyToClipboard(username);
        showStatusMessage('Username copied to clipboard', 'success');
      });
    });
    
    document.querySelectorAll('.copy-password').forEach(button => {
      button.addEventListener('click', function() {
        const passwordId = this.getAttribute('data-id');
        getAndCopyPassword(passwordId);
      });
    });
    
    document.querySelectorAll('.fill-password').forEach(button => {
      button.addEventListener('click', function() {
        const passwordId = this.getAttribute('data-id');
        fillPasswordOnPage(passwordId);
      });
    });
  }
  
  /**
   * Filter passwords based on search term
   */
  function filterPasswords(searchTerm) {
    const items = document.querySelectorAll('.password-item');
    
    if (items.length === 0) return;
    
    if (!searchTerm) {
      // If search is empty, show all
      items.forEach(item => item.style.display = 'block');
      return;
    }
    
    items.forEach(item => {
      const title = item.dataset.title;
      const url = item.dataset.url;
      const username = item.dataset.username;
      
      if (
        title.includes(searchTerm) || 
        url.includes(searchTerm) || 
        username.includes(searchTerm)
      ) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  /**
   * Get password from server and copy to clipboard
   */
  function getAndCopyPassword(passwordId) {
    chrome.storage.local.get(['authToken'], function(result) {
      if (!result.authToken) {
        showStatusMessage('You must be logged in to copy passwords', 'error');
        return;
      }
      
      // Call API to get password
      fetch(`${API_BASE_URL}/get-password/${passwordId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${result.authToken}`
        }
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.message || 'Failed to get password');
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.success && data.password) {
          copyToClipboard(data.password);
          showStatusMessage('Password copied to clipboard', 'success');
        } else {
          showStatusMessage('Could not retrieve password', 'error');
        }
      })
      .catch(error => {
        console.error('Error getting password:', error);
        showStatusMessage(`Error: ${error.message}`, 'error');
      });
    });
  }
  
  /**
   * Fill password on current page
   */
  function fillPasswordOnPage(passwordId) {
    chrome.storage.local.get(['authToken'], function(result) {
      if (!result.authToken) {
        showStatusMessage('You must be logged in to fill passwords', 'error');
        return;
      }
      
      fetch(`${API_BASE_URL}/get-password/${passwordId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${result.authToken}`
        }
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.message || 'Failed to get password');
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.success && data.password && data.username) {
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || !tabs[0]) {
              showStatusMessage('No active tab found', 'error');
              return;
            }
            
            try {
              chrome.tabs.sendMessage(
                tabs[0].id,
                {
                  action: "fillCredentials",
                  username: data.username,
                  password: data.password
                },
                function(response) {
                  if (chrome.runtime.lastError) {
                    console.error("Error:", chrome.runtime.lastError);
                    showStatusMessage('Cannot fill credentials on this page', 'error');
                    return;
                  }
                  
                  if (response && response.success) {
                    showStatusMessage('Credentials filled successfully', 'success');
                  } else {
                    showStatusMessage('Could not find username/password fields', 'error');
                  }
                }
              );
            } catch (error) {
              console.error("Error sending message:", error);
              showStatusMessage('Error filling credentials', 'error');
            }
          });
        } else {
          showStatusMessage('Could not retrieve credentials', 'error');
        }
      })
      .catch(error => {
        console.error('Error getting credentials:', error);
        showStatusMessage(`Error: ${error.message}`, 'error');
      });
    });
  }
  
  /**
   * Copy text to clipboard
   */
  function copyToClipboard(text) {
    // Create a temporary element
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    
    // Select and copy
    el.select();
    document.execCommand('copy');
    
    // Clean up
    document.body.removeChild(el);
  }
  
  /**
   * Show status message
   */
  function showStatusMessage(message, className) {
    passwordStatusMessage.textContent = message;
    passwordStatusMessage.className = 'status-message ' + (className || '');
    passwordStatusMessage.style.display = 'block';
    
    if (className === 'success') {
      setTimeout(() => {
        passwordStatusMessage.style.display = 'none';
      }, 3000);
    }
  }
  
  let inactivityTimeout;
  
  function resetInactivityTimer() {
    clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(handleLogout, 5 * 60 * 1000); // 5 minutes
  }
  
  document.addEventListener('click', resetInactivityTimer);
  document.addEventListener('keypress', resetInactivityTimer);
  
  resetInactivityTimer();
});