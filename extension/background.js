chrome.runtime.onInstalled.addListener(async () => {
  const { lastBackendUrl } = await chrome.storage.local.get(["lastBackendUrl"]);

  if (!lastBackendUrl) {
    await chrome.storage.local.set({
      lastBackendUrl: "http://localhost:3000",
    });
  }
});

