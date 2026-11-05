import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import Navbar from "../../components/Navbar";
import { apiService } from "../../services/api";
import { compressImage } from "../../lib/compressImage";

import type mapboxgl from "mapbox-gl";

/* ==========================================================================
   CONFIGURATION
========================================================================== */

const HOST_ROLE = "host";
const MAX_IMAGES = 6;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const ACCEPTED_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
];

// Backend route: POST /api/v1/uploads/:type
const LISTING_IMAGE_UPLOAD_ENDPOINT =
  import.meta.env.VITE_LISTING_IMAGE_UPLOAD_ENDPOINT ||
  "/api/v1/uploads/listings";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

const DEFAULT_CENTER = { lat: 20, lng: 0 };

const NAV_LINKS = [
  {
    id: "dashboard",
    label: "Home",
    labelAr: "الرئيسية",
    href: "/host-dashboard",
    icon: "🏡",
  },
  {
    id: "listings",
    label: "Listings",
    labelAr: "إعلاناتي",
    href: "/host/listings",
    icon: "🏠",
  },
  {
    id: "bookings",
    label: "Bookings",
    labelAr: "الحجوزات",
    href: "/host/bookings",
    icon: "📅",
  },
  {
    id: "settings",
    label: "Settings",
    labelAr: "الإعدادات",
    href: "/host/settings",
    icon: "⚙️",
  },
];

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-base outline-none transition focus:border-[#e8c547] focus:ring-2 focus:ring-[#e8c547]/30 disabled:bg-gray-50";

/* ==========================================================================
   TYPES
========================================================================== */

interface Coordinates {
  lat: number;
  lng: number;
}

interface CancellationPolicy {
  type: string;
  description: string;
  rules: string[];
}

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number | string;
  location: string;
  latitude: number | string | null;
  longitude: number | string | null;
  timezone: string;
  images: string[];
  category: string;
  amenities: string[];
  rules: string[];
  cancellation_policy: CancellationPolicy;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormState {
  title: string;
  description: string;
  price: string;
  location: string;
  coordinates: Coordinates | null;
  timezone: string;
  images: string[];
  amenities: string[];
  rules: string[];
  category: string;
  cancellation_policy: CancellationPolicy;
}

interface Category {
  id: string;
  icon: string;
  labelEn: string;
  labelAr: string;
}

type TFn = (en: string, ar: string) => string;

/* ==========================================================================
   CONSTANTS
========================================================================== */

const CATEGORIES: Category[] = [
  { id: "beachfront", icon: "🏖️", labelEn: "Beachfront", labelAr: "شاطئ" },
  { id: "mountain", icon: "🏔️", labelEn: "Mountain", labelAr: "جبال" },
  { id: "city", icon: "🏙️", labelEn: "City", labelAr: "مدينة" },
  { id: "countryside", icon: "🏡", labelEn: "Countryside", labelAr: "ريفي" },
  { id: "pool", icon: "🏊", labelEn: "Pool", labelAr: "مسبح" },
  { id: "desert", icon: "🏜️", labelEn: "Desert", labelAr: "صحراء" },
  { id: "camping", icon: "🏕️", labelEn: "Camping", labelAr: "تخييم" },
  { id: "cabins", icon: "🛖", labelEn: "Cabins", labelAr: "كوخ" },
];

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  price: "",
  location: "",
  coordinates: null,
  timezone: "Africa/Tripoli",
  images: [],
  amenities: [""],
  rules: [],
  category: "city",
  cancellation_policy: {
    type: "flexible",
    description: "",
    rules: [],
  },
};

/* ==========================================================================
   GENERAL HELPERS
========================================================================== */

// Read the access token from the application's stored token object.
const readStoredAccessToken = (): string | null => {
  try {
    const raw = localStorage.getItem("tokens");
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return typeof parsed?.accessToken === "string" ? parsed.accessToken : null;
  } catch {
    return null;
  }
};

// Basic client-side JWT expiration check.
// The backend must still validate every protected request.
const isJwtExpired = (token: string): boolean => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return true;

    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");

    const payload = JSON.parse(atob(base64));

    if (!payload?.exp) return false;

    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
};

const hasValidStoredToken = (): boolean => {
  const token = readStoredAccessToken();
  return !!token && !isJwtExpired(token);
};

const toRole = (role?: string) => String(role || "").toLowerCase();

// Repair older URLs that were saved with HTML-escaped characters.
const normalizeImageUrl = (value: string): string => {
  return value
    .trim()
    .replace(/&#x2f;|&#47;|&sol;/gi, "/")
    .replace(/&#x3a;|&#58;|&colon;/gi, ":")
    .replace(/&amp;/gi, "&");
};

// Extract a useful message from different API error formats.
const extractApiErrorMessage = (error: any): string => {
  if (!error) return "Something went wrong";

  const body = error?.response?.data || error?.data || error?.body || null;

  if (body && typeof body === "object") {
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      const fieldErrors = body.errors
        .map((item: any) => {
          if (typeof item === "string") return item;

          if (item && typeof item === "object") {
            const message = item.message || item.msg || item.error;
            const value = item.value !== undefined ? `: ${item.value}` : "";

            return message ? `${message}${value}` : null;
          }

          return null;
        })
        .filter(Boolean);

      return [body.message || "Validation failed", ...fieldErrors].join("\n");
    }

    if (typeof body.message === "string" && body.message) {
      return body.message;
    }

    if (typeof body.error === "string" && body.error) {
      return body.error;
    }
  }

  if (typeof error?.message === "string" && error.message) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Something went wrong";
  }
};

/* ==========================================================================
   SMALL UI COMPONENTS
========================================================================== */

const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200/80 ${className}`} />
);

const Spinner: React.FC<{ className?: string }> = ({
  className = "border-[#e8c547]",
}) => (
  <span
    className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${className}`}
  />
);

const Section: React.FC<{
  title: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ title, hint, children }) => (
  <section className="rounded-2xl bg-white p-4 shadow-sm">
    <h3 className="text-base font-bold">{title}</h3>

    {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}

    <div className="mt-3 space-y-3">{children}</div>
  </section>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="mb-1.5 block text-sm font-medium text-gray-700">
    {children}
  </label>
);

/* ==========================================================================
   MAIN COMPONENT
========================================================================== */

