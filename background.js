// Background service worker for LinkedIn Roaster extension

// Open sidepanel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for messages from content script and sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PROFILE_DATA') {
    // Forward profile data to sidepanel
    chrome.runtime.sendMessage({
      type: 'PROFILE_DATA_RECEIVED',
      data: request.data,
      url: request.url
    }).catch(() => {
      // Sidepanel might not be open, store data for later
      chrome.storage.local.set({
        lastProfileData: request.data,
        lastProfileUrl: request.url
      });
    });
    sendResponse({ success: true });
  } else if (request.type === 'GET_PROFILE_DATA') {
    // Request profile data from active tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.url && activeTab.url.match(PROFILE_REGEX)) {
        try {
          // Try sending message first
          const response = await chrome.tabs.sendMessage(activeTab.id, { type: 'EXTRACT_PROFILE' });
          sendResponse(response);
        } catch (err) {
          console.log('Content script not found, attempting to inject...', err);
          // Fallback: Inject the script dynamically
          try {
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ['content.js']
            });
            // Wait a tiny bit for initialization
            setTimeout(async () => {
              try {
                const response = await chrome.tabs.sendMessage(activeTab.id, { type: 'EXTRACT_PROFILE' });
                sendResponse(response);
              } catch (retryErr) {
                sendResponse({ error: 'Failed to extract profile data even after injection. Please refresh.' });
              }
            }, 100);
          } catch (injectErr) {
            console.error('Injection failed:', injectErr);
            sendResponse({ error: 'Could not connect to LinkedIn page. Please refresh.' });
          }
        }
      } else {
        sendResponse({ error: 'Not a LinkedIn profile page' });
      }
    });
    return true; // Keep channel open for async response
  } else if (request.type === 'OPEN_AUTH') {
    // Handle Supabase auth in a new tab
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true;
  } else if (request.type === 'CAPTURE_SCREENSHOT') {
    // Take a screenshot of the visible area
    chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl: dataUrl });
      }
    });
    return true;
  }
});

// Profile Regex helper
const PROFILE_REGEX = /^https:\/\/www\.linkedin\.com\/in\/[^\/\?#]+[\/\?#]?.*$/;

// Monitor tab updates to detect LinkedIn profile pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    if (tab.url && tab.url.match(PROFILE_REGEX)) {
      // Notify sidepanel that we're on a valid LinkedIn profile
      chrome.runtime.sendMessage({
        type: 'VALID_PROFILE_PAGE',
        url: tab.url
      }).catch(() => { });
    } else {
      // Notify sidepanel to hide the card
      chrome.runtime.sendMessage({
        type: 'NOT_PROFILE_PAGE'
      }).catch(() => { });
    }
  }
});

// Monitor tab activation (switching between tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab?.url && tab.url.match(PROFILE_REGEX)) {
      chrome.runtime.sendMessage({
        type: 'VALID_PROFILE_PAGE',
        url: tab.url
      }).catch(() => { });
    } else {
      chrome.runtime.sendMessage({
        type: 'NOT_PROFILE_PAGE'
      }).catch(() => { });
    }
  });
});

console.log('LinkedIn Roaster background service worker loaded');
