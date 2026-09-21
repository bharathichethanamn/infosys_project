import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Master Port Coordinates Dictionary for all dataset ports & transshipment hubs
const PORT_COORDINATES = {
  'chennai': { name: 'Chennai (India)', lat: 13.0827, lng: 80.2707, country: 'India' },
  'rotterdam': { name: 'Rotterdam (Netherlands)', lat: 51.9244, lng: 4.4777, country: 'Netherlands' },
  'shanghai': { name: 'Shanghai (China)', lat: 31.2304, lng: 121.4737, country: 'China' },
  'los angeles': { name: 'Los Angeles (USA)', lat: 33.7423, lng: -118.2704, country: 'USA' },
  'singapore': { name: 'Singapore', lat: 1.3521, lng: 103.8198, country: 'Singapore' },
  'port of singapore': { name: 'Singapore', lat: 1.3521, lng: 103.8198, country: 'Singapore' },
  'hamburg': { name: 'Hamburg (Germany)', lat: 53.5511, lng: 9.9937, country: 'Germany' },
  'mumbai': { name: 'Mumbai (India)', lat: 18.9438, lng: 72.8360, country: 'India' },
  'felixstowe': { name: 'Felixstowe (UK)', lat: 51.9617, lng: 1.3513, country: 'UK' },
  'ningbo': { name: 'Ningbo (China)', lat: 29.8683, lng: 121.5440, country: 'China' },
  'new york': { name: 'New York (USA)', lat: 40.7128, lng: -74.0060, country: 'USA' },
  'busan': { name: 'Busan', lat: 35.1796, lng: 129.0756, country: 'South Korea' },
  'busan port': { name: 'Busan', lat: 35.1796, lng: 129.0756, country: 'South Korea' },
  'tokyo': { name: 'Tokyo (Japan)', lat: 35.6762, lng: 139.6503, country: 'Japan' },
  'dubai': { name: 'Jebel Ali / Dubai', lat: 25.0210, lng: 55.0607, country: 'UAE' },
  'jebel ali port': { name: 'Jebel Ali / Dubai', lat: 25.0210, lng: 55.0607, country: 'UAE' },
  'hong kong': { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, country: 'Hong Kong' },
  'port of hong kong': { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, country: 'Hong Kong' },
  'colombo': { name: 'Colombo', lat: 6.9271, lng: 79.8612, country: 'Sri Lanka' },
  'port of colombo': { name: 'Colombo', lat: 6.9271, lng: 79.8612, country: 'Sri Lanka' },
  'yokohama': { name: 'Yokohama', lat: 35.4437, lng: 139.6380, country: 'Japan' },
  'port of yokohama': { name: 'Yokohama', lat: 35.4437, lng: 139.6380, country: 'Japan' },
  'salalah': { name: 'Salalah', lat: 17.0151, lng: 54.0924, country: 'Oman' },
  'port of salalah': { name: 'Salalah', lat: 17.0151, lng: 54.0924, country: 'Oman' },
  'klang': { name: 'Port Klang', lat: 3.0000, lng: 101.4000, country: 'Malaysia' },
  'qingdao': { name: 'Qingdao (China)', lat: 36.0671, lng: 120.3826, country: 'China' },
  'antwerp': { name: 'Antwerp (Belgium)', lat: 51.2194, lng: 4.4025, country: 'Belgium' },
  'vancouver': { name: 'Vancouver (Canada)', lat: 49.2827, lng: -123.1207, country: 'Canada' },
  'genoa': { name: 'Genoa (Italy)', lat: 44.4056, lng: 8.9463, country: 'Italy' },
  'melbourne': { name: 'Melbourne (Australia)', lat: -37.8136, lng: 144.9631, country: 'Australia' },
  'sydney': { name: 'Sydney (Australia)', lat: -33.8688, lng: 151.2093, country: 'Australia' },
  'santos': { name: 'Santos (Brazil)', lat: -23.9608, lng: -46.3339, country: 'Brazil' },
  'bremerhaven': { name: 'Bremerhaven (Germany)', lat: 53.5428, lng: 8.5824, country: 'Germany' }
}

