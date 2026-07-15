document.addEventListener('DOMContentLoaded', () => {
  const profitInput = document.getElementById('profitMin');
  const enabledToggle = document.getElementById('enabled');
  const saveBtn = document.getElementById('saveBtn');
  const savedMsg = document.getElementById('savedMsg');

  chrome.runtime.sendMessage({ action: 'getConfig' }, (response) => {
    if (response) {
      profitInput.value = response.profitMin;
      enabledToggle.checked = response.enabled;
    }
  });

  saveBtn.addEventListener('click', () => {
    const profitMin = parseInt(profitInput.value) || 15;
    const enabled = enabledToggle.checked;

    chrome.runtime.sendMessage({
      action: 'setConfig',
      profitMin,
      enabled
    }, () => {
      savedMsg.classList.add('show');
      setTimeout(() => savedMsg.classList.remove('show'), 1500);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'configUpdated' });
        }
      });
    });
  });
});
