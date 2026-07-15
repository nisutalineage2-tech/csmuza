document.addEventListener('DOMContentLoaded', () => {
  const profitInput = document.getElementById('profitMin');
  const maxPriceInput = document.getElementById('maxPrice');
  const enabledToggle = document.getElementById('enabled');
  const saveBtn = document.getElementById('saveBtn');
  const savedMsg = document.getElementById('savedMsg');
  const openApp = document.getElementById('openApp');

  // Load saved config
  chrome.storage.local.get(['profitMin', 'maxPrice', 'enabled'], (result) => {
    if (result.profitMin) profitInput.value = result.profitMin;
    if (result.maxPrice) maxPriceInput.value = result.maxPrice;
    if (result.enabled !== undefined) enabledToggle.checked = result.enabled;
  });

  // Open main app page
  openApp.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
  });

  // Save config
  saveBtn.addEventListener('click', () => {
    const config = {
      profitMin: parseInt(profitInput.value) || 15,
      maxPrice: parseInt(maxPriceInput.value) || 50,
      enabled: enabledToggle.checked
    };

    chrome.storage.local.set(config, () => {
      savedMsg.classList.add('show');
      setTimeout(() => savedMsg.classList.remove('show'), 1500);

      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'configUpdated' }).catch(() => {});
        }
      });
    });
  });
});
