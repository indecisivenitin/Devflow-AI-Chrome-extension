// Create context menu when extension is installed or reloaded
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ask-devflow",
    title: "Ask DevFlow",
    contexts: ["selection"] // only show when text is selected
  });
});

// Handle right-click → Ask DevFlow
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ask-devflow" && tab?.id) {

    // Save selected text
    chrome.storage.local.set({
      selectedText: info.selectionText
    });

    // Open side panel immediately (must not use await here)
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});