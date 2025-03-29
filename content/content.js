// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "getCredentials") {
      // Try to find username and password fields on the page
      const usernameField = findUsernameField();
      const passwordField = findPasswordField();
      
      const credentials = {
        username: usernameField ? usernameField.value : '',
        password: passwordField ? passwordField.value : ''
      };
      
      sendResponse(credentials);
    }
    
    else if (request.action === "fillCredentials") {
      // Fill in the credentials on the page
      const usernameField = findUsernameField();
      const passwordField = findPasswordField();
      
      if (usernameField && passwordField) {
        // Set values
        usernameField.value = request.username;
        passwordField.value = request.password;
        
        // Trigger input events to notify the page of changes
        triggerInputEvent(usernameField);
        triggerInputEvent(passwordField);
        
        sendResponse({success: true});
      } else {
        sendResponse({success: false, message: "Could not find username or password fields"});
      }
    }
  });
  
  /**
   * Find username field on the page
   */
  function findUsernameField() {
    // Common username field selectors
    const selectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[id="email"]',
      'input[name="username"]',
      'input[id="username"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]'
    ];
    
    // Try each selector
    for (const selector of selectors) {
      const field = document.querySelector(selector);
      if (field) return field;
    }
    
    // If no exact match, try to find input fields that might be username
    const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
    return inputs.find(input => {
      const attributes = [input.name, input.id, input.placeholder];
      return attributes.some(attr => 
        attr && 
        (attr.toLowerCase().includes('user') || 
         attr.toLowerCase().includes('email') || 
         attr.toLowerCase().includes('login'))
      );
    });
  }
  
  /**
   * Find password field on the page
   */
  function findPasswordField() {
    // Try standard password fields first
    const passwordField = document.querySelector('input[type="password"]');
    if (passwordField) return passwordField;
    
    // If no password field found, try other selectors
    const selectors = [
      'input[name="password"]',
      'input[id="password"]',
      'input[autocomplete="current-password"]'
    ];
    
    for (const selector of selectors) {
      const field = document.querySelector(selector);
      if (field) return field;
    }
    
    return null;
  }
  
  /**
   * Trigger input event on element to notify the page of changes
   */
  function triggerInputEvent(element) {
    const inputEvent = new Event('input', { bubbles: true });
    const changeEvent = new Event('change', { bubbles: true });
    
    element.dispatchEvent(inputEvent);
    element.dispatchEvent(changeEvent);
  }
  
  /**
   * Listen for form submissions to detect login attempts
   */
  document.addEventListener('submit', function(event) {
    // Check if this form has a password field
    const form = event.target;
    const passwordField = form.querySelector('input[type="password"]');
    
    if (passwordField) {
      const usernameField = findUsernameField();
      
      if (usernameField && usernameField.value && passwordField.value) {
        // Send credentials to background script
        chrome.runtime.sendMessage({
          action: "saveCredentials",
          url: window.location.href,
          username: usernameField.value,
          password: passwordField.value,
          showPopup: false
        });
      }
    }
  });