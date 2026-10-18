"use client";

import { useEffect, useRef, useState } from "react";

type Category = "pharmacy" | "hospital" | "clinic";

type Place = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  distance: number;
};

type UserLocation = {
  lat: number;
  lon: number;
};

const categories: {
  id: Category;
  label: string;
  icon: string;
}[] = [
  {
    id: "pharmacy",
    label: "Pharmacy",
    icon: "💊",
  },
  {
    id: "hospital",
    label: "Hospital",
    icon: "🏥",
  },
  {
    id: "clinic",
    label: "Clinic",
    icon: "🩺",
  },
];

// Multiple public Overpass servers.
// Public instances can become busy, so we try them one by one.
const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const OSRM_SERVER =
  "https://router.project-osrm.org";

export default function HealthCenterMap() {
  const mapRef = useRef<HTMLDivElement | null>(
    null
  );

  const mapInstance = useRef<any>(null);

  const userMarker = useRef<any>(null);

  const placeMarkers = useRef<any[]>([]);

  const routeLine = useRef<any>(null);

  const [category, setCategory] =
    useState<Category>("pharmacy");

  const [places, setPlaces] = useState<Place[]>(
    []
  );

  const [location, setLocation] =
    useState<UserLocation | null>(null);

  const [selectedPlace, setSelectedPlace] =
    useState<Place | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [routeLoading, setRouteLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [routeInfo, setRouteInfo] =
    useState<{
      distance: string;
      duration: string;
    } | null>(null);

  // =====================================================
  // INITIALIZE LEAFLET MAP
  // =====================================================

  useEffect(() => {
    let active = true;

    async function initializeMap() {
      if (!mapRef.current) return;

      const L = await import(
        "leaflet"
      );

      if (!active || !mapRef.current) {
        return;
      }

      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)
        ._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(
        mapRef.current
      ).setView(
        [28.6139, 77.209],
        13
      );

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,

          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }
      ).addTo(map);

      mapInstance.current = map;

      // Important for maps inside dynamic layouts
      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    }

    initializeMap();

    return () => {
      active = false;

      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // =====================================================
  // GET CURRENT LOCATION
  // =====================================================

  function getCurrentLocation(): Promise<UserLocation> {
    return new Promise(
      (resolve, reject) => {
        if (!navigator.geolocation) {
          reject(
            new Error(
              "Your browser does not support location access."
            )
          );

          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            });
          },

          (error) => {
            if (
              error.code ===
              error.PERMISSION_DENIED
            ) {
              reject(
                new Error(
                  "Location permission was denied. Please allow location access."
                )
              );
            } else {
              reject(
                new Error(
                  "Could not determine your location. Please try again."
                )
              );
            }
          },

          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000,
          }
        );
      }
    );
  }

  // =====================================================
  // CLEAR PLACE MARKERS
  // =====================================================

  function clearPlaceMarkers() {
    placeMarkers.current.forEach(
      (marker) => {
        marker.remove();
      }
    );

    placeMarkers.current = [];
  }

  // =====================================================
  // CLEAR ROUTE
  // =====================================================

  function clearRoute() {
    if (routeLine.current) {
      routeLine.current.remove();
      routeLine.current = null;
    }

    setRouteInfo(null);
  }

  // =====================================================
  // BUILD OVERPASS QUERY
  // =====================================================

  function buildQuery(
    selected: Category,
    lat: number,
    lon: number
  ) {
    if (selected === "pharmacy") {
      return `
        [out:json][timeout:20];

        nwr["amenity"="pharmacy"]
          (around:3000,${lat},${lon});

        out center tags;
      `;
    }

    if (selected === "hospital") {
      return `
        [out:json][timeout:20];

        nwr["amenity"="hospital"]
          (around:5000,${lat},${lon});

        out center tags;
      `;
    }

    return `
      [out:json][timeout:20];

      (
        nwr["amenity"="clinic"]
          (around:5000,${lat},${lon});

        nwr["amenity"="doctors"]
          (around:5000,${lat},${lon});

        nwr["healthcare"="clinic"]
          (around:5000,${lat},${lon});

        nwr["healthcare"="doctor"]
          (around:5000,${lat},${lon});
      );

      out center tags;
    `;
  }

  // =====================================================
  // SEARCH OVERPASS WITH FALLBACK SERVERS
  // =====================================================

  async function searchOverpass(
    query: string
  ) {
    let lastError: unknown = null;

    for (const server of OVERPASS_SERVERS) {
      try {
        console.log(
          "Trying Overpass:",
          server
        );

        const controller =
          new AbortController();

        const timeout =
          setTimeout(() => {
            controller.abort();
          }, 18000);

        const response =
          await fetch(server, {
            method: "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            body:
              "data=" +
              encodeURIComponent(query),

            signal:
              controller.signal,
          });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(
            `Server returned ${response.status}`
          );
        }

        const data =
          await response.json();

        return data;
      } catch (error) {
        console.warn(
          "Overpass failed:",
          server,
          error
        );

        lastError = error;
      }
    }

    throw (
      lastError ||
      new Error(
        "All nearby search servers failed."
      )
    );
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
      // -----------------------------------------------
      // GPS
      // -----------------------------------------------

      const current =
        await getCurrentLocation();

      setLocation(current);

      // -----------------------------------------------
      // MAP
      // -----------------------------------------------

      if (!mapInstance.current) {
        throw new Error(
          "Map is still loading. Please try again."
        );
      }

      mapInstance.current.setView(
        [
          current.lat,
          current.lon,
        ],
        15
      );

      const L =
        await import("leaflet");

      // User marker
      if (userMarker.current) {
        userMarker.current.remove();
      }

      userMarker.current =
        L.marker([
          current.lat,
          current.lon,
        ])
          .addTo(mapInstance.current)
          .bindPopup(
            "📍 You are here"
          );

      // -----------------------------------------------
      // OVERPASS
      // -----------------------------------------------

      const query =
        buildQuery(
          category,
          current.lat,
          current.lon
        );

      const data =
        await searchOverpass(
          query
        );

      const results: Place[] =
        data.elements
          .map((item: any) => {
            const lat =
              item.lat ??
              item.center?.lat;

            const lon =
              item.lon ??
              item.center?.lon;

            if (
              typeof lat !== "number" ||
              typeof lon !== "number"
            ) {
              return null;
            }

            const tags =
              item.tags || {};

            const name =
              tags.name ||
              tags["name:en"] ||
              tags["name:hi"] ||
              category ===
                "pharmacy"
                ? "Pharmacy"
                : category ===
                  "hospital"
                ? "Hospital"
                : "Clinic";

            const address =
              [
                tags[
                  "addr:housenumber"
                ],
                tags[
                  "addr:street"
                ],
                tags[
                  "addr:suburb"
                ],
                tags["addr:city"],
              ]
                .filter(Boolean)
                .join(", ");

            return {
              id: `${item.type}-${item.id}`,

              name,

              lat,

              lon,

              address:
                address ||
                "Address unavailable",

              distance:
                calculateDistance(
                  current.lat,
                  current.lon,
                  lat,
                  lon
                ),
            };
          })
          .filter(Boolean)
          .sort(
            (
              a: Place,
              b: Place
            ) =>
              a.distance -
              b.distance
          )
          .slice(0, 15);

      if (!results.length) {
        setMessage(
          `No ${category} locations were found nearby.`
        );

        setLoading(false);

        return;
      }

      setPlaces(results);

      // -----------------------------------------------
      // ADD MARKERS
      // -----------------------------------------------

      results.forEach(
        (place) => {
          const marker =
            L.marker([
              place.lat,
              place.lon,
            ])
              .addTo(
                mapInstance.current!
              )
              .bindPopup(
                `<strong>${escapeHtml(
                  place.name
                )}</strong><br/>${formatDistance(
                  place.distance
                )}`
              );

          marker.on(
            "click",
            () => {
              setSelectedPlace(
                place
              );

              clearRoute();
            }
          );

          placeMarkers.current.push(
            marker
          );
        }
      );

      setMessage(
        `Found ${results.length} nearby ${category} locations.`
      );

      // Make sure map redraws
      setTimeout(() => {
        mapInstance.current?.invalidateSize();
      }, 200);
    } catch (error: any) {
      console.error(
        "VisionMate nearby search error:",
        error
      );

      setMessage(
        error?.message ||
          "Nearby healthcare search failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // SHOW WALKING ROUTE
  // =====================================================

  async function showWalkingRoute(
    place: Place
  ) {
    if (!location) {
      setMessage(
        "Please find your location first."
      );

      return;
    }

    if (!mapInstance.current) {
      return;
    }

    setSelectedPlace(place);
    setRouteLoading(true);
    setMessage("");
    clearRoute();

    try {
      const url =
        `${OSRM_SERVER}/route/v1/foot/` +
        `${location.lon},${location.lat};` +
        `${place.lon},${place.lat}` +
        `?overview=full` +
        `&geometries=geojson` +
        `&steps=true`;

      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Walking route service returned ${response.status}.`
        );
      }

      const data =
        await response.json();

      if (
        data.code !== "Ok" ||
        !data.routes?.length
      ) {
        throw new Error(
          "No walking route could be calculated."
        );
      }

      const route =
        data.routes[0];

      const routeDistance =
        Number(
          route.distance || 0
        );

      const routeDuration =
        Number(
          route.duration || 0
        );

      const distanceText =
        routeDistance >= 1000
          ? `${(
              routeDistance /
              1000
            ).toFixed(1)} km`
          : `${Math.round(
              routeDistance
            )} m`;

      const minutes = Math.max(
        1,
        Math.round(
          routeDuration /
            60
        )
      );

      const durationText =
        minutes >= 60
          ? `${Math.floor(
              minutes / 60
            )} hr ${
              minutes % 60
            } min`
          : `${minutes} min`;

      setRouteInfo({
        distance:
          distanceText,

        duration:
          durationText,
      });

      // -----------------------------------------------
      // DRAW ROUTE
      // -----------------------------------------------

      const L =
        await import("leaflet");

      const coordinates =
        route.geometry
          ?.coordinates || [];

      const latLngs =
        coordinates.map(
          (coordinate: [
            number,
            number
          ]) => [
            coordinate[1],
            coordinate[0],
          ]
        );

      if (latLngs.length) {
        routeLine.current =
          L.polyline(
            latLngs,
            {
              weight: 6,
              opacity: 0.9,
            }
          ).addTo(
            mapInstance.current
          );

        mapInstance.current.fitBounds(
          routeLine.current.getBounds(),
          {
            padding: [
              40,
              40,
            ],
          }
        );
      }

      setMessage(
        `Walking route to ${place.name} calculated.`
      );
    } catch (error: any) {
      console.error(
        "Walking route error:",
        error
      );

      setMessage(
        error?.message ||
          "Could not calculate walking route."
      );
    } finally {
      setRouteLoading(false);
    }
  }

  // =====================================================
  // OPEN GOOGLE MAPS EXTERNALLY
  // =====================================================

  function openGoogleMaps(
    place: Place
  ) {
    if (!location) {
      return;
    }

    const url =
      "https://www.google.com/maps/dir/?api=1" +
      `&origin=${location.lat},${location.lon}` +
      `&destination=${place.lat},${place.lon}` +
      "&travelmode=walking";

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <section className="w-full space-y-4">
      {/* HEADER */}

      <div>
        <h2 className="text-2xl font-bold">
          VisionMate Navigation
        </h2>

        <p className="text-sm text-gray-500">
          Find nearby healthcare facilities
          using OpenStreetMap.
        </p>
      </div>

      {/* CATEGORY BUTTONS */}

      <div className="flex flex-wrap gap-2">
        {categories.map(
          (item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setCategory(
                  item.id
                );

                setPlaces(
                  []
                );

                setSelectedPlace(
                  null
                );

                setMessage("");

                clearPlaceMarkers();

                clearRoute();
              }}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                category ===
                item.id
                  ? "bg-black text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {item.icon}{" "}
              {item.label}
            </button>
          )
        )}
      </div>

      {/* CONTROLS */}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={findNearby}
          disabled={loading}
          className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading
            ? "Searching..."
            : `🔎 Find nearby ${category}`}
        </button>

        <button
          type="button"
          onClick={async () => {
            try {
              const current =
                await getCurrentLocation();

              setLocation(
                current
              );

              mapInstance.current?.setView(
                [
                  current.lat,
                  current.lon,
                ],
                16
              );

              const L =
                await import(
                  "leaflet"
                );

              if (
                userMarker.current
              ) {
                userMarker.current.remove();
              }

              userMarker.current =
                L.marker([
                  current.lat,
                  current.lon,
                ])
                  .addTo(
                    mapInstance.current!
                  )
                  .bindPopup(
                    "📍 You are here"
                  )
                  .openPopup();

              setMessage(
                "Your current location has been found."
              );
            } catch (error: any) {
              setMessage(
                error?.message ||
                  "Could not get your location."
              );
            }
          }}
          className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white"
        >
          📍 Find my location
        </button>
      </div>

      {/* MESSAGE */}

      {message && (
        <div className="rounded-xl border bg-white p-3 text-sm">
          {message}
        </div>
      )}

      {/* MAP */}

      <div
        ref={mapRef}
        className="h-[420px] w-full overflow-hidden rounded-2xl border"
      />

      {/* ROUTE INFORMATION */}

      {routeInfo &&
        selectedPlace && (
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-lg font-bold">
              🚶 Walking route
            </div>

            <div className="mt-1 font-semibold">
              {selectedPlace.name}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-xs text-gray-500">
                  Distance
                </div>

                <div className="mt-1 text-xl font-bold">
                  {routeInfo.distance}
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <div className="text-xs text-gray-500">
                  Walking time
                </div>

                <div className="mt-1 text-xl font-bold">
                  {routeInfo.duration}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* NEARBY RESULTS */}

      {places.length > 0 && (
        <div>
          <h3 className="mb-3 text-xl font-bold">
            Nearby{" "}
            {category ===
            "pharmacy"
              ? "Pharmacies"
              : category ===
                "hospital"
              ? "Hospitals"
              : "Clinics"}
          </h3>

          <div className="grid gap-3">
            {places.map(
              (place) => (
                <div
                  key={place.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm ${
                    selectedPlace?.id ===
                    place.id
                      ? "border-blue-500"
                      : ""
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-bold">
                        {place.name}
                      </h4>

                      <p className="mt-1 text-sm text-gray-500">
                        {place.address}
                      </p>

                      <p className="mt-2 font-semibold text-blue-600">
                        📍{" "}
                        {formatDistance(
                          place.distance
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          showWalkingRoute(
                            place
                          )
                        }
                        disabled={
                          routeLoading
                        }
                        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {routeLoading &&
                        selectedPlace?.id ===
                          place.id
                          ? "Calculating..."
                          : "🚶 Show route"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openGoogleMaps(
                            place
                          )
                        }
                        className="rounded-lg border px-4 py-2 text-sm font-semibold"
                      >
                        Google Maps
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* OSM ATTRIBUTION */}

      <p className="text-xs text-gray-500">
        Map and healthcare location data ©
        OpenStreetMap contributors.
        Healthcare data may be incomplete
        or outdated.
      </p>
    </section>
  );
}

// =====================================================
// DISTANCE CALCULATION
// =====================================================

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadius = 6371;

  const dLat =
    ((lat2 - lat1) *
      Math.PI) /
    180;

  const dLon =
    ((lon2 - lon1) *
      Math.PI) /
    180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos(
      (lat1 * Math.PI) /
        180
    ) *
      Math.cos(
        (lat2 * Math.PI) /
          180
      ) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return (
    earthRadius * c
  );
}

// =====================================================
// FORMAT DISTANCE
// =====================================================

function formatDistance(
  distance: number
) {
  if (distance < 1) {
    return `${Math.round(
      distance * 1000
    )} m away`;
  }

  return `${distance.toFixed(
    1
  )} km away`;
}

// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(
  value: string
) {
  return value
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}