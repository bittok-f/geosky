'use strict';
const navigationContainer = document.querySelector('.nav');
const navUpdatesContainer = document.querySelector('.nav-weather');
const map = document.getElementById('map');
const weatherContainer = document.querySelector('.weather__wrapper');
const form = document.querySelector('.form');
const formInput = document.querySelector('.form__input');
const weatherInfo = document.querySelector('.weather__container');
const recentContainer = document.querySelector('.recent--list');
const TIMEOUT_SEC = 10;

////Helper Functions

const timeout = function (s) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error(`Request took too long! Timeout after ${s} seconds`));
    }, s * 1000);
  });
};
///Get JSON
const getJSON = async function (url) {
  try {
    const res = await Promise.race([fetch(url), timeout(TIMEOUT_SEC)]);
    const data = await res.json();

    if (!res.ok) throw new Error(`${data.message} (${res.status})`);
    return data;
  } catch (err) {
    throw err;
  }
};

class App {
  #map;
  locale = navigator.locale;
  #appData;
  #renderedWeatherData = [];
  #mapZoomLevel = 12;
  #DATA_PER_PAGE = 4;
  #weatherAPI_URL = `https://api.weatherapi.com/v1/current.json?key=c1fefd6a691d48a7bf0171403221707&q=`;
  #errorMessage = `Location not found. Try another country/city/town`;
  #navUpdatesContainer = document.querySelector('.nav-weather');
  #weatherContainer = document.querySelector('.weather__wrapper');

  constructor() {
    this.#appData = {
      query: [],
      weatherData: {},
      searchHistory: [],
    };
    // localStorage.clear();
    formInput.focus();
    this.#getposition();
    this.submitSearchResults();
    this.getLocalStorage();

