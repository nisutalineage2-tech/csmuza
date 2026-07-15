let steamPrices = {};
let profitMin = 10;
let enabled = true;

chrome.storage.local.get(['profitMin', 'enabled'], (result) => {
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
    chrome.storage.local.get(['profitMin', 'enabled'], (result) => {
      sendResponse({
        profitMin: result.profitMin || 10,
        enabled: result.enabled !== false
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
