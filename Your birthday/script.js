
const cityInput = document.getElementById("city");
const birthdayInput = document.getElementById("birthday");
const message = document.getElementById("message");
const results = document.getElementById("results");
const discoverBtn = document.getElementById("discoverBtn");

// Today's date
const now = new Date();
const today =
  `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

birthdayInput.max = today;

// Calculate age
function calculateAge(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const today = new Date();

  let years = today.getFullYear() - year;
  let months = today.getMonth() + 1 - month;
  let days = today.getDate() - day;

  if (days < 0) {
    months--;
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  return `${years} years, ${months} months and ${days} days`;
}

// Weather descriptions
function getWeather(code) {
  if (code === 0) return ["Clear Sky", "☀️"];
  if (code <= 2) return ["Partly Cloudy", "🌤️"];
  if (code === 3) return ["Cloudy", "☁️"];
  if (code <= 48) return ["Fog", "🌫️"];
  if (code <= 57) return ["Drizzle", "🌦️"];
  if (code <= 67) return ["Rain", "🌧️"];
  if (code <= 77) return ["Snow", "❄️"];
  if (code <= 82) return ["Rain Showers", "🌧️"];
  if (code <= 86) return ["Snow Showers", "🌨️"];
  return ["Thunderstorm", "⛈️"];
}

// Safe element creation
function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// 1. Historical weather
async function loadWeather(place, date) {
  const box = document.getElementById("weather");
  const icon = document.getElementById("weatherIcon");
  const temp = document.getElementById("temperature");
  const location = document.getElementById("weatherPlace");

  if (Number(date.slice(0,4)) < 1940) {
    box.textContent = "Historical weather unavailable";
    icon.textContent = "🌍";
    temp.textContent = "Weather archive starts from 1940.";
    return;
  }

  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${place.latitude}&longitude=${place.longitude}&start_date=${date}&end_date=${date}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Weather service error");

  const data = await response.json();
  const daily = data.daily;

  if (!daily || daily.weather_code?.[0] == null ||
      daily.temperature_2m_max?.[0] == null ||
      daily.temperature_2m_min?.[0] == null) {
    throw new Error("Weather data unavailable");
  }

  const weather = getWeather(daily.weather_code[0]);

  icon.textContent = weather[1];
  box.textContent = weather[0];

  temp.textContent =
    `Minimum: ${daily.temperature_2m_min[0]}°C | Maximum: ${daily.temperature_2m_max[0]}°C`;

  location.textContent = `Weather in ${place.name}, ${place.country || ""}`;
}

// 2. Historical city photo
async function loadCityPhoto(place) {
  const container = document.getElementById("cityImage");
  const name = document.getElementById("cityName");
  const description = document.getElementById("cityDescription");

  name.textContent = place.name + ", " + (place.country || "");
  description.textContent = "Searching for an archive photo...";

  const query = encodeURIComponent(
    `${place.name} ${place.country || ""} city`
  );

  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json&origin=*`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Image search unavailable");

  const data = await response.json();
  const pages = Object.values(data.query?.pages || {});

  const photo = pages.find(page =>
    page.imageinfo?.[0]?.thumburl
  );

  if (!photo) {
    container.textContent = "No city photo found.";
    description.textContent = "Try another city name.";
    return;
  }

  const img = document.createElement("img");
  img.src = photo.imageinfo[0].thumburl;
  img.alt = `Archive photo of ${place.name}`;
  img.loading = "lazy";

  img.onerror = () => {
    container.textContent = "Photo could not be loaded.";
  };

  container.replaceChildren(img);
  description.textContent = "Photo from Wikimedia Commons archive.";
}

