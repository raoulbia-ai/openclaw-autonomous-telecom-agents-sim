import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { get } from '../lib/api';
import { cellStatus, STATUS_COLOUR, STATUS_LABEL, STATUS_BG } from '../lib/status';

export default function MapPage() {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const cellDataRef  = useRef({});   // cellId → full enriched cell object
  const prevSelRef   = useRef(null); // previously selected numeric feature id
  const [selected, setSelected] = useState(null);
  const [loaded, setLoaded]     = useState(false);
  const [tick, setTick]         = useState(0);
  const [counts, setCounts]     = useState(null); // { sites, cells }
  const [showReal, setShowReal] = useState(false);
  const realLoaded = useRef(false);
  const [searchParams]          = useSearchParams();
  const targetCell              = searchParams.get('cell');

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setTick(t => t + 1); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setLoaded(false); setSelected(null); }

    Promise.all([
      get('/api/topology').catch(() => null),
      get('/api/performance').catch(() => null),
      get('/api/signals').catch(() => null),
      get('/api/alarms').catch(() => null),
    ]).then(([topology, performance, signals, alarms]) => {
      if (!topology) return;

      // Build attention lookup
      const sigMap = {};
      for (const sig of signals?.crossZoneSignals ?? []) {
        sigMap[sig.cellId] = { perfFlags: sig.perfFlags, alarms: sig.alarms };
      }

      // Build per-cell data
      const STATUS_RANK = { 'cross-zone': 0, 'outlier': 1, 'elevated': 2, 'normal': 3 };
      const cellMap = {};
      topology.cells.forEach(cell => {
        const status    = cellStatus(cell.id, performance, signals);
        const perfEntry = [
          ...(performance?.outliers ?? []),
          ...(performance?.elevated ?? []),
          ...(performance?.normal   ?? []),
        ].find(c => c.cellId === cell.id);
        const cellAlarms = alarms?.alarms?.filter(a => a.managedObjectInstance === cell.id) ?? [];
        const sig = sigMap[cell.id];
        cellMap[cell.id] = {
          id: cell.id, site: cell.site, lon: cell.lon, lat: cell.lat,
          status, colour: STATUS_COLOUR[status],
          dlThp: perfEntry?.counters?.dlThpCell ?? null,
          errorRate: perfEntry?.counters?.errorRate ?? null,
          availability: perfEntry?.counters?.cellAvailTime ?? null,
          flags: perfEntry?.flags ?? [],
          alarmSummary: cellAlarms.map(a => `${a.alarmId} (${a.perceivedSeverity})`).join(', '),
          perfFlags: sig?.perfFlags ?? [],
          attentionAlarms: sig?.alarms ?? [],
        };
      });

      // Collapse to one dot per site — coloured by worst cell at that site.
      // Clicking a site dot shows the worst cell's details.
      const siteMap = {};
      Object.values(cellMap).forEach(cell => {
        const existing = siteMap[cell.site];
        if (!existing || STATUS_RANK[cell.status] < STATUS_RANK[existing.status]) {
          siteMap[cell.site] = cell;
        }
      });

      // Assign numeric ids for setFeatureState
      let idx = 0;
      const dataMap = {}; // site name → enriched worst-cell object with numId
      for (const [site, cell] of Object.entries(siteMap)) {
        dataMap[site] = { ...cell, numId: idx++ };
      }
      cellDataRef.current = dataMap;
      setCounts({ sites: Object.keys(dataMap).length, cells: topology.cells.length });

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [-7.9, 53.1],
        zoom: 6.5,
      });
      mapRef.current = map;

      map.on('load', () => {
        setLoaded(true);

        const features = Object.values(dataMap).map(d => ({
          type: 'Feature',
          id: d.numId,
          geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
          properties: { siteKey: d.site, colour: d.colour },
        }));

        map.addSource('cells', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
        });

        // Halo behind selected cell
        map.addLayer({
          id: 'cells-halo',
          type: 'circle',
          source: 'cells',
          paint: {
            'circle-color': '#ef4444',
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 12, 10, 18, 14, 26],
            'circle-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.18, 0],
            'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 1.5, 0],
            'circle-stroke-color': '#ef4444',
            'circle-stroke-opacity': 0.5,
          },
        });

        // Main dots — colour driven by feature state
        map.addLayer({
          id: 'cells-circle',
          type: 'circle',
          source: 'cells',
          paint: {
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#ef4444',
              ['get', 'colour'],
            ],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 8, 3.5, 12, 5, 15, 7],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 1.5],
            'circle-stroke-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#ffffff',
              '#0f172a',
            ],
            'circle-opacity': 0.9,
          },
        });


        const selectCell = (siteKey) => {
          const data = cellDataRef.current[siteKey];
          if (!data) return;

          // Clear previous selection
          if (prevSelRef.current !== null) {
            map.setFeatureState({ source: 'cells', id: prevSelRef.current }, { selected: false });
          }
          map.setFeatureState({ source: 'cells', id: data.numId }, { selected: true });
          prevSelRef.current = data.numId;

          setSelected(data);
        };

        map.on('click', 'cells-circle', e => {
          selectCell(e.features[0].properties.siteKey);
        });

        map.on('mouseenter', 'cells-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'cells-circle', () => { map.getCanvas().style.cursor = ''; });

        // Fly to and select if navigated from Dashboard (targetCell is a full cell URN)
        if (targetCell) {
          // Find which site this cell belongs to
          const siteEntry = Object.values(dataMap).find(d => d.id === targetCell || d.site === targetCell);
          // Also check if the cell's site is in dataMap (the worst-cell for that site)
          const cellSite = cellMap[targetCell]?.site;
          const d = siteEntry ?? (cellSite ? dataMap[cellSite] : null);
          if (d) {
            map.flyTo({ center: [d.lon, d.lat], zoom: 13, duration: 1200, essential: true });
            selectCell(d.site);
          }
        }
      });
    });

    return () => { mapRef.current?.remove(); mapRef.current = null; realLoaded.current = false; };
  }, [tick]);

  // Toggle real tower layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    if (showReal && !realLoaded.current) {
      // Load real tower data once
      fetch('/ireland_sites.json').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(sites => {
        if (!mapRef.current) return;
        const features = sites.map(([lon, lat], i) => ({
          type: 'Feature',
          id: i,
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: {},
        }));
        map.addSource('real-towers', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
        });
        map.addLayer({
          id: 'real-towers-circle',
          type: 'circle',
          source: 'real-towers',
          paint: {
            'circle-color': '#3b82f6',
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 8, 2.5, 12, 4.5, 15, 7],
            'circle-opacity': 0.5,
          },
        }, 'cells-halo'); // insert below NKA layers
        realLoaded.current = true;
      }).catch(() => { /* ireland_sites.json not available */ });
    } else if (realLoaded.current) {
      map.setLayoutProperty('real-towers-circle', 'visibility', showReal ? 'visible' : 'none');
    }
  }, [showReal, loaded]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Map</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            One dot per <span className="text-slate-400">site</span> — a physical tower location that hosts multiple cells.
            {counts && (
              <span className="ml-1.5 text-slate-400 font-medium">{counts.sites} sites · {counts.cells} cells</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs shrink-0">
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: STATUS_COLOUR[k] }} />
              <span className="text-slate-400">{v}</span>
            </div>
          ))}
          <div className="w-px h-4 bg-slate-700" />
          <button
            onClick={() => setShowReal(r => !r)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-colors ${showReal ? 'border-blue-500/50 bg-blue-950/40 text-blue-400' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
          >
            <span className="w-2 h-2 rounded-full inline-block bg-blue-500" />
            Real towers {showReal ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-slate-700" style={{ height: '65vh' }}>
        <div ref={mapContainer} className="w-full h-full" />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <p className="text-slate-400 text-sm">Loading map…</p>
          </div>
        )}

        {selected && (
          <div className="absolute top-3 right-3 w-72 rounded-lg border border-slate-600 bg-slate-900/95 backdrop-blur-sm p-4 shadow-xl space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-100 text-sm">{selected.site}</p>
                <p className="text-xs text-slate-400 font-mono">cell {selected.id?.split('=').pop() ?? ''}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_BG[selected.status]}`}>
                  {STATUS_LABEL[selected.status]}
                </span>
                <button
                  onClick={() => {
                    if (prevSelRef.current !== null) {
                      mapRef.current?.setFeatureState({ source: 'cells', id: prevSelRef.current }, { selected: false });
                      prevSelRef.current = null;
                    }
                    setSelected(null);
                  }}
                  className="text-slate-500 hover:text-slate-300 text-sm leading-none"
                >✕</button>

              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {selected.dlThp != null && (
                <div className="rounded bg-slate-800 px-2 py-1.5 text-center">
                  <p className="text-xs font-semibold text-slate-200">{selected.dlThp} Mbps</p>
                  <p className="text-xs text-slate-500">DL</p>
                </div>
              )}
              {selected.errorRate != null && (
                <div className="rounded bg-slate-800 px-2 py-1.5 text-center">
                  <p className="text-xs font-semibold text-slate-200">{selected.errorRate}%</p>
                  <p className="text-xs text-slate-500">Error</p>
                </div>
              )}
              {selected.availability != null && (
                <div className="rounded bg-slate-800 px-2 py-1.5 text-center">
                  <p className="text-xs font-semibold text-slate-200">{selected.availability}%</p>
                  <p className="text-xs text-slate-500">Avail</p>
                </div>
              )}
            </div>

            {(selected.perfFlags?.length > 0 || selected.flags?.length > 0) && (
              <div className="space-y-0.5">
                {(selected.perfFlags.length > 0 ? selected.perfFlags : selected.flags).map((f, i) => (
                  <p key={i} className="text-xs text-orange-400">⚠ {f}</p>
                ))}
              </div>
            )}
            {selected.attentionAlarms?.length > 0 && (
              <div className="space-y-0.5">
                {selected.attentionAlarms.map((a, i) => (
                  <p key={i} className="text-xs text-red-400">🔔 {a.severity}: {a.problem}</p>
                ))}
              </div>
            )}
            {!selected.attentionAlarms?.length && selected.alarmSummary && (
              <p className="text-xs text-red-400">🔔 {selected.alarmSummary}</p>
            )}
            <Link
              to={`/cells?site=${encodeURIComponent(selected.site)}`}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors block pt-1"
            >
              View all cells at this site →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
