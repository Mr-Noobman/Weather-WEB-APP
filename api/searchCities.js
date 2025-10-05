export default async function handler(request, response) {
    const API_KEY = process.env.WEATHER_API_KEY;
    
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const query = searchParams.get('q');

    if (!query) {
        return response.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // This API endpoint finds locations based on a query string
    const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`;

    try {
        const apiResponse = await fetch(geocodeUrl);
        if (!apiResponse.ok) {
            throw new Error(`Failed to fetch city data. Status: ${apiResponse.status}`);
        }
        
        const data = await apiResponse.json();
        
        // Send the data from the OpenWeather API back to our frontend
        response.status(200).json(data);

    } catch (error) {
        console.error("Backend Search Error:", error);
        response.status(500).json({ error: 'Internal Server Error' });
    }
}