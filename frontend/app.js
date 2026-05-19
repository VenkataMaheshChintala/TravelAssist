/* ============================================================
   TGSRTC – Hyderabad Bus Finder  |  app.js  (Vanilla JS)
   ============================================================ */

const API = 'http://localhost:8080/api/bus';

/* ── Mock data (kept identical to the React version) ── */
const MOCK_ROUTES = {
  "Charminar-Mehdipatnam": [
    { name: "Charminar",   coords: [17.3616, 78.4747] },
    { name: "City College", coords: [17.3664, 78.4716] },
    { name: "Afzal Gunj",  coords: [17.3768, 78.4777] },
    { name: "Nampally",    coords: [17.3916, 78.4682] },
    { name: "Lakdikapul",  coords: [17.4011, 78.4616] },
    { name: "Mehdipatnam", coords: [17.3916, 78.4300] }
  ],
  "Secunderabad-Ameerpet": [
    { name: "Secunderabad", coords: [17.4399, 78.4983] },
    { name: "Patny Center", coords: [17.4385, 78.4891] },
    { name: "Begumpet",     coords: [17.4447, 78.4664] },
    { name: "Ameerpet",     coords: [17.4375, 78.4482] }
  ],
  "Ameerpet-Kukatpally": [
    { name: "Ameerpet",     coords: [17.4375, 78.4482] },
    { name: "S.R. Nagar",   coords: [17.4435, 78.4430] },
    { name: "Erragadda",    coords: [17.4528, 78.4359] },
    { name: "Bharat Nagar", coords: [17.4615, 78.4287] },
    { name: "Moosapet",     coords: [17.4682, 78.4230] },
    { name: "Kukatpally",   coords: [17.4849, 78.4079] }
  ]
};

const MOCK_COORDS = {
  "Charminar":   [17.3616, 78.4747],
  "Mehdipatnam": [17.3916, 78.4300],
  "Secunderabad":[17.4399, 78.4983],
  "Ameerpet":    [17.4375, 78.4482],
  "Kukatpally":  [17.4849, 78.4079],
  "Jubilee Hills":[17.4300, 78.4069],
  "Banjara Hills":[17.4156, 78.4367],
  "Hitec City":  [17.4435, 78.3772],
  "Gachibowli":  [17.4401, 78.3489],
  "Miyapur":     [17.4968, 78.3614],
  "Ameerpet (Current Location)": [17.4375, 78.4482]
};

/* ── State ── */
const state = {
  source: '',
  dest: '',
  results: null,
  loading: false,
  dark: false,
  osrmCoords: null,
  dynamicCoords: null,
  dynamicStops: null,
  selectedBusStops: null,
  liveBusIndex: 0,
  liveBusTimer: null,
  favorites: [],
  recents: [],
  map: null,
  mapLayers: []
};

