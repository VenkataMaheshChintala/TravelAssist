import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── tiny icon components ─────────────────────────────────────── */
const BusIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <path d="M2 10h20M7 19v2M17 19v2M2 14h20"/>
  </svg>
);

const ArrowIcon = () => (
  <svg className="w-4 h-4 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        const res = await fetch(
          `http://localhost:8080/api/bus/stops?query=${encodeURIComponent(value.trim())}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
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
function StopInput({ id, label, value, onChange, onKeyDown, placeholder, filled }) {
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
        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
      />

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
            className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-sky-100 rounded-xl shadow-lg overflow-hidden"
          >
            {suggestions.map((name, i) => (
              <li
                key={i}
                onMouseDown={() => handleSelect(name)}   // mousedown fires before input blur
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-sky-50 cursor-pointer transition-colors"
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
        const data = await res.json();
        setDetails(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  };

  return (
    <motion.div variants={fadeUp} className="bg-white border border-sky-100 rounded-xl shadow-sm mb-2.5 overflow-hidden">
      <button 
        onClick={toggleExpand}
        className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-sky-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-50 text-sky-500">
            <BusIcon />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Bus {item.bus}</p>
            <p className="text-xs text-slate-400">Direct service</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
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
            className="border-t border-sky-50 px-4 py-4 bg-slate-50/50"
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
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Next Departures</p>
                  {details.departures.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {details.departures.map((time, idx) => (
                        <span key={idx} className="bg-sky-100 shadow-sm border border-sky-200 text-sky-700 text-xs font-medium px-2.5 py-1 rounded-md">
                          {time.substring(0, 5)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 bg-white border border-slate-100 rounded-md py-1.5 px-3 inline-block">No scheduled departures today</p>
                  )}
                </div>

                {/* Route Stops */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Intermediate Stops</p>
                  <div className="relative border-l-2 border-sky-200 ml-1.5 py-1 space-y-3">
                    {details.stops.map((stop, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === details.stops.length - 1;
                      return (
                        <div key={idx} className="relative pl-5 flex items-center">
                          <span className={`absolute -left-[5px] w-2 h-2 rounded-full ${isFirst || isLast ? 'bg-sky-500 ring-4 ring-sky-50' : 'bg-slate-300'}`} />
                          <p className={`text-xs ${isFirst || isLast ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>
                            {stop}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-md">Failed to load route details.</p>
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

  const swap = () => { setSource(dest); setDest(source); };

  const handleSearch = async () => {
    if (!source.trim() || !dest.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(
        `http://localhost:8080/api/bus/search?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(dest)}`
      );
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setResults(await res.json());
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
    <div className="min-h-screen bg-sky-50 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-sky-100 px-6 py-4 flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sky-500 text-white">
          <BusIcon />
        </div>
        <div>
          <h1 className="text-base font-700 font-semibold text-sky-600 leading-tight tracking-tight">TGSRTC</h1>
          <p className="text-xs text-slate-400 leading-none">Hyderabad Bus Finder</p>
        </div>
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
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">
              Find your bus,&nbsp;
              <span className="text-sky-500 block sm:inline">instantly.</span>
            </h2>
            <p className="mt-2 text-slate-400 text-sm">
              Search direct routes or connecting services across Hyderabad.
            </p>
          </motion.div>

          {/* Search card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="w-full bg-white rounded-2xl shadow-sm border border-sky-100 p-5"
          >
          {/* From */}
          <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">From</label>
          <div className="mb-3">
            <StopInput
              id="source-input"
              value={source}
              onChange={setSource}
              onKeyDown={onKeyDown}
              placeholder="e.g. Charminar"
              filled
            />
          </div>

          {/* Swap button */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 border-t border-dashed border-sky-100" />
            <button
              id="swap-btn"
              onClick={swap}
              title="Swap source and destination"
              className="flex items-center justify-center w-7 h-7 rounded-full border border-sky-200 text-sky-400 hover:bg-sky-50 hover:text-sky-500 transition-all"
            >
              <SwapIcon />
            </button>
            <div className="flex-1 border-t border-dashed border-sky-100" />
          </div>

          {/* To */}
          <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">To</label>
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
            disabled={loading || !source.trim() || !dest.trim()}
            className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-200 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 rounded-xl transition-all duration-200"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : <SearchIcon />}
            {loading ? 'Searching…' : 'Search Buses'}
          </button>
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
                className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-500"
              >
                ⚠️ {error}
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
                    <DirectBusCard key={i} item={item} />
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
                  className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3"
                >
                  <span className="text-lg">🚫</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-700">No direct routes available</p>
                    <p className="text-xs text-amber-500 mt-0.5">Showing connecting routes instead</p>
                  </div>
                </motion.div>

                <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-2 ml-1">
                  Connecting Route
                </p>
                {connectingSteps.map((item, i) => (
                  <motion.div
                    key={i}
                    variants={fadeUp}
                    className="bg-white border border-amber-100 rounded-xl px-4 py-3.5 flex items-start gap-3 shadow-sm mb-2.5"
                  >
                    <span className="flex-shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-400 text-xs font-bold">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-600 leading-snug">{item.step}</p>
                  </motion.div>
                ))}
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
      <footer className="text-center py-5 text-xs text-slate-300">
        TGSRTC Hyderabad · GTFS Data
      </footer>
    </div>
  );
};

export default BusFinder;