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

// 2. RENDERIZAR RESULTADOS (Con ordenamiento)
function renderProducts(items, query) {
  hideLoader();
  var grid = document.getElementById('productsGrid');
  var status = document.getElementById('resultsStatus');

  if (!items || items.length === 0) {
    grid.innerHTML = `<div class="error-box"><p>No se encontraron resultados para "${query}".</p></div>`;
    status.textContent = 'Sin resultados';
    return;
  }

  // ORDENAR de menor a mayor precio (usando extracted_price que es numérico)
  items.sort((a, b) => {
    const priceA = a.extracted_price || 0;
    const priceB = b.extracted_price || 0;
    return priceA - priceB;
  });

  status.textContent = items.length + ' ofertas ordenadas por precio (Menor a Mayor)';
  var html = '<div class="products-grid">';

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var title = item.title || '';
    var price = item.price || '';
    var store = item.source || 'Tienda';
    var img = item.thumbnail || '';
    var link = item.link || '#';
    var delivery = item.delivery || '';

    html += `
      <a class="product-card" href="${link}" target="_blank" rel="noopener">
        <img class="product-img" src="${img}" alt="${title}" loading="lazy">
        <div class="product-info">
          <div class="product-store">${store}</div>
          <div class="product-title">${title}</div>
          <div class="product-price">${price}</div>
          ${delivery ? `<div class="product-shipping" style="color:var(--green)">${delivery}</div>` : ''}
        </div>
      </a>`;
  }

  html += '</div>';
  grid.innerHTML = html;
}

// 3. REALIZAR BÚSQUEDA (Con parámetro de ordenamiento)
async function doSearch(query) {
  if (!query) return;
  
  currentQuery = query;
  showLoader();
  document.getElementById('resultsStatus').textContent = 'Analizando las mejores ofertas...';

  const locationParam = userLocationData.city ? `${userLocationData.city}, ${userLocationData.country_name}` : userLocationData.country_name;
  
  // Llamamos a nuestro propio backend en Vercel
  const targetUrl = `/api/search?q=${encodeURIComponent(query)}&location=${encodeURIComponent(locationParam)}&hl=es&gl=${userLocationData.country_code.toLowerCase()}&sort_by=p`;

  try {
    const res = await fetch(targetUrl);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderProducts(data.shopping_results || [], query);
  } catch (err) {
    console.error('Error en búsqueda:', err);
    hideLoader();
    document.getElementById('productsGrid').innerHTML = `
      <div class="error-box">
        <p>No se pudo completar la búsqueda.</p>
        <p style="font-size:0.8rem">${err.message}</p>
      </div>`;
    document.getElementById('resultsStatus').textContent = 'Error de conexión';
  }
}

function searchProduct() {
  var q = document.getElementById('productInput').value.trim();
  if (!q) { document.getElementById('productInput').focus(); return; }
  doSearch(q);
}

// --- ESCÁNER DE CÓDIGO DE BARRAS ---
let html5QrCode;

async function startScanner() {
  document.getElementById('scannerModal').style.display = 'flex';
  
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }
  
  const config = { 
    fps: 10, 
    qrbox: { width: 300, height: 180 }, // Ajustado para códigos de barras alargados
    aspectRatio: 1.0,
    formatsToSupport: [ 
      Html5QrcodeSupportedFormats.EAN_13, 
      Html5QrcodeSupportedFormats.EAN_8, 
      Html5QrcodeSupportedFormats.UPC_A, 
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.QR_CODE
    ]
  };

  try {
    // Intentar iniciar con la cámara trasera (environment)
    await html5QrCode.start(
      { facingMode: "environment" }, 
      config,
      (decodedText) => {
        // ÉXITO: Código detectado
        stopScanner();
        document.getElementById('productInput').value = decodedText;
        doSearch(decodedText);
      }
    );
  } catch (err) {
    console.error("Error al iniciar cámara:", err);
    alert("No se pudo acceder a la cámara. Verifica los permisos.");
    stopScanner();
  }
}

function stopScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      document.getElementById('scannerModal').style.display = 'none';
    });
  } else {
    document.getElementById('scannerModal').style.display = 'none';
  }
}

// Event Listeners para el escéner
document.getElementById('cameraStartBtn').addEventListener('click', startScanner);
document.getElementById('closeScanner').addEventListener('click', stopScanner);

document.getElementById('btnProduct').addEventListener('click', searchProduct);
document.getElementById('productInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') searchProduct();
});

document.querySelectorAll('.tip-chip').forEach(chip => {
  chip.addEventListener('click', function() {
    const term = this.textContent;
    document.getElementById('productInput').value = term;
    doSearch(term);
  });
});

window.addEventListener('DOMContentLoaded', detectLocation);
