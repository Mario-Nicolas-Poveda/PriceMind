
export default async function handler(req, res) {
  try {
    // Llamamos al servicio de IP desde el backend (donde no hay bloqueos de CORS)
    const response = await fetch('https://freeipapi.com/api/json');
    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error detecting location:', error);
    return res.status(500).json({ error: 'Failed to detect location' });
  }
}
