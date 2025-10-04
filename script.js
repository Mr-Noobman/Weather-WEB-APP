document.addEventListener("DOMContentLoaded", () => {
  // API Key is REMOVED from the frontend for security.

  const cityInput = document.getElementById("city-input");
  const searchForm = document.getElementById("search-form");
  const locationBtn = document.getElementById("location-btn");
  const celsiusBtn = document.getElementById("celsius-btn");
  const fahrenheitBtn = document.getElementById("fahrenheit-btn");
  const weatherContent = document.getElementById("weather-content-main");
  const loader = document.getElementById("loader");
  const errorMessage = document.getElementById("error-message");
  const currentWeatherSection = document.querySelector(".current-weather");
  const current = {
    icon: document.getElementById("current-weather-icon"),
    temp: document.getElementById("current-temp"),
    city: document.getElementById("current-city"),
    desc: document.getElementById("current-desc"),
    humidity: document.getElementById("current-humidity"),
    wind: document.getElementById("current-wind"),
    precipitation: document.getElementById("current-precipitation"),
  };
  const fiveDayContainer = document.getElementById("five-day-container");
  const hourlyContainer = document.getElementById("hourly-container");
  const hourlyForecastTitle = document.getElementById("hourly-forecast-title");

  let currentUnit = "celsius";
  let weatherDataStore = null;

  // --- NEW SECURE DATA FETCHING ---
  async function getWeatherByCity(city) {
    showLoader();
    try {
      // Step 1: Call your own secure serverless function
      const response = await fetch(`/api/getWeather?city=${encodeURIComponent(city)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      // Step 2: Get the combined data from your function's response
      const data = await response.json();

      if (data.current && data.forecast) {
        weatherDataStore = { current: data.current, forecast: data.forecast };
        updateUI();
        showWeatherContent();
      } else {
        throw new Error("Received incomplete data from the server.");
      }
    } catch (err) {
      console.error("Frontend Fetch Error:", err);
      showError(err.message || "Could not fetch weather data. Please try again.");
    }
  }

  // --- EVENT LISTENERS ---
  celsiusBtn.addEventListener("click", () => setUnit("celsius"));
  fahrenheitBtn.addEventListener("click", () => setUnit("fahrenheit"));

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = cityInput.value.trim();
    if (!q) return;
    getWeatherByCity(q);
    localStorage.setItem("lastCity", q);
    cityInput.value = "";
    cityInput.blur();
  });

  locationBtn.addEventListener("click", getUserCoordinates);

  currentWeatherSection.addEventListener("click", () => {
    if (!weatherDataStore) return;
    updateBackground(weatherDataStore.current);
    document.querySelectorAll(".forecast-day").forEach(d => {
      d.classList.remove("selected");
      d.removeAttribute("aria-current");
    });
    if (fiveDayContainer.firstChild) {
      fiveDayContainer.firstChild.classList.add("selected");
      fiveDayContainer.firstChild.setAttribute("aria-current", "true");
      updateHourlyForecast(fiveDayContainer.firstChild.dataset.date);
    }
  });

  // --- UI AND HELPER FUNCTIONS (Most of these remain unchanged) ---

  function updateUI() {
    if (!weatherDataStore) return;
    updateCurrentWeather();
    updateFiveDayForecast();
    const firstDay = Object.keys(getGroupedForecast())[0];
    if (firstDay) updateHourlyForecast(firstDay);
  }

  function createIconImg(iconCode) {
    const iconMapping = {
      "01d": "clear-day",
      "01n": "clear-night",
      "02d": "partly-cloudy-day",
      "02n": "partly-cloudy-night",
      "03d": "cloudy",
      "03n": "cloudy",
      "04d": "overcast",
      "04n": "overcast",
      "09d": "drizzle",
      "09n": "drizzle",
      "10d": "rain",
      "10n": "rain",
      "11d": "thunderstorms",
      "11n": "thunderstorms",
      "13d": "snow",
      "13n": "snow",
      "50d": "mist",
      "50n": "mist",
    };
    const iconName = iconMapping[iconCode] || "cloudy";
    const img = document.createElement("img");
    img.src = `https://basmilius.github.io/weather-icons/production/fill/all/${iconName}.svg`;
    img.alt = iconName.replace("-", " ");
    img.loading = "lazy";
    return img;
  }

  function setUnit(unit) {
    if (currentUnit === unit) return;
    currentUnit = unit;
    celsiusBtn.classList.toggle("active", unit === "celsius");
    fahrenheitBtn.classList.toggle("active", unit === "fahrenheit");
    celsiusBtn.setAttribute("aria-pressed", unit === "celsius");
    fahrenheitBtn.setAttribute("aria-pressed", unit === "fahrenheit");
    updateUI();
  }

  function updateCurrentWeather() {
    const data = weatherDataStore.current;
    current.icon.innerHTML = "";
    current.icon.appendChild(createIconImg(data.weather[0].icon));
    current.temp.textContent = `${formatTemperature(data.main.temp)}°`;
    current.city.textContent = `${data.name}, ${data.sys.country}`;
    current.desc.textContent = data.weather[0].description;
    current.humidity.textContent = `Humidity: ${data.main.humidity}%`;
    current.wind.textContent = `Wind: ${formatWindSpeed(data.wind.speed)}`;
    const precip = data.rain && data.rain["1h"] ? data.rain["1h"] : 0;
    current.precipitation.textContent = `Precipitation (1h): ${precip} mm`;
    updateBackground(data);
  }

  function getGroupedForecast() {
    const grouped = {};
    weatherDataStore.forecast.list.forEach(item => {
      const date = item.dt_txt.split(" ")[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    });
    return grouped;
  }

  function updateFiveDayForecast() {
    const grouped = getGroupedForecast();
    fiveDayContainer.innerHTML = "";
    let count = 0;
    for (const date in grouped) {
      if (count >= 5) break;
      const dayData = grouped[date];
      const rep = dayData[Math.floor(dayData.length / 2)];
      const dayCard = document.createElement("div");
      dayCard.className = "forecast-day";
      dayCard.dataset.date = date;
      dayCard.dataset.weather = rep.weather[0].main;
      dayCard.dataset.isDay = rep.weather[0].icon.endsWith("d");
      dayCard.innerHTML = `<p>${
        new Date(date).toLocaleDateString("en-US", { weekday: "short" })
      }</p><div class="weather-icon"></div><p class="temp">${
        formatTemperature(Math.max(...dayData.map(i => i.main.temp_max)))
      }° / ${formatTemperature(Math.min(...dayData.map(i => i.main.temp_min)))}°</p>`;
      dayCard.querySelector(".weather-icon").appendChild(createIconImg(rep.weather[0].icon));
      dayCard.addEventListener("click", () => {
        document.querySelectorAll(".forecast-day").forEach(d => {
          d.classList.remove("selected");
          d.removeAttribute("aria-current");
        });
        dayCard.classList.add("selected");
        dayCard.setAttribute("aria-current", "true");
        updateHourlyForecast(date);
        updateBackground({ condition: dayCard.dataset.weather, isDay: dayCard.dataset.isDay === "true" });
      });
      fiveDayContainer.appendChild(dayCard);
      count++;
    }
    if (fiveDayContainer.firstChild) {
      fiveDayContainer.firstChild.classList.add("selected");
      fiveDayContainer.firstChild.setAttribute("aria-current", "true");
    }
  }

  function updateHourlyForecast(date) {
    const dayData = getGroupedForecast()[date] || [];
    hourlyContainer.innerHTML = "";
    hourlyForecastTitle.textContent = `Hourly Forecast for ${
      new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    }`;
    dayData.forEach(item => {
      const wrap = document.createElement("div");
      wrap.className = "hourly-item";
      wrap.innerHTML = `<p>${
        new Date(item.dt * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
      }</p><div class="weather-icon"></div><p>${formatTemperature(item.main.temp)}°</p>`;
      wrap.querySelector(".weather-icon").appendChild(createIconImg(item.weather[0].icon));
      hourlyContainer.appendChild(wrap);
    });
  }

  function formatTemperature(tempC) {
    if (currentUnit === "fahrenheit") return Math.round((tempC * 9 / 5) + 32);
    return Math.round(tempC);
  }

  function formatWindSpeed(speedMs) {
    if (currentUnit === "fahrenheit") return `${(speedMs * 2.237).toFixed(1)} mph`;
    return `${speedMs.toFixed(1)} m/s`;
  }

  function generateRainDrops(count = 25) {
    const container = document.getElementById("background-animation");
    container.querySelectorAll(".drop").forEach(n => n.remove());
    for (let i = 0; i < count; i++) {
      const drop = document.createElement("i");
      drop.className = "drop";
      drop.style.left = `${Math.random() * 100}%`;
      drop.style.height = `${Math.random() * 60 + 40}px`;
      drop.style.animationDuration = `${(Math.random() * 0.6 + 0.6).toFixed(2)}s`;
      drop.style.animationDelay = `${(Math.random() * 1.4).toFixed(2)}s`;
      container.appendChild(drop);
    }
  }

  function updateBackground(data) {
    const body = document.body;
    const weatherClasses = [
      "weather-clear-day",
      "weather-clear-night",
      "weather-clouds",
      "weather-rain",
      "weather-snow",
      "weather-mist",
    ];
    body.classList.remove(...weatherClasses);
    document.getElementById("background-animation").querySelectorAll(".drop").forEach((n) => n.remove());

    let condition;
    let isDay;
    if (data.weather) {
      condition = data.weather[0].main;
      isDay = data.dt > data.sys.sunrise && data.dt < data.sys.sunset;
    } else {
      condition = data.condition;
      isDay = data.isDay;
    }
    switch (condition) {
      case "Clear":
        body.classList.add(isDay ? "weather-clear-day" : "weather-clear-night");
        break;
      case "Clouds":
        body.classList.add("weather-clouds");
        break;
      case "Rain":
      case "Drizzle":
      case "Thunderstorm":
        body.classList.add("weather-rain");
        generateRainDrops();
        break;
      case "Snow":
        body.classList.add("weather-snow");
        break;
      case "Mist":
      case "Fog":
      case "Haze":
        body.classList.add("weather-mist");
        break;
    }
  }

  function showLoader() {
    loader.classList.add("visible");
    errorMessage.classList.remove("visible");
    weatherContent.style.display = "none";
  }

  function showWeatherContent() {
    loader.classList.remove("visible");
    errorMessage.classList.remove("visible");
    weatherContent.style.display = ""; // Reset to default grid display
  }

  function showError(msg) {
    loader.classList.remove("visible");
    weatherContent.style.display = "none";
    errorMessage.textContent = msg;
    errorMessage.classList.add("visible");
  }

  // This function for getting city from coordinates still needs an API key.
  // For a 100% secure app, you'd create a second serverless function for this.
  async function getCityFromCoords(latitude, longitude) {
    // NOTE: This key is still visible on the frontend.
    const GEO_API_KEY = "9ef308a75f3fb9dacd694fc7a2f48405";
    const REVERSE_URL =
      `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${GEO_API_KEY}`;
    const res = await fetch(REVERSE_URL);
    if (!res.ok) throw new Error("Reverse geocoding failed");
    const data = await res.json();
    if (!data || data.length === 0) {
      showError("Could not determine city from coordinates.");
      return null;
    }
    return data[0].name;
  }

  function getUserCoordinates() {
    if (!navigator.geolocation) {
      showError("Geolocation not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const city = await getCityFromCoords(latitude, longitude);
        if (city) {
          cityInput.value = city;
          localStorage.setItem("lastCity", city);
          getWeatherByCity(city); // This correctly calls our new secure function
        }
      } catch (err) {
        console.error(err);
        showError("An error occurred while resolving your location.");
      }
    }, (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        showError("Location permission denied. Showing fallback city Dhaka.");
        getWeatherByCity("Dhaka");
      } else {
        showError("Geolocation error. Please search manually.");
      }
    });
  }

  // --- INITIALIZATION ---
  const lastCity = localStorage.getItem("lastCity") || "Dhaka";
  cityInput.value = lastCity;
  getWeatherByCity(lastCity);
});