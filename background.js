// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
    console.log("Filament Password Manager installed");
  });
  
  // Listen for messages from content scripts or popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "saveCredentials") {
      // Store credentials temporarily
      chrome.storage.local.set({
        tempCredentials: {
          url: request.url,
          username: request.username,
          password: request.password
        }
      }, function() {
        // Optionally open the popup to save these credentials
        if (request.showPopup) {
          chrome.action.openPopup();
        }
        sendResponse({success: true});
      });
      return true; // Required for async response
    }
    
    // Handle other message types if needed
  });
  
  // Optional: Listen for form submissions
  chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
      // Only care about form submissions
      if (details.method !== "POST") return;
      
      // Check if this is a login form (you may need to refine this logic)
      if (details.type === "main_frame" && details.requestBody && details.requestBody.formData) {
        const formData = details.requestBody.formData;
        
        // Look for common username/password field names
        const usernameFields = ["username", "email", "user", "login"];
        const passwordFields = ["password", "pass", "pwd"];
        
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
        
        // If we found both username and password, store them
        if (username && password) {
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const activeTab = tabs[0];
            
            chrome.storage.local.set({
              tempCredentials: {
                url: activeTab.url,
                username: username,
                password: password
              }
            });
            
            // Show notification that credentials were detected
            chrome.notifications.create({
              type: "basic",
              iconUrl: "icons/icon48.png",
              title: "Password Detected",
              message: "Would you like to save this password in Filament Password Manager?",
              buttons: [
                {title: "Save Password"},
                {title: "Ignore"}
              ]
            });
          });
        }
      }
    },
    {urls: ["<all_urls>"]},
    ["requestBody"]
  );