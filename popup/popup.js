document.addEventListener('DOMContentLoaded', function() {
  // Cache DOM elements
  const savePasswordForm = document.getElementById('save-password-form');
  const statusMessage = document.getElementById('status-message');
  
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
  
  // Event listener for form submission
  savePasswordForm.addEventListener('submit', handleSavePassword);
  
  /**
   * Handle save password form submission
   */
  function handleSavePassword(e) {
    e.preventDefault();
    
    const url = document.getElementById('site-url').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('site-password').value;
    const title = document.getElementById('title').value || new URL(url).hostname; // Use hostname as title if not provided
    
    // For testing, hardcode a user_id (you would normally get this from authentication)
    const user_id = 1; // Replace with actual user ID or authentication 
    
    // Show saving indicator
    showStatusMessage('Saving password...', '');
    
    // Call your specific endpoint
    fetch('http://185.77.96.90/api/store-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
          throw new Error(data.message || 'Error saving password');
        });
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        showStatusMessage('Password saved successfully', 'success');
        savePasswordForm.reset();
      } else {
        showStatusMessage(data.message || 'Error saving password', 'error-message');
      }
    })
    .catch(error => {
      console.error('Error saving password:', error);
      showStatusMessage(error.message || 'An error occurred while saving the password', 'error-message');
    });
  }
  
  /**
   * Show status message
   */
  function showStatusMessage(message, className) {
    statusMessage.textContent = message;
    statusMessage.className = className;
    
    // Clear message after 3 seconds if it's a success message
    if (className === 'success') {
      setTimeout(() => {
        statusMessage.textContent = '';
        statusMessage.className = '';
      }, 3000);
    }
  }
});