// Major Maritime Chokepoint & Intermediate Waypoint Locations
const CHOKEPOINT_LOCATIONS = {
  'suez': [
    { label: 'Suez Canal', lat: 29.93, lng: 32.56, showMarker: true },
    { label: 'Strait of Gibraltar', lat: 35.98, lng: -5.60, showMarker: false }
  ],
  'malacca': [
    { label: 'Strait of Malacca', lat: 2.50, lng: 101.50, showMarker: false }
  ],
  'panama': [
    { label: 'Panama Canal', lat: 9.08, lng: -79.68, showMarker: true }
  ],
  'cape': [
    { label: 'Cape of Good Hope', lat: -34.83, lng: 20.00, showMarker: true }
  ]
}

// Custom Leaflet DivIcon Generator matching reference pin style
const createCustomPinIcon = (type, label, colorHex = '#F59E0B') => {
  let pinBg = colorHex
  let iconEmoji = '📍'

  if (type === 'origin') {
    pinBg = '#10B981' // Green
    iconEmoji = '📍'
  } else if (type === 'destination') {
    pinBg = '#EF4444' // Red
    iconEmoji = '🏁'
  } else if (type === 'transshipment') {
    pinBg = colorHex || '#F59E0B' // Orange / Dynamic per route
    iconEmoji = '📍'
  }

  const html = `
    <div style="
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      transform: translate(-50%, -100%);
      pointer-events: auto;
    ">
      <div style="
        background: #FFFFFF;
        color: #062B49;
        font-weight: 700;
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 6px;
        border: 1px solid #CBD5E1;
        box-shadow: 0 3px 8px rgba(0,0,0,0.18);
        white-space: nowrap;
        margin-bottom: 3px;
        line-height: 1.2;
      ">
        ${label}
      </div>
      <div style="
        width: 24px;
        height: 24px;
        background-color: ${pinBg};
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      ">
        ${iconEmoji}
      </div>
    </div>
  `

  return L.divIcon({
    html: html,
    className: 'custom-maritime-pin-marker',
    iconSize: [0, 0]
  })
}

