
export default async function handler(req, res) {
  try {
    // Vercel añade automáticamente cabeceras con la ubicación del usuario
    const city = req.headers['x-vercel-ip-city'] || 'Bogotá';
    const country = req.headers['x-vercel-ip-country'] || 'CO';
    const countryName = req.headers['x-vercel-ip-country-name'] || 'Colombia';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    
    return res.status(200).json({
      cityName: decodeURIComponent(city),
      countryCode: country,
      countryName: decodeURIComponent(countryName)
    });
  } catch (error) {
    console.error('Error with Vercel Geo headers:', error);
    return res.status(500).json({ error: 'Failed to detect location' });
  }
}
