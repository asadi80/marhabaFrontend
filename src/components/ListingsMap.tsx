//src/components/ListingMap
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { Listing } from "../types";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";
// console.log("TOKEN RAW:", JSON.stringify(import.meta.env.VITE_MAPBOX_TOKEN));
// console.log("TOKEN LEN:", import.meta.env.VITE_MAPBOX_TOKEN?.length);

// Center of Libya, used when there are no listings to fit to.
const DEFAULT_CENTER: [number, number] = [17.2, 27.0];
const DEFAULT_ZOOM = 4.5;

interface ListingsMapProps {
  listings: Listing[];
  isAr: boolean;
  onSelect: (id: string | number) => void;
  /** When set, shows a "you are here" dot and includes it in the initial view. */
  userLocation?: { lat: number; lng: number } | null;
  className?: string;
}

type Coords = [number, number]; // [lng, lat]

/**
 * Listings may store coordinates in different shapes depending on the
 * endpoint. Accept the common ones and return [lng, lat] or null.
 */
function getCoords(listing: Listing): Coords | null {
  const l = listing as unknown as Record<string, any>;

  const candidates: Array<[unknown, unknown]> = [
    [l.longitude, l.latitude],
    [l.lng, l.lat],
    [l.lon, l.lat],
    [l.location?.lng, l.location?.lat],
    [l.location?.longitude, l.location?.latitude],
    [l.coordinates?.lng, l.coordinates?.lat],
    [l.coordinates?.longitude, l.coordinates?.latitude],
  ];

  if (Array.isArray(l.coordinates) && l.coordinates.length >= 2) {
    // GeoJSON order: [lng, lat]
    candidates.push([l.coordinates[0], l.coordinates[1]]);
  }

  for (const [rawLng, rawLat] of candidates) {
    if (rawLng == null || rawLat == null || rawLng === "" || rawLat === "") {
      continue;
    }
    const lng = Number(rawLng);
    const lat = Number(rawLat);
    if (
      Number.isFinite(lng) &&
      Number.isFinite(lat) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      !(lat === 0 && lng === 0)
    ) {
      return [lng, lat];
    }
  }
  return null;
}

function buildPopup(
  listing: Listing,
  isAr: boolean,
  onSelect: (id: string | number) => void,
): HTMLElement {
  // Built with DOM APIs (not innerHTML) so listing text can never inject markup.
  const root = document.createElement("div");
  root.style.cssText =
    "width:200px;cursor:pointer;font-family:inherit;direction:" +
    (isAr ? "rtl" : "ltr");

  const img = listing.images?.[0];
  if (img) {
    const el = document.createElement("img");
    el.src = img;
    el.alt = listing.title ?? "";
    el.style.cssText =
      "width:100%;height:120px;object-fit:cover;border-radius:10px;margin-bottom:8px;display:block";
    root.appendChild(el);
  }

  const title = document.createElement("div");
  title.textContent = (listing.title ?? "").slice(0, 50);
  title.style.cssText =
    "font-weight:600;font-size:13px;color:#111;margin-bottom:2px";
  root.appendChild(title);

  const price = document.createElement("div");
  price.style.cssText = "font-size:13px;color:#111";
  const strong = document.createElement("strong");
  strong.textContent = String(listing.price ?? "");
  price.appendChild(strong);
  price.appendChild(
    document.createTextNode(
      ` ${isAr ? "دينار" : "LYD"} / ${isAr ? "ليلة" : "night"}`,
    ),
  );
  root.appendChild(price);

  root.addEventListener("click", () => onSelect(listing.id as string | number));
  return root;
}

