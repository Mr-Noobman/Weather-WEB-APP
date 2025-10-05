document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Element References ---
  const cityInput = document.getElementById("city-input");
  const searchForm = document.getElementById("search-form");
  const suggestionsBox = document.getElementById("suggestions-box");
  const locationBtn = document.getElementById("location-btn");
  const celsiusBtn = document.getElementById("celsius-btn");
  const fahrenheitBtn = document.getElementById("fahrenheit-btn");
  const weatherContent = document.getElementById("weather-content-main");
  const loader = document.getElementById("loader");
  const toastNotification = document.getElementById("toast-notification");
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

  // --- State Variables ---
  let currentUnit = "celsius";
  let weatherDataStore = null;
  let toastTimeout;

  // --- NEW RESPONSIVE Toast Notification Function ---
  function showToast(message) {
    clearTimeout(toastTimeout);
    toastNotification.textContent = message;

    // Make it visible and apply the correct "show" transform
    toastNotification.style.opacity = 1;
    toastNotification.style.transform = "translate(-50%, 0)";

    // Set a timer to hide it again
    toastTimeout = setTimeout(() => {
      toastNotification.style.opacity = 0;
      // Check window width AGAIN to apply the correct "hide" transform
      if (window.innerWidth <= 991) {
        // Mobile: Hide by moving UP
        toastNotification.style.transform = "translate(-50%, -150px)";
      } else {
        // Desktop: Hide by moving DOWN
        toastNotification.style.transform = "translate(-50%, 100px)";
      }
    }, 3000);
  }

  // --- Debounce function for API calls ---
  function debounce(func, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // --- Live Search Functions ---
  async function getCitySuggestions(query) {
    if (!query) {
      suggestionsBox.style.display = "none";
      return;
    }
    try {
      const response = await fetch(`/api/searchCities?q=${encodeURIComponent(query)}`);
      if (!response.ok) return;
      const matches = await response.json();
      displaySuggestions(matches);
    } catch (error) {
      console.error("Error fetching city suggestions:", error);
      suggestionsBox.style.display = "none";
    }
  }

  function displaySuggestions(matches) {
    suggestionsBox.innerHTML = "";
    if (matches.length > 0) {
      matches.forEach(city => {
        const item = document.createElement("div");
        item.className = "suggestion-item";
        const state = city.state ? `, ${city.state}` : "";
        item.textContent = `${city.name}${state}, ${city.country}`;
        item.addEventListener("click", () => {
          cityInput.value = city.name;
          suggestionsBox.style.display = "none";
          searchForm.dispatchEvent(new Event("submit"));
        });
        suggestionsBox.appendChild(item);
      });
      suggestionsBox.style.display = "block";
    } else {
      suggestionsBox.style.display = "none";
    }
  }
  const debouncedGetCitySuggestions = debounce(getCitySuggestions, 300);

  // --- SECURE DATA FETCHING ---
  async function getWeatherByCity(city) {
    showLoader();
    try {
      const response = await fetch(`/api/getWeather?city=${encodeURIComponent(city)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Error: ${response.status}`);
      }
      if (data.current && data.forecast) {
        weatherDataStore = { current: data.current, forecast: data.forecast };
        updateUI();
        showWeatherContent();
      } else {
        throw new Error("Received incomplete data from the server.");
      }
    } catch (err) {
      console.error("Frontend Fetch Error:", err);
      showError(err.message);
    }
  }

  async function getCityFromCoords(latitude, longitude) {
    try {
      const response = await fetch(`/api/getCity?lat=${latitude}&lon=${longitude}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }
      const data = await response.json();
      return data.city;
    } catch (err) {
      console.error("Frontend geocoding error:", err);
      showError("Could not determine city from your location.");
      return null;
    }
  }

  // --- EVENT LISTENERS ---
  cityInput.addEventListener("input", (e) => {
    debouncedGetCitySuggestions(e.target.value.trim());
  });

  celsiusBtn.addEventListener("click", () => setUnit("celsius"));
  fahrenheitBtn.addEventListener("click", () => setUnit("fahrenheit"));

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    suggestionsBox.style.display = "none";
    const q = cityInput.value.trim();
    if (!q || (weatherDataStore && q.toLowerCase() === weatherDataStore.current.name.toLowerCase())) {
      return;
    }
    getWeatherByCity(q);
    cityInput.blur();
  });

  document.addEventListener("click", (e) => {
    if (!searchForm.contains(e.target)) {
      suggestionsBox.style.display = "none";
    }
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

  // --- UI and Helper Functions ---
  function showLoader() {
    loader.classList.add("visible");
  }

  function showWeatherContent() {
    loader.classList.remove("visible");
    if (weatherContent.style.display === "none") {
      weatherContent.style.display = "";
    }
  }

  function showError(msg) {
    loader.classList.remove("visible");
    showToast(msg);
  }

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
    let condition, isDay;
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

  async function getUserCoordinates() {
    if (!navigator.geolocation || !navigator.permissions) {
      return showError("Geolocation is not supported by this browser.");
    }
    showLoader();
    try {
      const permissionStatus = await navigator.permissions.query({ name: "geolocation" });
      if (permissionStatus.state === "denied") {
        showError("Permission denied. Please enable location in browser settings.");
        getWeatherByCity("Dhaka");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const city = await getCityFromCoords(latitude, longitude);
          if (city) {
            cityInput.value = city;
            localStorage.setItem("lastCity", city);
            getWeatherByCity(city);
          }
        },
        (error) => {
          console.error("Geolocation Error:", error);
          showError("Could not get location. Showing fallback city.");
          getWeatherByCity("Dhaka");
        },
      );
    } catch (error) {
      showError("Could not check location permissions.");
    }
  }

  // --- INITIALIZATION ---
  function initializeApp() {
    weatherContent.style.display = "none";
    const lastCity = localStorage.getItem("lastCity") || "Dhaka";
    if (lastCity) {
      getWeatherByCity(lastCity);
    }
  }

  initializeApp();
});