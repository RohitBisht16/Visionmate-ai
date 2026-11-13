"use client";

import { useEffect, useRef, useState } from "react";

type Category = "pharmacy" | "hospital" | "clinic";

type LatLon = {
  lat: number;
  lon: number;
};

type Place = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  distance: number;
};

type RouteInfo = {
  distanceMeters: number;
  durationSeconds: number;
};

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Default fallback center (Ghaziabad / Delhi NCR) before GPS locks
const DEFAULT_CENTER: LatLon = {
  lat: 28.6692,
  lon: 77.4538,
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m away`;
  }
  return `${(meters / 1000).toFixed(1)} km away`;
}

function formatDuration(seconds: number) {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) {
    return `${mins} min`;
  }
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}

export default function HealthCenterMap() {
  const [category, setCategory] = useState<Category>("pharmacy");
  const [location, setLocation] = useState<LatLon | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [message, setMessage] = useState("");

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const userMarker = useRef<any>(null);
  const placeMarkers = useRef<any[]>([]);
  const routeLayer = useRef<any>(null);

  // =====================================================
  // INITIALIZE LEAFLET MAP
  // =====================================================

  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstance.current) return;

      const L = await import("leaflet");

      // Fix default Leaflet marker icons in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!isMounted || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current).setView(
        [DEFAULT_CENTER.lat, DEFAULT_CENTER.lon],
        14
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      mapInstance.current = map;
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // =====================================================
  // HELPERS
  // =====================================================

  function clearPlaceMarkers() {
    placeMarkers.current.forEach((marker) => marker.remove());
    placeMarkers.current = [];
  }

  function clearRoute() {
    if (routeLayer.current) {
      routeLayer.current.remove();
      routeLayer.current = null;
    }
    setRouteInfo(null);
  }

  function getCurrentLocation(): Promise<LatLon> {
    if (location) {
      return Promise.resolve(location);
    }

    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            reject(
              new Error(
                "Location permission denied. Please enable GPS access in your browser."
              )
            );
          } else {
            reject(new Error("Unable to retrieve your current location."));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000,
        }
      );
    });
  }

  async function locateUserOnly() {
    setLoading(true);
    setMessage("");
    try {
      const current = await getCurrentLocation();
      setLocation(current);

      if (mapInstance.current) {
        mapInstance.current.setView([current.lat, current.lon], 15);
        const L = await import("leaflet");

        if (userMarker.current) {
          userMarker.current.remove();
        }

        userMarker.current = L.marker([current.lat, current.lon])
          .addTo(mapInstance.current)
          .bindPopup("📍 You are here")
          .openPopup();
      }
      setMessage("Location updated.");
    } catch (error: any) {
      setMessage(error?.message || "Could not get location.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // OVERPASS QUERY & PARALLEL RACE
  // =====================================================

  function buildQuery(selected: Category, lat: number, lon: number) {
    if (selected === "pharmacy") {
      return `[out:json][timeout:8];nw["amenity"="pharmacy"](around:2500,${lat},${lon});out center 25;`;
    }

    if (selected === "hospital") {
      return `[out:json][timeout:8];nw["amenity"="hospital"](around:4000,${lat},${lon});out center 25;`;
    }

    return `[out:json][timeout:8];(nw["amenity"~"^(clinic|doctors)$"](around:3500,${lat},${lon});nw["healthcare"~"^(clinic|doctor)$"](around:3500,${lat},${lon}););out center 25;`;
  }

  async function searchOverpass(query: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const data = await Promise.any(
        OVERPASS_SERVERS.map(async (server) => {
          const response = await fetch(server, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "data=" + encodeURIComponent(query),
            signal: controller.signal,
          });

          if (!response.ok) {
            return Promise.reject(`HTTP ${response.status}`);
          }

          return response.json();
        })
      );

      clearTimeout(timeout);
      controller.abort();
      return data;
    } catch {
      clearTimeout(timeout);
      throw new Error(
        "Map servers are busy right now. Please tap Find nearby again."
      );
    }
  }

  // =====================================================
  // FIND NEARBY HEALTHCARE
  // =====================================================

  async function findNearby() {
    setLoading(true);
    setMessage("");
    setSelectedPlace(null);
    clearRoute();
    clearPlaceMarkers();

    try {
      const current = await getCurrentLocation();
      setLocation(current);

      if (!mapInstance.current) {
        throw new Error("Map is still loading. Please try again.");
      }

      mapInstance.current.setView([current.lat, current.lon], 15);
      const L = await import("leaflet");

      if (userMarker.current) {
        userMarker.current.remove();
      }

      userMarker.current = L.marker([current.lat, current.lon])
        .addTo(mapInstance.current)
        .bindPopup("📍 You are here");

      // Session cache check (0ms repeat searches)
      const cacheKey = `vm_osm_${category}_${current.lat.toFixed(3)}_${current.lon.toFixed(3)}`;
      let data: any = null;

      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) data = JSON.parse(cached);
      } catch {}

      if (!data) {
        const query = buildQuery(category, current.lat, current.lon);
        data = await searchOverpass(query);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        } catch {}
      }

      const elements = Array.isArray(data?.elements) ? data.elements : [];

      const results: Place[] = elements
        .map((item: any) => {
          const lat = item.lat ?? item.center?.lat;
          const lon = item.lon ?? item.center?.lon;

          if (typeof lat !== "number" || typeof lon !== "number") {
            return null;
          }

          const tags = item.tags || {};
          const name =
            tags.name ||
            tags["name:en"] ||
            tags["name:hi"] ||
            (category === "pharmacy"
              ? "Pharmacy"
              : category === "hospital"
              ? "Hospital"
              : "Clinic");

          const address = [
            tags["addr:housenumber"],
            tags["addr:street"],
            tags["addr:suburb"],
            tags["addr:city"],
          ]
            .filter(Boolean)
            .join(", ");

          return {
            id: `${item.type}-${item.id}`,
            name,
            lat,
            lon,
            address: address || "Address unavailable",
            distance: calculateDistance(current.lat, current.lon, lat, lon),
          };
        })
        .filter(Boolean)
        .sort((a: Place, b: Place) => a.distance - b.distance)
        .slice(0, 15);

      if (!results.length) {
        setPlaces([]);
        setMessage(`No ${category} locations were found nearby.`);
        return;
      }

      setPlaces(results);

      results.forEach((place) => {
        const marker = L.marker([place.lat, place.lon])
          .addTo(mapInstance.current!)
          .bindPopup(
            `<strong>${escapeHtml(place.name)}</strong><br/>${formatDistance(
              place.distance
            )}`
          );

        marker.on("click", () => {
          setSelectedPlace(place);
          clearRoute();
        });

        placeMarkers.current.push(marker);
      });

      setMessage(`Found ${results.length} nearby ${category} locations.`);
    } catch (error: any) {
      setMessage(error?.message || "Could not search nearby locations.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // SHOW WALKING ROUTE (OSRM)
  // =====================================================

  async function showWalkingRoute(place: Place) {
    if (!location || !mapInstance.current) return;

    setSelectedPlace(place);
    setRouteLoading(true);
    clearRoute();

    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${location.lon},${location.lat};${place.lon},${place.lat}?overview=full&geometries=geojson`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(7000),
      });

      if (!response.ok) {
        throw new Error("Could not calculate walking route.");
      }

      const data = await response.json();
      const route = data?.routes?.[0];

      if (!route?.geometry?.coordinates) {
        throw new Error("No walking route found.");
      }

      const latLngs = route.geometry.coordinates.map(
        ([lon, lat]: [number, number]) => [lat, lon]
      );

      const L = await import("leaflet");

      routeLayer.current = L.polyline(latLngs, {
        color: "#16a34a",
        weight: 5,
      }).addTo(mapInstance.current);

      mapInstance.current.fitBounds(routeLayer.current.getBounds(), {
        padding: [40, 40],
      });

      setRouteInfo({
        distanceMeters: route.distance,
        durationSeconds: route.duration,
      });
    } catch (error: any) {
      setMessage(error?.message || "Walking route failed.");
    } finally {
      setRouteLoading(false);
    }
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">VisionMate Navigation</h2>
        <p className="text-sm text-zinc-500">
          Find nearby healthcare facilities using OpenStreetMap.
        </p>
      </div>

      {/* Category Selector */}
      <div className="flex flex-wrap gap-2">
        {(["pharmacy", "hospital", "clinic"] as Category[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize border transition ${
              category === cat
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {cat === "pharmacy"
              ? "💊 Pharmacy"
              : cat === "hospital"
              ? "🏥 Hospital"
              : "🩺 Clinic"}
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={findNearby}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition"
        >
          {loading ? "Searching..." : `🔎 Find nearby ${category}`}
        </button>

        <button
          type="button"
          onClick={locateUserOnly}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition"
        >
          📍 Find my location
        </button>
      </div>

      {/* Status Message */}
      {message && (
        <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-700">
          {message}
        </div>
      )}

      {/* Leaflet Map */}
      <div
        ref={mapContainerRef}
        className="w-full h-[420px] rounded-xl border border-zinc-200 overflow-hidden z-0"
      />

      {/* Selected Route Banner */}
      {selectedPlace && routeInfo && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 space-y-1">
          <p className="font-semibold text-emerald-900">
            🚶 Walking route — {selectedPlace.name}
          </p>
          <p className="text-sm text-emerald-800">
            Distance: {(routeInfo.distanceMeters / 1000).toFixed(2)} km •
            Walking time: {formatDuration(routeInfo.durationSeconds)}
          </p>
        </div>
      )}

      {/* Results List */}
      {places.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {places.map((place) => (
            <div
              key={place.id}
              className="p-4 rounded-xl border border-zinc-200 bg-white flex flex-col justify-between gap-3"
            >
              <div>
                <h3 className="font-semibold text-zinc-900">{place.name}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{place.address}</p>
                <p className="text-xs font-medium text-emerald-700 mt-1">
                  📍 {formatDistance(place.distance)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => showWalkingRoute(place)}
                  disabled={routeLoading}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition"
                >
                  {routeLoading && selectedPlace?.id === place.id
                    ? "Routing..."
                    : "🚶 Show route"}
                </button>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}&travelmode=walking`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition"
                >
                  Google Maps ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-400">
        Map and healthcare location data &copy; OpenStreetMap contributors.
        Healthcare data may be incomplete or outdated.
      </p>
      <p className="text-xs text-zinc-500">
        <strong>Safety note:</strong> Visionmate provides informational
        assistance. In an emergency or severe symptoms, contact local emergency
        services or a qualified healthcare professional.
      </p>
    </div>
  );
}