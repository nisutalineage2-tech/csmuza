(async function() {
  'use strict';

  let allResults = [];
  let steamCache = {};
  let scanning = false;

  const $ = (sel) => document.querySelector(sel);
  const scanBtn = $('#scanBtn');
  const profitFilter = $('#profitFilter');
  const maxPrice = $('#maxPrice');
  const progressContainer = $('#progressContainer');
  const statusText = $('#statusText');
  const progressFill = $('#progressFill');
  const resultsContainer = $('#resultsContainer');

  scanBtn.addEventListener('click', startScan);
  profitFilter.addEventListener('change', applyFilters);
  maxPrice.addEventListener('change', applyFilters);

  async function fetchCSFloatPriceList() {
    const resp = await fetch('https://csfloat.com/api/v1/listings/price-list');
    if (!resp.ok) throw new Error(`CSFloat error: ${resp.status}`);
    return await resp.json();
  }

  async function fetchSteamPrice(name) {
    if (steamCache[name] && Date.now() - steamCache[name].time < 1800000) {
      return steamCache[name].price;
    }

    try {
      const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(name)}`;
      const resp = await fetch(url);

      if (resp.status === 429) {
        await new Promise(r => setTimeout(r, 10000));
        return null;
      }

      const data = await resp.json();

      let price = null;
      if (data.lowest_price) {
        price = parseFloat(data.lowest_price.replace('$', '').replace(',', '.'));
      } else if (data.median_price) {
        price = parseFloat(data.median_price.replace('$', '').replace(',', '.'));
      }

      if (price) {
        steamCache[name] = { price, time: Date.now() };
      }
      return price;
    } catch (e) {
      return null;
    }
  }

  async function startScan() {
    if (scanning) return;
    scanning = true;

    scanBtn.disabled = true;
    scanBtn.textContent = 'Escaneando...';
    progressContainer.style.display = 'block';
    resultsContainer.innerHTML = '<div class="loading">Cargando precios de CSFloat...</div>';

    try {
      statusText.textContent = 'Cargando lista de precios de CSFloat...';
      progressFill.style.width = '5%';

      const priceList = await fetchCSFloatPriceList();
      const maxPriceCents = parseInt(maxPrice.value) * 100;

      const candidates = priceList.filter(item =>
        item.min_price > 10 &&
        item.min_price <= maxPriceCents &&
        item.quantity >= 1
      );

      candidates.sort((a, b) => {
        const scoreA = (a.quantity || 1) * (1 / (a.min_price || 1));
        const scoreB = (b.quantity || 1) * (1 / (b.min_price || 1));
        return scoreB - scoreA;
      });

      const BATCH_SIZE = 10;
      const STEAM_DELAY = 1800;
      const MAX_ITEMS = Math.min(candidates.length, 500);

      statusText.textContent = `Verificando ${MAX_ITEMS} skins en Steam (lotes de ${BATCH_SIZE})...`;
      allResults = [];

      for (let i = 0; i < MAX_ITEMS; i += BATCH_SIZE) {
        if (!scanning) break;

        const batch = candidates.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(MAX_ITEMS / BATCH_SIZE);

        const progress = 5 + (i / MAX_ITEMS) * 90;
        progressFill.style.width = `${progress}%`;
        statusText.textContent = `Lote ${batchNum}/${totalBatches} | Verificando ${batch.length} skins...`;

        const promises = batch.map(async (item) => {
          const csfloatPrice = item.min_price / 100;
          const steamPrice = await fetchSteamPrice(item.market_hash_name);

          if (steamPrice && steamPrice > csfloatPrice) {
            const profit = steamPrice - csfloatPrice;
            const profitPercent = ((steamPrice - csfloatPrice) / csfloatPrice) * 100;

            return {
              market_name: item.market_hash_name,
              csfloat_price: csfloatPrice,
              steam_price: steamPrice,
              profit_usd: profit,
              profit_percent: profitPercent,
              quantity: item.quantity
            };
          }
          return null;
        });

        const batchResults = await Promise.all(promises);
        batchResults.filter(Boolean).forEach(r => allResults.push(r));

        allResults.sort((a, b) => b.profit_usd - a.profit_usd);
        renderResults();

        await new Promise(r => setTimeout(r, STEAM_DELAY));
      }

      allResults.sort((a, b) => b.profit_usd - a.profit_usd);

      progressFill.style.width = '100%';
      statusText.textContent = `Completado: ${allResults.length} skins con profit de ${MAX_ITEMS} verificadas`;

      renderResults();

    } catch (e) {
      resultsContainer.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`;
      statusText.textContent = 'Error durante el escaneo';
    }

    scanBtn.disabled = false;
    scanBtn.textContent = 'Escanear CSFloat';
    scanning = false;
  }

  function applyFilters() {
    renderResults();
  }

  function renderResults() {
    const minProfit = parseInt(profitFilter.value) || 10;

    const filtered = allResults.filter(r => r.profit_percent >= minProfit);

    $('#totalCount').textContent = allResults.length;
    $('#profitCount').textContent = filtered.length;

    if (filtered.length === 0) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <h3>Sin resultados aun</h3>
          <p>Haz clic en "Escanear CSFloat" para buscar oportunidades</p>
        </div>
      `;
      $('#avgProfit').textContent = '$0';
      $('#maxProfit').textContent = '$0';
      return;
    }

    const profits = filtered.map(r => r.profit_usd);
    const avg = profits.reduce((a, b) => a + b, 0) / profits.length;
    const max = Math.max(...profits);

    $('#avgProfit').textContent = `$${avg.toFixed(2)}`;
    $('#maxProfit').textContent = `$${max.toFixed(2)}`;

    let html = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th onclick="sortTable('market_name')">Skin</th>
              <th onclick="sortTable('csfloat_price')">CSFloat</th>
              <th onclick="sortTable('steam_price')">Steam</th>
              <th onclick="sortTable('profit_usd')">Profit $</th>
              <th onclick="sortTable('profit_percent')">Profit %</th>
              <th onclick="sortTable('quantity')">Stock</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
    `;

    filtered.forEach(r => {
      const profitClass = r.profit_percent >= 30 ? 'profit-high' : 'profit-positive';
      html += `
        <tr>
          <td class="skin-name">${r.market_name}</td>
          <td class="price-csfloat">$${r.csfloat_price.toFixed(2)}</td>
          <td class="price-steam">$${r.steam_price.toFixed(2)}</td>
          <td class="${profitClass}">+$${r.profit_usd.toFixed(2)}</td>
          <td class="${profitClass}">${r.profit_percent.toFixed(0)}%</td>
          <td class="qty">${r.quantity}</td>
          <td>
            <a href="https://csfloat.com/search?market_hash_name=${encodeURIComponent(r.market_name)}"
               target="_blank" class="action-link">Ver →</a>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    resultsContainer.innerHTML = html;
  }

  window.sortTable = function(key) {
    allResults.sort((a, b) => {
      if (typeof a[key] === 'string') return a[key].localeCompare(b[key]);
      return b[key] - a[key];
    });
    renderResults();
  };

  const savedMinProfit = localStorage.getItem('profitFilter');
  const savedMaxPrice = localStorage.getItem('maxPrice');
  if (savedMinProfit) profitFilter.value = savedMinProfit;
  if (savedMaxPrice) maxPrice.value = savedMaxPrice;

  profitFilter.addEventListener('change', () => {
    localStorage.setItem('profitFilter', profitFilter.value);
    applyFilters();
  });
  maxPrice.addEventListener('change', () => {
    localStorage.setItem('maxPrice', maxPrice.value);
  });

  startScan();
})();
