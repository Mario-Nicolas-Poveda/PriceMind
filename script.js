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
      document.getElementById('userCity').textContent = data.cityName + ', ' + data.countryCode;
    }
  } catch (err) {
    console.error('Error detectando ubicación:', err);
    document.getElementById('userCity').textContent = 'Ubicación local';
  }
}

function showLoader() {
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('loader').style.display = 'flex';
  document.getElementById('productsGrid').innerHTML = '';
}

function hideLoader() {
  document.getElementById('loader').style.display = 'none';
}

// 2. RENDERIZAR RESULTADOS
function renderProducts(items, query) {
  hideLoader();
  var grid = document.getElementById('productsGrid');
  var status = document.getElementById('resultsStatus');

  if (!items || items.length === 0) {
    grid.innerHTML = `<div class="error-box"><p>No se encontraron resultados para "${query}".</p></div>`;
    status.textContent = 'Sin resultados';
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

  status.textContent = filteredItems.length + ' ofertas encontradas';
  var html = '<div class="products-grid">';

  for (var i = 0; i < filteredItems.length; i++) {
    var item = filteredItems[i];
    var title = item.title || '';
    var price = item.price || '';
    var store = item.source || 'Tienda';
    var img = item.thumbnail || '';
    var delivery = item.delivery || '';
    
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
  grid.innerHTML = html;
}

// 3. REALIZAR BÚSQUEDA
async function doSearch(query) {
  if (!query) return;
  currentQuery = query;
  showLoader();
  document.getElementById('resultsStatus').textContent = 'Analizando ofertas...';

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
    document.getElementById('productsGrid').innerHTML = `<div class="error-box"><p>Error: ${err.message}</p></div>`;
  }
}

function searchProduct() {
  var inputEl = document.getElementById('productInput');
  var q = inputEl.value.trim();
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
  let i = 0;
  tipInterval = setInterval(() => {
    i = (i + 1) % scannerTips.length;
    tipEl.style.opacity = 0;
    setTimeout(() => { tipEl.textContent = scannerTips[i]; tipEl.style.opacity = 1; }, 300);
  }, 4000);
}

async function startScanner() {
  document.getElementById('scannerModal').style.display = 'flex';
  if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
  try {
    cameras = await Html5Qrcode.getCameras();
    if (cameras && cameras.length > 0) {
      if (cameras.length > 1) document.getElementById('switchCameraBtn').style.display = 'block';
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
    document.getElementById('productInput').value = decodedText;
    doSearch(decodedText);
  });
}

function stopScanner() {
  clearInterval(tipInterval);
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => { document.getElementById('scannerModal').style.display = 'none'; });
  } else { document.getElementById('scannerModal').style.display = 'none'; }
}

// --- ANALÍTICA ---
function openAnalytics(encodedData) {
  const product = JSON.parse(decodeURIComponent(encodedData));
  const modal = document.getElementById('analyticsModal');
  document.getElementById('anaImg').src = product.thumbnail;
  document.getElementById('anaTitle').textContent = product.title;
  document.getElementById('anaPrice').textContent = product.price;

  const currentPrice = product.extracted_price || 100000;
  document.getElementById('minPrice').textContent = formatPrice(currentPrice * 0.82);
  document.getElementById('avgPrice').textContent = formatPrice(currentPrice * 1.08);

  updateChart();
  modal.style.display = 'flex';
}

function closeAnalytics() {
  document.getElementById('analyticsModal').style.display = 'none';
}

function updateChart() {
  const container = document.getElementById('chartBars');
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
    <button class="btn btn-primary" onclick="doSearch('${data.name}')" style="width:auto; padding: 0.5rem 1rem; font-size: 0.75rem;">Ver Oferta</button>
  `;
  recoSection.style.display = 'block';
}

// Event Listeners Globales
window.addEventListener('DOMContentLoaded', () => {
  detectLocation();
  loadRecommendations();
  
  document.getElementById('cameraStartBtn').addEventListener('click', startScanner);
  document.getElementById('closeScanner').addEventListener('click', stopScanner);
  document.getElementById('btnProduct').addEventListener('click', searchProduct);
  document.getElementById('productInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchProduct(); });
});
