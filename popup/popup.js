document.addEventListener('DOMContentLoaded', function() {
    // Cache DOM elements
    const loginForm = document.getElementById('login-form');
    const loggedOutSection = document.getElementById('logged-out');
    const loggedInSection = document.getElementById('logged-in');
    const savePasswordBtn = document.getElementById('save-password-btn');
    const viewPasswordsBtn = document.getElementById('view-passwords-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const saveForm = document.getElementById('save-form');
    const savePasswordForm = document.getElementById('save-password-form');
    const passwordsList = document.getElementById('passwords-list');
    const backBtn = document.getElementById('back-btn');
    const cancelSaveBtn = document.getElementById('cancel-save');
    const statusMessage = document.getElementById('status-message');
    const passwordsContainer = document.getElementById('passwords-container');
    const searchPasswords = document.getElementById('search-passwords');
    
    // Configuration - replace with your Filament backend URL
    const API_BASE_URL = 'https://your-filament-backend-url.com/api';
    
    // Check authentication status on load
    checkAuth();
    
    // Event listeners
    loginForm.addEventListener('submit', handleLogin);
    savePasswordBtn.addEventListener('click', showSaveForm);
    viewPasswordsBtn.addEventListener('click', showPasswordsList);
    logoutBtn.addEventListener('click', handleLogout);
    savePasswordForm.addEventListener('submit', handleSavePassword);
    backBtn.addEventListener('click', goBackToActions);
    cancelSaveBtn.addEventListener('click', goBackToActions);
    searchPasswords.addEventListener('input', filterPasswords);
    
    /**
     * Check if user is authenticated
     */
    function checkAuth() {
      chrome.storage.local.get(['token', 'user'], function(result) {
        if (result.token && result.user) {
          loggedOutSection.classList.add('hidden');
          loggedInSection.classList.remove('hidden');
          
          // Optionally verify token validity with the backend
          verifyToken(result.token);
        } else {
          loggedOutSection.classList.remove('hidden');
          loggedInSection.classList.add('hidden');
        }
      });
    }
    
    /**
     * Verify token with backend
     */
    function verifyToken(token) {
      fetch(`${API_BASE_URL}/verify-token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .then(response => {
        if (!response.ok) {
          // Token invalid, log user out
          handleLogout();
        }
        return response.json();
      })
      .catch(error => {
        console.error('Error verifying token:', error);
        // On error, keep user logged in but silently log the error
      });
    }
    
    /**
     * Handle login form submission
     */
    function handleLogin(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const loginError = document.getElementById('login-error');
      
      // Clear previous errors
      loginError.textContent = '';
      
      // Call login API
      fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })
      .then(response => response.json())
      .then(data => {
        if (data.token) {
          // Store token and user info
          chrome.storage.local.set({
            token: data.token,
            user: data.user
          }, function() {
            checkAuth();
          });
        } else {
          loginError.textContent = data.message || 'Login failed. Please check your credentials.';
        }
      })
      .catch(error => {
        console.error('Login error:', error);
        loginError.textContent = 'An error occurred. Please try again.';
      });
    }
    
    /**
     * Handle logout
     */
    function handleLogout() {
      chrome.storage.local.remove(['token', 'user'], function() {
        checkAuth();
      });
    }
    
    /**
     * Show save password form
     */
    function showSaveForm() {
      // Get current tab URL
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        document.getElementById('site-url').value = currentUrl;
        
        // Try to get current page credentials from content script
        chrome.tabs.sendMessage(tabs[0].id, {action: "getCredentials"}, function(response) {
          if (response && response.username) {
            document.getElementById('username').value = response.username;
          }
          if (response && response.password) {
            document.getElementById('site-password').value = response.password;
          }
        });
      });
      
      // Hide other sections, show save form
      passwordsList.classList.add('hidden');
      saveForm.classList.remove('hidden');
    }
    
    /**
     * Show passwords list
     */
    function showPasswordsList() {
      // Hide other sections, show passwords list
      saveForm.classList.add('hidden');
      passwordsList.classList.remove('hidden');
      
      // Fetch passwords from backend
      fetchPasswords();
    }
    
    /**
     * Fetch passwords from backend
     */
    function fetchPasswords() {
      chrome.storage.local.get(['token'], function(result) {
        if (!result.token) {
          showStatusMessage('You must be logged in to view passwords', 'error-message');
          return;
        }
        
        passwordsContainer.innerHTML = '<p>Loading passwords...</p>';
        
        fetch(`${API_BASE_URL}/passwords`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${result.token}`,
            'Content-Type': 'application/json'
          }
        })
        .then(response => response.json())
        .then(data => {
          if (data.passwords && data.passwords.length > 0) {
            displayPasswords(data.passwords);
          } else {
            passwordsContainer.innerHTML = '<p>No passwords saved yet.</p>';
          }
        })
        .catch(error => {
          console.error('Error fetching passwords:', error);
          passwordsContainer.innerHTML = '<p>Error loading passwords. Please try again.</p>';
        });
      });
    }
    
    /**
     * Display passwords in the list
     */
    function displayPasswords(passwords) {
      passwordsContainer.innerHTML = '';
      
      passwords.forEach(password => {
        const item = document.createElement('div');
        item.className = 'password-item';
        item.dataset.url = password.url;
        item.dataset.username = password.username;
        
        item.innerHTML = `
          <h4>${password.title || password.url}</h4>
          <p>Username: ${password.username}</p>
          <div class="password-actions">
            <button class="copy-username" data-username="${password.username}">Copy Username</button>
            <button class="copy-password" data-id="${password.id}">Copy Password</button>
            <button class="fill-credentials" data-id="${password.id}">Fill</button>
          </div>
        `;
        
        passwordsContainer.appendChild(item);
      });
      
      // Add event listeners for password item actions
      document.querySelectorAll('.copy-username').forEach(button => {
        button.addEventListener('click', function() {
          navigator.clipboard.writeText(this.dataset.username);
          showStatusMessage('Username copied to clipboard', 'success');
        });
      });
      
      document.querySelectorAll('.copy-password').forEach(button => {
        button.addEventListener('click', function() {
          getPassword(this.dataset.id);
        });
      });
      
      document.querySelectorAll('.fill-credentials').forEach(button => {
        button.addEventListener('click', function() {
          fillCredentials(this.dataset.id);
        });
      });
    }
    
    /**
     * Get password from backend and copy to clipboard
     */
    function getPassword(id) {
      chrome.storage.local.get(['token'], function(result) {
        fetch(`${API_BASE_URL}/passwords/${id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${result.token}`,
            'Content-Type': 'application/json'
          }
        })
        .then(response => response.json())
        .then(data => {
          if (data.password) {
            navigator.clipboard.writeText(data.password);
            showStatusMessage('Password copied to clipboard', 'success');
          } else {
            showStatusMessage('Could not retrieve password', 'error-message');
          }
        })
        .catch(error => {
          console.error('Error getting password:', error);
          showStatusMessage('Error retrieving password', 'error-message');
        });
      });
    }
    
    /**
     * Fill credentials in active tab
     */
    function fillCredentials(id) {
      chrome.storage.local.get(['token'], function(result) {
        fetch(`${API_BASE_URL}/passwords/${id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${result.token}`,
            'Content-Type': 'application/json'
          }
        })
        .then(response => response.json())
        .then(data => {
          if (data.username && data.password) {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "fillCredentials",
                username: data.username,
                password: data.password
              }, function(response) {
                if (response && response.success) {
                  showStatusMessage('Credentials filled', 'success');
                } else {
                  showStatusMessage('Could not fill credentials', 'error-message');
                }
              });
            });
          }
        })
        .catch(error => {
          console.error('Error getting credentials:', error);
          showStatusMessage('Error retrieving credentials', 'error-message');
        });
      });
    }
    
    /**
     * Handle save password form submission
     */
    function handleSavePassword(e) {
      e.preventDefault();
      
      const url = document.getElementById('site-url').value;
      const username = document.getElementById('username').value;
      const password = document.getElementById('site-password').value;
      const notes = document.getElementById('notes').value;
      
      chrome.storage.local.get(['token'], function(result) {
        if (!result.token) {
          showStatusMessage('You must be logged in to save passwords', 'error-message');
          return;
        }
        
        fetch(`${API_BASE_URL}/passwords`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${result.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url,
            username,
            password,
            notes
          })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            showStatusMessage('Password saved successfully', 'success');
            savePasswordForm.reset();
            goBackToActions();
          } else {
            showStatusMessage(data.message || 'Error saving password', 'error-message');
          }
        })
        .catch(error => {
          console.error('Error saving password:', error);
          showStatusMessage('An error occurred while saving the password', 'error-message');
        });
      });
    }
    
    /**
     * Go back to main actions view
     */
    function goBackToActions() {
      saveForm.classList.add('hidden');
      passwordsList.classList.add('hidden');
    }
    
    /**
     * Filter passwords based on search input
     */
    function filterPasswords() {
      const searchTerm = searchPasswords.value.toLowerCase();
      const items = passwordsContainer.getElementsByClassName('password-item');
      
      for (let i = 0; i < items.length; i++) {
        const url = items[i].dataset.url.toLowerCase();
        const username = items[i].dataset.username.toLowerCase();
        
        if (url.includes(searchTerm) || username.includes(searchTerm)) {
          items[i].style.display = 'block';
        } else {
          items[i].style.display = 'none';
        }
      }
    }
    
    /**
     * Show status message
     */
    function showStatusMessage(message, className) {
      statusMessage.textContent = message;
      statusMessage.className = className;
      
      // Clear message after 3 seconds
      setTimeout(() => {
        statusMessage.textContent = '';
        statusMessage.className = '';
      }, 3000);
    }
  });