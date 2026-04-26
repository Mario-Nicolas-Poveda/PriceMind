// --- CONFIGURACIÓN ---
var currentQuery = '';
var userLocationData = {
  city: '',
  country_name: 'Colombia',
  country_code: 'CO'
};

// 1. DETECTAR UBICACIÓN
async function detectLocation() {
  try {
    const res = await fetch('/api/location');
    const data = await res.json();
    if (data.cityName) {
      userLocationData = {
          city: data.cityName,
          country_name: data.countryName,
          country_code: data.countryCode
      };
      const label = document.getElementById('userCity');
      if(label) label.textContent = data.cityName + ', ' + data.countryCode;
    }
  } catch (err) {
    console.error('Error detectando ubicación:', err);
    const label = document.getElementById('userCity');
    if(label) label.textContent = 'Ubicación local';
  }
}

function showLoader() {
  const p = document.getElementById('placeholder');
  const l = document.getElementById('loader');
  const g = document.getElementById('productsGrid');
  if(p) p.style.display = 'none';
  if(l) l.style.display = 'flex';
  if(g) g.innerHTML = '';
}

function hideLoader() {
  const l = document.getElementById('loader');
  if(l) l.style.display = 'none';
}

// 2. RENDERIZAR RESULTADOS
function renderProducts(items, query) {
  hideLoader();
  const grid = document.getElementById('productsGrid');
  const status = document.getElementById('resultsStatus');

  if (!items || items.length === 0) {
    if(grid) grid.innerHTML = `<div class="error-box"><p>No se encontraron resultados para "${query}".</p></div>`;
    if(status) status.textContent = 'Sin resultados';
    return;
  }

  const isBarcode = /^\d{8,14}$/.test(query.trim());
  let filteredItems = items;

  if (isBarcode && items.length > 0) {
    const firstTitle = items[0].title.toLowerCase();
    const keywords = firstTitle.split(' ').filter(word => word.length > 3);
    
    filteredItems = items.filter((item, index) => {
      if (index === 0) return true;
      const title = item.title.toLowerCase();
      const matches = keywords.filter(key => title.includes(key));
      return matches.length >= 2 || (keywords.length > 0 && title.includes(keywords[0]));
    });
  }

  filteredItems.sort((a, b) => (a.extracted_price || 0) - (b.extracted_price || 0));

  if(status) status.textContent = filteredItems.length + ' ofertas encontradas';
  let html = '<div class="products-grid">';

  for (let i = 0; i < filteredItems.length; i++) {
    const item = filteredItems[i];
    const title = item.title || '';
    const price = item.price || '';
    const store = item.source || 'Tienda';
    const img = item.thumbnail || '';
    const delivery = item.delivery || '';
    
    const itemData = encodeURIComponent(JSON.stringify(item));

    html += `
      <div class="product-card" onclick="openAnalytics('${itemData}')">
        <img class="product-img" src="${img}" alt="${title}" loading="lazy">
        <div class="product-info">
          <div class="product-store">${store}</div>
          <div class="product-title">${title}</div>
          <div class="product-price">${price}</div>
          ${delivery ? `<div class="product-shipping" style="color:var(--green)">${delivery}</div>` : ''}
          <div style="margin-top:10px; font-size:0.65rem; color:var(--blue-mid); font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Ver Tendencia 📈</div>
        </div>
      </div>`;
  }
  html += '</div>';
  if(grid) grid.innerHTML = html;
}

// 3. REALIZAR BÚSQUEDA
async function doSearch(query) {
  if (!query) return;
  console.log("Iniciando búsqueda para:", query);
  currentQuery = query;
  showLoader();
  const status = document.getElementById('resultsStatus');
  if(status) status.textContent = 'Analizando ofertas...';

  const locationParam = userLocationData.city ? `${userLocationData.city}, ${userLocationData.country_name}` : userLocationData.country_name;
  const targetUrl = `/api/search?q=${encodeURIComponent(query)}&location=${encodeURIComponent(locationParam)}&hl=es&gl=${userLocationData.country_code.toLowerCase()}`;

  try {
    const res = await fetch(targetUrl);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    
    if (data.shopping_results && data.shopping_results.length > 0) {
      saveToHistory(data.shopping_results[0]);
    }
    
    renderProducts(data.shopping_results || [], query);
  } catch (err) {
    console.error('Error en búsqueda:', err);
    hideLoader();
    const g = document.getElementById('productsGrid');
    if(g) g.innerHTML = `<div class="error-box"><p>Error: ${err.message}</p></div>`;
  }
}

function searchProduct() {
  const inputEl = document.getElementById('productInput');
  if(!inputEl) return;
  const q = inputEl.value.trim();
  if (!q) { inputEl.focus(); return; }
  doSearch(q);
  inputEl.value = '';
}

// --- ESCÁNER ---
let html5QrCode;
let cameras = [];
let currentCameraIndex = 0;
let tipInterval;
const scannerTips = ["Centra el código", "Acerca el celular", "Buena luz", "Mantén firme"];

function updateScannerTip() {
  const tipEl = document.getElementById('scannerTip');
  if(!tipEl) return;
  let i = 0;
  tipInterval = setInterval(() => {
    i = (i + 1) % scannerTips.length;
    tipEl.style.opacity = 0;
    setTimeout(() => { tipEl.textContent = scannerTips[i]; tipEl.style.opacity = 1; }, 300);
  }, 4000);
}

