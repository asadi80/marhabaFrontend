import React, { useEffect, useState, useRef, useCallback } from "react";

import { useNavigate, Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../hooks/useLanguage";
import LoadingScreen from "../../components/LoadingScreen";
import Navbar from "../../components/Navbar";
import { apiService } from "../../services/api";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";


// ============================================================
// TOKEN GUARD (extra client-side check)
// ============================================================
// NOTE: this is a UX nicety, not real security — anyone can edit their own
// localStorage. It only lets us redirect to /login early (before firing off
// API calls) when the stored token is missing/expired. The actual security
// boundary is the server rejecting unauthorized/expired tokens on every
// request; this never replaces that.

const HOST_ROLE = "host";

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

// Decodes a JWT's payload (no signature verification — that's the server's job)
// just to read the `exp` claim.
const isJwtExpired = (token: string): boolean => {
  try {
    const payloadB64 = token.split(".")[1];
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload?.exp) return false; // no exp claim — nothing to check locally
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true; // malformed/unreadable token — treat as invalid
  }
};

const hasValidStoredToken = (): boolean => {
  const token = readStoredAccessToken();
  return !!token && !isJwtExpired(token);
};

const toRole = (role?: string) => String(role || "").toLowerCase();

// ============================================================
// TYPES
// ============================================================

interface Coordinates {
  lat: number;
  lng: number;
}

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number | string;
  location: string;
  latitude: number | string | null;
  longitude: number | string | null;
  images: string[];
  category: string;
  amenities: string[];
  rules: string[];
  cancellation_policy: {
    type: string;
    description: string;
    rules: string[];
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  title: string;
  description: string;
  price: string;
  location: string;
  coordinates: Coordinates | null;
  images: string[];
  amenities: string[];
  rules: string[];
  category: string;
  cancellation_policy: {
    type: string;
    description: string;
    rules: string[];
  };
}

interface Category {
  id: string;
  icon: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const CATEGORIES: Category[] = [
  {
    id: "beachfront",
    icon: "🏖️",
    labelEn: "Beachfront",
    labelAr: "شاطئ",
    descriptionEn: "Beautiful beachfront properties",
    descriptionAr: "عقارات جميلة على الشاطئ",
  },
  {
    id: "mountain",
    icon: "🏔️",
    labelEn: "Mountain",
    labelAr: "جبال",
    descriptionEn: "Scenic mountain retreats",
    descriptionAr: "منتجعات جبلية خلابة",
  },
  {
    id: "city",
    icon: "🏙️",
    labelEn: "City",
    labelAr: "مدينة",
    descriptionEn: "Vibrant city apartments",
    descriptionAr: "شقق مدينة نابضة بالحياة",
  },
  {
    id: "countryside",
    icon: "🏡",
    labelEn: "Countryside",
    labelAr: "ريفي",
    descriptionEn: "Peaceful countryside homes",
    descriptionAr: "منازل ريفية هادئة",
  },
  {
    id: "pool",
    icon: "🏊",
    labelEn: "Pool",
    labelAr: "مسبح",
    descriptionEn: "Properties with pools",
    descriptionAr: "عقارات بها مسبح",
  },
  {
    id: "desert",
    icon: "🏜️",
    labelEn: "Desert",
    labelAr: "صحراء",
    descriptionEn: "Stunning desert escapes",
    descriptionAr: "ملاذات صحراوية خلابة",
  },
  {
    id: "camping",
    icon: "🏕️",
    labelEn: "Camping",
    labelAr: "تخييم",
    descriptionEn: "Outdoor camping experiences",
    descriptionAr: "تجارب تخييم في الهواء الطلق",
  },
  {
    id: "cabins",
    icon: "🛖",
    labelEn: "Cabins",
    labelAr: "كوخ",
    descriptionEn: "Cozy cabin getaways",
    descriptionAr: "ملاذات كوخ مريحة",
  },
];

const EMPTY_FORM: FormData = {
  title: "",
  description: "",
  price: "",
  location: "",
  coordinates: null,
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

const DEFAULT_CENTER: Coordinates = {
  lat: 20,
  lng: 0,
};

// ============================================================
// IMAGE UPLOAD SETTINGS
// ============================================================

const MAX_IMAGES = 10;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

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



// Change this if your backend uses another listing upload route.
const LISTING_IMAGE_UPLOAD_ENDPOINT =
  import.meta.env.VITE_LISTING_IMAGE_UPLOAD_ENDPOINT || "/uploads/listings";

// ============================================================
// MAPBOX
// ============================================================

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

// ============================================================
// COMPONENT
// ============================================================

const HostListings: React.FC = () => {
  const navigate = useNavigate();

  const { lang, toggleLanguage } = useLanguage();

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const isAr = lang === "ar";

  // ============================================================
  // LISTING STATE
  // ============================================================

  const [listings, setListings] = useState<Listing[]>([]);

  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  // ============================================================
  // LOCATION STATE
  // ============================================================

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

  // ============================================================
  // FORM STATE
  // ============================================================

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  // ============================================================
  // LISTING ACTION STATE
  // ============================================================

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [savingListing, setSavingListing] = useState(false);

  // ============================================================
  // IMAGE UPLOAD STATE
  // ============================================================

  const [uploadingImages, setUploadingImages] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);

  const [uploadingFileName, setUploadingFileName] = useState<string | null>(
    null,
  );

  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // ============================================================
  // ADDRESS SEARCH STATE
  // ============================================================

  const [addressQuery, setAddressQuery] = useState("");

  const [addressSuggestions, setAddressSuggestions] = useState<
    {
      id: string;
      place_name: string;
      lat: number;
      lng: number;
    }[]
  >([]);

  const [showSuggestions, setShowSuggestions] = useState(false);

  const [searchingAddress, setSearchingAddress] = useState(false);

  const addressSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // ============================================================
  // MAP REFS
  // ============================================================

  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);

  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const [mapReady, setMapReady] = useState(false);

  // ============================================================
  // TRANSLATIONS
  // ============================================================

