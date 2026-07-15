(async function() {
  'use strict';

  let allResults = [];
  let steamCache = {};

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
    if (steamCache[name] && Date.now() - steamCache[name].time < 600000) {
      return steamCache[name].price;
    }

    try {
      const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(name)}`;
      const resp = await fetch(url);
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
    scanBtn.disabled = true;
    scanBtn.textContent = 'Escaneando...';
    progressContainer.style.display = 'block';
    resultsContainer.innerHTML = '<div class="loading">Cargando precios de CSFloat...</div>';

    try {
      statusText.textContent = 'Cargando precios de CSFloat...';
      progressFill.style.width = '10%';

      const priceList = await fetchCSFloatPriceList();
      const maxPriceCents = parseInt(maxPrice.value) * 100;

      const filtered = priceList.filter(item =>
        item.min_price > 50 &&
        item.min_price <= maxPriceCents &&
        item.quantity >= 2
      );

      filtered.sort((a, b) => a.min_price - b.min_price);
      const toCheck = filtered.slice(0, 100);

      statusText.textContent = `Verificando ${toCheck.length} skins en Steam...`;
      allResults = [];

      for (let i = 0; i < toCheck.length; i++) {
        const item = toCheck[i];
        const csfloatPrice = item.min_price / 100;

        progressFill.style.width = `${10 + (i / toCheck.length) * 85}%`;
        statusText.textContent = `Verificando ${i + 1}/${toCheck.length}: ${item.market_hash_name}`;

        const steamPrice = await fetchSteamPrice(item.market_hash_name);

        if (steamPrice && steamPrice > csfloatPrice) {
          const profit = steamPrice - csfloatPrice;
          const profitPercent = ((steamPrice - csfloatPrice) / csfloatPrice) * 100;

          allResults.push({
            market_name: item.market_hash_name,
            csfloat_price: csfloatPrice,
            steam_price: steamPrice,
            profit_usd: profit,
            profit_percent: profitPercent,
            quantity: item.quantity
          });
        }

        if (i % 5 === 0) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      allResults.sort((a, b) => b.profit_usd - a.profit_usd);

      progressFill.style.width = '100%';
      statusText.textContent = `Completado: ${allResults.length} skins con profit encontradas`;

      renderResults();

    } catch (e) {
      resultsContainer.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`;
      statusText.textContent = 'Error durante el escaneo';
    }

    scanBtn.disabled = false;
    scanBtn.textContent = 'Escanear CSFloat';
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
          <h3>Sin resultados</h3>
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
              <th onclick="sortTable('profit_usd')">Profit</th>
              <th onclick="sortTable('profit_percent')">% </th>
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

  profitFilter.addEventListener('change', () => localStorage.setItem('profitFilter', profitFilter.value));
  maxPrice.addEventListener('change', () => localStorage.setItem('maxPrice', maxPrice.value));
})();
