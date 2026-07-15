let steamPrices = {};
let profitMin = 10;
let enabled = true;

const GITHUB_MANIFEST = 'https://raw.githubusercontent.com/nisutalineage2-tech/csmuza/main/manifest.json';
const CHECK_INTERVAL = 3600000;

chrome.storage.local.get(['profitMin', 'enabled', 'lastVersion'], (result) => {
  profitMin = result.profitMin || 10;
  enabled = result.enabled !== false;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSteamPrice') {
    fetchSteamPrice(request.marketName).then(price => {
      sendResponse({ price });
    });
    return true;
  }

  if (request.action === 'getConfig') {
    chrome.storage.local.get(['profitMin', 'enabled', 'lastVersion', 'updateAvailable'], (result) => {
      sendResponse({
        profitMin: result.profitMin || 10,
        enabled: result.enabled !== false,
        lastVersion: result.lastVersion || chrome.runtime.getManifest().version,
        updateAvailable: result.updateAvailable || false
      });
    });
    return true;
  }

  if (request.action === 'setConfig') {
    profitMin = request.profitMin;
    enabled = request.enabled;
    chrome.storage.local.set({ profitMin, enabled });
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'checkUpdate') {
    checkForUpdate().then(result => sendResponse(result));
    return true;
  }

  if (request.action === 'dismissUpdate') {
    chrome.storage.local.set({ updateAvailable: false });
    sendResponse({ ok: true });
    return true;
  }
});

async function fetchSteamPrice(marketName) {
  if (steamPrices[marketName] && Date.now() - steamPrices[marketName].time < 300000) {
    return steamPrices[marketName].price;
  }

  try {
    const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(marketName)}`;
    const response = await fetch(url);
    const data = await response.json();

    let price = null;
    if (data.lowest_price) {
      price = parseFloat(data.lowest_price.replace('$', '').replace(',', '.'));
    } else if (data.median_price) {
      price = parseFloat(data.median_price.replace('$', '').replace(',', '.'));
    }

    if (price) {
      steamPrices[marketName] = { price, time: Date.now() };
    }

    return price;
  } catch (e) {
    return null;
  }
}

async function checkForUpdate() {
  try {
    const currentVersion = chrome.runtime.getManifest().version;
    const resp = await fetch(GITHUB_MANIFEST + '?t=' + Date.now());
    const remoteManifest = await resp.json();
    const remoteVersion = remoteManifest.version;

    const currentParts = currentVersion.split('.').map(Number);
    const remoteParts = remoteVersion.split('.').map(Number);

    let isNewer = false;
    for (let i = 0; i < 3; i++) {
      if ((remoteParts[i] || 0) > (currentParts[i] || 0)) {
        isNewer = true;
        break;
      }
      if ((remoteParts[i] || 0) < (currentParts[i] || 0)) {
        break;
      }
    }

    if (isNewer) {
      chrome.storage.local.set({
        updateAvailable: true,
        remoteVersion: remoteVersion
      });

      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });

      return { available: true, current: currentVersion, remote: remoteVersion };
    }

    chrome.storage.local.set({ updateAvailable: false });
    chrome.action.setBadgeText({ text: '' });

    return { available: false, current: currentVersion, remote: remoteVersion };
  } catch (e) {
    return { available: false, error: e.message };
  }
}

chrome.alarms.create('checkUpdate', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkUpdate') {
    checkForUpdate();
  }
});

checkForUpdate();
