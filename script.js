// --- CONFIGURACIÓN ---
var currentQuery = '';
var userLocationData = { city: '', country_name: 'Colombia', country_code: 'CO' };

const MOCK_PRODUCTS = [
  { title: "Apple iPhone 15 Pro Max 256GB", price: "$ 5.499.000", extracted_price: 5499000, thumbnail: "https://images.unsplash.com/photo-1696446701796-da61225697cc?w=400&h=400&fit=crop", source: "Mercado Libre", link: "https://www.mercadolibre.com.co" },
  { title: "Sony PlayStation 5 Slim 1TB", price: "$ 2.450.000", extracted_price: 2450000, thumbnail: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=400&fit=crop", source: "Amazon", link: "https://www.amazon.com" },
  { title: "AirPods Pro (2.ª generación)", price: "$ 980.000", extracted_price: 980000, thumbnail: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop", source: "Éxito", link: "https://www.exito.com" },
  { title: "Samsung Galaxy S24 Ultra", price: "$ 4.890.000", extracted_price: 4890000, thumbnail: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&h=400&fit=crop", source: "Alkosto", link: "https://www.alkosto.com" },
  { title: "Monitor Gamer Odyssey G5 27\"", price: "$ 1.150.000", extracted_price: 1150000, thumbnail: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=400&fit=crop", source: "Mercado Libre", link: "https://www.mercadolibre.com.co" },
  { title: "Cafetera Nespresso Vertuo Pop", price: "$ 450.000", extracted_price: 450000, thumbnail: "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400&h=400&fit=crop", source: "Falabella", link: "https://www.falabella.com.co" },
  { title: "Nintendo Switch OLED Model", price: "$ 1.650.000", extracted_price: 1650000, thumbnail: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=400&h=400&fit=crop", source: "Amazon", link: "https://www.amazon.com" },
  { title: "iPad Air M2 12.9\"", price: "$ 3.200.000", extracted_price: 3200000, thumbnail: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=400&fit=crop", source: "Mercado Libre", link: "https://www.mercadolibre.com.co" },
  { title: "Apple Watch Series 9", price: "$ 1.850.000", extracted_price: 1850000, thumbnail: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&h=400&fit=crop", source: "Éxito", link: "https://www.exito.com" },
  { title: "MacBook Air M3 13\"", price: "$ 5.800.000", extracted_price: 5800000, thumbnail: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop", source: "Falabella", link: "https://www.falabella.com.co" }
];

async function detectLocation() {
  try {
    const res = await fetch('/api/location');
    const data = await res.json();
    if (data.cityName) {
      userLocationData = { city: data.cityName, country_name: data.countryName, country_code: data.countryCode };
      if(document.getElementById('userCity')) document.getElementById('userCity').textContent = `${data.cityName}, ${data.countryCode}`;
    }
  } catch (e) { console.log("Error detectando ubicación"); }
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

function renderProducts(items, query) {
  hideLoader();
  const grid = document.getElementById('productsGrid');
  const status = document.getElementById('resultsStatus');
  if(!grid) return;

  if(!items || items.length === 0) {
    grid.innerHTML = '<div class="error-box"><p>No se encontraron ofertas.</p></div>';
    if(status) status.textContent = 'Sin resultados';
    return;
  }
  if(status) status.textContent = `${items.length} ofertas encontradas`;
  grid.innerHTML = '<div class="products-grid">' + items.map(item => createProductCard(item)).join('') + '</div>';
}

function createProductCard(item) {
  const itemData = encodeURIComponent(JSON.stringify(item));
  return `
    <div class="product-card" onclick="openAnalytics('${itemData}')">
      <img class="product-img" src="${item.thumbnail}" alt="${item.title}">
      <div class="product-info">
        <div class="product-store">${item.source || 'Tienda'}</div>
        <div class="product-title">${item.title}</div>
        <div class="product-price">${item.price}</div>
        <div style="margin-top:10px; font-size:0.65rem; color:var(--blue-mid); font-weight:700;">VER TENDENCIA 📈</div>
      </div>
    </div>`;
}

async function doSearch(query) {
  if (!query) return;
  showLoader();
  const locationParam = userLocationData.city ? `${userLocationData.city}, ${userLocationData.country_name}` : userLocationData.country_name;
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&location=${encodeURIComponent(locationParam)}&gl=co`);
    const data = await res.json();
    if (data.shopping_results) saveToHistory(data.shopping_results[0]);
    renderProducts(data.shopping_results || [], query);
  } catch (e) {
    hideLoader();
    document.getElementById('productsGrid').innerHTML = '<div class="error-box"><p>Error de conexión.</p></div>';
  }
}

function saveToHistory(product) {
  if(!product) return;
  let hist = JSON.parse(localStorage.getItem('searchHistory') || '[]');
  const item = { title: product.title, price: product.price, extracted_price: product.extracted_price, thumbnail: product.thumbnail, source: product.source };
  hist = [item, ...hist.filter(p => p.title !== item.title)].slice(0, 6);
  localStorage.setItem('searchHistory', JSON.stringify(hist));
}

function populateFeed() {
  const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
  const recoItems = [...history, ...MOCK_PRODUCTS].slice(0, 3);
  const grid = document.getElementById('recoGrid');
  if(grid) {
    grid.innerHTML = recoItems.map(item => `
      <div class="reco-card" onclick="doSearch('${item.title.replace(/'/g, "\\'")}')">
        <img src="${item.thumbnail || item.image}" class="reco-img">
        <div class="reco-info">
          <div class="reco-name">${item.title}</div>
          <div class="reco-new-price">${formatPrice((item.extracted_price || 100000) * 0.88)}</div>
        </div>
      </div>
    `).join('');
    document.getElementById('recoSection').style.display = 'block';
  }
  
  const disc = document.getElementById('discoveryGrid');
  if(disc) {
    disc.innerHTML = MOCK_PRODUCTS.sort(() => 0.5 - Math.random()).map(item => createProductCard(item)).join('');
  }
}

function openAnalytics(encodedData) {
  const product = JSON.parse(decodeURIComponent(encodedData));
  const modal = document.getElementById('analyticsModal');
  document.getElementById('anaImg').src = product.thumbnail;
  document.getElementById('anaTitle').textContent = product.title;
  document.getElementById('anaPrice').textContent = product.price;
  document.getElementById('anaStore').textContent = product.source || 'Tienda Oficial';
  
  // Galería de Imágenes Reales (Prioridad)
  const gallery = document.getElementById('anaGallery');
  let images = [product.thumbnail];
  
  if (product.images && Array.isArray(product.images)) {
    images = [...images, ...product.images].slice(0, 3);
  } else if (product.related_images && Array.isArray(product.related_images)) {
    images = [...images, ...product.related_images.map(img => img.link)].slice(0, 3);
  }
  
  // Limpiar la galería si solo hay una imagen o poblarla si hay más
  if (images.length > 1) {
    gallery.innerHTML = images.map(img => `<img src="${img}" class="gallery-thumb" onclick="document.getElementById('anaImg').src='${img}'">`).join('');
    gallery.style.display = 'flex';
  } else {
    gallery.innerHTML = '';
    gallery.style.display = 'none';
  }

  const price = product.extracted_price || 100000;
  document.getElementById('minPrice').textContent = formatPrice(price * 0.85);
  document.getElementById('avgPrice').textContent = formatPrice(price * 1.05);
  
  updateChart('dia');
  modal.style.display = 'flex';
}

function updateChart(period) {
  const path = document.getElementById('chartPath');
  const fill = document.getElementById('chartFill');
  const xAxis = document.getElementById('xAxis');
  const dataPoints = document.getElementById('chartDataPoints');
  if(!path || !fill || !xAxis || !dataPoints) return;

  let labels = [];
  if(period === 'dia') labels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
  else if(period === 'semana') labels = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
  else labels = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  const pointsCount = labels.length;
  const points = [];
  const width = 500;
  const height = 200;

  xAxis.innerHTML = labels.map(l => `<span>${l}</span>`).join('');
  dataPoints.innerHTML = '';

  for (let i = 0; i < pointsCount; i++) {
    const x = (i / (pointsCount - 1)) * width;
    const y = 40 + Math.random() * (height - 80);
    points.push({x, y});

    // Crear Punto Visual (Div)
    const dot = document.createElement('div');
    dot.className = 'chart-data-point';
    dot.style.left = `${(x / width) * 100}%`;
    dot.style.top = `${(y / height) * 100}%`;
    dataPoints.appendChild(dot);
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }

  path.setAttribute('d', d);
  fill.setAttribute('d', d + ` L ${width} ${height} L 0 ${height} Z`);
  
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-period') === period);
  });
}

function closeAnalytics() { document.getElementById('analyticsModal').style.display = 'none'; }
function formatPrice(v) { return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(v); }

window.addEventListener('DOMContentLoaded', () => {
  detectLocation();
  populateFeed();

  const searchBtn = document.getElementById('btnProduct');
  const searchInput = document.getElementById('productInput');
  if(searchBtn) searchBtn.onclick = () => doSearch(searchInput.value);
  if(searchInput) searchInput.onkeydown = (e) => { if (e.key === 'Enter') doSearch(e.target.value); };

  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.onclick = () => updateChart(btn.getAttribute('data-period'));
  });

  const cameraBtn = document.getElementById('cameraStartBtn');
  if(cameraBtn) {
    cameraBtn.onclick = () => {
      document.getElementById('scannerModal').style.display = 'flex';
      const scanner = new Html5Qrcode("reader");
      scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        scanner.stop();
        document.getElementById('scannerModal').style.display = 'none';
        if(searchInput) searchInput.value = text;
        doSearch(text);
      });
      const closeS = document.getElementById('closeScanner');
      if(closeS) closeS.onclick = () => { scanner.stop(); document.getElementById('scannerModal').style.display = 'none'; };
    };
  }
});

function executePurchase() {
  const overlay = document.getElementById('successOverlay');
  if(!overlay) return;
  overlay.style.display = 'flex';
  
  setTimeout(() => {
    overlay.style.display = 'none';
    closeAnalytics();
    // Volver al inicio (limpiar b�squeda)
    document.getElementById('productInput').value = '';
    document.getElementById('productsGrid').innerHTML = '';
    document.getElementById('placeholder').style.display = 'flex';
    document.getElementById('resultsStatus').textContent = 'Esperando b�squeda...';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 2500);
}