/* ── Leaflet icons ── */
function makePinIcon(color) {
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="width:24px;height:24px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 3px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">
             <div style="width:8px;height:8px;background:white;border-radius:50%;"></div>
           </div>`,
    iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [0, -24]
  });
}

const sourceIcon = makePinIcon('#10b981');
const destIcon   = makePinIcon('#ef4444');
const liveBusIcon = L.divIcon({
  className: 'live-bus-pin',
  html: `<div style="width:32px;height:32px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 15px rgba(59,130,246,.8);display:flex;align-items:center;justify-content:center;font-size:16px;">🚌</div>`,
  iconSize: [32, 32], iconAnchor: [16, 16]
});

/* ── DOM refs ── */
const $ = id => document.getElementById(id);
const srcInput       = $('source-input');
const destInput      = $('dest-input');
const srcSuggestions = $('source-suggestions');
const destSuggestions= $('dest-suggestions');
const searchBtn      = $('search-btn');
const searchLabel    = $('search-btn-label');
const searchIcon     = searchBtn.querySelector('.search-icon');
const spinner        = searchBtn.querySelector('.spinner');
const errorBanner    = $('error-banner');
const mapWrapper     = $('map-wrapper');
const directSection  = $('direct-section');
const directLabel    = $('direct-label');
const directList     = $('direct-list');
const connectSection = $('connecting-section');
const connectList    = $('connecting-list');
const emptyState     = $('empty-state');
const quickLinks     = $('quick-links');
const favsSection    = $('favourites-section');
const favsList       = $('favourites-list');
const recentsSection = $('recents-section');
const recentsList    = $('recents-list');
const favBtn         = $('fav-btn');

/* ── Persistence ── */
function loadStorage() {
  try { state.favorites = JSON.parse(localStorage.getItem('tgsrtc_favorites')) || []; } catch { state.favorites = []; }
  try { state.recents   = JSON.parse(localStorage.getItem('tgsrtc_recent_searches')) || []; } catch { state.recents = []; }
}
function saveFavs()    { localStorage.setItem('tgsrtc_favorites', JSON.stringify(state.favorites)); }
function saveRecents() { localStorage.setItem('tgsrtc_recent_searches', JSON.stringify(state.recents)); }

/* ── Theme ── */
$('theme-toggle').addEventListener('click', () => {
  state.dark = !state.dark;
  document.documentElement.setAttribute('data-theme', state.dark ? 'dark' : 'light');
  if (state.map) updateMapTiles();
});

let tileLayer = null;
function updateMapTiles() {
  if (!state.map || !tileLayer) return;
  tileLayer.setUrl(state.dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png');
}

/* ── Autocomplete ── */
let acTimers = { src: null, dest: null };

function setupAutocomplete(input, listEl, key) {
  input.addEventListener('input', () => {
    clearTimeout(acTimers[key]);
    const val = input.value.trim();
    if (val.length < 2) { listEl.hidden = true; return; }
    acTimers[key] = setTimeout(() => fetchSuggestions(val, listEl, input), 200);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { listEl.hidden = true; handleSearch(); }
    if (e.key === 'Escape') listEl.hidden = true;
  });
  document.addEventListener('mousedown', e => {
    if (!input.closest('.input-wrapper').contains(e.target)) listEl.hidden = true;
  });
}

async function fetchSuggestions(q, listEl, input) {
  try {
    const res = await fetch(`${API}/stops?query=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderSuggestions(data, listEl, input);
  } catch {
    listEl.hidden = true;
  }
}

