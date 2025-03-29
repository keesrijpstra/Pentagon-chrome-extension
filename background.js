// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
  console.log("Pentagon Password Manager installed");
  
  // Set up alarm for token checking
  chrome.alarms.create('checkAuthToken', { periodInMinutes: 1 });
});

// Set up alarm listener for periodic token checking
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkAuthToken') {
    // Check if token has expired
    chrome.storage.local.get(['authToken', 'tokenExpiry'], function(result) {
      const currentTime = new Date().getTime();
      
      if (result.authToken && result.tokenExpiry && currentTime >= result.tokenExpiry) {
        // Token has expired, clear it
        chrome.storage.local.remove(['authToken', 'tokenExpiry', 'user_id']);
      }
    });
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "checkAuth") {
    chrome.storage.local.get(['authToken', 'tokenExpiry'], function(result) {
      const currentTime = new Date().getTime();
      const isAuthenticated = result.authToken && result.tokenExpiry && currentTime < result.tokenExpiry;
      
      sendResponse({isAuthenticated: isAuthenticated});
    });
    return true; // Required for async response
  }
  
  // New message to handle saving detected credentials
  if (request.action === "saveDetectedCredentials") {
    chrome.storage.local.set({
      tempCredentials: request.credentials
    });
    
    // Create a simple notification without buttons
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Password Detected",
      message: "Click this notification to open Pentagon Password Manager and save these credentials."
    });
  }
});

// Handle notification clicks (instead of buttons which are problematic in MV3)
chrome.notifications.onClicked.addListener(function(notificationId) {
  chrome.action.openPopup();
});