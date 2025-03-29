document.addEventListener('DOMContentLoaded', function() {
  // Cache DOM elements
  const loginSection = document.getElementById('login-section');
  const passwordManagerSection = document.getElementById('password-manager-section');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const savePasswordForm = document.getElementById('save-password-form');
  const logoutBtn = document.getElementById('logout-btn');
  const passwordStatusMessage = document.getElementById('password-status-message');
  
  // Configuration - replace with your Filament backend URL
  const API_BASE_URL = 'http://185.77.96.90/api';
  
  // Check authentication status when the popup opens
  checkAuthStatus();
  
  // Event listeners
  loginForm.addEventListener('submit', handleLogin);
  savePasswordForm.addEventListener('submit', handleSavePassword);
  logoutBtn.addEventListener('click', handleLogout);
  
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
  }
  
  /**
   * Prefill save password form with current page info
   */
  function sendMessageToActiveTab(message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) {
          return reject(new Error("No active tab"));
        }
        
        const activeTab = tabs[0];
        
        if (!activeTab.url.startsWith('http')) {
          return reject(new Error("Not a regular web page"));
        }
        
        try {
          chrome.tabs.sendMessage(activeTab.id, message, function(response) {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            resolve(response);
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async function prefillSavePasswordForm() {
    try {
      const tabs = await new Promise(resolve => chrome.tabs.query({active: true, currentWindow: true}, resolve));
      const currentUrl = tabs[0].url;
      document.getElementById('site-url').value = currentUrl;
      document.getElementById('title').value = tabs[0].title || new URL(currentUrl).hostname;
      
      if (currentUrl.startsWith('http')) {
        try {
          const credentials = await sendMessageToActiveTab({action: "getCredentials"});
          if (credentials && credentials.username) {
            document.getElementById('username').value = credentials.username;
          }
          if (credentials && credentials.password) {
            document.getElementById('site-password').value = credentials.password;
          }
        } catch (error) {
          console.log("Could not get credentials:", error.message);
        }
      }
    } catch (error) {
      console.error("Error in prefillSavePasswordForm:", error);
    }
  }
  
  function handleSavePassword(e) {
    e.preventDefault();
    
    chrome.storage.local.get(['authToken', 'user_id'], function(result) {
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
          
          setTimeout(prefillSavePasswordForm, 1500);
        } else {
          showStatusMessage(data.message || 'Error saving password', 'error');
        }
      })
      .catch(error => {
        console.error('Error saving password:', error);
        
        if (error.message && (
            error.message.includes('Unauthenticated') || 
            error.message.includes('token') || 
            error.message.includes('expired'))
        ) {
          handleLogout();
          showStatusMessage('Your session has expired. Please login again.', 'error');
        } else {
          showStatusMessage(error.message || 'An error occurred while saving the password', 'error');
        }
      });
    });
  }
  
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
    inactivityTimeout = setTimeout(handleLogout, 5 * 60 * 1000);
  }
  
  document.addEventListener('click', resetInactivityTimer);
  document.addEventListener('keypress', resetInactivityTimer);
  
  resetInactivityTimer();
});