    this.#weatherContainer.addEventListener(
      'click',
      this.#scrollToView.bind(this)
    );

    recentContainer.addEventListener(
      'click',
      this.handleRecentSearch.bind(this)
    );
  }
  /////Get current coordinates based on location
  #getposition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this.#getCoords.bind(this),
        function () {
          alert('Failed to get location');
        }
      );
    }
  }

  ////if success getting position
  #getCoords(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    //Leaflet map code set center of map based of current coords
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    ////Handling Map clicks
    // this.#map.on('click', this.hideSearch);
  }

  ////render error message
  #renderError(container, message = 'error') {
    const html = `
      <div class="error">
          <svg class="error__icon">
            <use xlink:href="assets/sprite.svg#icon-alert-triangle"></use>
          </svg>
          <p class="error_message">${message}</p>
        </div>
      </div>
    `;

    container.innerHTML = '';
    container.insertAdjacentHTML('afterbegin', html);
  }

  ////Get weather updates
  async #getWeather(query) {
    ////1. check if query is already included
    if (this.#appData.query.includes(query)) return;

    ////2. Render loader
    this.#renderLoader(this.#weatherContainer);

    ////3. add query to the query and search history array
    this.#appData.query.push(query);

    if (!this.#appData.searchHistory.includes(query))
      this.#appData.searchHistory.push(query);

    try {
      const data = await getJSON(`${this.#weatherAPI_URL}${query}`);

      this.#appData.weatherData = {
        uniqueID:
          data.current.last_updated_epoch +
          Math.trunc(Math.random() * 1000000000),
        currentCondition: data.current.condition.text,
        currentTemp_Deg: data.current.temp_c,
        currentTemp_Fh: data.current.temp_f,
        currentHumidity: data.current.humidity,
        lastUpdate: data.current.last_updated,
        localTime: data.location.localtime,
        windDegree: data.current.wind_deg,
        windSpeed_kph: data.current.wind_kph,
        windSpeed_mph: data.current.wind_mph,
        country: data.location.country,
        region: data.location.name,
        icon: data.current.condition.icon,
        regionCoords: [data.location.lat, data.location.lon],
      };

      this.#renderedWeatherData.push(this.#appData.weatherData);

      ////4.Display data
      this.renderWeather(
        this.#weatherContainer,
        this.weatherMarkUp(this.#renderedWeatherData)
      );

      this.scrollIntoWeatherDetailsView();

      this.#generateSearchHistory(this.#appData.searchHistory);
      this.setLocalStorage();

      ////render Marker
      this.#renderMarkerOnMap();
    } catch (err) {
      /////delete last query that was not found by API
      this.#appData.query.splice(-1);
      this.#appData.searchHistory.splice(-1);
      this.#renderError(this.#weatherContainer, this.#errorMessage);

      ////Re-render weather after displaying error message
      setTimeout(() => {
        this.renderWeather(
          this.#weatherContainer,
          this.weatherMarkUp(this.#renderedWeatherData)
        );
      }, 3000);
    }
  }

  scrollIntoWeatherDetailsView() {
    document.getElementById('weather-view-details').scrollIntoView({
      behaviour: 'smooth',
      block: 'end',
    });
  }

  ////Handling user search
  submitSearchResults() {
    form.addEventListener('submit', this.#loadSearch.bind(this));
  }

  ////Processing the search query
  async #loadSearch(e) {
    e.preventDefault();
    ////1.Get user query
    const query = form.querySelector('.form__input').value.trim();

    ////2.check to see if there's a query
    if (!query) return;

    ////3.Fetch data
    this.#getWeather(query);

    ////4. Scroll to view
    this.scrollIntoWeatherDetailsView();
    ////5.Empty the search input
    form.querySelector('.form__input').value = '';
  }

  ////render marker on map
  #renderMarkerOnMap() {
    this.#renderedWeatherData.forEach(data => {
      const weatherIcon = `<img src="${data.icon}" alt="weather-icon" class="weather__img">`;
      L.marker(data.regionCoords)
        .addTo(this.#map)
        .bindPopup(
          L.popup({
            maxWidth: 350,
            minWidth: 100,
            autoClose: false,
            closeOnEscapeKey: false,
            closeButton: false,
            closeOnClick: false,
            className: `weather__overview`,
          })
        )
        .setPopupContent(
          `${data.region}, ${data.country}, ${data.currentCondition} ${weatherIcon} `
        )
        .openPopup();
    });
  }

  ////Generate Weather Markup
  weatherMarkUp(data) {
    return data
      .slice(-this.#DATA_PER_PAGE)
      .map(this.generateMarkupPreview)
      .join('');
  }

  generateMarkupPreview(info) {
    return `
  <div class="weather__container" data-unique="${info.uniqueID}">
      <h2 class="weather__heading">Region:</h2>
      <p class="weather__text">${info.region}, ${info.country}</p>
      <img src="${info.icon}" alt="weather-icon" class="weather__img" />
      <p class="weather__text">${info.currentCondition}</p>

      <div class="weather__info--more">
        <h2 class="weather__heading">Updated at: </h2>
        <p class="weather__text">${info.lastUpdate}</p>
        <h2 class="weather__heading">Local Time: </h2>
        <p class="weather__text">${info.localTime}</p>
        <h2 class="weather__heading">Temp(℃): </h2>
        <p class="weather__text">${info.currentTemp_Deg} ℃</p>
        <h2 class="weather__heading">Temp(℉): </h2>
        <p class="weather__text">${info.currentTemp_Fh} ℉</p>
      </div>
    </div>
  `;
  }

  ////Loader generator
  #renderLoader(container) {
    const html = `
    <div class="load">
      <svg class="load__icon">
        <use xlink:href="assets/sprite.svg#icon-loader"></use>
      </svg>
    </div>
  `;
    container.innerHTML = '';
    container.insertAdjacentHTML('afterbegin', html);
  }

  ////display Weather
  renderWeather(container, markup) {
    container.innerHTML = '';
    container.insertAdjacentHTML('afterbegin', markup);
  }

  ////move to marker on click
  #scrollToView(e) {
    const clickedEl = e.target.closest('.weather__container');

    if (!clickedEl) return;

    map.scrollIntoView({
      behaviour: 'smooth',
      block: 'center',
      inline: 'center',
    });

    const selectedWeather = this.#renderedWeatherData.find(
      weather => weather.uniqueID === +clickedEl.dataset.unique
    );
    this.#map.setView(selectedWeather.regionCoords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  #generateSearchHistory(data) {
    if (!data || (Array.isArray(data) && data.length === 0)) return;

    const markup = data
      .slice(-this.#DATA_PER_PAGE)
      .map(search => {
        return `<li class="recent--item">${search}</li>`;
      })
      .join(' ');

    recentContainer.innerHTML = '';
    recentContainer.insertAdjacentHTML('afterbegin', markup);
  }

  setLocalStorage() {
    localStorage.setItem(
      'recent',
      JSON.stringify(this.#appData.searchHistory.slice(-this.#DATA_PER_PAGE))
    );
  }

  getLocalStorage() {
    const data = localStorage.getItem('recent');
    if (data) this.#appData.searchHistory = JSON.parse(data);

    this.#generateSearchHistory(JSON.parse(data));
  }

  handleRecentSearch(e) {
    const clicked = e.target.closest('.recent--item');
    if (!clicked) return;
    this.#getWeather(clicked.textContent);
  }
}
const startApp = new App();