function renderSuggestions(items, listEl, input) {
  listEl.innerHTML = '';
  if (!items.length) { listEl.hidden = true; return; }
  items.forEach(name => {
    const li = document.createElement('li');
    li.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>${name}`;
    li.addEventListener('mousedown', () => { input.value = name; listEl.hidden = true; syncState(); });
    listEl.appendChild(li);
  });
  listEl.hidden = false;
}

setupAutocomplete(srcInput,  srcSuggestions,  'src');
setupAutocomplete(destInput, destSuggestions, 'dest');

srcInput.addEventListener('input',  syncState);
destInput.addEventListener('input', syncState);

function syncState() {
  state.source = srcInput.value.trim();
  state.dest   = destInput.value.trim();
  updateSearchBtn();
  updateFavBtn();
}

/* ── Use Location ── */
$('use-location-btn').addEventListener('click', () => {
  if (!navigator.geolocation) { alert('Geolocation not supported.'); return; }
  srcInput.value = 'Locating…';
  navigator.geolocation.getCurrentPosition(
    () => { setTimeout(() => { srcInput.value = 'Ameerpet (Current Location)'; syncState(); }, 600); },
    ()  => { srcInput.value = ''; alert('Unable to retrieve your location.'); syncState(); }
  );
});

/* ── Swap ── */
$('swap-btn').addEventListener('click', () => {
  [srcInput.value, destInput.value] = [destInput.value, srcInput.value];
  syncState();
});

/* ── Favourites ── */
favBtn.addEventListener('click', () => {
  const s = state.source, d = state.dest;
  if (!s || !d) return;
  const idx = state.favorites.findIndex(f => f.source === s && f.dest === d);
  if (idx === -1) state.favorites.push({ source: s, dest: d });
  else state.favorites.splice(idx, 1);
  saveFavs();
  updateFavBtn();
  renderQuickLinks();
});

function updateFavBtn() {
  const active = state.favorites.some(f => f.source === state.source && f.dest === state.dest);
  favBtn.classList.toggle('active', active);
}

/* ── Search Button state ── */
function updateSearchBtn() {
  const canSearch = state.source && state.dest && state.source !== 'Locating…';
  searchBtn.disabled = state.loading || !canSearch;
}

/* ── Quick Links render ── */
function renderQuickLinks() {
  const hasFavs    = state.favorites.length > 0;
  const hasRecents = state.recents.length > 0;

  quickLinks.hidden = !(hasFavs || hasRecents) || state.results !== null;

  favsSection.hidden = !hasFavs;
  if (hasFavs) {
    favsList.innerHTML = '';
    state.favorites.forEach(f => favsList.appendChild(makeChip(f, 'fav-chip')));
  }

  recentsSection.hidden = !hasRecents;
  if (hasRecents) {
    recentsList.innerHTML = '';
    state.recents.forEach(f => recentsList.appendChild(makeChip(f, 'recent-chip')));
  }
}

function makeChip({ source, dest }, cls) {
  const btn = document.createElement('button');
  btn.className = `chip ${cls}`;
  btn.innerHTML = `<span style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${source}</span>
    <svg class="chip-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    <span style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${dest}</span>`;
  btn.addEventListener('click', () => handleSearch(source, dest));
  return btn;
}

$('clear-recents-btn').addEventListener('click', () => {
  state.recents = [];
  localStorage.removeItem('tgsrtc_recent_searches');
  renderQuickLinks();
});

/* ── Main Search ── */
async function handleSearch(overrideSrc, overrideDest) {
  const s = (typeof overrideSrc === 'string' ? overrideSrc : state.source).trim();
  const d = (typeof overrideDest === 'string' ? overrideDest : state.dest).trim();
  if (!s || !d) return;

  if (overrideSrc) { srcInput.value = s; destInput.value = d; syncState(); }

  setLoading(true);
  clearResults();

  try {
    const res = await fetch(`${API}/search?source=${encodeURIComponent(s)}&destination=${encodeURIComponent(d)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Backend server error');
    }
    state.results = await res.json();
    renderResults(s, d);
    saveRecentSearch(s, d);
    fetchMapRoute(s, d);
  } catch (err) {
    showError('⚠️ ' + err.message);
  } finally {
    setLoading(false);
  }
}

/* ── Loading state helpers ── */
function setLoading(on) {
  state.loading = on;
  searchIcon.style.display = on ? 'none' : '';
  spinner.style.display    = on ? '' : 'none';
  searchLabel.textContent = on ? 'Searching…' : 'Search Buses';
  updateSearchBtn();
}

/* ── Results render ── */
function clearResults() {
  errorBanner.hidden = true;
  mapWrapper.hidden  = true;
  directSection.hidden   = true;
  connectSection.hidden  = true;
  emptyState.hidden      = true;
  quickLinks.hidden      = true;
  directList.innerHTML   = '';
  connectList.innerHTML  = '';
  clearMapLayers();
  stopLiveBus();
}

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.hidden = false;
}

function renderResults(s, d) {
  if (!state.results) return;

  const directs    = state.results.filter(r => r.type === 'direct');
  const connecting = state.results.filter(r => r.type === 'connecting');

  if (state.results.length === 0) { emptyState.hidden = false; return; }

  if (directs.length > 0) {
    directLabel.textContent = `Direct Routes — ${directs.length} found`;
    directs.forEach(item => directList.appendChild(makeBusCard(item)));
    directSection.hidden = false;
  }

  if (connecting.length > 0 && directs.length === 0) {
    connecting.forEach((item, i) => connectList.appendChild(makeTimelineStep(item, i, connecting.length)));
    connectSection.hidden = false;
  }
}

/* ── Bus Card ── */
function makeBusCard(item) {
  const card = document.createElement('div');
  card.className = 'bus-card';

  card.innerHTML = `
    <button class="bus-card-header" aria-expanded="false">
      <div class="bus-card-left">
        <div class="bus-icon-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 19v2M17 19v2M2 14h20"/></svg>
        </div>
        <div>
          <p class="bus-name">Bus ${item.bus}</p>
          <p class="bus-sub">Direct service</p>
        </div>
      </div>
      <div class="bus-card-right">
        <div class="route-preview">
          <span>${item.from}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          <span>${item.to}</span>
        </div>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </button>
    <div class="bus-card-body"></div>
  `;

  const header  = card.querySelector('.bus-card-header');
  const body    = card.querySelector('.bus-card-body');
  const chevron = card.querySelector('.chevron');
  let loaded = false;

  header.addEventListener('click', async () => {
    const open = body.classList.toggle('open');
    chevron.classList.toggle('open', open);
    header.setAttribute('aria-expanded', open);

    if (open && !loaded) {
      loaded = true;
      body.innerHTML = `<div class="body-loading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>`;
      try {
        const res = await fetch(`${API}/route-details?bus=${encodeURIComponent(item.bus)}&source=${encodeURIComponent(item.from)}&destination=${encodeURIComponent(item.to)}`);
        if (!res.ok) throw new Error('Failed to load route details');
        const data = await res.json();
        renderCardBody(body, data);
        if (data.stops) {
          state.selectedBusStops = data.stops;
          fetchBusStopsRoute(data.stops);
        }
      } catch {
        body.innerHTML = `<p style="font-size:12px;color:var(--red);padding:8px 0;">Failed to load route details.</p>`;
      }
    }
  });

  return card;
}

function renderCardBody(body, data) {
  const fare = Math.floor(15 + data.stops.length * 2.5);
  const depsHtml = data.departures.length
    ? data.departures.map(t => `<span class="departure-chip">${t.substring(0,5)}</span>`).join('')
    : `<span style="font-size:12px;color:var(--text-muted)">No scheduled departures today</span>`;

  const stopsHtml = data.stops.map((s, i) => {
    const name = s.stop_name || s;
    const isTerminal = i === 0 || i === data.stops.length - 1;
    return `<div class="stop-item ${isTerminal ? 'terminal' : ''}">${name}</div>`;
  }).join('');

  body.innerHTML = `
    <p class="body-section-title">Next Departures</p>
    <div class="departure-chips">${depsHtml}</div>
    <p class="body-section-title">Intermediate Stops</p>
    <div class="stops-timeline">${stopsHtml}</div>
    <div class="card-footer">
      <span class="fare-badge">Est. Fare: ₹${fare}</span>
    </div>
  `;
}

/* ── Timeline step ── */
function makeTimelineStep(item, i, total) {
  const div = document.createElement('div');
  div.className = 'timeline-step';
  div.innerHTML = `
    <div class="step-dot">${i + 1}</div>
    <p class="step-text">${item.step}</p>
    ${i < total - 1 ? `<p class="step-change">Change buses here</p>` : ''}
  `;
  return div;
}

/* ── Map ── */
function ensureMap() {
  if (state.map) return;
  state.map = L.map('map', { zoomControl: false });
  tileLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    { attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19 }
  ).addTo(state.map);
  state.map.setView([17.3850, 78.4867], 12);
}