function RouteMap({
  routes = [],
  singleRoute = null,
  bestRouteId = null,
  activeRouteId = 'ALL',
  selectedRouteObj = null,
  originName = '',
  destinationName = '',
  isCompact = false,
  onSelectRoute = null,
  onResetViewAll = null
}) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  // Normalize routes input array
  const routeList = Array.isArray(routes) && routes.length > 0
    ? routes
    : singleRoute
      ? [singleRoute]
      : []

  // Identify Best Route ID
  const effectiveBestId = bestRouteId || (routeList.length > 0 ? routeList[0]?.route_id : null)

  // Determine if viewing ALL routes or a SINGLE specific route
  const isMultiRouteMode = activeRouteId === 'ALL' || !activeRouteId || activeRouteId === null

  // Filter routes to render on the map: ALL routes or ONLY the selected single route
  const routesToDraw = isMultiRouteMode
    ? routeList
    : routeList.filter(r => r.route_id === activeRouteId)

  // Determine active route object for metrics banner
  const activeRouteMetrics = selectedRouteObj || (
    isMultiRouteMode
      ? (routeList.find(r => r.route_id === effectiveBestId) || routeList[0])
      : (routeList.find(r => r.route_id === activeRouteId) || routeList[0])
  )

  useEffect(() => {
    if (!mapRef.current) return

    try {
      // Clean up previous map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      const oKey = (originName || activeRouteMetrics?.origin || '').toLowerCase().trim()
      const dKey = (destinationName || activeRouteMetrics?.destination || '').toLowerCase().trim()

      const originCoord = PORT_COORDINATES[oKey]
      const destCoord = PORT_COORDINATES[dKey]

      if (!originCoord || !destCoord) {
        return
      }

      // Initialize Leaflet Map
      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: false
      })

      mapInstanceRef.current = map

      // Primary Tile Layer: Esri World Street Map with CartoDB fallback
      const primaryTileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
      const fallbackTileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

      const tileLayer = L.tileLayer(primaryTileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(map)

      tileLayer.on('tileerror', function () {
        tileLayer.setUrl(fallbackTileUrl)
      })

      const allWaypoints = []

      // 1. Origin Marker
      allWaypoints.push([originCoord.lat, originCoord.lng])
      const originMarker = L.marker([originCoord.lat, originCoord.lng], {
        icon: createCustomPinIcon('origin', originCoord.name)
      }).addTo(map)
      originMarker.bindPopup(`<b>${originCoord.name}</b><br/>Role: Origin Port<br/>Country: ${originCoord.country}`)

      // 2. Destination Marker
      allWaypoints.push([destCoord.lat, destCoord.lng])
      const destMarker = L.marker([destCoord.lat, destCoord.lng], {
        icon: createCustomPinIcon('destination', destCoord.name)
      }).addTo(map)
      destMarker.bindPopup(`<b>${destCoord.name}</b><br/>Role: Destination Port<br/>Country: ${destCoord.country}`)

      let altCounter = 0
      const addedHubMarkers = new Set()

      // Sort routesToDraw so Best Route is rendered last (drawn on top)
      const sortedRoutesToDraw = [...routesToDraw].sort((a, b) => {
        if (!a || !b) return 0
        if (a.route_id === effectiveBestId) return 1
        if (b.route_id === effectiveBestId) return -1
        return 0
      })

      // Draw routes on the map (ALL or SINGLE based on mode)
      sortedRoutesToDraw.forEach((r) => {
        if (!r) return
        const isBest = r.route_id === effectiveBestId

        // Route Styling specifications
        let routeColor = '#10B981' // Solid Bright Green for Best Route
        let weight = 6
        let dashArray = null
        let opacity = 1.0

        if (isBest) {
          routeColor = '#10B981' // Best Route: Solid Bright Green
          weight = 6
          dashArray = null
          opacity = 1.0
        } else {
          // Identify index in full routeList for consistent color assignment
          const listIdx = routeList.findIndex(x => x.route_id === r.route_id)
          altCounter = listIdx > 0 ? listIdx : (altCounter + 1)

          if (altCounter === 1) {
            routeColor = '#2563EB' // Alternative Route 1: Blue dashed
          } else if (altCounter === 2) {
            routeColor = '#EA580C' // Alternative Route 2: Orange dashed
          } else {
            routeColor = '#7C3AED' // Alternative Route 3+: Purple dashed
          }
          weight = isMultiRouteMode ? 4 : 6
          dashArray = '8, 8'
          opacity = 0.90
        }

        // Build Route Path Points
        const pathPoints = [[originCoord.lat, originCoord.lng]]

        // Transshipment hubs for this route
        const transshipmentStr = r.transshipment_ports || ''
        if (r.transshipments > 0 && transshipmentStr && !transshipmentStr.includes('Direct')) {
          const stops = transshipmentStr.split(/[,&]/)
          stops.forEach(stop => {
            const cleanStop = stop.trim().toLowerCase()
            const tCoord = PORT_COORDINATES[cleanStop] || Object.entries(PORT_COORDINATES).find(([k]) => cleanStop.includes(k))?.[1]
            if (tCoord) {
              pathPoints.push([tCoord.lat, tCoord.lng])
              allWaypoints.push([tCoord.lat, tCoord.lng])

              // Place Hub Pin Marker
              const hubKey = `${tCoord.lat}_${tCoord.lng}`
              if (!addedHubMarkers.has(hubKey)) {
                addedHubMarkers.add(hubKey)
                const tMarker = L.marker([tCoord.lat, tCoord.lng], {
                  icon: createCustomPinIcon('transshipment', tCoord.name, routeColor)
                }).addTo(map)

                tMarker.bindPopup(`
                  <div style="font-family: system-ui, sans-serif; padding: 2px;">
                    <strong style="color: #062B49; font-size: 13px;">${tCoord.name}</strong><br/>
                    <span style="font-size: 11px; color: #475569;">Transshipment Hub for <strong>${r.route_name}</strong></span><br/>
                    <span style="font-size: 11px; color: #64748B;">Country: ${tCoord.country}</span>
                  </div>
                `)
              }
            }
          })
        }

        // Primary Chokepoints / Ocean Waypoints
        const chokepoints = (r.primary_chokepoints || '').toLowerCase()
        const chokeWaypoints = []
        if (chokepoints.includes('suez')) {
          chokeWaypoints.push(...CHOKEPOINT_LOCATIONS.suez)
        } else if (chokepoints.includes('malacca') && !chokepoints.includes('suez')) {
          chokeWaypoints.push(...CHOKEPOINT_LOCATIONS.malacca)
        } else if (chokepoints.includes('panama')) {
          chokeWaypoints.push(...CHOKEPOINT_LOCATIONS.panama)
        } else if (chokepoints.includes('cape')) {
          chokeWaypoints.push(...CHOKEPOINT_LOCATIONS.cape)
        }

        if (chokeWaypoints.length > 0) {
          chokeWaypoints.forEach(cw => {
            pathPoints.push([cw.lat, cw.lng])
            allWaypoints.push([cw.lat, cw.lng])

            if (cw.showMarker) {
              const chokeKey = `${cw.lat}_${cw.lng}`
              if (!addedHubMarkers.has(chokeKey)) {
                addedHubMarkers.add(chokeKey)
                const chokeMarker = L.marker([cw.lat, cw.lng], {
                  icon: createCustomPinIcon('transshipment', cw.label, routeColor)
                }).addTo(map)
                chokeMarker.bindPopup(`<b>${cw.label}</b><br/>Primary Maritime Corridor Waypoint`)
              }
            }
          })
        }

        // Special handling for Cape Bypass Route (R-CHE-ROT-03)
        if (r.route_name.toLowerCase().includes('cape') || r.ocean_corridor.toLowerCase().includes('south atlantic')) {
          const capeLat = -34.83
          const capeLng = 20.00
          pathPoints.push([capeLat, capeLng])
          allWaypoints.push([capeLat, capeLng])

          const capeKey = `${capeLat}_${capeLng}`
          if (!addedHubMarkers.has(capeKey)) {
            addedHubMarkers.add(capeKey)
            const capeMarker = L.marker([capeLat, capeLng], {
              icon: createCustomPinIcon('transshipment', 'Cape of Good Hope', routeColor)
            }).addTo(map)
            capeMarker.bindPopup(`<b>Cape of Good Hope</b><br/>Cape Ocean Bypass Route`)
          }
        }

        // End at Destination
        pathPoints.push([destCoord.lat, destCoord.lng])

        // Add curve/offset when multiple routes are visible simultaneously
        if (isMultiRouteMode && !isBest) {
          const listIdx = routeList.findIndex(x => x.route_id === r.route_id)
          const shiftLat = (listIdx % 2 === 1 ? listIdx * 1.0 : -listIdx * 1.0)
          const shiftLng = (listIdx % 2 === 1 ? -listIdx * 0.8 : listIdx * 0.8)
          if (pathPoints.length === 2) {
            const midLat = (pathPoints[0][0] + pathPoints[1][0]) / 2 + shiftLat
            const midLng = (pathPoints[0][1] + pathPoints[1][1]) / 2 + shiftLng
            pathPoints.splice(1, 0, [midLat, midLng])
          } else {
            for (let k = 1; k < pathPoints.length - 1; k++) {
              pathPoints[k] = [pathPoints[k][0] + shiftLat * 0.35, pathPoints[k][1] + shiftLng * 0.35]
            }
          }
        }

        // Draw Polyline for this route
        const polyline = L.polyline(pathPoints, {
          color: routeColor,
          weight: weight,
          opacity: opacity,
          dashArray: dashArray,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map)

        // Bring Best Route to front in multi-route mode
        if (isBest && polyline?._path?.parentNode) {
          try {
            polyline.bringToFront()
          } catch (e) {}
        }

        // Polyline Click & Hover Popup
        polyline.bindPopup(`
          <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 180px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <strong style="color: ${routeColor}; font-size: 13px;">${r.route_name}</strong>
              ${isBest ? '<span style="background:#FEF3C7; color:#B45309; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:10px;">⭐ BEST</span>' : ''}
            </div>
            <div style="font-size: 11px; color: #334155; line-height: 1.4;">
              <div><strong>Route ID:</strong> ${r.route_id}</div>
              <div><strong>Transit Time:</strong> ${r.transit_days} Days</div>
              <div><strong>Distance:</strong> ${Number(r.distance_nautical_miles).toLocaleString()} NM</div>
              <div><strong>Stops:</strong> ${r.transshipments === 0 ? 'Direct' : r.transshipment_ports}</div>
              <div><strong>Reliability:</strong> ${r.reliability_rating}%</div>
              <div><strong>Route Score:</strong> <strong style="color: #F59E0B;">${r.route_score}/100</strong></div>
            </div>
          </div>
        `)

        polyline.on('click', () => {
          if (onSelectRoute) {
            onSelectRoute(r)
          }
        })
      })

      // Fit map bounds to encompass all waypoints & markers
      const bounds = L.latLngBounds(allWaypoints)
      map.fitBounds(bounds, { padding: [45, 45] })

      // Force map tile recalculation and fit bounds after container mount
      ;[50, 200, 500].forEach((delay) => {
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize()
            if (allWaypoints.length > 0) {
              mapInstanceRef.current.fitBounds(L.latLngBounds(allWaypoints), { padding: [45, 45] })
            }
          }
        }, delay)
      })

    } catch (err) {
      console.error('Map rendering exception:', err)
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [routes, singleRoute, bestRouteId, activeRouteId, originName, destinationName, isMultiRouteMode])

  // Resolve origin & destination coordinates for fallback check
  const oKey = (originName || activeRouteMetrics?.origin || '').toLowerCase().trim()
  const dKey = (destinationName || activeRouteMetrics?.destination || '').toLowerCase().trim()
  const originCoord = PORT_COORDINATES[oKey]
  const destCoord = PORT_COORDINATES[dKey]

  if (!originCoord || !destCoord) {
    return (
      <div className="ocean-card alert-warning-ocean" style={{ textAlign: 'center', padding: '2rem' }}>
        <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🗺️</span>
        <h4 style={{ color: '#062B49', margin: '0 0 0.5rem 0' }}>Map Visualization Unavailable</h4>
        <p style={{ color: '#475569', margin: 0, fontSize: '0.9rem' }}>
          Port coordinates unavailable for corridor: <strong>{originName || activeRouteMetrics?.origin} ➔ {destinationName || activeRouteMetrics?.destination}</strong>.
        </p>
      </div>
    )
  }

  // Pre-calculate color legend entries for available routes matching reference mockup
  let legendAltIdx = 1
  const legendRoutes = routeList.map((r) => {
    const isBest = r.route_id === effectiveBestId
    const isActive = isMultiRouteMode ? isBest : (r.route_id === activeRouteId)
    let hex = '#2563EB'
    let label = 'Alternative Route 1'
    let isDashed = true

    if (isBest) {
      hex = '#10B981'
      label = 'Best Route'
      isDashed = false
    } else {
      if (legendAltIdx === 1) {
        hex = '#2563EB'
        label = 'Alternative Route 1'
      } else if (legendAltIdx === 2) {
        hex = '#EA580C'
        label = 'Alternative Route 2'
      } else {
        hex = '#7C3AED'
        label = `Alternative Route ${legendAltIdx}`
      }
      legendAltIdx++
    }

    return {
      ...r,
      colorHex: hex,
      roleLabel: label,
      isDashed,
      isBest,
      isActive
    }
  })

  return (
    <div className="map-intelligence-card ocean-card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
      <div className="map-card-header" style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🗺️</span>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#062B49', fontWeight: '700' }}>
              Map Intelligence — {isMultiRouteMode ? 'All Available Routes' : `Single Route View (${activeRouteMetrics?.route_name})`}
            </h3>
          </div>
          <p style={{ margin: '0.25rem 0 0 1.7rem', fontSize: '0.85rem', color: '#64748B' }}>
            {isMultiRouteMode
              ? `Showing all ${routeList.length} corridor options simultaneously on the map`
              : `Viewing single route trajectory for ${activeRouteMetrics?.route_name}`}
          </p>
        </div>

        <div className="route-map-badge-group" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {!isCompact && !isMultiRouteMode && (
            <button
              onClick={() => {
                if (onResetViewAll) onResetViewAll()
                else if (onSelectRoute) onSelectRoute('ALL')
              }}
              style={{
                background: 'linear-gradient(135deg, #0F8B8D 0%, #062B49 100%)',
                color: 'white',
                border: 'none',
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 6px rgba(15,139,141,0.3)'
              }}
            >
              🌐 View All Routes
            </button>
          )}

          {activeRouteMetrics && (
            <>
              <span className="pill-status teal" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
                Route ID: {activeRouteMetrics.route_id}
              </span>
              <span className="pill-status green" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
                Score: {activeRouteMetrics.route_score}/100
              </span>
            </>
          )}
        </div>
      </div>

      {/* ACTIVE SELECTED ROUTE METRICS BANNER */}
      {activeRouteMetrics && (
        <div className="map-metrics-summary-bar" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
          background: 'linear-gradient(135deg, #062B49 0%, #073B5C 100%)',
          padding: '0.85rem 1rem',
          borderRadius: '10px',
          color: 'white',
          marginBottom: '1rem'
        }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>SELECTED ROUTE</span>
            <strong style={{ fontSize: '0.9rem', color: '#20C4D9' }}>{activeRouteMetrics.route_name}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>DISTANCE</span>
            <strong style={{ fontSize: '0.9rem' }}>{Number(activeRouteMetrics.distance_nautical_miles || 0).toLocaleString()} NM</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>TRANSIT TIME</span>
            <strong style={{ fontSize: '0.9rem' }}>{activeRouteMetrics.transit_days} Days</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>TRANSSHIPMENTS</span>
            <strong style={{ fontSize: '0.9rem' }}>
              {activeRouteMetrics.transshipments === 0 ? '0 (Direct)' : `${activeRouteMetrics.transshipments} Stop`}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>RELIABILITY</span>
            <strong style={{ fontSize: '0.9rem', color: '#10B981' }}>{activeRouteMetrics.reliability_rating}%</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>ROUTE SCORE</span>
            <strong style={{ fontSize: '0.9rem', color: '#F59E0B' }}>{activeRouteMetrics.route_score} / 100</strong>
          </div>
        </div>
      )}

      {/* MAP CONTAINER & FLOATING IN-MAP LEGEND OVERLAY */}
      <div style={{ position: 'relative' }}>
        <div
          ref={mapRef}
          style={{
            height: isCompact ? '340px' : '440px',
            width: '100%',
            backgroundColor: '#AAD3DF',
            borderRadius: '12px',
            border: '1px solid #CBD5E1',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
            overflow: 'hidden',
            zIndex: 1
          }}
        />

        {/* FLOATING IN-MAP LEGEND CARD (TOP RIGHT OVERLAY) */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 999,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(4px)',
          border: '1px solid #CBD5E1',
          borderRadius: '8px',
          padding: '10px 14px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
          fontSize: '11px',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ fontWeight: '700', color: '#062B49', marginBottom: '6px' }}>
            {isMultiRouteMode ? 'All Routes Legend' : 'Single Route View'}
          </div>
          {legendRoutes.filter(lr => isMultiRouteMode || lr.route_id === activeRouteMetrics?.route_id).map((lr) => (
            <div key={lr.route_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{
                display: 'inline-block',
                width: '20px',
                height: lr.isDashed ? '0px' : '4px',
                borderTop: lr.isDashed ? `3px dashed ${lr.colorHex}` : `4px solid ${lr.colorHex}`,
                borderRadius: '2px'
              }} />
              <span style={{ color: '#1E293B', fontWeight: '600' }}>{lr.roleLabel}</span>
            </div>
          ))}

          {!isCompact && !isMultiRouteMode && (
            <div style={{ marginTop: '6px' }}>
              <button
                onClick={() => {
                  if (onResetViewAll) onResetViewAll()
                  else if (onSelectRoute) onSelectRoute('ALL')
                }}
                style={{
                  background: '#0F8B8D',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🌐 View All Routes
              </button>
            </div>
          )}

          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #E2E8F0', color: '#475569' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span>🟢</span> Origin Port</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span>🔴</span> Destination Port</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span>🟠</span> Transshipment Port</div>
          </div>
        </div>

        {/* INTERACTIVE BOTTOM MAP LEGEND STRIP */}
        <div className="map-legend-box" style={{
          marginTop: '0.85rem',
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '0.75rem 1rem'
        }}>
          <div style={{
            fontSize: '0.8rem',
            fontWeight: '700',
            color: '#062B49',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between'
          }}>
            <span>📍 MAP LEGEND — {isMultiRouteMode ? 'ROUTE COLOR CODING' : 'SINGLE ROUTE MODE'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {!isCompact && !isMultiRouteMode && (
                <button
                  onClick={() => {
                    if (onResetViewAll) onResetViewAll()
                    else if (onSelectRoute) onSelectRoute('ALL')
                  }}
                  style={{
                    background: '#0F8B8D',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  🌐 View All Routes
                </button>
              )}

              <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748B' }}>
                {isMultiRouteMode ? `SHOWING ${routeList.length} ROUTE(S) SIMULTANEOUSLY` : `SHOWING 1 ROUTE (${activeRouteMetrics?.route_name})`}
              </span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '1.25rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            fontSize: '0.85rem'
          }}>
            {legendRoutes.map((lr) => (
              <div
                key={lr.route_id}
                onClick={() => onSelectRoute && onSelectRoute(lr)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  background: lr.isActive ? '#FFFFFF' : 'transparent',
                  border: lr.isActive ? `1.5px solid ${lr.colorHex}` : '1.5px solid transparent',
                  fontWeight: lr.isActive ? '700' : '500',
                  boxShadow: lr.isActive ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <span style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '3px',
                  backgroundColor: lr.colorHex,
                  display: 'inline-block',
                  border: lr.isBest ? '2px solid #047857' : '1px solid rgba(0,0,0,0.2)'
                }} />
                <span style={{ color: '#1E293B' }}>
                  {lr.isBest ? 'Best Route' : `${lr.roleLabel}`}: <strong>{lr.route_name}</strong> ({lr.route_score}/100)
                </span>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginLeft: 'auto', fontSize: '0.8rem', color: '#475569' }}>
              <span>🛫 Origin Port</span>
              <span>🏁 Destination Port</span>
              <span>🔄 Transshipment Port</span>
            </div>
          </div>
        </div>
      </div>

      {/* VISUALIZATION DISCLAIMER FOOTER */}
      <div style={{
        marginTop: '0.65rem',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        fontSize: '0.78rem',
        color: '#64748B',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <span>
          ⚠️ <em>Visualization Corridor: Connects dataset ports for illustrative route analysis; not exact AIS vessel tracking.</em>
        </span>
        <span style={{ fontWeight: '600', color: '#0F8B8D' }}>
          📍 {originCoord.name} ➔ {destCoord.name}
        </span>
      </div>
    </div>
  )
}

export default RouteMap
