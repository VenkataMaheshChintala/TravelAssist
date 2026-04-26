import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Create premium custom map pins
const createPinIcon = (color) => L.divIcon({
  className: 'custom-pin',
  html: `<div style="width: 24px; height: 24px; background-color: ${color}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
    <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24]
});

const sourceIcon = createPinIcon('#10b981'); // Emerald Green
const destIcon = createPinIcon('#ef4444');   // Rose Red

const liveBusIcon = L.divIcon({
  className: 'live-bus-pin',
  html: `<div style="width: 32px; height: 32px; background-color: #3b82f6; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(59,130,246,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: pulse 2s infinite;">
    <span style="font-size: 16px;">🚌</span>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const MOCK_ROUTES = {
  "Charminar-Mehdipatnam": [
    { name: "Charminar", coords: [17.3616, 78.4747] },
    { name: "City College", coords: [17.3664, 78.4716] },
    { name: "Afzal Gunj", coords: [17.3768, 78.4777] },
    { name: "Nampally", coords: [17.3916, 78.4682] },
    { name: "Lakdikapul", coords: [17.4011, 78.4616] },
    { name: "Mehdipatnam", coords: [17.3916, 78.4300] }
  ],
  "Secunderabad-Ameerpet": [
    { name: "Secunderabad", coords: [17.4399, 78.4983] },
    { name: "Patny Center", coords: [17.4385, 78.4891] },
    { name: "Begumpet", coords: [17.4447, 78.4664] },
    { name: "Ameerpet", coords: [17.4375, 78.4482] }
  ],
  "Ameerpet-Kukatpally": [
    { name: "Ameerpet", coords: [17.4375, 78.4482] },
    { name: "S.R. Nagar", coords: [17.4435, 78.4430] },
    { name: "Erragadda", coords: [17.4528, 78.4359] },
    { name: "Bharat Nagar", coords: [17.4615, 78.4287] },
    { name: "Moosapet", coords: [17.4682, 78.4230] },
    { name: "Kukatpally", coords: [17.4849, 78.4079] }
  ]
};

const MOCK_COORDS = {
  "Charminar": [17.3616, 78.4747],
  "Mehdipatnam": [17.3916, 78.4300],
  "Secunderabad": [17.4399, 78.4983],
  "Ameerpet": [17.4375, 78.4482],
  "Kukatpally": [17.4849, 78.4079],
  "Jubilee Hills": [17.4300, 78.4069],
  "Banjara Hills": [17.4156, 78.4367],
  "Hitec City": [17.4435, 78.3772],
  "Gachibowli": [17.4401, 78.3489],
  "Miyapur": [17.4968, 78.3614],
  "Ameerpet (Current Location)": [17.4375, 78.4482],
};

/* ─── tiny icon components ─────────────────────────────────────── */
const BusIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <path d="M2 10h20M7 19v2M17 19v2M2 14h20"/>
  </svg>
);

const ArrowIcon = () => (
  <svg className="w-4 h-4 text-sky-300 dark:text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

const SwapIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4"/>
  </svg>
);

const MapPinIcon = ({ filled }) => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
    <circle cx="12" cy="9" r="2.5"/>
  </svg>
);

const LocationIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
  </svg>
);

const MoonIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const SunIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

/* ─── animation variants ────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:   { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const dropdownVariants = {
  hidden: { opacity: 0, y: -4, scaleY: 0.95 },
  show:   { opacity: 1, y: 0,  scaleY: 1,    transition: { duration: 0.15, ease: 'easeOut' } },
  exit:   { opacity: 0, y: -4, scaleY: 0.95, transition: { duration: 0.1 } },
};

const staggerContainer = {
  show: { transition: { staggerChildren: 0.07 } },
};

/* ─── autocomplete hook ─────────────────────────────────────────── */
function useAutocomplete(value) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`http://localhost:8080/api/bus/stops?query=${encodeURIComponent(value.trim())}`);
        if (!res.ok) throw new Error("Backend unavailable");
        const data = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch (err) {
        console.error("Autocomplete fetch failed:", err);
        setSuggestions([]);
        setOpen(false);
      }
    }, 200); // 200 ms debounce

    return () => clearTimeout(timerRef.current);
  }, [value]);

  const close = useCallback(() => setOpen(false), []);

  return { suggestions, open, close };
}