function clearMapLayers() {
  state.mapLayers.forEach(l => { try { state.map && state.map.removeLayer(l); } catch{} });
  state.mapLayers = [];
}

function addMapLayer(layer) {
  if (state.map) { layer.addTo(state.map); state.mapLayers.push(layer); }
}

async function fetchMapRoute(s, d) {
  const routeKey = `${s}-${d}`;
  let waypoints = [];
  let sCoord = MOCK_COORDS[s];
  let dCoord = MOCK_COORDS[d];

  if (MOCK_ROUTES[routeKey]) {
    waypoints = MOCK_ROUTES[routeKey].map(r => r.coords);
  } else {
    if (!sCoord) sCoord = await geocode(s);
    if (!dCoord) dCoord = await geocode(d);
    if (sCoord && dCoord) waypoints = [sCoord, dCoord];
  }

  if (waypoints.length < 2) return;
  drawMapForWaypoints(waypoints, sCoord, dCoord, s, d, MOCK_ROUTES[routeKey]);
}

async function fetchBusStopsRoute(stops) {
  let wps = stops.map(s => [s.stop_lat, s.stop_lon]).filter(c => c[0] && c[1]);
  if (wps.length > 95) wps = wps.filter((_, i) => i % Math.ceil(wps.length / 95) === 0 || i === wps.length - 1);
  if (wps.length < 2) return;

  const sCoord = wps[0], dCoord = wps[wps.length - 1];
  drawMapForWaypoints(wps, sCoord, dCoord, '', '', null, true);
}

