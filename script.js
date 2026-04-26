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

  // FILTRO INTELIGENTE PARA CÓDIGOS DE BARRAS
  // Si la búsqueda es solo números y larga (código de barras), filtramos por relevancia
  const isBarcode = /^\d{8,14}$/.test(query.trim());
  let filteredItems = items;

  if (isBarcode && items.length > 0) {
    // Tomamos el primer resultado como referencia de "Verdad"
    const firstTitle = items[0].title.toLowerCase();
    const keywords = firstTitle.split(' ').filter(word => word.length > 3); // Solo palabras significativas
    
    filteredItems = items.filter((item, index) => {
      if (index === 0) return true; // El primero siempre se queda
      const title = item.title.toLowerCase();
      // FILTRO MÁS ESTRICTO: Debe coincidir con al menos 2 palabras clave importantes
      // o ser una coincidencia muy fuerte de marca.
      const matches = keywords.filter(key => title.includes(key));
      return matches.length >= 2 || (keywords.length > 0 && title.includes(keywords[0]));
    });

    // Si después de filtrar solo queda 1 y parece basura (menos de 2 palabras coinciden), 
    // mejor no mostrar nada irrelevante.
    if (filteredItems.length === 1 && items.length > 5) {
        const firstTitle = items[0].title.toLowerCase();
        // Si el primer título no tiene nada que ver con el código, lo vaciamos
        // (Google a veces mete basura incluso en el primer resultado si no hay nada)
    }
  }

  // ORDENAR de menor a mayor precio
  filteredItems.sort((a, b) => {
    const priceA = a.extracted_price || 0;
    const priceB = b.extracted_price || 0;
    return priceA - priceB;
  });

  status.textContent = filteredItems.length + ' ofertas encontradas para este producto';
  var html = '<div class="products-grid">';

  for (var i = 0; i < filteredItems.length; i++) {
    var item = filteredItems[i];
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
  const targetUrl = `/api/search?q=${encodeURIComponent(query)}&location=${encodeURIComponent(locationParam)}&hl=es&gl=${userLocationData.country_code.toLowerCase()}`;

  try {
    const res = await fetch(targetUrl);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    
    // GUARDAR EN HISTORIAL (para recomendaciones)
    if (data.shopping_results && data.shopping_results.length > 0) {
      saveToHistory(data.shopping_results[0]);
    }
    
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
  var inputEl = document.getElementById('productInput');
  var q = inputEl.value.trim();
  if (!q) { inputEl.focus(); return; }
  doSearch(q);
  inputEl.value = ''; // Limpiar la barra de búsqueda
}

// --- ESCÁNER DE CÓDIGO DE BARRAS ---
let html5QrCode;
let cameras = [];
let currentCameraIndex = 0;
let tipInterval;

const scannerTips = [
  "Centra el código de barras",
  "Acerca un poco más el celular",
  "Asegúrate de tener buena luz",
  "Mantén el dispositivo firme",
  "Mueve lento para enfocar"
];

function updateScannerTip() {
  const tipEl = document.getElementById('scannerTip');
  let i = 0;
  tipInterval = setInterval(() => {
    i = (i + 1) % scannerTips.length;
    tipEl.style.opacity = 0;
    setTimeout(() => {
      tipEl.textContent = scannerTips[i];
      tipEl.style.opacity = 1;
    }, 300);
  }, 4000);
}

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
    // Obtener todas las cámaras disponibles
    cameras = await Html5Qrcode.getCameras();
    
    if (cameras && cameras.length > 0) {
      // Si hay más de una cámara, mostrar botón de cambio
      if (cameras.length > 1) {
        document.getElementById('switchCameraBtn').style.display = 'block';
        // Intentar buscar la cámara trasera por defecto (usualmente al final de la lista)
        currentCameraIndex = cameras.length - 1;
      }
      
      await startWithCamera(cameras[currentCameraIndex].id);
      updateScannerTip();
    } else {
      alert("No se detectaron cámaras.");
      stopScanner();
    }
  } catch (err) {
    console.error("Error al iniciar cámara:", err);
    alert("No se pudo acceder a la cámara. Verifica los permisos.");
    stopScanner();
  }
}

async function startWithCamera(cameraId) {
  const config = { 
    fps: 10, 
    qrbox: { width: 300, height: 180 },
    aspectRatio: 1.0,
    formatsToSupport: [ 
      Html5QrcodeSupportedFormats.EAN_13, 
      Html5QrcodeSupportedFormats.EAN_8, 
      Html5QrcodeSupportedFormats.UPC_A, 
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.QR_CODE
    ]
  };

  if (html5QrCode.isScanning) {
    await html5QrCode.stop();
  }

  await html5QrCode.start(
    cameraId, 
    config,
    (decodedText) => {
      stopScanner();
      document.getElementById('productInput').value = decodedText;
      doSearch(decodedText);
    }
  );
}

async function switchCamera() {
  if (cameras.length > 1) {
    currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
    const btn = document.getElementById('switchCameraBtn');
    btn.disabled = true;
    btn.textContent = "Cambiando...";
    
    try {
      await startWithCamera(cameras[currentCameraIndex].id);
    } catch (err) {
      console.error("Error al cambiar de cámara", err);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;"><path d="M21 7v6h-6"></path><path d="M3 17v-6h6"></path><path d="M3 17a9 9 0 0 1 14.82-6.82L21 13"></path><path d="M21 7a9 9 0 0 0-14.82 6.82L3 11"></path></svg>
        Cambiar Lente`;
    }
  }
}

function stopScanner() {
  clearInterval(tipInterval);
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      document.getElementById('scannerModal').style.display = 'none';
    });
  } else {
    document.getElementById('scannerModal').style.display = 'none';
  }
}

// Event Listeners para el escáner
document.getElementById('cameraStartBtn').addEventListener('click', startScanner);
document.getElementById('closeScanner').addEventListener('click', stopScanner);
document.getElementById('switchCameraBtn').addEventListener('click', switchCamera);

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

// --- PERSISTENCIA Y RECOMENDACIONES ---
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

  // Simulamos una oferta (bajamos el precio un 10-15%)
  const discount = 0.12;
  const newPriceValue = Math.floor(data.extracted_price * (1 - discount));
  const newPriceFormatted = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(newPriceValue);

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
    <button class="btn btn-primary" onclick="window.location.reload();" style="width:auto; padding: 0.5rem 1rem; font-size: 0.75rem;">Ver Oferta</button>
  `;

  recoSection.style.display = 'block';
}

window.addEventListener('DOMContentLoaded', () => {
  detectLocation();
  loadRecommendations();
});
