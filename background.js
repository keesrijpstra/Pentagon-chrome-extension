chrome.runtime.onInstalled.addListener(function() {
  console.log("Pentagon Password Manager installed");
  
  chrome.alarms.create('checkAuthToken', { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkAuthToken') {
    chrome.storage.local.get(['authToken', 'tokenExpiry'], function(result) {
      const currentTime = new Date().getTime();
      
      if (result.authToken && result.tokenExpiry && currentTime >= result.tokenExpiry) {
        chrome.storage.local.remove(['authToken', 'tokenExpiry', 'user_id']);
      }
    });
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "checkAuth") {
    chrome.storage.local.get(['authToken', 'tokenExpiry'], function(result) {
      const currentTime = new Date().getTime();
      const isAuthenticated = result.authToken && result.tokenExpiry && currentTime < result.tokenExpiry;
      
      sendResponse({isAuthenticated: isAuthenticated});
    });
    return true;
  }
  
  if (request.action === "saveDetectedCredentials") {
    chrome.storage.local.set({
      tempCredentials: request.credentials
    });
    
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Password Detected",
      message: "Click this notification to open Pentagon Password Manager and save these credentials."
    });
  }
});

chrome.notifications.onClicked.addListener(function(notificationId) {
  chrome.action.openPopup();
});