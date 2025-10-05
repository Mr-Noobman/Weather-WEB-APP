export default async function handler(request, response) {
    // This uses the same key from your .env.local file
    const API_KEY = process.env.WEATHER_API_KEY;

    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
        return response.status(400).json({ error: 'Latitude and Longitude are required' });
    }

    const reverseGeocodeUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`;

    try {
        const geoResponse = await fetch(reverseGeocodeUrl);
        if (!geoResponse.ok) {
            throw new Error('Failed to fetch city data from coordinates');
        }
        
        const geoData = await geoResponse.json();
        if (!geoData || geoData.length === 0) {
            return response.status(404).json({ error: 'Could not determine city' });
        }

        response.status(200).json({ city: geoData[0].name });

    } catch (error) {
        console.error("Backend Geocoding Error:", error);
        response.status(500).json({ error: 'Internal Server Error' });
    }
}