  const t = {
    overview: isAr ? "نظرة عامة" : "Overview",

    myListings: isAr ? "إعلاناتي" : "My Listings",

    bookings: isAr ? "الحجوزات" : "Bookings",

    hostPanel: isAr ? "لوحة المضيف" : "Host Panel",

    myListingsTitle1: isAr ? "إعلاناتي" : "My",

    listings1: isAr ? "الإعلانات" : "Listings",

    listingsActive: isAr ? "إعلان نشط" : "Active Listings",

    listingActive: isAr ? "إعلان نشط" : "Active Listing",

    addNewListing: isAr ? "إضافة إعلان جديد" : "Add New Listing",

    editListing: isAr ? "تعديل الإعلان" : "Edit Listing",

    newListing: isAr ? "إعلان جديد" : "New Listing",

    edit: isAr ? "تعديل" : "Edit",

    createA: isAr ? "إنشاء" : "Create a",

    listing: isAr ? "إعلان" : "Listing",

    title: isAr ? "العنوان" : "Title",

    titlePlaceholder: isAr ? "أدخل عنوان الإعلان" : "Enter listing title",

    description: isAr ? "الوصف" : "Description",

    descriptionPlaceholder: isAr ? "صف إعلانك" : "Describe your listing",

    pricePerNight: isAr ? "السعر لكل ليلة" : "Price per night",

    night: isAr ? "ليلة" : "night",

    location: isAr ? "الموقع" : "Location",

    addressWillAppear: isAr ? "العنوان سيظهر هنا" : "Address will appear here",

    myLocation: isAr ? "موقعي" : "My Location",

    gettingLocation: isAr ? "جاري الحصول على الموقع..." : "Getting location...",

    imagesRequired: isAr ? "الصور (مطلوب)" : "Images (Required)",

    addImage: isAr ? "إضافة صورة" : "Add Image",

    uploadImages: isAr ? "رفع الصور" : "Upload Images",

    imageUploading: isAr ? "جاري رفع الصورة..." : "Uploading image...",

    imagesUploaded: isAr ? "تم رفع الصور" : "Images uploaded",

    imageSizeError: isAr
      ? "حجم الصورة يجب ألا يتجاوز 10 ميجابايت"
      : "Image size must not exceed 10 MB",

    imageTypeError: isAr
      ? "نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP"
      : "Unsupported image type. Use JPG, PNG or WEBP",

    maxImagesError: isAr
      ? "يمكنك رفع 6 صور كحد أقصى"
      : "You can upload a maximum of 6 images",

    imageUploadFailed: isAr ? "فشل رفع الصورة" : "Image upload failed",

    amenities: isAr ? "المرافق" : "Amenities",

    amenityPlaceholder: isAr ? "مرفق (مثل: Wi-Fi)" : "Amenity (e.g., Wi-Fi)",

    remove: isAr ? "إزالة" : "Remove",

    addAmenity: isAr ? "إضافة مرفق" : "Add Amenity",

    houseRules: isAr ? "قواعد المنزل" : "House Rules",

    quickAdd: isAr ? "إضافة سريعة" : "Quick Add",

    ruleNoSmoking: isAr ? "ممنوع التدخين" : "No Smoking",

    ruleNoParties: isAr ? "ممنوع الحفلات" : "No Parties",

    ruleNoPets: isAr ? "ممنوع الحيوانات" : "No Pets",

    ruleQuietHours: isAr ? "ساعات الهدوء" : "Quiet Hours",

    ruleSelfCheckIn: isAr ? "تسجيل وصول ذاتي" : "Self Check-in",

    ruleNoShoes: isAr ? "ممنوع الأحذية" : "No Shoes",

    rulePlaceholder: isAr
      ? "قاعدة (مثل: لا طعام في الغرف)"
      : "Rule (e.g., No food in rooms)",

    addCustomRule: isAr ? "+ إضافة قاعدة مخصصة" : "+ Add Custom Rule",

    cancel: isAr ? "إلغاء" : "Cancel",

    createListing: isAr ? "إنشاء الإعلان" : "Create Listing",

    updateListing: isAr ? "تحديث الإعلان" : "Update Listing",

    noListingsYet: isAr ? "لا توجد إعلانات بعد" : "No listings yet",

    createFirstListing: isAr ? "إنشاء أول إعلان" : "Create your first listing",

    viewDetails: isAr ? "عرض التفاصيل" : "View Details",

    delete: isAr ? "حذف" : "Delete",

    pleaseSelectLocation: isAr
      ? "الرجاء تحديد الموقع على الخريطة"
      : "Please select a location on the map",

    pleaseUploadImage: isAr
      ? "الرجاء رفع صورة واحدة على الأقل"
      : "Please upload at least one image",

    listingCreatedSuccess: isAr
      ? "تم إنشاء الإعلان بنجاح"
      : "Listing created successfully",

    listingUpdatedSuccess: isAr
      ? "تم تحديث الإعلان بنجاح"
      : "Listing updated successfully",

    listingDeletedSuccess: isAr
      ? "تم حذف الإعلان بنجاح"
      : "Listing deleted successfully",

    confirmDeleteListing: isAr
      ? "هل أنت متأكد من حذف هذا الإعلان؟"
      : "Are you sure you want to delete this listing?",

    save: isAr ? "حفظ" : "Save",

    saving: isAr ? "جاري الحفظ..." : "Saving...",
  };

  // ============================================================
  // HELPERS
  // ============================================================

  const formatCurrency = (n: number) =>
    isAr
      ? `${Math.round(n).toLocaleString()} دينار`
      : `${Math.round(n).toLocaleString()} LYD`;

  // ============================================================
  // GET API BASE URL
  // ============================================================

