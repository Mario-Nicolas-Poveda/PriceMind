// --- CONFIGURACIÓN ---
var currentQuery = '';
var userLocationData = { city: '', country_name: 'Colombia', country_code: 'CO' };

// PRODUCTOS ELEGIDOS PARA LLENAR ESPACIOS (Simulación)
const MOCK_PRODUCTS = [
  { title: "Apple iPhone 15 Pro Max 256GB", price: "$ 5.499.000", extracted_price: 5499000, thumbnail: "https://images.unsplash.com/photo-1696446701796-da61225697cc?w=400&h=400&fit=crop", source: "Mercado Libre" },
  { title: "Sony PlayStation 5 Slim 1TB", price: "$ 2.450.000", extracted_price: 2450000, thumbnail: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=400&fit=crop", source: "Amazon" },
  { title: "AirPods Pro (2.ª generación)", price: "$ 980.000", extracted_price: 980000, thumbnail: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop", source: "Éxito" },
  { title: "Samsung Galaxy S24 Ultra", price: "$ 4.890.000", extracted_price: 4890000, thumbnail: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&h=400&fit=crop", source: "Alkosto" },
  { title: "Monitor Gamer Odyssey G5 27\"", price: "$ 1.150.000", extracted_price: 1150000, thumbnail: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=400&fit=crop", source: "Mercado Libre" },
  { title: "Cafetera Nespresso Vertuo Pop", price: "$ 450.000", extracted_price: 450000, thumbnail: "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400&h=400&fit=crop", source: "Falabella" },
  { title: "Nintendo Switch OLED Model", price: "$ 1.650.000", extracted_price: 1650000, thumbnail: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=400&h=400&fit=crop", source: "Amazon" },
  { title: "iPad Air M2 12.9\"", price: "$ 3.200.000", extracted_price: 3200000, thumbnail: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=400&fit=crop", source: "Mercado Libre" },
  { title: "Apple Watch Series 9", price: "$ 1.850.000", extracted_price: 1850000, thumbnail: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&h=400&fit=crop", source: "Éxito" },
  { title: "MacBook Air M3 13\"", price: "$ 5.800.000", extracted_price: 5800000, thumbnail: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop", source: "Falabella" }
];

// 1. DETECTAR UBICACIÓN
async function detectLocation() {
  try {
    const res = await fetch('/api/location');
    const data = await res.json();
    if (data.cityName) {
      userLocationData = { city: data.cityName, country_name: data.countryName, country_code: data.countryCode };
      const label = document.getElementById('userCity');
      if(label) label.textContent = data.cityName + ', ' + data.countryCode;
    }
  } catch (err) {
    const label = document.getElementById('userCity');
    if(label) label.textContent = 'Colombia, CO';
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
  if(!grid) return;

  if (!items || items.length === 0) {
    grid.innerHTML = `<div class="error-box"><p>No se encontraron resultados para "${query}".</p></div>`;
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

  grid.innerHTML = '<div class="products-grid">' + filteredItems.map(item => createProductCard(item)).join('') + '</div>';
  window.scrollTo({ top: grid.offsetTop - 100, behavior: 'smooth' });
}

function createProductCard(item) {
  const itemData = encodeURIComponent(JSON.stringify(item));
  const delivery = item.delivery || '';
  return `
    <div class="product-card" onclick="openAnalytics('${itemData}')">
      <img class="product-img" src="${item.thumbnail}" alt="${item.title}" loading="lazy">
      <div class="product-info">
        <div class="product-store">${item.source || 'Tienda'}</div>
        <div class="product-title">${item.title}</div>
        <div class="product-price">${item.price}</div>
        ${delivery ? `<div class="product-shipping" style="color:var(--green)">${delivery}</div>` : ''}
        <div style="margin-top:10px; font-size:0.65rem; color:var(--blue-mid); font-weight:700; text-transform:uppercase;">Ver Tendencia 📈</div>
      </div>
    </div>`;
}

// 3. REALIZAR BÚSQUEDA
async function doSearch(query) {
  if (!query) return;
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
    hideLoader();
    const g = document.getElementById('productsGrid');
    if(g) g.innerHTML = `<div class="error-box"><p>Error: ${err.message}</p></div>`;
  }
}

function searchProduct() {
  const inputEl = document.getElementById('productInput');
  const q = inputEl ? inputEl.value.trim() : '';
  if (!q) { inputEl.focus(); return; }
  doSearch(q);
  inputEl.value = '';
}

// --- ESCÁNER --- (Simplificado para brevedad)
let html5QrCode;
async function startScanner() {
  document.getElementById('scannerModal').style.display = 'flex';
  if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (cameras && cameras.length > 0) {
      await html5QrCode.start(cameras[cameras.length-1].id, { fps: 10, qrbox: { width: 300, height: 180 } }, (text) => {
        stopScanner();
        document.getElementById('productInput').value = text;
        doSearch(text);
      });
    }
  } catch (e) { stopScanner(); }
}
function stopScanner() { 
  if(html5QrCode) html5QrCode.stop().finally(() => document.getElementById('scannerModal').style.display = 'none');
}

// --- ANALÍTICA ---
function openAnalytics(encodedData) {
  const product = JSON.parse(decodeURIComponent(encodedData));
  const modal = document.getElementById('analyticsModal');
  if(!modal) return;
  document.getElementById('anaImg').src = product.thumbnail;
  document.getElementById('anaTitle').textContent = product.title;
  document.getElementById('anaPrice').textContent = product.price;

  const currentPrice = product.extracted_price || 100000;
  document.getElementById('minPrice').textContent = formatPrice(currentPrice * 0.82);
  document.getElementById('avgPrice').textContent = formatPrice(currentPrice * 1.08);
  updateChart();
  modal.style.display = 'flex';
}
function closeAnalytics() { document.getElementById('analyticsModal').style.display = 'none'; }
function updateChart() {
  const c = document.getElementById('chartBars');
  if(!c) return;
  c.innerHTML = Array(12).fill(0).map(() => {
    const h = Math.floor(Math.random() * 75) + 20;
    const v = '$' + (Math.floor(Math.random()*50)+100) + 'k';
    return `<div class="chart-bar" style="height:${h}%" data-val="${v}"></div>`;
  }).join('');
}
function formatPrice(v) { return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(v); }

// --- PERSISTENCIA Y RECOMENDACIONES (FEED) ---
function saveToHistory(product) {
  let hist = JSON.parse(localStorage.getItem('searchHistory') || '[]');
  // Unificamos a 'thumbnail' para que coincida con MOCK_PRODUCTS
  const historyItem = {
    title: product.title,
    price: product.price,
    extracted_price: product.extracted_price,
    thumbnail: product.thumbnail,
    source: product.source,
    timestamp: Date.now()
  };
  hist = [historyItem, ...hist.filter(p => p.title !== product.title)].slice(0, 6);
  localStorage.setItem('searchHistory', JSON.stringify(hist));
}

function populateFeed() {
  // 1. Llenar Sugerencias (3 tarjetas)
  const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
  // Combinamos historial real con productos mock si falta espacio
  const recoItems = [...history, ...MOCK_PRODUCTS].slice(0, 3);
  const recoGrid = document.getElementById('recoGrid');
  
  if(recoGrid) {
    recoGrid.innerHTML = recoItems.map(item => {
      const discount = 0.12;
      const newPriceFormatted = formatPrice((item.extracted_price || 100000) * (1 - discount));
      const recoCard = document.createElement('div');
      recoCard.className = 'reco-card';
      recoCard.style.display = 'flex';
      recoCard.style.flexDirection = 'row';
      recoCard.innerHTML = `
        <img src="${item.thumbnail || item.image || ''}" class="reco-img" alt="${item.title}">
        <div class="reco-info">
          <div class="reco-name">${item.title}</div>
          <div class="reco-price-row">
            <span class="reco-new-price">${newPriceFormatted}</span>
            <span class="reco-old-price">${item.price}</span>
            <span class="reco-save-label">¡Baja de precio!</span>
          </div>
        </div>
      `;
      // Quitamos el botón de adentro para que toda la tarjeta sea el botón (más limpio)
      return recoCard.outerHTML;
    }).join('');
    document.getElementById('recoSection').style.display = 'block';
  }

  // 2. Llenar "Quizás te interese" (Productos Aleatorios)
  const discGrid = document.getElementById('discoveryGrid');
  if(discGrid) {
    const shuffled = [...MOCK_PRODUCTS].sort(() => 0.5 - Math.random());
    discGrid.innerHTML = shuffled.map(item => createProductCard(item)).join('');
  }
}

// INICIALIZACIÓN
window.addEventListener('DOMContentLoaded', () => {
  detectLocation();
  populateFeed();
  
  const bS = document.getElementById('btnProduct');
  if(bS) bS.addEventListener('click', searchProduct);
  const iS = document.getElementById('productInput');
  if(iS) iS.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchProduct(); });
  const cS = document.getElementById('cameraStartBtn');
  if(cS) cS.addEventListener('click', startScanner);
  const clS = document.getElementById('closeScanner');
  if(clS) clS.addEventListener('click', stopScanner);
  const swS = document.getElementById('switchCameraBtn');
  if(swS) swS.addEventListener('click', () => {
     // Lógica simple de cambio si hay varias cámaras
     console.log("Cambiando lente...");
  });
  
  document.querySelectorAll('.tip-chip').forEach(c => c.addEventListener('click', () => {
    if(iS) iS.value = c.textContent;
    doSearch(c.textContent);
  }));
});
function updateChart() {
  const c = document.getElementById('chartBars');
  if(!c) return;
  c.innerHTML = Array(12).fill(0).map(() => {
    const h = Math.floor(Math.random() * 75) + 20;
    const v = '$' + (Math.floor(Math.random()*50)+100) + 'k';
    return `<div class="chart-bar" style="height:${h}%" data-val="${v}"></div>`;
  }).join('');
}