/* ─── StopInput component ───────────────────────────────────────── */
function StopInput({ id, label, value, onChange, onKeyDown, placeholder, filled, onUseLocation }) {
  const wrapperRef = useRef(null);
  const { suggestions, open, close } = useAutocomplete(value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [close]);

  const handleSelect = (name) => {
    onChange(name);
    close();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400 z-10">
        <MapPinIcon filled={filled} />
      </span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm text-slate-700 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900 focus:border-sky-300 dark:focus:border-sky-700"
      />
      {onUseLocation && (
        <button
          onClick={onUseLocation}
          title="Use my location"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors z-10"
        >
          <LocationIcon />
        </button>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.ul
            key="dropdown"
            variants={dropdownVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ originY: 0 }}
            className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-800 border border-sky-100 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden"
          >
            {suggestions.map((name, i) => (
              <li
                key={i}
                onMouseDown={() => handleSelect(name)}   // mousedown fires before input blur
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
              >
                <span className="text-sky-400 flex-shrink-0">
                  <MapPinIcon />
                </span>
                {name}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── DirectBusCard component ─────────────────────────────────────── */
const DirectBusCard = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const toggleExpand = async () => {
    if (!expanded && !details) {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:8080/api/bus/route-details?bus=${encodeURIComponent(item.bus)}&source=${encodeURIComponent(item.from)}&destination=${encodeURIComponent(item.to)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to load route details');
        }
        const data = await res.json();
        setDetails(data);
        if (item.onRouteSelect && data.stops) {
          item.onRouteSelect(data.stops);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  };

  const fare = details ? Math.floor(15 + details.stops.length * 2.5) : null;

  return (
    <motion.div variants={fadeUp} className="bg-white dark:bg-slate-800 border border-sky-100 dark:border-slate-700 rounded-xl shadow-sm mb-2.5 overflow-hidden">
      <button 
        onClick={toggleExpand}
        className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-sky-50 dark:hover:bg-slate-700 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-50 dark:bg-slate-900 text-sky-500">
            <BusIcon />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Bus {item.bus}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Direct service</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <span className="truncate max-w-[56px]">{item.from}</span>
            <ArrowIcon />
            <span className="truncate max-w-[56px]">{item.to}</span>
          </div>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-sky-50 dark:border-slate-700 px-4 py-4 bg-slate-50/50 dark:bg-slate-800/50"
          >
            {loading ? (
              <div className="flex justify-center py-4">
                <svg className="w-5 h-5 text-sky-500 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              </div>
            ) : details ? (
              <div className="space-y-5">
                {/* Departures */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Next Departures</p>
                  {details.departures.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {details.departures.map((time, idx) => (
                        <span key={idx} className="bg-sky-100 dark:bg-sky-900/30 shadow-sm border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-400 text-xs font-medium px-2.5 py-1 rounded-md">
                          {time.substring(0, 5)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-md py-1.5 px-3 inline-block">No scheduled departures today</p>
                  )}
                </div>

                {/* Stops Timeline */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Intermediate Stops</p>
                  <div className="relative border-l-2 border-slate-100 dark:border-slate-700/50 ml-3 space-y-4 py-1">
                    <AnimatePresence>
                      {details.stops.map((stop, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === details.stops.length - 1;
                        const stopName = stop.stop_name || stop; // fallback for strings
                        return (
                          <div key={idx} className="relative pl-5 flex items-center">
                            <span className={`absolute -left-[5px] w-2 h-2 rounded-full ${isFirst || isLast ? 'bg-sky-500 ring-4 ring-sky-50 dark:ring-slate-800' : 'bg-slate-300 dark:bg-slate-600'}`} />
                            <p className={`text-xs ${isFirst || isLast ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                              {stopName}
                            </p>
                          </div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Fare & Times */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                  <div className="flex gap-2">
                    {details.departures.map((time, i) => (
                      <span key={i} className="px-2 py-1 bg-sky-50 dark:bg-slate-700 text-sky-600 dark:text-sky-300 text-xs font-medium rounded-md">{time}</span>
                    ))}
                  </div>
                  <div className="text-sm font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-lg">
                    Est. Fare: ₹{fare}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md">Failed to load route details.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ─── main component ────────────────────────────────────────────── */
const BusFinder = () => {
  const [source, setSource] = useState('');
  const [dest,   setDest]   = useState('');
  const [results,  setResults]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [osrmRouteCoords, setOsrmRouteCoords] = useState(null);
  const [dynamicCoords, setDynamicCoords] = useState(null);
  const [dynamicIntermediateStops, setDynamicIntermediateStops] = useState(null);
  const [selectedBusStops, setSelectedBusStops] = useState(null);
  
  // Live Bus Tracking state
  const [liveBusIndex, setLiveBusIndex] = useState(0);

  // Favorites
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tgsrtc_favorites')) || []; }
    catch { return []; }
  });

  const toggleFavorite = (src, dst) => {
    if (!src.trim() || !dst.trim()) return;
    setFavorites(prev => {
      const exists = prev.find(f => f.source === src && f.dest === dst);
      let updated;
      if (exists) updated = prev.filter(f => !(f.source === src && f.dest === dst));
      else updated = [...prev, { source: src, dest: dst }];
      localStorage.setItem('tgsrtc_favorites', JSON.stringify(updated));
      return updated;
    });
  };

  // Re-fetch OSRM route if user clicks a specific bus route with exact coordinates
  useEffect(() => {
    if (!selectedBusStops || selectedBusStops.length < 2) return;
    
    let waypoints = selectedBusStops.map(s => [s.stop_lat, s.stop_lon]).filter(c => c[0] && c[1]);
    
    // Downsample to avoid OSRM URL limit (max ~100 waypoints)
    if (waypoints.length > 95) {
      waypoints = waypoints.filter((_, i) => i % Math.ceil(waypoints.length / 95) === 0 || i === waypoints.length - 1);
    }
    
    if (waypoints.length >= 2) {
      const coordsString = waypoints.map(c => `${c[1]},${c[0]}`).join(';');
      fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`)
        .then(res => res.json())
        .then(data => {
          if (data.routes && data.routes[0]) {
             const latLngs = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
             setOsrmRouteCoords(latLngs);
             setDynamicIntermediateStops(selectedBusStops.slice(1, -1).map(s => ({ name: s.stop_name, coords: [s.stop_lat, s.stop_lon] })));
             setLiveBusIndex(0); // reset bus
          }
        })
        .catch(err => console.error("Failed to load accurate bus geometry:", err));
    }
  }, [selectedBusStops]);

  // Compute display path globally so we can animate the bus along it
  const displayPathData = React.useMemo(() => {
    const routeKey = `${source}-${dest}`;
    const routeData = MOCK_ROUTES[routeKey];
    let sCoord, dCoord, displayPath, intermediateStops;

    if (selectedBusStops && selectedBusStops.length >= 2) {
       sCoord = [selectedBusStops[0].stop_lat, selectedBusStops[0].stop_lon];
       dCoord = [selectedBusStops[selectedBusStops.length - 1].stop_lat, selectedBusStops[selectedBusStops.length - 1].stop_lon];
       displayPath = osrmRouteCoords || selectedBusStops.map(s => [s.stop_lat, s.stop_lon]);
       intermediateStops = dynamicIntermediateStops || [];
    } else {
       sCoord = routeData ? routeData[0].coords : (MOCK_COORDS[source] || dynamicCoords?.source);
       dCoord = routeData ? routeData[routeData.length - 1].coords : (MOCK_COORDS[dest] || dynamicCoords?.dest);
       displayPath = osrmRouteCoords || (routeData ? routeData.map(r => r.coords) : (sCoord && dCoord ? [sCoord, dCoord] : null));
       intermediateStops = routeData ? routeData.slice(1, -1) : (dynamicIntermediateStops || []);
    }
    
    if (!sCoord || !dCoord || !sCoord[0] || !dCoord[0]) return null;
    return { sCoord, dCoord, displayPath, intermediateStops };
  }, [source, dest, selectedBusStops, osrmRouteCoords, dynamicCoords, dynamicIntermediateStops]);

  // Simulated live tracking animation effect
  useEffect(() => {
    if (!displayPathData || !displayPathData.displayPath || displayPathData.displayPath.length < 2) return;
    
    const pathLen = displayPathData.displayPath.length;
    // Calculate interval so bus completes the route in ~10 seconds
    const intervalTime = Math.max(50, 10000 / pathLen);
    
    const interval = setInterval(() => {
      setLiveBusIndex(prev => {
        if (prev >= pathLen - 1) return 0;
        return prev + 1;
      });
    }, intervalTime);
    
    return () => clearInterval(interval);
  }, [displayPathData]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('tgsrtc_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const saveRecentSearch = (src, dst) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(item => !(item.source === src && item.dest === dst));
      const updated = [{ source: src, dest: dst }, ...filtered].slice(0, 4);
      localStorage.setItem('tgsrtc_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const swap = () => { setSource(dest); setDest(source); };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setSource("Locating...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Mocking reverse geocoding for UI purposes
        setTimeout(() => setSource("Ameerpet (Current Location)"), 600);
      },
      (error) => {
        alert("Unable to retrieve your location.");
        setSource("");
      }
    );
  };

  const handleSearch = async (overrideSource, overrideDest) => {
    const isOverride = typeof overrideSource === 'string' && typeof overrideDest === 'string';
    const s = isOverride ? overrideSource : source;
    const d = isOverride ? overrideDest : dest;

    if (!s.trim() || !d.trim()) return;

    if (isOverride) {
      setSource(s);
      setDest(d);
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setOsrmRouteCoords(null);
    setDynamicCoords(null);
    setDynamicIntermediateStops(null);
    setSelectedBusStops(null);
    
    try {
      const res = await fetch(`http://localhost:8080/api/bus/search?source=${encodeURIComponent(s.trim())}&destination=${encodeURIComponent(d.trim())}`);
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Backend server error');
      }
      
      const data = await res.json();
      setResults(data);

      // Fetch exact road path from OSRM
      const routeKey = `${s.trim()}-${d.trim()}`;
      let waypoints = [];
      let isDynamic = false;
      let sCoord = MOCK_COORDS[s.trim()];
      let dCoord = MOCK_COORDS[d.trim()];

      if (MOCK_ROUTES[routeKey]) {
        waypoints = MOCK_ROUTES[routeKey].map(r => r.coords);
      } else {
        // Dynamically geocode unknown stops using free Nominatim API
        if (!sCoord) {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(s.trim() + ', Hyderabad')}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) sCoord = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          } catch(e) {}
        }
        if (!dCoord) {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(d.trim() + ', Hyderabad')}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) dCoord = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          } catch(e) {}
        }

        if (sCoord && dCoord) {
          waypoints = [sCoord, dCoord];
          isDynamic = true;
          setDynamicCoords({ source: sCoord, dest: dCoord });
        }
      }

      if (waypoints.length >= 2) {
        // OSRM expects longitude,latitude format
        const coordsString = waypoints.map(c => `${c[1]},${c[0]}`).join(';');
        fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`)
          .then(res => res.json())
          .then(data => {
            if (data.routes && data.routes[0]) {
               // Convert GeoJSON (lon, lat) to Leaflet (lat, lon)
               const latLngs = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
               setOsrmRouteCoords(latLngs);

               // Dynamically generate fake stops perfectly aligned on the real route!
               if (isDynamic || (!MOCK_ROUTES[routeKey] && waypoints.length === 2)) {
                 const len = latLngs.length;
                 if (len > 10) {
                   setDynamicIntermediateStops([
                     { name: "Transit Stop 1", coords: latLngs[Math.floor(len * 0.33)] },
                     { name: "Transit Stop 2", coords: latLngs[Math.floor(len * 0.66)] }
                   ]);
                 }
               }
            }
          })
          .catch(err => console.error("Failed to load road geometry:", err));
      }

      saveRecentSearch(s.trim(), d.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const directBuses    = results?.filter(r => r.type === 'direct')    ?? [];
  const connectingSteps = results?.filter(r => r.type === 'connecting') ?? [];

  return (
    <div className="min-h-screen bg-sky-50 dark:bg-slate-950 transition-colors duration-300 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white dark:bg-slate-900 border-b border-sky-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sky-500 text-white">
            <BusIcon />
          </div>
          <div>
            <h1 className="text-base font-700 font-semibold text-sky-600 dark:text-sky-400 leading-tight tracking-tight">TGSRTC</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-none">Hyderabad Bus Finder</p>
          </div>
        </div>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-full text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-slate-800 dark:hover:text-sky-400 transition-colors"
          title="Toggle Dark Mode"
        >
          {darkMode ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex flex-col lg:flex-row gap-8 lg:gap-14 items-start relative">

        {/* ── Left Column (Sticky Search) ── */}
        <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col gap-8 lg:sticky lg:top-8">
          
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center lg:text-left"
          >
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight transition-colors">
              Find your bus,&nbsp;
              <span className="text-sky-500 block sm:inline">instantly.</span>
            </h2>
            <p className="mt-2 text-slate-400 dark:text-slate-500 text-sm transition-colors">
              Search direct routes or connecting services across Hyderabad.
            </p>
          </motion.div>

          {/* Search card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-sky-100 dark:border-slate-800 p-5 transition-colors duration-300"
          >
          {/* From */}
          <label className="block text-xs font-medium text-slate-400 dark:text-slate-500 mb-1 ml-1">From</label>
          <div className="mb-3">
            <StopInput
              id="source-input"
              value={source}
              onChange={setSource}
              onKeyDown={onKeyDown}
              placeholder="e.g. Charminar"
              onUseLocation={handleUseLocation}
              filled
            />
          </div>

          {/* Swap button & Favorite */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 border-t border-dashed border-sky-100 dark:border-slate-800" />
            
            <button
              onClick={() => toggleFavorite(source, dest)}
              title="Save to Favorites"
              className={`p-2.5 rounded-full transition-all border ${
                favorites.find(f => f.source === source && f.dest === dest) 
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-500 border-amber-200 dark:border-amber-800 scale-110' 
                  : 'bg-white dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-700 hover:text-amber-400 hover:border-amber-200'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>

            <button
              id="swap-btn"
              onClick={swap}
              className="p-2.5 rounded-full bg-sky-50 dark:bg-slate-800 text-sky-500 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-slate-700 hover:rotate-180 transition-all duration-300 border border-sky-100 dark:border-slate-700 shadow-sm"
              title="Swap stops"
            >
              <SwapIcon />
            </button>
            <div className="flex-1 border-t border-dashed border-sky-100 dark:border-slate-800" />
          </div>

          {/* To */}
          <label className="block text-xs font-medium text-slate-400 dark:text-slate-500 mb-1 ml-1">To</label>
          <div className="mb-5">
            <StopInput
              id="dest-input"
              value={dest}
              onChange={setDest}
              onKeyDown={onKeyDown}
              placeholder="e.g. Mehdipatnam"
            />
          </div>

          {/* Search button */}
          <button
            id="search-btn"
            onClick={handleSearch}
            disabled={loading || !source.trim() || !dest.trim() || source === "Locating..."}
            className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-200 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white dark:disabled:text-slate-500 font-semibold text-sm py-3 rounded-xl transition-all duration-200"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : <SearchIcon />}
            {loading ? 'Searching…' : 'Search Buses'}
          </button>

          {/* Recent Searches & Favorites container */}
          {(!results && !loading) && (recentSearches.length > 0 || favorites.length > 0) && (
            <div className="mt-8 space-y-6">
              
              {/* Saved / Favorites */}
              {favorites.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-3 ml-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    Saved Routes
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {favorites.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => handleSearch(item.source, item.dest)}
                        className="px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-lg border border-amber-200 dark:border-amber-800/50 hover:shadow-md transition-all flex items-center gap-2 shadow-sm"
                      >
                        <span className="truncate max-w-[100px]">{item.source}</span>
                        <ArrowIcon />
                        <span className="truncate max-w-[100px]">{item.dest}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Recent Searches</h3>
                    <button 
                      onClick={() => { setRecentSearches([]); localStorage.removeItem('tgsrtc_recent_searches'); }}
                      className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => handleSearch(item.source, item.dest)}
                        className="px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <span className="truncate max-w-[100px]">{item.source}</span>
                        <ArrowIcon />
                        <span className="truncate max-w-[100px]">{item.dest}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
            </div>
          )}
        </motion.div>
        
        </div> {/* End Left Column */}

        {/* ── Right Column (Results) ── */}
        <div className="w-full flex-1 min-w-0 flex flex-col space-y-3 pb-12">

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="error"
                variants={fadeUp} initial="hidden" animate="show" exit="exit"
                className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl px-4 py-3 text-sm text-red-500 dark:text-red-400"
              >
                ⚠️ {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Map View */}
          <AnimatePresence>
            {results !== null && results.length > 0 && !loading && (
              <motion.div
                key="map"
                variants={fadeUp} initial="hidden" animate="show" exit="exit"
                className="w-full h-[300px] sm:h-[400px] bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm border border-sky-100 dark:border-slate-800 mb-4 z-0 relative"
              >
                <MapContainer 
                  center={[
                    ((MOCK_COORDS[source] || [17.3850, 78.4867])[0] + (MOCK_COORDS[dest] || [17.3850, 78.4867])[0]) / 2,
                    ((MOCK_COORDS[source] || [17.3850, 78.4867])[1] + (MOCK_COORDS[dest] || [17.3850, 78.4867])[1]) / 2
                  ]} 
                  zoom={12} 
                  style={{ height: '100%', width: '100%', zIndex: 0 }}
                  zoomControl={false}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                    url={darkMode 
                      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
                      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"}
                    maxZoom={19}
                  />
                  {(() => {
                    if (!displayPathData) return null;
                    const { sCoord, dCoord, displayPath, intermediateStops } = displayPathData;

                    return (
                      <>
                        {/* Shadow/Outline Polyline */}
                        <Polyline positions={displayPath} color={darkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)"} weight={9} lineCap="round" lineJoin="round" />
                        {/* Main Colored Line */}
                        <Polyline positions={displayPath} color={darkMode ? "#38bdf8" : "#0ea5e9"} weight={5} opacity={0.9} lineCap="round" lineJoin="round" />

                        {intermediateStops.map((stop, i) => (
                          stop.coords && stop.coords[0] ? (
                            <CircleMarker key={i} center={stop.coords} radius={5} pathOptions={{ color: darkMode ? '#38bdf8' : '#0ea5e9', fillColor: darkMode ? '#0f172a' : 'white', fillOpacity: 1, weight: 2.5 }}>
                              <Popup><strong>{stop.name}</strong></Popup>
                            </CircleMarker>
                          ) : null
                        ))}

                        <Marker position={sCoord} icon={sourceIcon}>
                          <Popup><strong>Start:</strong> {source}</Popup>
                        </Marker>
                        <Marker position={dCoord} icon={destIcon}>
                          <Popup><strong>End:</strong> {dest}</Popup>
                        </Marker>
                        
                        {/* 🌟 LIVE SIMULATED BUS 🌟 */}
                        {displayPath.length > 2 && liveBusIndex < displayPath.length && (
                           <Marker position={displayPath[liveBusIndex]} icon={liveBusIcon}>
                              <Popup>Live Tracking (Simulated)</Popup>
                           </Marker>
                        )}
                      </>
                    );
                  })()}
                </MapContainer>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Direct buses */}
          <AnimatePresence>
            {directBuses.length > 0 && (
              <motion.section key="direct" variants={staggerContainer} initial="hidden" animate="show" exit="exit">
                <p className="text-xs font-semibold text-sky-500 uppercase tracking-widest mb-3 ml-1">
                  Direct Routes — {directBuses.length} found
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
                  {directBuses.map((item, i) => (
                    <DirectBusCard key={i} item={{...item, onRouteSelect: setSelectedBusStops}} />
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Connecting route — shown only when no direct routes exist */}
          <AnimatePresence>
            {connectingSteps.length > 0 && directBuses.length === 0 && (
              <motion.section key="connecting" variants={staggerContainer} initial="hidden" animate="show" exit="exit">
                {/* No direct routes notice */}
                <motion.div
                  variants={fadeUp}
                  className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl px-4 py-3 mb-3"
                >
                  <span className="text-lg">🚫</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-500">No direct routes available</p>
                    <p className="text-xs text-amber-500 dark:text-amber-600 mt-0.5">Showing connecting routes instead</p>
                  </div>
                </motion.div>

                <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-3 ml-1">
                  Connecting Route Itinerary
                </p>
                
                <div className="bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-xl p-5 shadow-sm mb-2.5">
                  <div className="relative border-l-2 border-amber-200 dark:border-amber-900/50 ml-3 space-y-6">
                    {connectingSteps.map((item, i) => (
                      <motion.div key={i} variants={fadeUp} className="relative pl-6">
                        <span className="absolute -left-[11px] top-0 flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-sm ring-4 ring-white dark:ring-slate-900">
                          {i + 1}
                        </span>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug">{item.step}</p>
                        {i < connectingSteps.length - 1 && (
                           <p className="text-xs text-slate-400 mt-1">Change buses here</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* No results state */}
          <AnimatePresence>
            {results !== null && results.length === 0 && !loading && (
              <motion.div
                key="empty"
                variants={fadeUp} initial="hidden" animate="show" exit="exit"
                className="text-center py-10"
              >
                <div className="text-4xl mb-3">🚏</div>
                <p className="text-slate-500 text-sm font-medium">No buses found</p>
                <p className="text-slate-400 text-xs mt-1">Try different stop names or check spelling.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="text-center py-5 text-xs text-slate-300 dark:text-slate-600 transition-colors">
        TGSRTC Hyderabad · GTFS Data
      </footer>
    </div>
  );
};

export default BusFinder;