  const getApiUrl = useCallback((endpoint: string) => {
    const baseUrl = import.meta.env.VITE_API_URL || "";

    if (!baseUrl) {
      return endpoint;
    }

    return `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;
  }, []);

  // ============================================================
  // GET AUTH TOKEN
  // ============================================================

  const getAuthToken = () => {
    return (
      localStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("authToken") ||
      sessionStorage.getItem("token") ||
      ""
    );
  };


  // ============================================================
// FETCH MY LISTINGS ONLY
// ============================================================

const fetchListings = useCallback(async () => {
  if (!user?.id) {
    console.warn("⚠️ No logged-in host ID");
    setListings([]);
    setLoading(false);
    return;
  }

  try {
    console.log("🏠 FETCHING HOST LISTINGS");
    console.log("👤 Host ID:", user.id);

    const response = await apiService.getProtectedData<Listing[]>(
      `/api/v1/listings/host/${user.id}`
    );

    console.log("📦 Host listings response:", response);
    console.log("📋 Host listings:", response.data);

    if (response.success && Array.isArray(response.data)) {
      setListings(response.data);

      console.log(
        "✅ Host listings loaded:",
        response.data.length
      );
    } else {
      console.warn("⚠️ Host listings response is invalid:", response);
      setListings([]);
    }
  } catch (error) {
    console.error("❌ Failed to fetch host listings:", error);
    setListings([]);
  } finally {
    setLoading(false);
  }
}, [user?.id]);


  // ============================================================
  // AUTH CHECK
  // ============================================================

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
      fetchListings();
  
      // Re-check periodically in case the token expires while this page is open.
      const intervalId = window.setInterval(() => {
        if (!hasValidStoredToken()) {
          navigate("/login", { replace: true });
        }
      }, 60_000);
  
      return () => window.clearInterval(intervalId);
    }, [authLoading, isAuthenticated, user, navigate]);

  // ============================================================
  // REVERSE GEOCODING
  // ============================================================

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!res.ok) {
        throw new Error("Reverse geocoding failed");
      }

      const data = await res.json();

      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  // ============================================================
  // APPLY COORDINATES
  // ============================================================

  const applyCoordinates = async (lat: number, lng: number) => {
    setMarkerPosition({
      lat,
      lng,
    });

    const address = await reverseGeocode(lat, lng);

    setSelectedLocation({
      lat,
      lng,
      address,
    });

    setFormData((prev) => ({
      ...prev,
      location: address,
      coordinates: {
        lat,
        lng,
      },
    }));
  };

  // ============================================================
  // MAP CLICK
  // ============================================================

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    await applyCoordinates(lat, lng);

    mapInstanceRef.current?.flyTo({
      center: [lng, lat],
      zoom: 14,
    });
  }, []);

  // ============================================================
  // IP GEOLOCATION
  // ============================================================

  const getIPGeolocation = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");

      if (!res.ok) {
        return null;
      }

      const data = await res.json();

      if (data?.latitude !== undefined && data?.longitude !== undefined) {
        return {
          lat: Number(data.latitude),
          lng: Number(data.longitude),
        };
      }
    } catch (error) {
      console.error("IP geolocation failed:", error);
    }

    return null;
  };

  // ============================================================
  // CURRENT LOCATION
  // ============================================================

  const useCurrentLocation = useCallback(async () => {
    setIsGettingLocation(true);
    setLocationError(null);

    let success = false;

    if ("geolocation" in navigator) {
      const options = [
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

          setMapCenter({
            lat,
            lng,
          });

          await applyCoordinates(lat, lng);

          mapInstanceRef.current?.flyTo({
            center: [lng, lat],
            zoom: opts.enableHighAccuracy ? 15 : 13,
          });

          success = true;
        } catch {
          // Try fallback.
        }
      }
    }

    if (!success) {
      const ip = await getIPGeolocation();

      if (ip) {
        setMapCenter({
          lat: ip.lat,
          lng: ip.lng,
        });

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
      const message = isAr
        ? "تعذر تحديد موقعك تلقائياً. حرك الخريطة أو ابحث عن عنوان يدوياً."
        : "Could not detect your location automatically. Move the map or search for an address manually.";

      setLocationError(message);
    }
  }, [isAr]);

  // ============================================================
  // ADDRESS SEARCH
  // ============================================================

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
          `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
          `${encodeURIComponent(query)}.json` +
          `?access_token=${MAPBOX_TOKEN}` +
          `&autocomplete=true&limit=5`;

        const res = await fetch(url);

        if (!res.ok) {
          throw new Error("Address search failed");
        }

        const data = await res.json();

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
      } catch (error) {
        console.error("Address search error:", error);

        setAddressSuggestions([]);
      } finally {
        setSearchingAddress(false);
      }
    }, 350);
  }, []);

  // ============================================================
  // SELECT ADDRESS
  // ============================================================

  const handleSuggestionSelect = (suggestion: {
    place_name: string;
    lat: number;
    lng: number;
  }) => {
    setMarkerPosition({
      lat: suggestion.lat,
      lng: suggestion.lng,
    });

    setSelectedLocation({
      lat: suggestion.lat,
      lng: suggestion.lng,
      address: suggestion.place_name,
    });

    setFormData((prev) => ({
      ...prev,
      location: suggestion.place_name,
      coordinates: {
        lat: suggestion.lat,
        lng: suggestion.lng,
      },
    }));

    setMapCenter({
      lat: suggestion.lat,
      lng: suggestion.lng,
    });

    mapInstanceRef.current?.flyTo({
      center: [suggestion.lng, suggestion.lat],
      zoom: 14,
    });

    setAddressQuery(suggestion.place_name);

    setShowSuggestions(false);
  };

  // ============================================================
  // CREATE MAP
  // ============================================================

  useEffect(() => {
    const showMap = !!mapCenter && !isGettingLocation;

    if (!showMap || !mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    if (!MAPBOX_TOKEN) {
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,

      style: "mapbox://styles/mapbox/streets-v12",

      center: [mapCenter!.lng, mapCenter!.lat],

      zoom: markerPosition ? 14 : 2,
    });

    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: false,
      }),
      "top-right",
    );

    map.on("click", (event) => {
      handleMapClick(event.lngLat.lat, event.lngLat.lng);
    });

    mapInstanceRef.current = map;

    setMapReady(true);

    return () => {
      map.remove();

      mapInstanceRef.current = null;

      markerRef.current = null;

      setMapReady(false);
    };
  }, [!!mapCenter && !isGettingLocation]);

  // ============================================================
  // MAP MARKER
  // ============================================================

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) return;

    if (!markerPosition) {
      markerRef.current?.remove();

      markerRef.current = null;

      return;
    }

    if (!markerRef.current) {
      const marker = new mapboxgl.Marker({
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

  // ============================================================
  // FORM INPUT
  // ============================================================

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ============================================================
  // ARRAY INPUT
  // ============================================================

  const handleArrayChange = (
    index: number,
    field: "amenities" | "rules",
    value: string,
  ) => {
    setFormData((prev) => {
      const array = [...prev[field]];

      array[index] = value;

      return {
        ...prev,
        [field]: array,
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

  // ============================================================
  // REAL IMAGE UPLOAD
  // ============================================================

  const uploadSingleImage = async (file: File): Promise<string> => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";

    const isValidType =
      ACCEPTED_IMAGE_TYPES.includes(file.type.toLowerCase()) ||
      ACCEPTED_IMAGE_EXTENSIONS.includes(extension);

    if (!isValidType) {
      throw new Error(t.imageTypeError);
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(t.imageSizeError);
    }

    const token = getAuthToken();

    const uploadFormData = new FormData();

    /*
     * IMPORTANT
     *
     * Your backend uses:
     *
     * upload.single("image")
     *
     * Therefore the field MUST be "image".
     */
    uploadFormData.append("image", file);

    const url = getApiUrl(LISTING_IMAGE_UPLOAD_ENDPOINT);

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: uploadFormData,
      credentials: "include",
    });

    const responseText = await response.text();

    let data: any = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = {
        message: responseText,
      };
    }

    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `Upload failed (${response.status})`,
      );
    }

    /*
     * Your backend currently returns:
     *
     * {
     *   success: true,
     *   url: imageUrl,
     *   imageUrl: imageUrl,
     *   file: ...
     * }
     *
     * We support that plus nested data responses.
     */
    const imageUrl =
      data?.data?.url ||
      data?.data?.imageUrl ||
      data?.data?.fileUrl ||
      data?.url ||
      data?.imageUrl ||
      data?.fileUrl;

    if (!imageUrl || typeof imageUrl !== "string") {
      console.error("Image upload response:", data);

      throw new Error(
        isAr
          ? "تم رفع الصورة ولكن لم يتم إرجاع رابط الصورة من الخادم"
          : "Image uploaded but the server did not return an image URL",
      );
    }

    return imageUrl;
  };

  // ============================================================
  // HANDLE FILE SELECTION
  // ============================================================

  const handleImageFilesSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);

    /*
     * Reset input so selecting the same
     * image again works.
     */
    event.target.value = "";

    if (!files.length) {
      return;
    }

    const currentImageCount = formData.images.filter(Boolean).length;

    const remainingSlots = MAX_IMAGES - currentImageCount;

    if (remainingSlots <= 0) {
      alert(t.maxImagesError);
      return;
    }

    if (files.length > remainingSlots) {
      alert(
        isAr
          ? `يمكنك إضافة ${remainingSlots} صورة فقط`
          : `You can add only ${remainingSlots} more image(s)`,
      );
    }

    const filesToUpload = files.slice(0, remainingSlots);

    setUploadingImages(true);
    setUploadProgress(0);

    try {
      const uploadedUrls: string[] = [];

      for (let index = 0; index < filesToUpload.length; index++) {
        const file = filesToUpload[index];

        setUploadingFileName(file.name);

        const url = await uploadSingleImage(file);

        if (url) {
          uploadedUrls.push(url);
        }

        setUploadProgress(
          Math.round(((index + 1) / filesToUpload.length) * 100),
        );
      }

      /*
       * IMPORTANT:
       *
       * These are now the REAL backend URLs.
       *
       * They are stored in formData.images
       * and later sent to:
       *
       * POST /api/listings
       * or
       * PUT /api/listings/:id
       *
       * where Prisma saves them into Listing.images.
       */
      if (uploadedUrls.length > 0) {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images.filter(Boolean), ...uploadedUrls],
        }));
      }
    } catch (error: any) {
      console.error("Image upload error:", error);

      alert(error?.message || t.imageUploadFailed);
    } finally {
      setUploadingImages(false);
      setUploadingFileName(null);
      setUploadProgress(0);
    }
  };
  // ============================================================
  // OPEN IMAGE PICKER
  // ============================================================

  const openImagePicker = () => {
    if (uploadingImages) {
      return;
    }

    const count = formData.images.filter(Boolean).length;

    if (count >= MAX_IMAGES) {
      alert(t.maxImagesError);

      return;
    }

    imageInputRef.current?.click();
  };

  // ============================================================
  // REMOVE IMAGE
  // ============================================================

  const handleImageRemove = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // ============================================================
  // RESET FORM
  // ============================================================

  const resetForm = () => {
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
  };

  // ============================================================
  // CANCEL
  // ============================================================

  const cancelEdit = () => {
    setShowForm(false);

    resetForm();
  };

  // ============================================================
  // EDIT LISTING
  // ============================================================

  const handleEdit = (listing: Listing) => {
    const lat =
      listing.latitude !== null && listing.latitude !== undefined
        ? parseFloat(String(listing.latitude))
        : null;

    const lng =
      listing.longitude !== null && listing.longitude !== undefined
        ? parseFloat(String(listing.longitude))
        : null;

    const coords =
      lat !== null &&
      lng !== null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
        ? {
            lat,
            lng,
          }
        : null;

    setIsEditing(true);

    setEditingId(listing.id);

    setFormData({
      title: listing.title || "",

      description: listing.description || "",

      price: String(listing.price ?? ""),

      location: listing.location || "",

      coordinates: coords,

      images: Array.isArray(listing.images)
        ? listing.images.filter(Boolean)
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
      setMapCenter(DEFAULT_CENTER);
    }

    setShowForm(true);
  };

  // ============================================================
  // TOGGLE ACTIVE
  // ============================================================

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
    } catch (error) {
      console.error("Failed to toggle listing:", error);
    } finally {
      setTogglingId(null);
    }
  };

  // ============================================================
  // VALIDATE FORM
  // ============================================================

  const validateForm = (): boolean => {
    if (!formData.location || !formData.coordinates) {
      alert(t.pleaseSelectLocation);

      return false;
    }

    const images = formData.images.filter(Boolean);

    if (images.length === 0) {
      alert(t.pleaseUploadImage);

      return false;
    }

    if (images.length > MAX_IMAGES) {
      alert(t.maxImagesError);

      return false;
    }

    if (!formData.title.trim()) {
      alert(
        isAr ? "الرجاء إدخال عنوان الإعلان" : "Please enter a listing title",
      );

      return false;
    }

    if (!formData.description.trim()) {
      alert(
        isAr
          ? "الرجاء إدخال وصف الإعلان"
          : "Please enter a listing description",
      );

      return false;
    }

    if (!formData.price || Number(formData.price) < 0) {
      alert(isAr ? "الرجاء إدخال سعر صحيح" : "Please enter a valid price");

      return false;
    }

    return true;
  };

  // ============================================================
  // CREATE LISTING
  // ============================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSavingListing(true);

    try {
      const payload = {
        ...formData,

        images: formData.images.filter(Boolean),

        amenities: formData.amenities
          .map((item) => item.trim())
          .filter(Boolean),

        rules: formData.rules.map((item) => item.trim()).filter(Boolean),

        price: Number(formData.price),
      };

      const response = await apiService.postProtectedData<{
        success: boolean;
        listing?: Listing;
      }>("/api/v1/listings", payload);

      if (response.success) {
        setShowForm(false);

        resetForm();

        await fetchListings();

        alert(t.listingCreatedSuccess);
      }
    } catch (error: any) {
      console.error("Create listing error:", error);

      alert(error?.message || "Failed to create listing");
    } finally {
      setSavingListing(false);
    }
  };

  // ============================================================
  // UPDATE LISTING
  // ============================================================
