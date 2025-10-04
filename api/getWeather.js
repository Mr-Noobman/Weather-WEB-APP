export default async function handler(request, response) {
    // Get the API key from Vercel's Environment Variables
    const API_KEY = process.env.WEATHER_API_KEY;

    // Get the city from the query parameters of the request URL
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const city = searchParams.get('city');

    if (!city) {
        return response.status(400).json({ error: 'City parameter is required' });
    }

    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;

    try {
        // Fetch both current weather and forecast data in parallel
        const [currentResponse, forecastResponse] = await Promise.all([
            fetch(currentUrl),
            fetch(forecastUrl)
        ]);

        if (!currentResponse.ok || !forecastResponse.ok) {
            // If either API call fails, throw an error
            throw new Error(`Failed to fetch weather data. Status: ${currentResponse.status}, ${forecastResponse.status}`);
        }

        const currentData = await currentResponse.json();
        const forecastData = await forecastResponse.json();

        // Send the combined data back to the frontend
        response.status(200).json({
            current: currentData,
            forecast: forecastData
        });

    } catch (error) {
        console.error("Backend Error:", error);
        response.status(500).json({ error: 'Internal Server Error' });
    }
}