const HostListings: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { lang, toggleLanguage } = useLanguage();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const isAr = lang === "ar";
  const t: TFn = (en, ar) => (isAr ? ar : en);

  const isAuthorizedHost =
    isAuthenticated && !!user && toRole(user.role) === HOST_ROLE;

  /* ------------------------------------------------------------------------
     STATE
  ------------------------------------------------------------------------ */

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingListing, setSavingListing] = useState(false);

  // Location and map state.
  const [markerPosition, setMarkerPosition] = useState<Coordinates | null>(
    null,
  );

  const [mapCenter, setMapCenter] = useState<Coordinates | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);

  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Address search state.
  const [addressQuery, setAddressQuery] = useState("");

  const [addressSuggestions, setAddressSuggestions] = useState<
    { id: string; place_name: string; lat: number; lng: number }[]
  >([]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);

  const addressSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Image upload and preview state.
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [uploadingFileName, setUploadingFileName] = useState<string | null>(
    null,
  );

  const imageInputRef = useRef<HTMLInputElement | null>(null);

  /*
   * IMPORTANT:
   * This Map connects each local blob preview URL to its actual File.
   *
   * Existing server images are normal URLs and are NOT stored here.
   * New images stay here until the user publishes or saves the listing.
   */
  const pendingImageFilesRef = useRef<Map<string, File>>(new Map());

  // Mapbox references.
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const mapboxglLibRef = useRef<typeof mapboxgl | null>(null);

  const [mapReady, setMapReady] = useState(false);

  // Toast notifications.
  const [toast, setToast] = useState<{
    msg: string;
    ok: boolean;
  } | null>(null);

  const notify = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
  }, []);

  /* ------------------------------------------------------------------------
     IMAGE CLEANUP
  ------------------------------------------------------------------------ */

  // Release all local preview URLs and clear their associated files.
  const clearPendingImages = useCallback(() => {
    for (const previewUrl of pendingImageFilesRef.current.keys()) {
      URL.revokeObjectURL(previewUrl);
    }

    pendingImageFilesRef.current.clear();
  }, []);

  // Toast automatically disappears.
  useEffect(() => {
    if (!toast) return;

    const id = window.setTimeout(() => setToast(null), toast.ok ? 3200 : 6000);

    return () => window.clearTimeout(id);
  }, [toast]);

  // Cleanup local resources when this component unmounts.
  useEffect(() => {
    return () => {
      clearPendingImages();

      if (addressSearchTimeout.current) {
        clearTimeout(addressSearchTimeout.current);
      }

      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [clearPendingImages]);

  /* ------------------------------------------------------------------------
     API URL HELPERS
  ------------------------------------------------------------------------ */

  // Build API endpoint URLs.
  const getApiUrl = useCallback((endpoint: string): string => {
    const baseUrl = (import.meta.env.VITE_API_URL || "")
      .trim()
      .replace(/\/+$/, "");

    let clean = endpoint.trim();

    if (/^https?:\/\//i.test(clean)) return clean;

    if (!clean.startsWith("/")) {
      clean = `/${clean}`;
    }

    // Prevent /api/v1/api/v1 duplication.
    if (baseUrl.endsWith("/api/v1") && clean.startsWith("/api/v1/")) {
      clean = clean.substring("/api/v1".length);
    }

    return baseUrl ? `${baseUrl}${clean}` : clean;
  }, []);

  // Get the API origin without its /api/v1 suffix.
  const getApiOrigin = useCallback((): string => {
    const baseUrl = (import.meta.env.VITE_API_URL || "")
      .trim()
      .replace(/\/+$/, "");

    return baseUrl.replace(/\/api\/v1$/i, "");
  }, []);

  /*
   * Convert a stored image path into a usable image URL.
   *
   * - Absolute URLs remain unchanged.
   * - blob URLs remain unchanged for local previews.
   * - Relative upload paths use the API origin.
   */
  const getAbsoluteImageUrl = useCallback(
    (imageUrl: string): string => {
      if (!imageUrl) return "";

      const normalized = normalizeImageUrl(imageUrl);

      if (/^https?:\/\//i.test(normalized)) return normalized;

      if (normalized.startsWith("blob:")) return normalized;

      if (normalized.startsWith("data:")) return normalized;

      const origin = getApiOrigin();

      if (!origin) return normalized;

      return `${origin}${normalized.startsWith("/") ? "" : "/"}${normalized}`;
    },
    [getApiOrigin],
  );

  // Read the token used by the image upload endpoint.
  const getAuthToken = (): string => {
    try {
      const raw = localStorage.getItem("tokens");

      if (raw) {
        const parsed = JSON.parse(raw);

        if (typeof parsed?.accessToken === "string") {
          return parsed.accessToken;
        }
      }
    } catch {
      // Try fallback token keys below.
    }

    return (
      localStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("authToken") ||
      sessionStorage.getItem("token") ||
      ""
    );
  };

  /* ------------------------------------------------------------------------
     GENERAL HELPERS
  ------------------------------------------------------------------------ */

  const getTimezoneByCoordinates = async (
    lat: number,
    lng: number,
  ): Promise<string> => {
    try {
      const response = await fetch(
        `https://hourora.app/api/v1/lookup?lat=${lat}&lng=${lng}`,
      );

      if (!response.ok) {
        throw new Error("Timezone lookup failed");
      }

      const data = await response.json();
      const timezone = data?.city?.zone;

      if (typeof timezone === "string" && timezone.includes("/")) {
        return timezone;
      }
    } catch (error) {
      console.error("Could not detect property timezone:", error);
    }

    return "Africa/Tripoli";
  };

  const formatCurrency = (n: number) =>
    isAr
      ? `${Math.round(n).toLocaleString()} دينار`
      : `${Math.round(n).toLocaleString()} LYD`;

  /* ------------------------------------------------------------------------
     FETCH LISTINGS
  ------------------------------------------------------------------------ */

  // silent=true refreshes the data without showing loading skeletons.
  const fetchListings = useCallback(
    async (silent = false) => {
      if (!user?.id) {
        setListings([]);
        setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
      }

      try {
        const response = await apiService.getProtectedData<Listing[]>(
          `/api/v1/listings/host/${user.id}`,
        );

        setListings(
          response.success && Array.isArray(response.data) ? response.data : [],
        );
      } catch (error) {
        console.error("Failed to fetch host listings:", error);
        setListings([]);
      } finally {
        setLoading(false);
      }
    },
    [user?.id],
  );

  /* ------------------------------------------------------------------------
     AUTHENTICATION AND ROLE GUARD
  ------------------------------------------------------------------------ */

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user || !hasValidStoredToken()) {
      navigate("/login", { replace: true });
      return;
    }

    if (toRole(user.role) !== HOST_ROLE) {
      navigate("/user-dashboard", { replace: true });
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!hasValidStoredToken()) {
        navigate("/login", { replace: true });
      }
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [authLoading, isAuthenticated, user, navigate]);

  useEffect(() => {
    if (!isAuthorizedHost) return;

    fetchListings();
  }, [isAuthorizedHost, fetchListings]);

  /* ------------------------------------------------------------------------
     LOCATION HELPERS
  ------------------------------------------------------------------------ */

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Reverse geocoding failed");
      }

      const data = await response.json();

      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const applyCoordinates = async (lat: number, lng: number) => {
    setMarkerPosition({ lat, lng });

    const [address, timezone] = await Promise.all([
      reverseGeocode(lat, lng),
      getTimezoneByCoordinates(lat, lng),
    ]);

    setSelectedLocation({ lat, lng, address });

    setFormData((prev) => ({
      ...prev,
      location: address,
      coordinates: { lat, lng },
      timezone,
    }));

    setAddressQuery(address);
  };

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    await applyCoordinates(lat, lng);

    mapInstanceRef.current?.flyTo({
      center: [lng, lat],
      zoom: 14,
    });
  }, []);

  const getIPGeolocation = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/");

      if (!response.ok) return null;

      const data = await response.json();

      if (data?.latitude !== undefined && data?.longitude !== undefined) {
        return {
          lat: Number(data.latitude),
          lng: Number(data.longitude),
          timezone:
            data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }
    } catch {
      // Ignore IP lookup errors.
    }

    return null;
  };

  const detectLocation = useCallback(async () => {
    setIsGettingLocation(true);
    setLocationError(null);

    let success = false;

    if ("geolocation" in navigator) {
      const options: PositionOptions[] = [
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 30000,
        },
      ];

      for (const opts of options) {
        if (success) break;

        try {
          const position = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, opts);
            },
          );

          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          setMapCenter({ lat, lng });

          await applyCoordinates(lat, lng);

          mapInstanceRef.current?.flyTo({
            center: [lng, lat],
            zoom: opts.enableHighAccuracy ? 15 : 13,
          });

          success = true;
        } catch {
          // Try the next geolocation option.
        }
      }
    }

    // Fallback: approximate location from IP address.
    if (!success) {
      const ip = await getIPGeolocation();

      if (ip) {
        setMapCenter({ lat: ip.lat, lng: ip.lng });

        await applyCoordinates(ip.lat, ip.lng);

        mapInstanceRef.current?.flyTo({
          center: [ip.lng, ip.lat],
          zoom: 10,
        });

        success = true;
      }
    }

    setIsGettingLocation(false);

    if (!success) {
      setLocationError(
        isAr
          ? "تعذر تحديد موقعك تلقائياً. ابحث عن عنوان أو حرك الخريطة."
          : "Could not detect your location. Search for an address instead.",
      );
    }
  }, [isAr]);

  /* ------------------------------------------------------------------------
     ADDRESS SEARCH
  ------------------------------------------------------------------------ */

  const searchAddress = useCallback((query: string) => {
    setAddressQuery(query);

    if (addressSearchTimeout.current) {
      clearTimeout(addressSearchTimeout.current);
    }

    if (!query.trim() || !MAPBOX_TOKEN) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    addressSearchTimeout.current = setTimeout(async () => {
      setSearchingAddress(true);

      try {
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
          `?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Address search failed");
        }

        const data = await response.json();

        const results = (data?.features || [])
          .map((feature: any) => ({
            id: String(feature.id),
            place_name: String(feature.place_name || ""),
            lat: Number(feature.center?.[1]),
            lng: Number(feature.center?.[0]),
          }))
          .filter(
            (item: any) =>
              Number.isFinite(item.lat) && Number.isFinite(item.lng),
          );

        setAddressSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setAddressSuggestions([]);
      } finally {
        setSearchingAddress(false);
      }
    }, 350);
  }, []);

  const handleSuggestionSelect = async (suggestion: {
    place_name: string;
    lat: number;
    lng: number;
  }) => {
    const { lat, lng, place_name } = suggestion;

    setMarkerPosition({ lat, lng });

    setSelectedLocation({
      lat,
      lng,
      address: place_name,
    });

    setMapCenter({ lat, lng });
    setAddressQuery(place_name);
    setShowSuggestions(false);

    mapInstanceRef.current?.flyTo({
      center: [lng, lat],
      zoom: 14,
    });

    const timezone = await getTimezoneByCoordinates(lat, lng);

    setFormData((prev) => ({
      ...prev,
      location: place_name,
      coordinates: { lat, lng },
      timezone,
    }));
  };

  /* ------------------------------------------------------------------------
     MAPBOX INITIALIZATION
  ------------------------------------------------------------------------ */

  useEffect(() => {
    const showMap = !!mapCenter && !isGettingLocation;

    if (
      !showMap ||
      !mapContainerRef.current ||
      mapInstanceRef.current ||
      !MAPBOX_TOKEN
    ) {
      return;
    }

    let cancelled = false;

    const initializeMap = async () => {
      try {
        const [{ default: mapboxglLib }] = await Promise.all([
          import("mapbox-gl"),
          import("mapbox-gl/dist/mapbox-gl.css"),
        ]);

        if (cancelled || !mapContainerRef.current || mapInstanceRef.current) {
          return;
        }

        mapboxglLib.accessToken = MAPBOX_TOKEN;
        mapboxglLibRef.current = mapboxglLib;

        const map = new mapboxglLib.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [mapCenter!.lng, mapCenter!.lat],
          zoom: markerPosition ? 14 : 2,
        });

        map.addControl(
          new mapboxglLib.NavigationControl({
            showCompass: false,
          }),
          "top-right",
        );

        map.on("click", (event) => {
          handleMapClick(event.lngLat.lat, event.lngLat.lng);
        });

        mapInstanceRef.current = map;
        setMapReady(true);
      } catch (error) {
        console.error("Mapbox failed to load:", error);
      }
    };

    initializeMap();

    return () => {
      cancelled = true;

      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;

      setMapReady(false);
    };
  }, [!!mapCenter && !isGettingLocation]);

  // Keep the map marker synchronized with the selected coordinates.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const lib = mapboxglLibRef.current;

    if (!map || !lib) return;

    if (!markerPosition) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const marker = new lib.Marker({
        color: "#e8c547",
        draggable: true,
      })
        .setLngLat([markerPosition.lng, markerPosition.lat])
        .addTo(map);

      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();

        setMarkerPosition({
          lat: lngLat.lat,
          lng: lngLat.lng,
        });

        applyCoordinates(lngLat.lat, lngLat.lng);
      });

      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([markerPosition.lng, markerPosition.lat]);
    }
  }, [markerPosition, mapReady]);

  // Automatically detect location when creating a new listing.
  useEffect(() => {
    if (!showForm || isEditing || mapCenter || isGettingLocation) {
      return;
    }

    detectLocation().then(() => {
      setMapCenter((current) => current ?? DEFAULT_CENTER);
    });
  }, [showForm, isEditing, mapCenter, isGettingLocation, detectLocation]);

  /* ------------------------------------------------------------------------
     FORM HELPERS
  ------------------------------------------------------------------------ */

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleArrayChange = (
    index: number,
    field: "amenities" | "rules",
    value: string,
  ) => {
    setFormData((prev) => {
      const updated = [...prev[field]];
      updated[index] = value;

      return {
        ...prev,
        [field]: updated,
      };
    });
  };

  const addArrayField = (field: "amenities" | "rules") => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], ""],
    }));
  };

  const removeArrayField = (field: "amenities" | "rules", index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const toggleQuickRule = (rule: string) => {
    setFormData((prev) => ({
      ...prev,
      rules: prev.rules.includes(rule)
        ? prev.rules.filter((item) => item !== rule)
        : [...prev.rules, rule],
    }));
  };

  const setPolicyField = (field: "type" | "description", value: string) => {
    setFormData((prev) => ({
      ...prev,
      cancellation_policy: {
        ...prev.cancellation_policy,
        [field]: value,
      },
    }));
  };

  const setPolicyRule = (index: number, value: string) => {
    setFormData((prev) => {
      const rules = [...prev.cancellation_policy.rules];
      rules[index] = value;

      return {
        ...prev,
        cancellation_policy: {
          ...prev.cancellation_policy,
          rules,
        },
      };
    });
  };

  const addPolicyRule = () => {
    setFormData((prev) => ({
      ...prev,
      cancellation_policy: {
        ...prev.cancellation_policy,
        rules: [...prev.cancellation_policy.rules, ""],
      },
    }));
  };

  const removePolicyRule = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      cancellation_policy: {
        ...prev.cancellation_policy,
        rules: prev.cancellation_policy.rules.filter((_, i) => i !== index),
      },
    }));
  };

  /* ------------------------------------------------------------------------
     IMAGE VALIDATION
  ------------------------------------------------------------------------ */

  const imageTypeError = t(
    "Unsupported image type. Use JPG, PNG, WEBP, HEIC or HEIF.",
    "نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP أو HEIC أو HEIF.",
  );

  const imageSizeError = t(
    "Image size must not exceed 10 MB.",
    "حجم الصورة يجب ألا يتجاوز 10 ميجابايت.",
  );

  const maxImagesError = t(
    "You can upload a maximum of 6 images.",
    "يمكنك رفع 6 صور كحد أقصى.",
  );

  const validateImageFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";

    const valid =
      ACCEPTED_IMAGE_TYPES.includes(file.type.toLowerCase()) ||
      ACCEPTED_IMAGE_EXTENSIONS.includes(extension);

    if (!valid) {
      throw new Error(imageTypeError);
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(imageSizeError);
    }
  };

  /* ------------------------------------------------------------------------
     IMAGE UPLOAD: ONE FILE
  ------------------------------------------------------------------------ */

  /*
   * This function uploads exactly one image.
   *
   * It is called ONLY by uploadPendingImages(), which is called
   * when the user clicks Publish listing or Save changes.
   */
  const uploadSingleImage = async (file: File): Promise<string> => {
    validateImageFile(file);

    const token = getAuthToken();

    if (!token) {
      throw new Error(
        t(
          "Your login session has expired. Please log in again.",
          "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.",
        ),
      );
    }

    const body = new FormData();

    // IMPORTANT: The backend expects the multipart field name "image".
    body.append("image", file);

    const url = getApiUrl(LISTING_IMAGE_UPLOAD_ENDPOINT);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
      credentials: "include",
    });

    const responseText = await response.text();
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      console.error("Image upload returned non-JSON response", {
        url,
        status: response.status,
        contentType,
      });

      throw new Error(
        t(
          "Image upload failed: unexpected server response.",
          "فشل رفع الصورة: استجابة الخادم غير صحيحة.",
        ),
      );
    }

    let data: any = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error("Invalid JSON response from image upload endpoint.");
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          data?.data?.message ||
          `Upload failed (${response.status})`,
      );
    }

    // Support common upload response structures.
    const imageUrl =
      data?.url ||
      data?.imageUrl ||
      data?.file?.url ||
      data?.data?.url ||
      data?.data?.imageUrl ||
      data?.data?.fileUrl ||
      data?.data?.path ||
      data?.data?.file?.url ||
      data?.data?.file?.imageUrl ||
      data?.data?.file?.path ||
      data?.fileUrl ||
      data?.path ||
      data?.file?.imageUrl ||
      data?.file?.path;

    if (!imageUrl || typeof imageUrl !== "string") {
      throw new Error(
        t(
          "Image was uploaded, but the server did not return an image URL.",
          "تم رفع الصورة ولكن الخادم لم يُرجع رابط الصورة.",
        ),
      );
    }

    return getAbsoluteImageUrl(imageUrl);
  };

  /* ------------------------------------------------------------------------
     IMAGE UPLOAD: ALL PENDING FILES
  ------------------------------------------------------------------------ */

  /*
   * Existing permanent URLs are left alone.
   *
   * Only blob URLs are uploaded.
   *
   * After each successful upload:
   * 1. Replace the blob preview URL with the permanent URL.
   * 2. Remove the File from the pending Map.
   * 3. Release the local object URL.
   *
   * If a later upload fails, earlier successful uploads remain in formData.
   */
  const uploadPendingImages = async (): Promise<string[]> => {
    const finalImages = [...formData.images];

    const pendingEntries = finalImages
      .map((url, index) => ({ url, index }))
      .filter(({ url }) => url.startsWith("blob:"));

    // Nothing new to upload. Return existing permanent URLs.
    if (!pendingEntries.length) {
      return finalImages.map(normalizeImageUrl);
    }

    setUploadingImages(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < pendingEntries.length; i++) {
        const { url: previewUrl, index } = pendingEntries[i];

        const file = pendingImageFilesRef.current.get(previewUrl);

        if (!file) {
          throw new Error(
            t(
              "An image is missing. Please remove it and select it again.",
              "إحدى الصور غير متوفرة. يرجى حذفها واختيارها مرة أخرى.",
            ),
          );
        }

        setUploadingFileName(
          t(
            `Uploading image ${i + 1} of ${pendingEntries.length}…`,
            `رفع الصورة ${i + 1} من ${pendingEntries.length}…`,
          ),
        );

        const uploadedUrl = await uploadSingleImage(file);
        const permanentUrl = normalizeImageUrl(uploadedUrl);

        // Update the final payload array.
        finalImages[index] = permanentUrl;

        // Remove the uploaded file from the pending collection.
        pendingImageFilesRef.current.delete(previewUrl);

        // Release the temporary browser preview URL.
        URL.revokeObjectURL(previewUrl);

        // Keep the successful upload in form state.
        setFormData((prev) => ({
          ...prev,
          images: prev.images.map((image) =>
            image === previewUrl ? permanentUrl : image,
          ),
        }));

        setUploadProgress(Math.round(((i + 1) / pendingEntries.length) * 100));
      }

      return finalImages.map(normalizeImageUrl);
    } finally {
      setUploadingImages(false);
      setUploadingFileName(null);
    }
  };

  /* ------------------------------------------------------------------------
     IMAGE SELECTION AND LOCAL PREVIEW
  ------------------------------------------------------------------------ */

  /*
   * IMPORTANT:
   * Selecting an image does NOT call the API.
   *
   * We compress the image, create a local blob preview, and save
   * the actual File in pendingImageFilesRef.
   */
  const handleImageFilesSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);

    // Allow selecting the same file again later.
    event.target.value = "";

    if (!files.length) return;

    const remainingSlots = MAX_IMAGES - formData.images.filter(Boolean).length;

    if (remainingSlots <= 0) {
      notify(maxImagesError, false);
      return;
    }

    if (files.length > remainingSlots) {
      notify(
        t(
          `Only ${remainingSlots} more image(s) can be added.`,
          `يمكنك إضافة ${remainingSlots} صورة فقط.`,
        ),
        false,
      );
    }

    const filesToPrepare = files.slice(0, remainingSlots);

    setUploadingImages(true);
    setUploadProgress(0);

    const failed: { name: string; reason: string }[] = [];

    try {
      for (let index = 0; index < filesToPrepare.length; index++) {
        const file = filesToPrepare[index];

        try {
          setUploadingFileName(
            t(`Preparing ${file.name}…`, `تجهيز ${file.name}…`),
          );

          validateImageFile(file);

      
          /*
           * compressImage may return a Blob instead of a File.
           * Convert it to a File so the pending Map has a consistent type.
           */
          // Compress the selected image.
          const compressedFile = await compressImage(file);

          // Create a local preview URL (no API upload yet).
          const previewUrl = URL.createObjectURL(compressedFile);

          // Keep the actual File for uploading when the user saves the listing.
          pendingImageFilesRef.current.set(previewUrl, compressedFile);

          // Add the preview URL to the form.
          setFormData((prev) => ({
            ...prev,
            images: [...prev.images, previewUrl],
          }));
        } catch (error: any) {
          failed.push({
            name: file.name,
            reason:
              error?.message ||
              t("Image preparation failed.", "فشل تجهيز الصورة."),
          });
        } finally {
          setUploadProgress(
            Math.round(((index + 1) / filesToPrepare.length) * 100),
          );
        }
      }
    } finally {
      setUploadingImages(false);
      setUploadingFileName(null);

      window.setTimeout(() => setUploadProgress(0), 300);
    }

    if (failed.length) {
      notify(
        `${t(
          `${failed.length} image(s) failed.`,
          `فشل تجهيز ${failed.length} صورة.`,
        )}\n${failed
          .map((item) => `• ${item.name}: ${item.reason}`)
          .join("\n")}`,
        false,
      );
    }
  };

  const openImagePicker = () => {
    if (uploadingImages || savingListing) return;

    if (formData.images.filter(Boolean).length >= MAX_IMAGES) {
      notify(maxImagesError, false);
      return;
    }

    imageInputRef.current?.click();
  };

  // Remove an image and clean up its local preview if necessary.
  const handleImageRemove = (index: number) => {
    if (uploadingImages || savingListing) return;

    const imageToRemove = formData.images[index];

    if (imageToRemove?.startsWith("blob:")) {
      URL.revokeObjectURL(imageToRemove);
      pendingImageFilesRef.current.delete(imageToRemove);
    }

    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  /* ------------------------------------------------------------------------
     RESET AND FORM OPEN/CLOSE
  ------------------------------------------------------------------------ */

  const resetForm = () => {
    // Always release local preview URLs before clearing the form.
    clearPendingImages();

    setFormData({
      ...EMPTY_FORM,
      amenities: [""],
      rules: [],
      images: [],
    });

    setMarkerPosition(null);
    setMapCenter(null);
    setSelectedLocation(null);

    setIsEditing(false);
    setEditingId(null);

    setLocationError(null);
    setAddressQuery("");
    setAddressSuggestions([]);
    setShowSuggestions(false);

    setUploadingImages(false);
    setUploadingFileName(null);
    setUploadProgress(0);

    if (addressSearchTimeout.current) {
      clearTimeout(addressSearchTimeout.current);
      addressSearchTimeout.current = null;
    }
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    if (savingListing || uploadingImages) return;

    setShowForm(false);
    resetForm();
  };

  /* ------------------------------------------------------------------------
     EDIT EXISTING LISTING
  ------------------------------------------------------------------------ */

  const handleEdit = (listing: Listing) => {
    // Make sure no previous form previews remain.
    clearPendingImages();

    const lat =
      listing.latitude != null ? parseFloat(String(listing.latitude)) : null;

    const lng =
      listing.longitude != null ? parseFloat(String(listing.longitude)) : null;

    const coords: Coordinates | null =
      lat !== null &&
      lng !== null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
        ? { lat, lng }
        : null;

    setIsEditing(true);
    setEditingId(listing.id);

    setFormData({
      title: listing.title || "",
      description: listing.description || "",
      price: String(listing.price ?? ""),
      location: listing.location || "",
      coordinates: coords,
      timezone: listing.timezone || "Africa/Tripoli",

      // Existing images are permanent URLs, not local blob previews.
      images: Array.isArray(listing.images)
        ? listing.images
            .filter(Boolean)
            .map((image) => normalizeImageUrl(image))
        : [],

      amenities: listing.amenities?.length ? listing.amenities : [""],

      rules: listing.rules || [],
      category: listing.category || "city",

      cancellation_policy: listing.cancellation_policy || {
        type: "flexible",
        description: "",
        rules: [],
      },
    });

    if (coords) {
      setMarkerPosition(coords);
      setMapCenter({
        lat: coords.lat,
        lng: coords.lng,
      });

      setSelectedLocation({
        ...coords,
        address: listing.location || "",
      });

      setAddressQuery(listing.location || "");
    } else {
      setMarkerPosition(null);
      setMapCenter(DEFAULT_CENTER);
      setSelectedLocation(null);
      setAddressQuery("");
    }

    setShowForm(true);
  };

  /* ------------------------------------------------------------------------
     LISTING ACTIONS
  ------------------------------------------------------------------------ */

  const handleToggleActive = async (listing: Listing) => {
    setTogglingId(listing.id);

    try {
      const response = await apiService.patchProtectedData<{
        is_active: boolean;
      }>(`/api/v1/listings/${listing.id}/toggle-active`);

      if (response.success && response.data) {
        setListings((prev) =>
          prev.map((item) =>
            item.id === listing.id
              ? {
                  ...item,
                  is_active: response.data!.is_active,
                }
              : item,
          ),
        );
      }
    } catch (error: any) {
      notify(extractApiErrorMessage(error), false);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(t("Delete this listing?", "هل أنت متأكد من حذف هذا الإعلان؟"))
    ) {
      return;
    }

    setDeletingId(id);

    try {
      const response = await apiService.deleteProtectedData<{
        success: boolean;
      }>(`/api/v1/listings/${id}?deleteListing=true`);

      if (response.success) {
        await fetchListings(true);
        notify(t("Listing deleted", "تم حذف الإعلان"));
      }
    } catch (error: any) {
      notify(extractApiErrorMessage(error), false);
    } finally {
      setDeletingId(null);
    }
  };

  /* ------------------------------------------------------------------------
     FORM VALIDATION
  ------------------------------------------------------------------------ */

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      notify(t("Please enter a title", "الرجاء إدخال عنوان الإعلان"), false);
      return false;
    }

    if (!formData.description.trim()) {
      notify(
        t("Please enter a description", "الرجاء إدخال وصف الإعلان"),
        false,
      );
      return false;
    }

    if (
      !formData.price ||
      !Number.isFinite(Number(formData.price)) ||
      Number(formData.price) < 0
    ) {
      notify(t("Please enter a valid price", "الرجاء إدخال سعر صحيح"), false);
      return false;
    }

    if (!formData.location || !formData.coordinates) {
      notify(
        t(
          "Please select a location on the map",
          "الرجاء تحديد الموقع على الخريطة",
        ),
        false,
      );
      return false;
    }

    const images = formData.images.filter(Boolean);

    if (images.length === 0) {
      notify(
        t("Please add at least one photo", "الرجاء رفع صورة واحدة على الأقل"),
        false,
      );
      return false;
    }

    if (images.length > MAX_IMAGES) {
      notify(maxImagesError, false);
      return false;
    }

    return true;
  };

  /* ------------------------------------------------------------------------
     SAVE OR PUBLISH LISTING
  ------------------------------------------------------------------------ */

  /*
   * One save handler handles both:
   * - Creating a new listing.
   * - Updating an existing listing.
   *
   * Upload sequence:
   * 1. Validate the form.
   * 2. Upload only new local blob images.
   * 3. Replace blob URLs with permanent URLs.
   * 4. Send the listing payload to the listing API.
   */
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (savingListing || uploadingImages) return;

    if (!validateForm()) return;

    if (isEditing && !editingId) return;

    setSavingListing(true);

    try {
      // Upload images only after Publish / Save changes is clicked.
      const publishedImageUrls = await uploadPendingImages();

      // Safety check: never send local blob URLs to the database.
      if (publishedImageUrls.some((url) => url.startsWith("blob:"))) {
        throw new Error(
          "A temporary image URL was detected. Please try again.",
        );
      }

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        location: formData.location.trim(),
        timezone: formData.timezone || "Africa/Tripoli",

        coordinates: formData.coordinates
          ? {
              lat: Number(formData.coordinates.lat),
              lng: Number(formData.coordinates.lng),
            }
          : null,

        // Only permanent image URLs are sent to the listing API.
        images: publishedImageUrls,

        amenities: formData.amenities
          .map((item) => item.trim())
          .filter(Boolean),

        rules: formData.rules.map((item) => item.trim()).filter(Boolean),

        category: formData.category || "city",

        cancellation_policy: {
          type: formData.cancellation_policy.type || "flexible",

          description: formData.cancellation_policy.description?.trim() || "",

          rules: formData.cancellation_policy.rules
            .map((item) => item.trim())
            .filter(Boolean),
        },
      };

      const response: any = isEditing
        ? await apiService.putProtectedData(
            `/api/v1/listings/${editingId}`,
            payload,
          )
        : await apiService.postProtectedData("/api/v1/listings", payload);

      if (!response?.success) {
        throw new Error(
          response?.message || t("Failed to save listing", "فشل حفظ الإعلان"),
        );
      }

      const wasEditing = isEditing;

      setShowForm(false);
      resetForm();

      await fetchListings(true);

      notify(
        wasEditing
          ? t("Listing updated", "تم تحديث الإعلان بنجاح")
          : t("Listing created", "تم إنشاء الإعلان بنجاح"),
      );
    } catch (error: any) {
      notify(extractApiErrorMessage(error), false);
    } finally {
      setSavingListing(false);
      setUploadingImages(false);
      setUploadingFileName(null);
      setUploadProgress(0);
    }
  };

  /* ------------------------------------------------------------------------
     RENDER HELPERS
  ------------------------------------------------------------------------ */

  // Wait for authentication, not for listings.
  if (authLoading || !isAuthorizedHost) {
    return null;
  }

  const imageCount = formData.images.filter(Boolean).length;

  const QUICK_RULES = [
    t("No Smoking", "ممنوع التدخين"),
    t("No Parties", "ممنوع الحفلات"),
    t("No Pets", "ممنوع الحيوانات"),
    t("Quiet Hours", "ساعات الهدوء"),
    t("Self Check-in", "تسجيل وصول ذاتي"),
    t("No Shoes", "ممنوع الأحذية"),
  ];

  const POLICIES = [
    { value: "flexible", label: t("Flexible", "مرنة") },
    { value: "moderate", label: t("Moderate", "متوسطة") },
    { value: "strict", label: t("Strict", "صارمة") },
  ];

  /* ==========================================================================
     JSX
  ========================================================================== */

  return (
    <div
      className={`min-h-screen bg-gray-50 text-gray-900 ${
        isAr ? "font-arabic" : "font-sans"
      }`}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Desktop navbar */}
      <div className="hidden md:block">
        <Navbar
          NAV_LINKS={NAV_LINKS}
          lang={lang}
          toggleLanguage={toggleLanguage}
        />
      </div>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#1a1a2e] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] md:hidden">
        <div>
          <h1 className="text-lg font-semibold text-white">
            {t("Listings", "الإعلانات")}
          </h1>

          <p className="text-xs text-white/50">
            {loading ? "…" : `${listings.length} ${t("listings", "إعلان")}`}
          </p>
        </div>

        <button
          onClick={toggleLanguage}
          className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white active:bg-white/10"
        >
          {isAr ? "EN" : "عربي"}
        </button>
      </header>

      {/* Toast notification */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+64px)] z-[60] flex justify-center px-4">
          <div
            className={`max-w-sm whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm font-medium shadow-lg ${
              toast.ok ? "bg-[#1a1a2e] text-white" : "bg-red-600 text-white"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}

      {/* =====================================================================
          LISTINGS PAGE
      ===================================================================== */}

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 md:px-6 md:pb-12 md:pt-8">
        <div className="mb-6 hidden items-center justify-between md:flex">
          <div>
            <h1 className="text-2xl font-bold">
              {t("My listings", "إعلاناتي")}
            </h1>

            <p className="text-sm text-gray-500">
              {loading ? "…" : `${listings.length} ${t("listings", "إعلان")}`}
            </p>
          </div>

          <button
            onClick={openNewForm}
            className="rounded-xl bg-[#1a1a2e] px-5 py-3 text-sm font-semibold text-[#e8c547] transition hover:opacity-90"
          >
            + {t("New listing", "إعلان جديد")}
          </button>
        </div>

        {/* Listing cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading &&
            [1, 2, 3].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-2xl bg-white shadow-sm"
              >
                <Skeleton className="h-44 w-full rounded-none" />

                <div className="space-y-3 p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              </div>
            ))}

          {!loading && listings.length === 0 && (
            <div className="col-span-full rounded-2xl bg-white p-10 text-center shadow-sm">
              <div className="mb-2 text-4xl">🏠</div>

              <p className="font-semibold">
                {t("No listings yet", "لا توجد إعلانات بعد")}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {t(
                  "Add your first place to start getting bookings.",
                  "أضف مكانك الأول لتبدأ باستقبال الحجوزات.",
                )}
              </p>

              <button
                onClick={openNewForm}
                className="mt-4 rounded-xl bg-[#1a1a2e] px-5 py-2.5 text-sm font-semibold text-[#e8c547]"
              >
                {t("Create listing", "إنشاء إعلان")}
              </button>
            </div>
          )}

          {!loading &&
            listings.map((listing) => {
              const category = CATEGORIES.find(
                (item) => item.id === listing.category,
              );

              const isToggling = togglingId === listing.id;

              const firstImage =
                listing.images?.find(Boolean) || "/placeholder.jpg";

              return (
                <article
                  key={listing.id}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm"
                >
                  <div className="relative h-44 bg-gray-100">
                    <img
                      src={getAbsoluteImageUrl(firstImage)}
                      alt={listing.title}
                      className={`h-full w-full object-cover ${
                        !listing.is_active ? "opacity-60 grayscale" : ""
                      }`}
                      onError={(event) => {
                        event.currentTarget.src = "/placeholder.jpg";
                      }}
                    />

                    <span
                      className={`absolute start-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${
                        listing.is_active ? "bg-emerald-600" : "bg-gray-500"
                      }`}
                    >
                      {listing.is_active
                        ? t("Active", "نشط")
                        : t("Paused", "متوقف")}
                    </span>

                    {listing.images?.length > 1 && (
                      <span className="absolute bottom-3 end-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
                        📷 {listing.images.length}
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="truncate text-base font-semibold">
                        {listing.title}
                      </h2>

                      <p className="shrink-0 text-sm font-bold">
                        {formatCurrency(Number(listing.price))}

                        <span className="text-xs font-normal text-gray-400">
                          /{t("night", "ليلة")}
                        </span>
                      </p>
                    </div>

                    <p className="mt-1 truncate text-sm text-gray-500">
                      {category
                        ? `${category.icon} ${
                            isAr ? category.labelAr : category.labelEn
                          } · `
                        : ""}
                      {listing.location}
                    </p>

                    {/* Booking switch */}
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-3">
                      <span className="text-sm text-gray-700">
                        {listing.is_active
                          ? t("Open for booking", "مفتوح للحجز")
                          : t("Booking paused", "الحجز متوقف")}
                      </span>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={listing.is_active}
                        onClick={() => handleToggleActive(listing)}
                        disabled={isToggling}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                          listing.is_active ? "bg-emerald-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                            listing.is_active ? "start-[22px]" : "start-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Listing actions */}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleEdit(listing)}
                        className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#1a1a2e] text-sm font-semibold text-[#e8c547] active:scale-[0.97]"
                      >
                        {t("Edit", "تعديل")}
                      </button>

                      <Link
                        to={`/listings/${listing.id}`}
                        className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 active:scale-[0.97]"
                      >
                        {t("View", "عرض")}
                      </Link>

                      <button
                        onClick={() => handleDelete(listing.id)}
                        disabled={deletingId === listing.id}
                        aria-label={t("Delete", "حذف")}
                        className="flex min-h-[44px] w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 active:scale-[0.97] disabled:opacity-50"
                      >
                        {deletingId === listing.id ? (
                          <Spinner className="border-red-600" />
                        ) : (
                          "🗑️"
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </main>

      {/* Mobile floating add button */}
      <button
        onClick={openNewForm}
        aria-label={t("New listing", "إعلان جديد")}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8c547] text-3xl font-light text-[#1a1a2e] shadow-lg active:scale-95 md:hidden"
      >
        +
      </button>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="mx-auto flex max-w-md">
          {NAV_LINKS.map((item) => {
            const active = location.pathname === item.href;

            return (
              <li key={item.id} className="flex-1">
                <Link
                  to={item.href}
                  className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                    active ? "text-[#1a1a2e]" : "text-gray-400"
                  }`}
                >
                  <span
                    className={`text-xl ${
                      active ? "" : "opacity-60 grayscale"
                    }`}
                  >
                    {item.icon}
                  </span>

                  {isAr ? item.labelAr : item.label}

                  <span
                    className={`h-1 w-1 rounded-full ${
                      active ? "bg-[#e8c547]" : "bg-transparent"
                    }`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* =====================================================================
          CREATE / EDIT LISTING FORM
      ===================================================================== */}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-gray-50"
          dir={isAr ? "rtl" : "ltr"}
        >
          {/* Form header */}
          <div className="flex shrink-0 items-center gap-3 bg-[#1a1a2e] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
            <button
              type="button"
              onClick={closeForm}
              disabled={savingListing || uploadingImages}
              aria-label={t("Close", "إغلاق")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-white active:bg-white/10 disabled:opacity-50"
            >
              ✕
            </button>

            <h2 className="text-lg font-semibold text-white">
              {isEditing
                ? t("Edit listing", "تعديل الإعلان")
                : t("New listing", "إعلان جديد")}
            </h2>
          </div>

          {/* Scrollable form content */}
          <div className="flex-1 overflow-y-auto">
            <form
              id="listing-form"
              onSubmit={handleSave}
              className="mx-auto max-w-2xl space-y-4 px-4 pb-8 pt-4"
            >
              {/* -------------------------------------------------------------
                  BASIC INFORMATION
              ------------------------------------------------------------- */}

              <Section title={t("The basics", "الأساسيات")}>
                <div>
                  <Label>{t("Title", "العنوان")}</Label>

                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={inputCls}
                    placeholder={t(
                      "Cozy apartment near the beach",
                      "أدخل عنوان الإعلان",
                    )}
                  />
                </div>

                <div>
                  <Label>{t("Description", "الوصف")}</Label>

                  <textarea
                    name="description"
                    rows={4}
                    value={formData.description}
                    onChange={handleInputChange}
                    className={`${inputCls} resize-y`}
                    placeholder={t(
                      "Tell guests what makes your place special",
                      "صف إعلانك",
                    )}
                  />
                </div>

                <div>
                  <Label>
                    {t("Price per night", "السعر لكل ليلة")} (
                    {isAr ? "دينار" : "LYD"})
                  </Label>

                  <input
                    type="number"
                    inputMode="decimal"
                    name="price"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={handleInputChange}
                    className={inputCls}
                    placeholder="99"
                  />
                </div>

                <div>
                  <Label>{t("Category", "الفئة")}</Label>

                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORIES.map((category) => {
                      const selected = formData.category === category.id;

                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              category: category.id,
                            }))
                          }
                          className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11px] font-medium transition active:scale-95 ${
                            selected
                              ? "border-[#e8c547] bg-[#fdf8e7] text-[#7a6012]"
                              : "border-gray-200 bg-white text-gray-600"
                          }`}
                        >
                          <span className="text-xl">{category.icon}</span>

                          {isAr ? category.labelAr : category.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Section>

              {/* -------------------------------------------------------------
                  PHOTOS
              ------------------------------------------------------------- */}

              <Section
                title={`${t("Photos", "الصور")} (${imageCount}/${MAX_IMAGES})`}
                hint={t(
                  "The first photo is your cover. Up to 10 MB each.",
                  "الصورة الأولى هي الغلاف. حتى 10 ميجابايت لكل صورة.",
                )}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                  multiple
                  onChange={handleImageFilesSelected}
                  className="hidden"
                />

                {/* Local previews and existing permanent images */}
                <div className="grid grid-cols-3 gap-2">
                  {formData.images.map((image, index) => (
                    <div
                      key={`${image}-${index}`}
                      className="relative aspect-square overflow-hidden rounded-xl bg-gray-100"
                    >
                      <img
                        src={getAbsoluteImageUrl(image)}
                        alt={`${index + 1}`}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />

                      {index === 0 && (
                        <span className="absolute bottom-1 start-1 rounded-full bg-[#1a1a2e]/90 px-2 py-0.5 text-[10px] text-[#e8c547]">
                          {t("Cover", "الغلاف")}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleImageRemove(index)}
                        disabled={uploadingImages || savingListing}
                        aria-label={t("Remove", "إزالة")}
                        className="absolute end-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-base text-white disabled:opacity-50"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {imageCount < MAX_IMAGES && (
                    <button
                      type="button"
                      onClick={openImagePicker}
                      disabled={uploadingImages || savingListing}
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 text-xs text-gray-500 active:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="text-2xl leading-none">+</span>
                      {t("Add", "إضافة")}
                    </button>
                  )}
                </div>

                {/* Preparation and upload progress */}
                {uploadingImages && (
                  <div className="rounded-xl bg-[#fdf8e7] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Spinner />

                      <span className="truncate text-xs font-medium text-[#7a6012]">
                        {uploadingFileName ||
                          t("Processing images…", "جاري تجهيز الصور…")}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-black/5">
                      <div
                        className="h-full bg-[#e8c547] transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </Section>

              {/* -------------------------------------------------------------
                  LOCATION
              ------------------------------------------------------------- */}

              <Section
                title={t("Location", "الموقع")}
                hint={t(
                  "Search, use your location, or tap the map.",
                  "ابحث، أو استخدم موقعك، أو اضغط على الخريطة.",
                )}
              >
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={addressQuery}
                      onChange={(event) => searchAddress(event.target.value)}
                      onFocus={() =>
                        addressSuggestions.length && setShowSuggestions(true)
                      }
                      onBlur={() =>
                        setTimeout(() => setShowSuggestions(false), 150)
                      }
                      placeholder={t("Search for an address", "ابحث عن عنوان")}
                      className={inputCls}
                      disabled={!MAPBOX_TOKEN}
                    />

                    {searchingAddress && (
                      <div className="absolute end-3 top-1/2 -translate-y-1/2">
                        <Spinner />
                      </div>
                    )}

                    {showSuggestions && addressSuggestions.length > 0 && (
                      <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                        {addressSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSuggestionSelect(suggestion)}
                            className="block w-full border-b border-gray-100 px-3.5 py-3 text-start text-sm last:border-b-0 active:bg-gray-50"
                          >
                            📍 {suggestion.place_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={isGettingLocation}
                    aria-label={t("My location", "موقعي")}
                    className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-xl text-white active:scale-95 disabled:opacity-50"
                  >
                    {isGettingLocation ? (
                      <Spinner className="border-white" />
                    ) : (
                      "📍"
                    )}
                  </button>
                </div>

                {!MAPBOX_TOKEN && (
                  <p className="text-xs text-red-600">
                    {t(
                      "Add VITE_MAPBOX_TOKEN to enable the map and address search.",
                      "أضف VITE_MAPBOX_TOKEN لتفعيل الخريطة والبحث.",
                    )}
                  </p>
                )}

                <div className="overflow-hidden rounded-xl border border-gray-200">
                  {(!mapCenter || isGettingLocation) && (
                    <div className="flex h-[300px] flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center md:h-[400px]">
                      {isGettingLocation ? (
                        <>
                          <Spinner className="!h-8 !w-8 border-[#e8c547]" />

                          <p className="text-sm text-gray-500">
                            {t(
                              "Finding your location…",
                              "جاري الحصول على الموقع...",
                            )}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">
                          {locationError ||
                            t(
                              "Tap 📍 or search for an address",
                              "اضغط 📍 أو ابحث عن عنوان",
                            )}
                        </p>
                      )}
                    </div>
                  )}

                  {mapCenter && !isGettingLocation && (
                    <div className="h-[300px] w-full md:h-[400px]">
                      {MAPBOX_TOKEN ? (
                        <div ref={mapContainerRef} className="h-full w-full" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gray-50 px-6 text-center text-sm text-red-600">
                          {t(
                            "Map unavailable: missing Mapbox token",
                            "الخريطة غير متاحة: رمز Mapbox مفقود",
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-[#fdf8e7] px-3.5 py-3">
                  <p className="text-sm font-medium text-[#7a6012]">
                    📍{" "}
                    {selectedLocation?.address ||
                      t("No location selected yet", "لم يتم اختيار موقع بعد")}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white px-3.5 py-3">
                  <Label>
                    {t("Property time zone", "المنطقة الزمنية للعقار")}
                  </Label>

                  <input
                    type="text"
                    value={formData.timezone}
                    readOnly
                    className={`${inputCls} bg-gray-50`}
                  />

                  <p className="mt-1 text-xs text-gray-500">
                    {t(
                      "Detected automatically from the selected property location.",
                      "يتم تحديدها تلقائياً حسب موقع العقار المحدد.",
                    )}
                  </p>
                </div>
              </Section>

              {/* -------------------------------------------------------------
                  AMENITIES
              ------------------------------------------------------------- */}

              <Section title={t("Amenities", "المرافق")}>
                {formData.amenities.map((amenity, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={amenity}
                      onChange={(event) =>
                        handleArrayChange(
                          index,
                          "amenities",
                          event.target.value,
                        )
                      }
                      placeholder={t("e.g. Wi-Fi", "مثل: Wi-Fi")}
                      className={inputCls}
                    />

                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField("amenities", index)}
                        aria-label={t("Remove", "إزالة")}
                        className="flex h-[50px] w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addArrayField("amenities")}
                  className="w-full rounded-xl border border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-600 active:bg-gray-50"
                >
                  + {t("Add amenity", "إضافة مرفق")}
                </button>
              </Section>

              {/* -------------------------------------------------------------
                  HOUSE RULES
              ------------------------------------------------------------- */}

              <Section title={t("House rules", "قواعد المنزل")}>
                <div className="flex flex-wrap gap-2">
                  {QUICK_RULES.map((rule) => {
                    const selected = formData.rules.includes(rule);

                    return (
                      <button
                        key={rule}
                        type="button"
                        onClick={() => toggleQuickRule(rule)}
                        className={`rounded-full px-3.5 py-2 text-sm transition active:scale-95 ${
                          selected
                            ? "bg-[#e8c547] font-semibold text-[#1a1a2e]"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {selected ? "✓ " : "+ "}
                        {rule}
                      </button>
                    );
                  })}
                </div>

                {formData.rules
                  .map((rule, index) => ({ rule, index }))
                  .filter(({ rule }) => !QUICK_RULES.includes(rule))
                  .map(({ rule, index }) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={rule}
                        onChange={(event) =>
                          handleArrayChange(index, "rules", event.target.value)
                        }
                        placeholder={t(
                          "e.g. No food in rooms",
                          "مثل: لا طعام في الغرف",
                        )}
                        className={inputCls}
                      />

                      <button
                        type="button"
                        onClick={() => removeArrayField("rules", index)}
                        aria-label={t("Remove", "إزالة")}
                        className="flex h-[50px] w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                <button
                  type="button"
                  onClick={() => addArrayField("rules")}
                  className="w-full rounded-xl border border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-600 active:bg-gray-50"
                >
                  + {t("Add your own rule", "إضافة قاعدة مخصصة")}
                </button>
              </Section>

              {/* -------------------------------------------------------------
                  CANCELLATION POLICY
              ------------------------------------------------------------- */}

              <Section
                title={t("Cancellation policy", "سياسة الإلغاء")}
                hint={t(
                  "Guests see this before they book.",
                  "سيراها الضيوف قبل الحجز.",
                )}
              >
                <div className="grid grid-cols-3 gap-2">
                  {POLICIES.map((policy) => {
                    const selected =
                      formData.cancellation_policy.type === policy.value;

                    return (
                      <button
                        key={policy.value}
                        type="button"
                        onClick={() => setPolicyField("type", policy.value)}
                        className={`rounded-xl border py-3 text-sm font-semibold transition active:scale-95 ${
                          selected
                            ? "border-[#e8c547] bg-[#fdf8e7] text-[#7a6012]"
                            : "border-gray-200 bg-white text-gray-600"
                        }`}
                      >
                        {policy.label}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  rows={4}
                  value={formData.cancellation_policy.description}
                  onChange={(event) =>
                    setPolicyField("description", event.target.value)
                  }
                  className={`${inputCls} resize-y`}
                  placeholder={t(
                    "Explain your cancellation policy.",
                    "اكتب سياسة الإلغاء الخاصة بك بالتفصيل.",
                  )}
                />

                {formData.cancellation_policy.rules.map((rule, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={rule}
                      onChange={(event) =>
                        setPolicyRule(index, event.target.value)
                      }
                      placeholder={t("Extra rule", "شرط إضافي")}
                      className={inputCls}
                    />

                    <button
                      type="button"
                      onClick={() => removePolicyRule(index)}
                      aria-label={t("Remove", "إزالة")}
                      className="flex h-[50px] w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPolicyRule}
                  className="w-full rounded-xl border border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-600 active:bg-gray-50"
                >
                  + {t("Add extra rule", "إضافة شرط")}
                </button>
              </Section>
            </form>
          </div>

          {/* ---------------------------------------------------------------
              STICKY SAVE BUTTONS
          --------------------------------------------------------------- */}

          <div className="shrink-0 border-t border-gray-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
            <div className="mx-auto flex max-w-2xl gap-3">
              <button
                type="button"
                onClick={closeForm}
                disabled={savingListing || uploadingImages}
                className="min-h-[48px] rounded-xl bg-gray-100 px-5 text-sm font-semibold text-gray-700 active:scale-[0.97] disabled:opacity-50"
              >
                {t("Cancel", "إلغاء")}
              </button>

              <button
                type="submit"
                form="listing-form"
                disabled={savingListing || uploadingImages}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#1a1a2e] text-sm font-semibold text-[#e8c547] active:scale-[0.97] disabled:opacity-50"
              >
                {savingListing ? (
                  <>
                    <Spinner />
                    {t("Saving…", "جاري الحفظ...")}
                  </>
                ) : isEditing ? (
                  t("Save changes", "حفظ التغييرات")
                ) : (
                  t("Publish listing", "نشر الإعلان")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostListings;
