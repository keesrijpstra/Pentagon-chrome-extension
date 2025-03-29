// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
  console.log("Pentagon Password Manager installed");
});

// Check authentication status periodically to ensure token hasn't expired
setInterval(function() {
  chrome.storage.local.get(['authToken', 'tokenExpiry'], function(result) {
    const currentTime = new Date().getTime();
    
    if (result.authToken && result.tokenExpiry && currentTime >= result.tokenExpiry) {
      // Token has expired, clear it
      chrome.storage.local.remove(['authToken', 'tokenExpiry', 'user_id']);
      
      // Notify user if the extension popup is open
      chrome.runtime.sendMessage({
        action: "sessionExpired"
      });
    }
  });
}, 60000); // Check every minute

// Listen for login form submissions to detect credentials
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    // Only process POST requests that might be login forms
    if (details.method !== "POST" || !details.requestBody || !details.requestBody.formData) {
      return;
    }
    
    // Check if the user is authenticated
    chrome.storage.local.get(['authToken'], function(result) {
      if (!result.authToken) {
        // User is not logged in to the extension, don't capture passwords
        return;
      }
      
      const formData = details.requestBody.formData;
      
      // Look for common username/password field names
      const usernameFields = ["username", "email", "user", "login", "userid"];
      const passwordFields = ["password", "pass", "pwd", "passwd"];
      
      let username = null;
      let password = null;
      
      // Try to find username field
      for (const field of usernameFields) {
        if (formData[field]) {
          username = formData[field][0];
          break;
        }
      }
      
      // Try to find password field
      for (const field of passwordFields) {
        if (formData[field]) {
          password = formData[field][0];
          break;
        }
      }
      
      // If we found both username and password, ask user if they want to save
      if (username && password) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          const activeTab = tabs[0];
          
          // Store detected credentials temporarily
          chrome.storage.local.set({
            tempCredentials: {
              url: activeTab.url,
              title: activeTab.title,
              username: username,
              password: password
            }
          });
          
          // Show notification asking if user wants to save
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "Password Detected",
            message: "Would you like to save this password in Pentagon Password Manager?",
            buttons: [
              {title: "Save Password"},
              {title: "Ignore"}
            ]
          });
        });
      }
    });
  },
  {urls: ["<all_urls>"]},
  ["requestBody"]
);

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
  if (buttonIndex === 0) { // "Save Password" button
    // Open the extension popup
    chrome.action.openPopup();
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Handle any message passing between components
  if (request.action === "checkAuth") {
    chrome.storage.local.get(['authToken', 'tokenExpiry'], function(result) {
      const currentTime = new Date().getTime();
      const isAuthenticated = result.authToken && result.tokenExpiry && currentTime < result.tokenExpiry;
      
      sendResponse({isAuthenticated: isAuthenticated});
    });
    return true; // Required for async response
  }
});