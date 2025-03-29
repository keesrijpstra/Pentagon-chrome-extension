document.addEventListener('submit', function(event) {
  const form = event.target;
  
  const passwordField = form.querySelector('input[type="password"]');
  if (!passwordField) return;
  
  const usernameSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[id="email"]',
    'input[name="username"]',
    'input[id="username"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]'
  ];
  
  let usernameField = null;
  for (const selector of usernameSelectors) {
    const field = form.querySelector(selector);
    if (field) {
      usernameField = field;
      break;
    }
  }
  
  if (usernameField && passwordField) {
    chrome.runtime.sendMessage({
      action: "saveDetectedCredentials",
      credentials: {
        url: window.location.href,
        title: document.title,
        username: usernameField.value,
        password: passwordField.value
      }
    });
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getCredentials") {
    const usernameField = findUsernameField();
    const passwordField = findPasswordField();
    
    const credentials = {
      username: usernameField ? usernameField.value : '',
      password: passwordField ? passwordField.value : ''
    };
    
    sendResponse(credentials);
  }
  
  else if (request.action === "fillCredentials") {
    const usernameField = findUsernameField();
    const passwordField = findPasswordField();
    
    if (usernameField && passwordField) {
      usernameField.value = request.username;
      passwordField.value = request.password;
      
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
  const selectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[id="email"]',
    'input[name="username"]',
    'input[id="username"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]'
  ];
  
  for (const selector of selectors) {
    const field = document.querySelector(selector);
    if (field) return field;
  }
  
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

function findPasswordField() {
  const passwordField = document.querySelector('input[type="password"]');
  if (passwordField) return passwordField;
  
  const selectors = [
    'input[name="password"]',
    'input[id="password"]',
    'input[autocomplete="current-password"]'
  ];
  
  for (const selector of selectors) {
    const field = docfgvvument.querySelector(selector);
    if (field) return field;
  }
  
  return null;
}

function triggerInputEvent(element) {
  const inputEvent = new Event('input', { bubbles: true });
  const changeEvent = new Event('change', { bubbles: true });
  
  element.dispatchEvent(inputEvent);
  element.dispatchEvent(changeEvent);
}