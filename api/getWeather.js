export default async function handler(request, response) {
  const API_KEY = process.env.WEATHER_API_KEY;
  const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
  const city = searchParams.get("city");

  if (!city) {
    return response.status(400).json({ error: "City parameter is required" });
  }

  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${
    encodeURIComponent(city)
  }&appid=${API_KEY}&units=metric`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${
    encodeURIComponent(city)
  }&appid=${API_KEY}&units=metric`;

  try {
    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(currentUrl),
      fetch(forecastUrl),
    ]);

    // --- NEW, SMARTER ERROR HANDLING ---
    // First, specifically check if the city was not found (404 error)
    if (currentResponse.status === 404) {
      // Send a clear "City not found" message back to the frontend
      return response.status(404).json({
        error: `Sorry, the city '${city}' was not found. Please check the spelling.`,
      });
    }
    // --- END OF NEW HANDLING ---

    // Now, check for any other type of error (like a bad API key, etc.)
    if (!currentResponse.ok || !forecastResponse.ok) {
      throw new Error(`Failed to fetch weather data. Status: ${currentResponse.status}, ${forecastResponse.status}`);
    }

    const currentData = await currentResponse.json();
    const forecastData = await forecastResponse.json();

    response.status(200).json({
      current: currentData,
      forecast: forecastData,
    });
  } catch (error) {
    console.error("Backend Error:", error);
    // This will now only catch true server errors, not "city not found"
    response.status(500).json({ error: "An unexpected error occurred on the server." });
  }
}