async function drawMapForWaypoints(wps, sCoord, dCoord, srcLabel, dstLabel, routeData, skipAnim) {
  ensureMap();
  clearMapLayers();
  stopLiveBus();
  mapWrapper.hidden = false;

  const cStr = wps.map(c => `${c[1]},${c[0]}`).join(';');
  let path = wps;

  try {
    const res  = await fetch(`https://router.project-osrm.org/route/v1/driving/${cStr}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes && data.routes[0]) {
      path = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
    }
  } catch {}

  const dark = state.dark;
  addMapLayer(L.polyline(path, { color: dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.2)', weight: 9, lineCap: 'round', lineJoin: 'round' }));
  addMapLayer(L.polyline(path, { color: dark ? '#38bdf8' : '#0ea5e9', weight: 5, opacity: .9, lineCap: 'round', lineJoin: 'round' }));

  if (sCoord && sCoord[0]) {
    addMapLayer(L.marker(sCoord, { icon: sourceIcon }).bindPopup(`<strong>Start:</strong> ${srcLabel}`));
  }
  if (dCoord && dCoord[0]) {
    addMapLayer(L.marker(dCoord, { icon: destIcon }).bindPopup(`<strong>End:</strong> ${dstLabel}`));
  }

  // Intermediate stops from routeData
  if (routeData) {
    routeData.slice(1, -1).forEach(stop => {
      addMapLayer(L.circleMarker(stop.coords, {
        radius: 5, color: dark ? '#38bdf8' : '#0ea5e9',
        fillColor: dark ? '#0f172a' : 'white', fillOpacity: 1, weight: 2.5
      }).bindPopup(`<strong>${stop.name}</strong>`));
    });
  }

  // Fit bounds
  const allPoints = path.filter(c => c && c[0]);
  if (allPoints.length > 1) state.map.fitBounds(L.latLngBounds(allPoints), { padding: [32, 32] });

  // Live bus animation
  if (path.length > 2) startLiveBus(path);
}

async function geocode(query) {
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Hyderabad')}&limit=1`);
    const data = await res.json();
    if (data && data.length) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {}
  return null;
}

/* ── Live Bus Animation ── */
let liveBusMarker = null;

function startLiveBus(path) {
  stopLiveBus();
  state.liveBusIndex = 0;

  const interval = Math.max(50, 10000 / path.length);
  liveBusMarker = L.marker(path[0], { icon: liveBusIcon }).bindPopup('Live Tracking (Simulated)');
  if (state.map) { liveBusMarker.addTo(state.map); state.mapLayers.push(liveBusMarker); }

  state.liveBusTimer = setInterval(() => {
    state.liveBusIndex = (state.liveBusIndex + 1) % path.length;
    const pos = path[state.liveBusIndex];
    if (pos && pos[0] && liveBusMarker) liveBusMarker.setLatLng(pos);
  }, interval);
}

function stopLiveBus() {
  if (state.liveBusTimer) { clearInterval(state.liveBusTimer); state.liveBusTimer = null; }
  if (liveBusMarker) {
    try { state.map && state.map.removeLayer(liveBusMarker); } catch {}
    liveBusMarker = null;
  }
}

/* ── Recent Searches ── */
function saveRecentSearch(s, d) {
  state.recents = [{ source: s, dest: d }, ...state.recents.filter(r => !(r.source === s && r.dest === d))].slice(0, 4);
  saveRecents();
}

/* ── Init ── */
loadStorage();
renderQuickLinks();
updateSearchBtn();
updateFavBtn();

// Search button click
searchBtn.addEventListener('click', () => handleSearch());

// Show quick links only when no results
Object.defineProperty(state, 'results', {
  get() { return this._results; },
  set(v) {
    this._results = v;
    quickLinks.hidden = v !== null;
    if (v === null) renderQuickLinks();
  }
});
// Re-initialize so the setter fires on first use
state._results = null;