async function startScanner() {
  const mod = document.getElementById('scannerModal');
  if(mod) mod.style.display = 'flex';
  if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
  try {
    cameras = await Html5Qrcode.getCameras();
    if (cameras && cameras.length > 0) {
      const btn = document.getElementById('switchCameraBtn');
      if (cameras.length > 1 && btn) btn.style.display = 'block';
      currentCameraIndex = cameras.length - 1;
      await startWithCamera(cameras[currentCameraIndex].id);
      updateScannerTip();
    }
  } catch (err) { stopScanner(); }
}

async function startWithCamera(cameraId) {
  const config = { fps: 10, qrbox: { width: 300, height: 180 }, aspectRatio: 1.0,
    formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.UPC_A]
  };
  if (html5QrCode.isScanning) await html5QrCode.stop();
  await html5QrCode.start(cameraId, config, (decodedText) => {
    stopScanner();
    const inp = document.getElementById('productInput');
    if(inp) inp.value = decodedText;
    doSearch(decodedText);
  });
}

function stopScanner() {
  clearInterval(tipInterval);
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => { 
      const mod = document.getElementById('scannerModal');
      if(mod) mod.style.display = 'none'; 
    });
  } else { 
    const mod = document.getElementById('scannerModal');
    if(mod) mod.style.display = 'none'; 
  }
}

// --- ANALÍTICA ---
function openAnalytics(encodedData) {
  const product = JSON.parse(decodeURIComponent(encodedData));
  const modal = document.getElementById('analyticsModal');
  if(!modal) return;

  const im = document.getElementById('anaImg');
  const ti = document.getElementById('anaTitle');
  const pr = document.getElementById('anaPrice');
  if(im) im.src = product.thumbnail;
  if(ti) ti.textContent = product.title;
  if(pr) pr.textContent = product.price;

  const currentPrice = product.extracted_price || 100000;
  const minP = document.getElementById('minPrice');
  const avgP = document.getElementById('avgPrice');
  if(minP) minP.textContent = formatPrice(currentPrice * 0.82);
  if(avgP) avgP.textContent = formatPrice(currentPrice * 1.08);

  updateChart();
  modal.style.display = 'flex';
}

function closeAnalytics() {
  const modal = document.getElementById('analyticsModal');
  if(modal) modal.style.display = 'none';
}

function updateChart() {
  const container = document.getElementById('chartBars');
  if(!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const height = Math.floor(Math.random() * 75) + 20;
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.style.height = height + '%';
    const simPrice = Math.floor(Math.random() * 50000) + 100000;
    bar.setAttribute('data-val', '$' + (simPrice/1000).toFixed(1) + 'k');
    container.appendChild(bar);
  }
}

function formatPrice(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
}

// --- RECOMENDACIONES ---
function saveToHistory(product) {
  const historyData = {
    name: product.title,
    price: product.price,
    extracted_price: product.extracted_price,
    image: product.thumbnail,
    timestamp: Date.now()
  };
  localStorage.setItem('lastSearch', JSON.stringify(historyData));
}

function loadRecommendations() {
  const lastSearch = localStorage.getItem('lastSearch');
  if (!lastSearch) return;
  const data = JSON.parse(lastSearch);
  const recoSection = document.getElementById('recoSection');
  const recoCard = document.getElementById('recoCard');
  if(!recoSection || !recoCard) return;

  const discount = 0.12;
  const newPriceValue = Math.floor((data.extracted_price || 100000) * (1 - discount));
  const newPriceFormatted = formatPrice(newPriceValue);

  recoCard.innerHTML = `
    <img src="${data.image}" class="reco-img" alt="${data.name}">
    <div class="reco-info">
      <div class="reco-name">${data.name}</div>
      <div class="reco-price-row">
        <span class="reco-new-price">${newPriceFormatted}</span>
        <span class="reco-old-price">${data.price}</span>
        <span class="reco-save-label">¡Baja de precio!</span>
      </div>
    </div>
    <button class="btn btn-primary" onclick="doSearch('${data.name.replace(/'/g, "\\'")}')" style="width:auto; padding: 0.5rem 1rem; font-size: 0.75rem;">Ver Oferta</button>
  `;
  recoSection.style.display = 'block';
}

// Event Listeners Globales
window.addEventListener('DOMContentLoaded', () => {
  console.log("PriceMind Cargado Correctamente");
  detectLocation();
  loadRecommendations();
  
  const camBtn = document.getElementById('cameraStartBtn');
  const closeCam = document.getElementById('closeScanner');
  const switchCam = document.getElementById('switchCameraBtn');
  const searchBtn = document.getElementById('btnProduct');
  const inputEl = document.getElementById('productInput');

  if(camBtn) camBtn.addEventListener('click', startScanner);
  if(closeCam) closeCam.addEventListener('click', stopScanner);
  if(switchCam) switchCam.addEventListener('click', switchCamera);
  if(searchBtn) searchBtn.addEventListener('click', searchProduct);
  if(inputEl) inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchProduct(); });

  // Chips de sugerencia
  document.querySelectorAll('.tip-chip').forEach(chip => {
    chip.addEventListener('click', function() {
      const term = this.textContent;
      if(inputEl) inputEl.value = term;
      doSearch(term);
    });
  });
});