const handleUpdate = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validateForm() || !editingId) {
    return;
  }

  setSavingListing(true);

  try {
    const payload = {
      title: formData.title.trim(),

      description: formData.description.trim(),

      price: Number(formData.price),

      location: formData.location.trim(),

      // Backend converts this into latitude/longitude
      coordinates: formData.coordinates
        ? {
            lat: Number(formData.coordinates.lat),
            lng: Number(formData.coordinates.lng),
          }
        : null,

      images: formData.images.filter(Boolean),

      amenities: formData.amenities
        .map((item) => item.trim())
        .filter(Boolean),

      rules: formData.rules
        .map((item) => item.trim())
        .filter(Boolean),

      category: formData.category || "city",

      cancellation_policy: {
        type: formData.cancellation_policy.type || "flexible",

        description:
          formData.cancellation_policy.description?.trim() || "",

        rules: formData.cancellation_policy.rules
          .map((item) => item.trim())
          .filter(Boolean),
      },
    };

    console.log("📤 UPDATE LISTING PAYLOAD:", payload);

    const response = await apiService.putProtectedData<{
      success: boolean;
      data?: Listing;
      listing?: Listing;
      message?: string;
    }>(`/api/v1/listings/${editingId}`, payload);

    console.log("📥 UPDATE LISTING RESPONSE:", response);

    if (response.success) {
      await fetchListings();

      setShowForm(false);

      resetForm();

      alert(t.listingUpdatedSuccess);
    } else {
      throw new Error(
        response.message || "Failed to update listing"
      );
    }
  } catch (error: any) {
    console.error("❌ Update listing error:", error);

    alert(error?.message || "Failed to update listing");
  } finally {
    setSavingListing(false);
  }
};

  // ============================================================
  // DELETE
  // ============================================================

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDeleteListing)) {
      return;
    }

    try {
      const response = await apiService.deleteProtectedData<{
        success: boolean;
      }>(`/api/v1/listings/${id}?deleteListing=true`);

      if (response.success) {
        await fetchListings();

        alert(t.listingDeletedSuccess);
      }
    } catch (error: any) {
      console.error("Delete listing error:", error);

      alert(error?.message || "Failed to delete listing");
    }
  };

  // ============================================================
  // AUTO LOCATION WHEN FORM OPENS
  // ============================================================

  useEffect(() => {
    if (!showForm || isEditing || mapCenter || isGettingLocation) {
      return;
    }

    useCurrentLocation().then(() => {
      setMapCenter((current) => current ?? DEFAULT_CENTER);
    });
  }, [showForm, isEditing, mapCenter, isGettingLocation, useCurrentLocation]);

  // ============================================================
  // FONTS
  // ============================================================

  const bodyFontClass = isAr
    ? "font-['Cairo','Tajawal',sans-serif]"
    : "font-['DM_Mono',monospace]";

  const displayFontClass = isAr
    ? "font-['Cairo','Tajawal',sans-serif]"
    : "font-['Fraunces',serif]";

  const fieldInput = `
    w-full
    px-3.5
    py-2.5
    border
    border-black/12
    rounded-lg
    text-[13px]
    font-[inherit]
    text-[#111118]
    bg-[#fafaf8]
    outline-none
    transition-all
    focus:border-[#e8c547]
    focus:shadow-[0_0_0_3px_rgba(232,197,71,0.12)]
    focus:bg-white
    ${bodyFontClass}
  `;

  const handleCancellationPolicyChange = (
    field: "type" | "description",
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      cancellation_policy: {
        ...prev.cancellation_policy,
        [field]: value,
      },
    }));
  };

  const handleCancellationRuleChange = (index: number, value: string) => {
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

  const addCancellationRule = () => {
    setFormData((prev) => ({
      ...prev,
      cancellation_policy: {
        ...prev.cancellation_policy,
        rules: [...prev.cancellation_policy.rules, ""],
      },
    }));
  };

  const removeCancellationRule = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      cancellation_policy: {
        ...prev.cancellation_policy,
        rules: prev.cancellation_policy.rules.filter((_, i) => i !== index),
      },
    }));
  };

  // ============================================================
  // NAV
  // ============================================================

  const NAV_LINKS = [
    {
      id: "overview",
      label: t.overview,
      href: "/host-dashboard",
    },
    {
      id: "listings",
      label: t.myListings,
      href: "/host/listings",
    },
    {
      id: "bookings",
      label: t.bookings,
      href: "/host/bookings",
    },
  ];

  // ============================================================
  // LOADING
  // ============================================================

  if (authLoading || loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // ============================================================
  // USER INITIALS
  // ============================================================

  const userInitials =
    user?.name
      ?.split(" ")
      .map((name: string) => name[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "H";

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      className={`min-h-screen bg-[#f7f6f2] ${bodyFontClass}`}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* ======================================================
          NAVBAR
      ====================================================== */}

      <Navbar
        NAV_LINKS={NAV_LINKS}
        lang={lang}
        toggleLanguage={toggleLanguage}
      />

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="bg-[#1a1a2e] border-b border-[#e8c547]/12 px-6 py-10 pb-8">
        <div className="max-w-[1100px] mx-auto flex justify-between items-end gap-4">
          <div>
            <div
              className={`text-[10px] tracking-[0.12em] uppercase text-[#e8c547]/60 mb-2 ${bodyFontClass}`}
            >
              {t.hostPanel}
            </div>

            <h1
              className={`${displayFontClass} italic font-light text-[clamp(28px,4vw,38px)] text-white`}
            >
              {t.myListingsTitle1}{" "}
              <span className="font-medium text-[#e8c547]">{t.listings1}</span>
            </h1>

            <p className={`text-xs text-white/35 mt-1.5 ${bodyFontClass}`}>
              {listings.length}{" "}
              {listings.length !== 1 ? t.listingsActive : t.listingActive}
            </p>
          </div>

          {!showForm && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className={`bg-[#e8c547] text-[#1a1a2e] px-5 py-2.5 rounded-lg text-xs font-medium border-none cursor-pointer shrink-0 hover:opacity-88 hover:-translate-y-px transition-all ${bodyFontClass}`}
            >
              + {t.addNewListing}
            </button>
          )}
        </div>
      </div>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="max-w-[1100px] mx-auto px-4 md:px-6 py-8">
        {/* ====================================================
            FORM
        ==================================================== */}

        {showForm && (
          <div className="bg-white rounded-2xl border border-black/7 p-8 mb-8">
            {/* FORM HEADER */}

            <div className="mb-7">
              <div
                className={`text-[10px] tracking-[0.12em] uppercase text-[#999] mb-1.5 ${bodyFontClass}`}
              >
                {isEditing ? t.editListing : t.newListing}
              </div>

              <h2
                className={`${displayFontClass} italic font-light text-[26px] text-[#111118]`}
              >
                {isEditing ? t.edit : t.createA}{" "}
                <span className="font-medium">{t.listing}</span>
              </h2>
            </div>

            <form
              onSubmit={isEditing ? handleUpdate : handleSubmit}
              className={bodyFontClass}
            >
              {/* ==================================================
                  TITLE
              ================================================== */}

              <div className="mb-5">
                <label
                  className={`block text-[10px] tracking-[0.1em] uppercase text-[#888] mb-1.5 ${bodyFontClass}`}
                >
                  {t.title} *
                </label>

                <input
                  type="text"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleInputChange}
                  className={fieldInput}
                  placeholder={t.titlePlaceholder}
                />
              </div>

              {/* ==================================================
                  DESCRIPTION
              ================================================== */}

              <div className="mb-5">
                <label
                  className={`block text-[10px] tracking-[0.1em] uppercase text-[#888] mb-1.5 ${bodyFontClass}`}
                >
                  {t.description} *
                </label>

                <textarea
                  name="description"
                  required
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  className={`${fieldInput} resize-y`}
                  placeholder={t.descriptionPlaceholder}
                />
              </div>

              {/* ==================================================
                  PRICE
              ================================================== */}

              <div className="mb-5">
                <label
                  className={`block text-[10px] tracking-[0.1em] uppercase text-[#888] mb-1.5 ${bodyFontClass}`}
                >
                  {t.pricePerNight} / {isAr ? "دينار" : "LYD"} *
                </label>

                <input
                  type="number"
                  name="price"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={handleInputChange}
                  className={fieldInput}
                  placeholder="99"
                />
              </div>

              {/* ==================================================
                  CATEGORY
              ================================================== */}

              <div className="mb-5">
                <label
                  className={`block text-[10px] tracking-[0.1em] uppercase text-[#888] mb-1.5 ${bodyFontClass}`}
                >
                  {isAr ? "الفئة" : "Category"} *
                </label>

                <select
                  name="category"
                  required
                  value={formData.category}
                  onChange={handleInputChange}
                  className={`${fieldInput} cursor-pointer`}
                >
                  <option value="">
                    {isAr ? "اختر فئة" : "Select a category"}
                  </option>

                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon}{" "}
                      {isAr ? category.labelAr : category.labelEn}
                    </option>
                  ))}
                </select>

                {formData.category && (
                  <div
                    className={`text-[11px] text-[#666] mt-1.5 ${bodyFontClass}`}
                  >
                    {isAr
                      ? CATEGORIES.find((c) => c.id === formData.category)
                          ?.descriptionAr
                      : CATEGORIES.find((c) => c.id === formData.category)
                          ?.descriptionEn}
                  </div>
                )}
              </div>

              <hr className="border-none border-t border-black/7 my-6" />

              {/* ==================================================
                  LOCATION
              ================================================== */}

              <div className="mb-5">
                <label
                  className={`block text-[10px] tracking-[0.1em] uppercase text-[#888] mb-1.5 ${bodyFontClass}`}
                >
                  {t.location} *
                </label>

                <div className="flex gap-2 flex-wrap mb-2.5">
                  <div className="flex-1 min-w-[180px] relative">
                    <input
                      type="text"
                      value={addressQuery}
                      onChange={(e) => searchAddress(e.target.value)}
                      onFocus={() => {
                        if (addressSuggestions.length) {
                          setShowSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowSuggestions(false), 150);
                      }}
                      placeholder={
                        isAr ? "ابحث عن عنوان" : "Search for an address"
                      }
                      className={fieldInput}
                      disabled={!MAPBOX_TOKEN}
                    />

                    {searchingAddress && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#e8c547] border-t-transparent rounded-full animate-spin" />
                    )}

                    {showSuggestions && addressSuggestions.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                        {addressSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSuggestionSelect(suggestion)}
                            className={`w-full text-left px-3.5 py-2.5 text-xs text-[#333] hover:bg-[#fafaf8] border-b border-black/5 last:border-b-0 ${bodyFontClass}`}
                          >
                            📍 {suggestion.place_name}
                          </button>
                        ))}
                      </div>
                    )}

                    {!MAPBOX_TOKEN && (
                      <p
                        className={`text-[11px] text-[#e05a5a] mt-1 ${bodyFontClass}`}
                      >
                        {isAr
                          ? "أضف VITE_MAPBOX_TOKEN لتفعيل البحث عن العناوين"
                          : "Add VITE_MAPBOX_TOKEN to enable address search"}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    disabled={isGettingLocation}
                    className={`px-4 py-2.5 rounded-lg text-xs font-medium border-none cursor-pointer whitespace-nowrap transition-all hover:opacity-88 hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed ${
                      isGettingLocation
                        ? "bg-[#ccc] text-white"
                        : "bg-[#1D9E75] text-white"
                    } ${bodyFontClass}`}
                  >
                    {isGettingLocation
                      ? t.gettingLocation
                      : `📍 ${t.myLocation}`}
                  </button>
                </div>

                <div className="mb-2.5">
                  <input
                    type="text"
                    name="location"
                    required
                    value={formData.location}
                    onChange={handleInputChange}
                    className={fieldInput}
                    placeholder={t.addressWillAppear}
                    readOnly
                  />
                </div>

                {/* MAP */}

                <div className="border border-black/10 rounded-xl overflow-hidden">
                  <div className="bg-[#1a1a2e] px-4 py-2.5 flex justify-between items-center flex-wrap gap-2">
                    <span
                      className={`text-[11px] text-white/50 ${bodyFontClass}`}
                    >
                      💡{" "}
                      {isAr
                        ? "انقر على الخريطة لتحديد الموقع"
                        : "Click on the map to select location"}
                    </span>
                  </div>

                  {(!mapCenter || isGettingLocation) && (
                    <div className="h-[400px] flex items-center justify-center bg-[#f7f6f2] flex-col gap-3">
                      {isGettingLocation ? (
                        <>
                          <div className="w-10 h-10 border-[3px] border-[#e8c547] border-t-transparent rounded-full animate-spin" />

                          <p className={`text-xs text-[#999] ${bodyFontClass}`}>
                            {t.gettingLocation}
                          </p>
                        </>
                      ) : (
                        <p className={`text-xs text-[#999] ${bodyFontClass}`}>
                          {locationError ||
                            (isAr
                              ? "انقر على 'موقعي' أو ابحث عن عنوان"
                              : "Click 'My Location' or search for an address")}
                        </p>
                      )}
                    </div>
                  )}

                  {mapCenter && !isGettingLocation && (
                    <div className="h-[400px] w-full relative">
                      {MAPBOX_TOKEN ? (
                        <div ref={mapContainerRef} className="h-full w-full" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-[#f7f6f2] px-6 text-center">
                          <p
                            className={`text-xs text-[#e05a5a] ${bodyFontClass}`}
                          >
                            {isAr
                              ? "أضف VITE_MAPBOX_TOKEN في ملف البيئة لعرض الخريطة"
                              : "Add VITE_MAPBOX_TOKEN to your env file to display the map"}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* LOCATION PILL */}

                <div className="bg-[#fdf8e7] border border-[#e8c547]/30 rounded-xl px-3.5 py-2.5 mt-2.5">
                  <p
                    className={`text-xs text-[#7a6012] font-medium ${bodyFontClass}`}
                  >
                    📍{" "}
                    {selectedLocation?.address ||
                      (isAr
                        ? "اختر موقعاً على الخريطة"
                        : "Select a location on the map")}
                  </p>

                  {selectedLocation && (
                    <p
                      className={`text-[11px] text-[#a08020] mt-0.5 ${bodyFontClass}`}
                    >
                      {selectedLocation.lat.toFixed(6)},{" "}
                      {selectedLocation.lng.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>

              <hr className="border-none border-t border-black/7 my-6" />

              {/* ==================================================
                  REAL IMAGE UPLOAD
              ================================================== */}

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label
                    className={`block text-[10px] tracking-[0.1em] uppercase text-[#888] ${bodyFontClass}`}
                  >
                    {t.imagesRequired}
                  </label>

                  <span className={`text-[11px] text-[#999] ${bodyFontClass}`}>
                    {formData.images.filter(Boolean).length} / {MAX_IMAGES}
                  </span>
                </div>

                {/* Hidden real file input */}

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                  multiple
                  onChange={handleImageFilesSelected}
                  className="hidden"
                />

                {/* IMAGE GRID */}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {formData.images.map((image, index) => (
                    <div key={`${image}-${index}`} className="relative group">
                      <img
                        src={image}
                        alt={`Listing image ${index + 1}`}
                        className="w-full h-40 object-cover rounded-xl border border-black/10"
                      />

                      {/* IMAGE NUMBER */}

                      <div className="absolute bottom-2 left-2 bg-[#1a1a2e]/90 text-[#e8c547] rounded-full px-2 py-1 text-[10px]">
                        {index + 1}
                      </div>

                      {/* REMOVE */}

                      <button
                        type="button"
                        onClick={() => handleImageRemove(index)}
                        disabled={uploadingImages}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-sm shadow-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                        aria-label={t.remove}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* ADD IMAGE */}

                  {formData.images.filter(Boolean).length < MAX_IMAGES && (
                    <button
                      type="button"
                      onClick={openImagePicker}
                      disabled={uploadingImages}
                      className="min-h-[160px] border-2 border-dashed border-black/12 rounded-xl p-6 bg-[#fafaf8] cursor-pointer flex flex-col items-center justify-center gap-2 text-xs text-[#999] transition-all hover:border-[#e8c547] hover:text-[#e8c547] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        width="30"
                        height="30"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4v16m8-8H4"
                        />
                      </svg>

                      <span>{t.addImage}</span>

                      <span className="text-[9px] text-[#bbb]">
                        JPG · JPEG · PNG · WEBP · HEIC · HEIF
                      </span>

                      <span className="text-[9px] text-[#bbb]">Max 10 MB</span>
                    </button>
                  )}
                </div>

                {/* UPLOADING */}

                {uploadingImages && (
                  <div className="mt-4 bg-[#fdf8e7] border border-[#e8c547]/30 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-5 h-5 border-2 border-[#e8c547] border-t-transparent rounded-full animate-spin" />

                      <span
                        className={`text-xs text-[#7a6012] font-medium ${bodyFontClass}`}
                      >
                        {t.imageUploading}
                      </span>
                    </div>

                    {uploadingFileName && (
                      <p
                        className={`text-[10px] text-[#a08020] mb-2 truncate ${bodyFontClass}`}
                      >
                        {uploadingFileName}
                      </p>
                    )}

                    <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#e8c547] transition-all duration-300"
                        style={{
                          width: `${uploadProgress}%`,
                        }}
                      />
                    </div>

                    <div
                      className={`text-[10px] text-[#a08020] mt-1 ${bodyFontClass}`}
                    >
                      {uploadProgress}%
                    </div>
                  </div>
                )}

                {/* HELP TEXT */}

                <p className={`text-[10px] text-[#aaa] mt-2 ${bodyFontClass}`}>
                  {isAr
                    ? "يمكنك رفع حتى 6 صور. الحد الأقصى لكل صورة 10 ميجابايت."
                    : "Upload up to 6 images. Maximum 10 MB per image."}
                </p>
              </div>

              <hr className="border-none border-t border-black/7 my-6" />

              {/* ==================================================
                  AMENITIES
              ================================================== */}

              <div className="mb-6">
                <label
                  className={`block text-[10px] tracking-[0.1em] uppercase text-[#888] mb-1.5 ${bodyFontClass}`}
                >
                  {t.amenities}
                </label>

                {formData.amenities.map((amenity, index) => (
                  <div key={index} className="flex gap-2 mb-2 items-center">
                    <input
                      type="text"
                      value={amenity}
                      onChange={(e) =>
                        handleArrayChange(index, "amenities", e.target.value)
                      }
                      placeholder={t.amenityPlaceholder}
                      className={`${fieldInput} flex-1`}
                    />

                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField("amenities", index)}
                        className={`bg-red-100 text-red-800 border-none rounded-md px-3 py-1.5 text-[11px] cursor-pointer ${bodyFontClass}`}
                      >
                        {t.remove}
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addArrayField("amenities")}
                  className={`text-xs text-[#e8c547] bg-transparent border-none cursor-pointer py-1 mt-1 ${bodyFontClass}`}
                >
                  + {t.addAmenity}
                </button>
              </div>

              {/* Cancellation Policy */}
              <div className="mb-6">
                <label
                  className={`block text-[10px] tracking-[0.1em] uppercase text-[#888] mb-1.5 ${bodyFontClass}`}
                >
                  {isAr ? "سياسة الإلغاء" : "Cancellation Policy"}
                </label>

                <p className={`text-[11px] text-[#999] mb-4 ${bodyFontClass}`}>
                  {isAr
                    ? "اكتب سياسة الإلغاء الخاصة بهذا الإعلان"
                    : "Set your own cancellation policy for this listing"}
                </p>

                {/* Policy Type */}
                <div className="mb-4">
                  <label
                    className={`block text-[10px] tracking-[0.08em] uppercase text-[#999] mb-2 ${bodyFontClass}`}
                  >
                    {isAr ? "نوع السياسة" : "Policy Type"}
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[
                      {
                        value: "flexible",
                        label: isAr ? "مرنة" : "Flexible",
                      },
                      {
                        value: "moderate",
                        label: isAr ? "متوسطة" : "Moderate",
                      },
                      {
                        value: "strict",
                        label: isAr ? "صارمة" : "Strict",
                      },
                    ].map((policy) => {
                      const selected =
                        formData.cancellation_policy.type === policy.value;

                      return (
                        <button
                          key={policy.value}
                          type="button"
                          onClick={() =>
                            handleCancellationPolicyChange("type", policy.value)
                          }
                          className={`text-left rounded-lg border px-3.5 py-3 cursor-pointer transition-all ${
                            selected
                              ? "border-[#e8c547] bg-[#fdf8e7]"
                              : "border-black/10 bg-[#fafaf8] hover:border-[#e8c547]/50"
                          } ${bodyFontClass}`}
                        >
                          <div
                            className={`text-xs font-medium ${
                              selected ? "text-[#7a6012]" : "text-[#555]"
                            }`}
                          >
                            {policy.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Host's Custom Policy */}
                <div className="mb-4">
                  <label
                    className={`block text-[10px] tracking-[0.1em] uppercase text-[#888] mb-1.5 ${bodyFontClass}`}
                  >
                    {isAr
                      ? "سياسة الإلغاء الخاصة بك"
                      : "Your Cancellation Policy"}
                  </label>

                  <textarea
                    rows={5}
                    value={formData.cancellation_policy.description}
                    onChange={(e) =>
                      handleCancellationPolicyChange(
                        "description",
                        e.target.value,
                      )
                    }
                    className={`${fieldInput} resize-y`}
                    placeholder={
                      isAr
                        ? "اكتب سياسة الإلغاء الخاصة بك بالتفصيل. مثال: يمكن للضيف الإلغاء مجاناً قبل 48 ساعة من موعد الوصول..."
                        : "Write your cancellation policy. Example: Guests can cancel for free up to 48 hours before check-in..."
                    }
                  />

                  <p
                    className={`text-[10px] text-[#999] mt-1.5 ${bodyFontClass}`}
                  >
                    {isAr
                      ? "سيتم عرض هذه السياسة للضيوف قبل الحجز."
                      : "This policy will be shown to guests before they book."}
                  </p>
                </div>

                {/* Custom Rules */}
                <div>
                  <label
                    className={`block text-[10px] tracking-[0.1em] uppercase text-[#888] mb-1.5 ${bodyFontClass}`}
                  >
                    {isAr
                      ? "شروط الإلغاء الإضافية"
                      : "Additional Cancellation Rules"}
                  </label>

                  {formData.cancellation_policy.rules.map((rule, index) => (
                    <div key={index} className="flex gap-2 mb-2 items-center">
                      <div className="w-5 h-5 rounded shrink-0 bg-[#e8c547] flex items-center justify-center">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M2 6l3 3 5-6"
                            stroke="#1a1a2e"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      <input
                        type="text"
                        value={rule}
                        onChange={(e) =>
                          handleCancellationRuleChange(index, e.target.value)
                        }
                        placeholder={
                          isAr
                            ? "اكتب شرط الإلغاء"
                            : "Write a cancellation rule"
                        }
                        className={`${fieldInput} flex-1`}
                      />

                      <button
                        type="button"
                        onClick={() => removeCancellationRule(index)}
                        className="bg-transparent border-none text-[#e05a5a] text-lg cursor-pointer px-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addCancellationRule}
                    className={`text-xs text-[#e8c547] bg-transparent border border-dashed border-[#e8c547]/50 rounded-lg cursor-pointer py-2 px-3 mt-2 w-full hover:border-[#e8c547] transition-colors ${bodyFontClass}`}
                  >
                    + {isAr ? "إضافة شرط" : "Add Cancellation Rule"}
                  </button>
                </div>
              </div>

              {/* ==================================================
                  RULES
              ================================================== */}

              <div className="mb-5">
                <label
                  className={`block text-[10px] tracking-[0.1em] uppercase text-[#888] mb-1.5 ${bodyFontClass}`}
                >
                  {t.houseRules}
                </label>

                <div className="mb-3">
                  <div
                    className={`text-[10px] tracking-[0.08em] uppercase text-[#999] mb-2 ${bodyFontClass}`}
                  >
                    {t.quickAdd}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      t.ruleNoSmoking,
                      t.ruleNoParties,
                      t.ruleNoPets,
                      t.ruleQuietHours,
                      t.ruleSelfCheckIn,
                      t.ruleNoShoes,
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          if (!formData.rules.includes(suggestion)) {
                            setFormData((prev) => ({
                              ...prev,
                              rules: [...prev.rules, suggestion],
                            }));
                          }
                        }}
                        className={`border border-black/10 rounded-full px-3 py-1 text-[11px] cursor-pointer transition-colors ${bodyFontClass} ${
                          formData.rules.includes(suggestion)
                            ? "bg-[#e8c547] text-[#1a1a2e]"
                            : "bg-[#fafaf8] text-[#888]"
                        }`}
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {formData.rules.map((rule, index) => (
                  <div key={index} className="flex gap-2 mb-2 items-center">
                    <div className="w-5 h-5 rounded shrink-0 bg-[#e8c547] flex items-center justify-center">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2 6l3 3 5-6"
                          stroke="#1a1a2e"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>

                    <input
                      type="text"
                      value={rule}
                      onChange={(e) =>
                        handleArrayChange(index, "rules", e.target.value)
                      }
                      placeholder={t.rulePlaceholder}
                      className={`${fieldInput} flex-1`}
                    />

                    <button
                      type="button"
                      onClick={() => removeArrayField("rules", index)}
                      className="bg-transparent border-none text-[#e05a5a] text-lg cursor-pointer px-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addArrayField("rules")}
                  className={`text-xs text-[#e8c547] bg-transparent border border-dashed border-[#e8c547]/50 rounded-lg cursor-pointer py-2 px-3 mt-2 w-full hover:border-[#e8c547] transition-colors ${bodyFontClass}`}
                >
                  {t.addCustomRule}
                </button>
              </div>

              <hr className="border-none border-t border-black/7 my-6" />

              {/* ==================================================
                  SUBMIT
              ================================================== */}

              <div className="flex justify-end gap-2.5 pt-5 border-t border-black/7">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={savingListing || uploadingImages}
                  className={`bg-transparent text-[#555] px-3.5 py-2 rounded-lg text-xs border border-black/12 cursor-pointer hover:border-black/30 hover:text-[#111118] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${bodyFontClass}`}
                >
                  {t.cancel}
                </button>

                <button
                  type="submit"
                  disabled={savingListing || uploadingImages}
                  className={`bg-[#1a1a2e] text-[#e8c547] px-5 py-2.5 rounded-lg text-xs font-medium border-none cursor-pointer hover:opacity-88 hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed ${bodyFontClass}`}
                >
                  {savingListing ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-[#e8c547] border-t-transparent rounded-full animate-spin" />

                      {t.saving}
                    </span>
                  ) : isEditing ? (
                    t.updateListing
                  ) : (
                    t.createListing
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================
            LISTINGS
        ====================================================== */}

        {!showForm &&
          (listings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/7 py-20 px-6 text-center">
              <div className="text-5xl mb-3">🏠</div>

              <p className={`text-[13px] text-[#999] mb-4 ${bodyFontClass}`}>
                {t.noListingsYet}
              </p>

              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className={`bg-transparent border-none text-[#e8c547] text-[13px] cursor-pointer ${bodyFontClass}`}
              >
                {t.createFirstListing} →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing) => {
                const category = CATEGORIES.find(
                  (category) => category.id === listing.category,
                );

                const isToggling = togglingId === listing.id;

                const firstImage =
                  listing.images?.find(Boolean) || "/placeholder.jpg";

                return (
                  <div
                    key={listing.id}
                    className={`bg-white rounded-2xl border overflow-hidden transition-all duration-[220ms] hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] ${
                      listing.is_active
                        ? "border-black/7"
                        : "border-[#e05a5a]/30"
                    }`}
                  >
                    {/* IMAGE */}

                    <div className="h-[200px] overflow-hidden relative">
                      <img
                        src={firstImage}
                        alt={listing.title}
                        className={`w-full h-full object-cover transition-all ${
                          !listing.is_active ? "opacity-60 grayscale" : ""
                        }`}
                        onError={(event) => {
                          event.currentTarget.src = "/placeholder.jpg";
                        }}
                      />

                      {/* PRICE */}

                      <div className="absolute top-3 right-3 bg-[rgba(26,26,46,0.92)] text-[#e8c547] rounded-lg px-2.5 py-1 text-xs font-medium">
                        {formatCurrency(Number(listing.price))}

                        <span className="text-[10px] text-[#e8c547]/60">
                          /{t.night}
                        </span>
                      </div>

                      {/* CATEGORY */}

                      {category && (
                        <div className="absolute bottom-3 left-3 bg-[rgba(26,26,46,0.9)] text-[#e8c547] rounded-full px-2.5 py-1 text-[11px] flex items-center gap-1">
                          {category.icon}{" "}
                          {isAr ? category.labelAr : category.labelEn}
                        </div>
                      )}

                      {/* ACTIVE */}

                      <div
                        className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-medium flex items-center gap-1 ${
                          listing.is_active
                            ? "bg-[#1D9E75] text-white"
                            : "bg-[#e05a5a] text-white"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full bg-white ${
                            listing.is_active ? "opacity-100" : "opacity-70"
                          }`}
                        />

                        {listing.is_active
                          ? isAr
                            ? "نشط"
                            : "Active"
                          : isAr
                            ? "غير نشط"
                            : "Inactive"}
                      </div>

                      {/* IMAGE COUNT */}

                      {listing.images?.length > 1 && (
                        <div className="absolute bottom-3 right-3 bg-black/70 text-white rounded-full px-2 py-1 text-[10px]">
                          📷 {listing.images.length}
                        </div>
                      )}
                    </div>

                    {/* CARD BODY */}

                    <div className="p-5">
                      <h3
                        className={`text-[15px] font-medium text-[#111118] mb-1.5 ${bodyFontClass}`}
                      >
                        {listing.title}
                      </h3>

                      <p
                        className={`text-xs text-[#888] mb-3 ${bodyFontClass}`}
                      >
                        📍 {listing.location}
                      </p>

                      {/* TOGGLE */}

                      <div className="flex items-center justify-between bg-[#f7f6f2] rounded-lg px-3 py-2 mb-3 border border-black/5">
                        <span
                          className={`text-[11px] text-[#666] ${bodyFontClass}`}
                        >
                          {listing.is_active
                            ? isAr
                              ? "مفتوح للحجز"
                              : "Open for booking"
                            : isAr
                              ? "الحجز متوقف"
                              : "Booking paused"}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(listing)}
                          disabled={isToggling}
                          className={`relative w-9 h-5 rounded-full border-none cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${
                            listing.is_active ? "bg-[#1D9E75]" : "bg-[#ddd]"
                          }`}
                        >
                          <span
                            className={`absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all duration-200 ${
                              listing.is_active ? "left-[19px]" : "left-[3px]"
                            }`}
                          />
                        </button>
                      </div>

                      {/* ACTIONS */}

                      <div className="flex justify-between items-center border-t border-black/[0.06] pt-3.5">
                        <Link
                          to={`/listings/${listing.id}`}
                          className={`text-xs text-[#1a1a2e] no-underline ${bodyFontClass}`}
                        >
                          {t.viewDetails} →
                        </Link>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(listing)}
                            className={`text-xs text-[#185FA5] bg-transparent border-none cursor-pointer ${bodyFontClass}`}
                          >
                            {t.edit}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(listing.id)}
                            className={`text-xs text-[#e05a5a] bg-transparent border-none cursor-pointer ${bodyFontClass}`}
                          >
                            {t.delete}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
      </main>
    </div>
  );
};

export default HostListings;