export default function ListingsMap({
  listings,
  isAr,
  onSelect,
  userLocation = null,
  className = "",
}: ListingsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const loadedRef = useRef(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Keep latest callbacks/data available to map event handlers without
  // re-creating the map every time they change.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const isArRef = useRef(isAr);
  isArRef.current = isAr;

  const { geojson, byId, bounds } = useMemo(() => {
    const byId = new Map<string, Listing>();
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    const bounds = new mapboxgl.LngLatBounds();

    listings.forEach((listing) => {
      const coords = getCoords(listing);
      if (!coords || listing.id == null) return;

      byId.set(String(listing.id), listing);
      bounds.extend(coords);
      features.push({
        type: "Feature",
        properties: { id: String(listing.id), price: String(listing.price ?? "") },
        geometry: { type: "Point", coordinates: coords },
      });
    });

    if (userLocation) bounds.extend([userLocation.lng, userLocation.lat]);

    return {
      geojson: {
        type: "FeatureCollection",
        features,
      } as GeoJSON.FeatureCollection<GeoJSON.Point>,
      byId,
      bounds,
    };
  }, [listings, userLocation]);

  const byIdRef = useRef(byId);
  byIdRef.current = byId;

  // ---- Create the map once ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      "top-right",
    );

    map.on("error", (e) => {
      console.error("Mapbox error:", e.error);
      const msg = e.error?.message || "Map failed to load";
      // Only surface fatal-looking errors (bad token, blocked style), not missing tiles.
      if (/unauthorized|forbidden|token|style|401|403/i.test(msg)) {
        setMapError(msg);
      }
    });

    map.on("load", () => {
      map.resize();
      map.addSource("listings", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 50,
      });

      // Clusters
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "listings",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1a1a2e",
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 50, 30],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#e8c547",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "listings",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 13,
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        },
        paint: { "text-color": "#ffffff" },
      });

      // Single listings
      map.addLayer({
        id: "listing-points",
        type: "circle",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#e8c547",
          "circle-radius": 9,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#1a1a2e",
        },
      });

      // Zoom into a cluster on click
      map.on("click", "clusters", (e) => {
        const feature = map.queryRenderedFeatures(e.point, {
          layers: ["clusters"],
        })[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id;
        const source = map.getSource("listings") as mapboxgl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          map.easeTo({
            center: (feature.geometry as GeoJSON.Point).coordinates as Coords,
            zoom: zoom + 0.5,
          });
        });
      });

      // Show a listing popup on click
      map.on("click", "listing-points", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const listing = byIdRef.current.get(String(feature.properties?.id));
        if (!listing) return;

        const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as Coords;

        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 16, closeButton: false })
          .setLngLat(coords)
          .setDOMContent(
            buildPopup(listing, isArRef.current, (id) => onSelectRef.current(id)),
          )
          .addTo(map);
      });

      ["clusters", "listing-points"].forEach((layer) => {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      });

      loadedRef.current = true;
      // Trigger the data effect below now that the source exists.
      map.fire("listings-ready");
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // ---- Push data into the map whenever listings change ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const source = map.getSource("listings") as mapboxgl.GeoJSONSource | undefined;
      if (!source) return;
      source.setData(geojson);

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 600 });
      }
    };

    if (loadedRef.current) {
      apply();
    } else {
      map.once("listings-ready", apply);
      return () => {
        map.off("listings-ready", apply);
      };
    }
  }, [geojson, bounds]);

  // ---- "You are here" marker ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    const dot = document.createElement("div");
    dot.setAttribute("aria-label", isArRef.current ? "موقعك" : "Your location");
    dot.style.cssText =
      "width:16px;height:16px;border-radius:50%;background:#378ADD;border:3px solid #fff;box-shadow:0 0 0 4px rgba(55,138,221,0.3)";

    const marker = new mapboxgl.Marker({ element: dot })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);

    return () => {
      marker.remove();
    };
  }, [userLocation]);

  if (!import.meta.env.VITE_MAPBOX_TOKEN) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-2xl text-sm text-gray-500 p-6 text-center ${className}`}
      >
        {isAr
          ? "مفتاح Mapbox غير مضبوط (VITE_MAPBOX_TOKEN)"
          : "Mapbox token missing. Set VITE_MAPBOX_TOKEN in your .env file."}
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-gray-100 ${className}`}
      style={{ minHeight: 360 }}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 p-6 text-center text-sm text-red-600">
          {mapError}
        </div>
      )}
      <div className="absolute bottom-3 start-3 bg-white/95 rounded-full px-3 py-1 text-[11px] font-medium text-gray-900 shadow">
        {geojson.features.length} {isAr ? "إقامة على الخريطة" : "stays on map"}
      </div>
    </div>
  );
}