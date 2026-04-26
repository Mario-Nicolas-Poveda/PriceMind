
export default async function handler(req, res) {
  const { q, location, hl, gl, sort_by } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  // Usamos la clave directamente aquí por ahora, pero lo ideal es usar process.env.SERPAPI_KEY
  const SERPAPI_KEY = process.env.SERPAPI_KEY || 'b6f2f89ceeb8148595b8974bbb32dfd70f9846173401c7235f9d7016f471ef43';
  
  const searchParams = new URLSearchParams({
    engine: 'google_shopping',
    q,
    location: location || 'Colombia',
    hl: hl || 'es',
    gl: gl || 'co',
    gl: gl || 'co',
    api_key: SERPAPI_KEY
  });

  const targetUrl = `https://serpapi.com/search.json?${searchParams.toString()}`;

  try {
    const response = await fetch(targetUrl);
    const data = await response.json();
    
    // Configurar CORS para permitir que el frontend llame a esta función
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching SerpApi:', error);
    return res.status(500).json({ error: 'Error fetching search results' });
  }
}