// 3. Events on this day
async function loadHistory(date) {
  const [year, month, day] = date.split("-");
  const box = document.getElementById("events");

  box.replaceChildren(
    makeElement("p", "muted", "Searching world history...")
  );

  const url =
    `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${month}/${day}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("History service unavailable");

  const data = await response.json();
  box.replaceChildren();

  const groups = [
    ["Historical events", data.events || []],
    ["Famous people born", data.births || []],
    ["Famous people who died", data.deaths || []]
  ];

  let total = 0;

  groups.forEach(([heading, items]) => {
    if (!items.length) return;

    const title = makeElement("h3", "history-heading", heading);
    box.appendChild(title);

    items.slice(0, 5).forEach(item => {
      const card = makeElement("div", "event-item");

      card.appendChild(
        makeElement("strong", "", item.year ? item.year + " — " : "")
      );

      const description = makeElement("p", "", item.text);
      card.appendChild(description);

      const page = item.pages?.find(p => p.content_urls?.desktop?.page);

      if (page) {
        const link = makeElement("a", "", "Read more →");
        link.href = page.content_urls.desktop.page;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        card.appendChild(link);
      }

      box.appendChild(card);
      total++;
    });
  });

  if (!total) {
    box.appendChild(
      makeElement("p", "muted", "No historical information found.")
    );
  }
}

// 4. Albums released on the birthday
async function loadAlbums(date) {
  const box = document.getElementById("albums");

  box.replaceChildren(
    makeElement("p", "muted", "Searching music archives...")
  );

  const query = encodeURIComponent(
    `date:${date} AND primarytype:album`
  );

  const url =
    `https://musicbrainz.org/ws/2/release-group/?query=${query}&fmt=json&limit=8`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Music service unavailable");

  const data = await response.json();
  box.replaceChildren();

  const albums = data["release-groups"] || [];

  if (!albums.length) {
    box.appendChild(
      makeElement("p", "muted", "No matching album releases found for this exact date.")
    );
    return;
  }

  albums.forEach(album => {
    const card = makeElement("article", "album-item");

    const cover = document.createElement("img");
    cover.alt = "Album cover";
    cover.loading = "lazy";
    cover.src =
      `https://coverartarchive.org/release-group/${album.id}/front-250`;

    cover.onerror = () => {
      const placeholder = makeElement("div", "album-placeholder", "🎵");
      cover.replaceWith(placeholder);
    };

    card.appendChild(cover);

    card.appendChild(
      makeElement("h3", "", album.title || "Unknown album")
    );

    const artists = (album["artist-credit"] || [])
      .map(artist => artist.name || artist.artist?.name)
      .filter(Boolean)
      .join(", ");

    card.appendChild(
      makeElement("p", "", artists || "Unknown artist")
    );

    card.appendChild(
      makeElement("p", "", "Release: " + (album["first-release-date"] || date))
    );

    const link = makeElement("a", "", "View album →");
    link.href = `https://musicbrainz.org/release-group/${album.id}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    card.appendChild(link);
    box.appendChild(card);
  });
}

// Main button
async function discover() {
  const city = cityInput.value.trim();
  const date = birthdayInput.value;

  results.classList.remove("show");
  message.textContent = "";

  if (!city || !date) {
    message.textContent = "Please enter your city and birthday.";
    return;
  }

  if (date > today) {
    message.textContent = "Birthday cannot be in the future.";
    return;
  }

  discoverBtn.disabled = true;
  discoverBtn.textContent = "Discovering...";

  message.textContent = "Finding your birthday story...";

  try {
    // Find city coordinates
    const geoURL =
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

    const geoResponse = await fetch(geoURL);

    if (!geoResponse.ok) throw new Error("City search failed.");

    const geoData = await geoResponse.json();

    if (!geoData.results?.length) {
      throw new Error("City not found. Try another name.");
    }

    const place = geoData.results[0];

    // Show age and date
    document.getElementById("age").textContent =
      calculateAge(date);

    document.getElementById("birthDateText").textContent =
      "Born on " + date;

    // Display results
    results.classList.add("show");
    message.textContent = "Your birthday report is being prepared! ✨";

    // Load each section independently
    const tasks = [
      ["Weather", () => loadWeather(place, date)],
      ["City photo", () => loadCityPhoto(place)],
      ["World history", () => loadHistory(date)],
      ["Albums", () => loadAlbums(date)]
    ];

    const outcomes = await Promise.allSettled(
      tasks.map(task => task[1]())
    );

    const failed = outcomes
      .map((outcome, index) => outcome.status === "rejected"
        ? tasks[index][0]
        : null)
      .filter(Boolean);

    if (failed.length) {
      message.textContent =
        "Report ready, but some sections could not load: " +
        failed.join(", ") + ".";
    } else {
      message.textContent =
        "Your birthday story is ready! ✨";
    }

  } catch (error) {
    message.textContent = "Error: " + error.message;

  } finally {
    discoverBtn.disabled = false;
    discoverBtn.innerHTML =
      'Discover My Birthday <span>→</span>';
  }
}
