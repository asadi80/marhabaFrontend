import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import LoadingScreen from "../../components/LoadingScreen";
import Navbar from "../../components/Navbar";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const nights = (a: string | Date, b: string | Date) =>
  Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

const haversine = (la1: number, lo1: number, la2: number, lo2: number) => {
  const R = 6371;
  const dLa = ((la2 - la1) * Math.PI) / 180;
  const dLo = ((lo2 - lo1) * Math.PI) / 180;
  const a =
    Math.sin(dLa / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) *
      Math.cos((la2 * Math.PI) / 180) *
      Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Avatar Helpers ──────────────────────────────────────────────────────────
const AVATAR_PAL = [
  { bg: "#EEEDFE", c: "#3C3489" },
  { bg: "#E6F1FB", c: "#0C447C" },
  { bg: "#EAF3DE", c: "#27500A" },
  { bg: "#FAEEDA", c: "#633806" },
  { bg: "#E1F5EE", c: "#085041" },
  { bg: "#FBEAF0", c: "#72243E" },
];

const getAvatar = (name: string) =>
  AVATAR_PAL[(name?.charCodeAt(0) ?? 0) % AVATAR_PAL.length];

const getInitials = (name: string) =>
  name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "";

const statusStyle = (s: string) =>
  ({
    confirmed: { bg: "#EAF3DE", c: "#27500A" },
    pending: { bg: "#FAEEDA", c: "#633806" },
    cancelled: { bg: "#FCEBEB", c: "#791F1F" },
  })[s] ?? { bg: "#F1EFE8", c: "#444" };

// ─── API Helpers ─────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "https://marhababackend.onrender.com/api/v1";

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    credentials: "include",
  });
  
  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  
  return response;
};

// ─── Google Maps Component ──────────────────────────────────────────────────
interface GoogleMapProps {
  userLocation: { lat: number; lng: number } | null;
  listings: any[];
  onDirections: (listing: any) => void;
  onOpenMaps: (listing: any) => void;
  isAr: boolean;
}

const GoogleMap = ({ userLocation, listings, onDirections, onOpenMaps, isAr }: GoogleMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [infoWindows, setInfoWindows] = useState<google.maps.InfoWindow[]>([]);

  // Load Google Maps API
  useEffect(() => {
    if (!window.google) {
      // Load Google Maps API script
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      
      script.onload = () => {
        initializeMap();
      };
    } else {
      initializeMap();
    }
  }, []);

  const initializeMap = () => {
    if (!mapRef.current || !userLocation) return;

    const mapOptions: google.maps.MapOptions = {
      center: { lat: userLocation.lat, lng: userLocation.lng },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
    };

    const newMap = new google.maps.Map(mapRef.current, mapOptions);
    setMap(newMap);

    // Add user location marker
    const userMarker = new google.maps.Marker({
      position: { lat: userLocation.lat, lng: userLocation.lng },
      map: newMap,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: "#4285F4",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 10,
      },
      title: isAr ? "موقعك الحالي" : "Your Location",
    });

    const userInfo = new google.maps.InfoWindow({
      content: `<div style="font-size:12px;font-weight:bold;">📍 ${isAr ? "موقعك الحالي" : "Your Location"}</div>`,
    });

    userMarker.addListener("click", () => {
      userInfo.open(newMap, userMarker);
    });

    setMarkers([userMarker]);
    setInfoWindows([userInfo]);
  };

  // Update markers when listings change
  useEffect(() => {
    if (!map || !window.google) return;

    // Clear old markers
    markers.forEach(marker => marker.setMap(null));
    infoWindows.forEach(win => win.close());

    const newMarkers: google.maps.Marker[] = [];
    const newInfoWindows: google.maps.InfoWindow[] = [];

    listings.forEach((listing) => {
      if (!listing.coordinates) return;

      const marker = new google.maps.Marker({
        position: { lat: listing.coordinates.lat, lng: listing.coordinates.lng },
        map,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z"
                fill="#e8c547" stroke="#1a1a2e" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          `)}`,
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 32),
        },
        title: listing.title,
      });

      // Create info window
      const infoContent = `
        <div style="min-width:160px;font-family:sans-serif;">
          ${listing.images?.[0] ? `<img src="${listing.images[0]}" alt="${listing.title}" style="width:100%;height:90px;object-fit:cover;border-radius:4px;margin-bottom:8px;" />` : ''}
          <div style="font-weight:500;margin-bottom:4px;">🏠 ${listing.title}</div>
          <div style="color:#666;font-size:12px;margin-bottom:8px;">${listing.location}</div>
          <div style="display:flex;gap:4px;">
            <a href="/listings/${listing.id}" style="flex:1;background:#1a1a2e;color:#e8c547;padding:4px 8px;border-radius:4px;text-align:center;font-size:11px;text-decoration:none;">
              ${isAr ? "عرض" : "view"}
            </a>
            <button onclick="window.handleDirections(${listing.id})" style="flex:1;background:#1D9E75;color:white;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;">
              ${isAr ? "اتجاهات" : "dir"}
            </button>
          </div>
        </div>
      `;

      const infoWindow = new google.maps.InfoWindow({
        content: infoContent,
      });

      // Store listing id for click handler
      (marker as any).listingId = listing.id;

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });

      newMarkers.push(marker);
      newInfoWindows.push(infoWindow);
    });

    // Add click handler to window for directions
    (window as any).handleDirections = (listingId: number) => {
      const listing = listings.find(l => l.id === listingId);
      if (listing) {
        onDirections(listing);
      }
    };

    setMarkers(newMarkers);
    setInfoWindows(newInfoWindows);
  }, [listings, map]);

  // Center map on user location
  const centerMap = () => {
    if (map && userLocation) {
      map.panTo({ lat: userLocation.lat, lng: userLocation.lng });
      map.setZoom(12);
    }
  };

  return (
    <div className="relative">
      <div ref={mapRef} className="h-full w-full min-h-[400px]" />
      <button
        onClick={centerMap}
        className="absolute bottom-4 right-4 bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-md hover:shadow-lg transition-shadow z-10"
        title={isAr ? "مركز الخريطة" : "Center map"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function UserDashboard() {
  const navigate = useNavigate();
  const { lang, toggleLanguage } = useLanguage();
  const isAr = lang === "ar";

  const [user, setUser] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState(10);
  const [activeTab, setActiveTab] = useState("nearby");
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  // ─── Auth Check + Data Fetch ─────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get user
        const userRes = await fetchWithAuth("/auth/me");
        if (!userRes.ok) throw new Error("Not authenticated");
        const userData = await userRes.json();
        
        const role = userData.user?.role || userData.user?.userType;
        if (role === "super_admin" || role === "admin") {
          navigate("/admin");
          return;
        }
        if (role === "host") {
          navigate("/host-dashboard");
          return;
        }
        
        setUser(userData.user);
        getUserLocation();
        await fetchListings();
        await fetchBookings();
        
        // Load Google Maps API
        loadGoogleMaps();
      } catch (error) {
        console.error("Auth error:", error);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // ─── Load Google Maps ────────────────────────────────────────────────────
  const loadGoogleMaps = () => {
    if (window.google) {
      setGoogleMapsLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      setGoogleMapsLoaded(true);
    };
    
    script.onerror = () => {
      console.error("Failed to load Google Maps API");
    };
    
    document.head.appendChild(script);
  };

  // ─── Location ─────────────────────────────────────────────────────────────
  const getUserLocation = () => {
    if (!("geolocation" in navigator)) {
      setUserLocation({ lat: 32.8872, lng: 13.1913 }); // Tripoli, Libya default
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        setUserLocation({ lat, lng });
      },
      () => setUserLocation({ lat: 32.8872, lng: 13.1913 })
    );
  };

  // ─── Data Fetching ────────────────────────────────────────────────────────
  const fetchListings = async () => {
    try {
      const res = await fetchWithAuth("/listings");
      const data = await res.json();
      const active = data.listings?.filter((l: any) => l.is_active !== false) || [];
      setListings(active);
      setFiltered(active);
    } catch (error) {
      console.error("Failed to fetch listings:", error);
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await fetchWithAuth("/bookings");
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
    }
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const filterByDistance = (radius: number) => {
    if (!userLocation) return;
    setFiltered(
      listings.filter(
        (l) =>
          l.coordinates &&
          haversine(
            userLocation.lat,
            userLocation.lng,
            l.coordinates.lat,
            l.coordinates.lng
          ) <= radius
      )
    );
    setSearchRadius(radius);
  };

  const openMaps = (l: any) =>
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${l.coordinates.lat},${l.coordinates.lng}`,
      "_blank"
    );

  const getDirections = (l: any) => {
    if (!userLocation) {
      alert(
        isAr
          ? "قم بتفعيل خدمات الموقع أولاً"
          : "Enable location services first"
      );
      return;
    }
    window.open(
      `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${l.coordinates.lat},${l.coordinates.lng}`,
      "_blank"
    );
  };

  const cancelBooking = async (id: string) => {
    if (!confirm(isAr ? "هل تريد إلغاء هذا الحجز؟" : "Cancel this booking?"))
      return;
    try {
      const res = await fetchWithAuth(`/bookings/${id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) throw new Error("Failed to cancel booking");
      await fetchBookings();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen />;
  if (!user) return null;

  const { bg: aviBg, c: aviColor } = getAvatar(user.name);
  const initials = getInitials(user.name);
  
  const displayFontClass = isAr
    ? "font-['Cairo','Tajawal',sans-serif]"
    : "font-['Fraunces',serif]";
  const bodyFontClass = isAr
    ? "font-['Cairo','Tajawal',sans-serif]"
    : "font-['DM_Mono',monospace]";

  const TABS = [
    { id: "nearby", label: isAr ? "الأماكن القريبة" : "Nearby Places" },
    { id: "bookings", label: `${isAr ? "الحجوزات" : "Bookings"} (${bookings.length})` },
    { id: "listings", label: isAr ? "تصفح العقارات" : "Browse Listings", href: "/listings" },
  ];

  return (
    <div className={`min-h-screen bg-[#f7f6f2] ${isAr ? "rtl" : "ltr"} ${bodyFontClass}`}>
      <Navbar
        NAV_LINKS={TABS}
        user={user}
        lang={lang}
        toggleLanguage={toggleLanguage}
        onTabChange={(tabId: string) => setActiveTab(tabId)}
      />

      <main className="max-w-[1200px] mx-auto p-4 md:p-6">
        {/* ─── Profile Strip ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-black/7 p-4 md:p-5 mb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-medium"
              style={{ background: aviBg, color: aviColor }}
            >
              {initials}
            </div>
            <div>
              <div className={`${displayFontClass} font-light text-xl text-[#111118] leading-tight ${isAr ? "italic" : ""}`}>
                {user.name}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {isAr ? "عضو منذ" : "member since"} {fmt(user.createdAt)}
              </div>
            </div>
          </div>
          <div className="flex gap-5 flex-wrap">
            {[
              { l: isAr ? "الحجوزات" : "bookings", v: bookings.length },
              { l: isAr ? "القريبة" : "nearby", v: filtered.length },
            ].map(({ l, v }) => (
              <div key={l} className={isAr ? "text-left" : "text-right"}>
                <div className={`${displayFontClass} font-light text-2xl text-[#111118] leading-tight ${isAr ? "italic" : ""}`}>
                  {v}
                </div>
                <div className="text-[10px] tracking-wide uppercase text-gray-300 mt-0.5">
                  {l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── NEARBY TAB ────────────────────────────────────────────────────── */}
        {activeTab === "nearby" && (
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2.5 mb-4">
              <div className={`${displayFontClass} font-light text-xl text-[#111118] ${isAr ? "italic" : ""}`}>
                {isAr ? "الأماكن القريبة" : "nearby places"}
                <span className="text-[13px] font-normal not-italic text-gray-400 ml-2">
                  ({filtered.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] tracking-wide uppercase text-gray-400">
                  {isAr ? "نصف القطر" : "radius"}
                </label>
                <select
                  onChange={(e) => filterByDistance(parseInt(e.target.value))}
                  value={searchRadius}
                  className="px-2.5 py-1.5 bg-[#fafaf8] border border-black/12 rounded-md text-xs outline-none"
                >
                  {[5, 10, 20, 50, 100].map((v) => (
                    <option key={v} value={v}>
                      {v} {isAr ? "كم" : "km"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ─── Google Map ────────────────────────────────────────────────── */}
            {userLocation && googleMapsLoaded && (
              <div className="rounded-xl overflow-hidden border border-black/8 mb-5 h-[clamp(280px,45vw,440px)]">
                <GoogleMap
                  userLocation={userLocation}
                  listings={filtered}
                  onDirections={getDirections}
                  onOpenMaps={openMaps}
                  isAr={isAr}
                />
              </div>
            )}

            {/* ─── Loading Maps ──────────────────────────────────────────────── */}
            {userLocation && !googleMapsLoaded && (
              <div className="rounded-xl overflow-hidden border border-black/8 mb-5 h-[clamp(280px,45vw,440px)] flex items-center justify-center bg-gray-100">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a1a2e] mx-auto mb-4"></div>
                  <p className="text-sm text-gray-500">{isAr ? "جاري تحميل الخريطة..." : "Loading map..."}</p>
                </div>
              </div>
            )}

            {/* ─── Listing Cards ──────────────────────────────────────────── */}
            {filtered.length > 0 ? (
              <div className="flex flex-col gap-4">
                {filtered.map((l) => {
                  const dist =
                    userLocation && l.coordinates
                      ? haversine(
                          userLocation.lat,
                          userLocation.lng,
                          l.coordinates.lat,
                          l.coordinates.lng
                        ).toFixed(1)
                      : null;
                  return (
                    <div
                      key={l.id}
                      className="flex flex-col sm:flex-row gap-5 bg-white rounded-xl border border-black/7 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="relative sm:w-[200px] sm:min-w-[200px] h-[200px] sm:h-[180px] overflow-hidden">
                        <img
                          src={l.images?.[0] || "/placeholder.jpg"}
                          alt={l.title}
                          className="w-full h-full object-cover transition-transform hover:scale-105"
                        />
                        {dist && (
                          <div className="absolute top-2 right-2 bg-[rgba(26,26,46,.85)] text-[#e8c547] text-[10px] px-2 py-0.5 rounded-full">
                            {dist} {isAr ? "كم" : "km"}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 p-4 sm:p-0 sm:py-4 sm:pr-5 flex flex-col justify-between">
                        <div>
                          <div className="text-base font-medium text-[#111118] mb-1.5">{l.title}</div>
                          <div className="text-[13px] text-gray-400 mb-2.5 flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[#e8c547]">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                            </svg>
                            {l.location}
                          </div>
                          <div className={`${displayFontClass} font-light text-2xl text-[#1a1a2e] mb-3 ${isAr ? "italic" : ""}`}>
                            {l.price} {isAr ? " دينار" : "LYD"}
                            <span className="text-base font-normal not-italic text-[#242323]">
                              / {isAr ? "ليلة" : "night"}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2.5 flex-wrap">
                          <Link
                            to={`/listings/${l.id}`}
                            className="bg-[#1a1a2e] text-[#e8c547] px-5 py-2.5 rounded-lg text-[13px] transition-opacity hover:opacity-90 no-underline"
                          >
                            {isAr ? "عرض التفاصيل" : "view details"} →
                          </Link>
                          {l.coordinates && (
                            <>
                              <button
                                onClick={() => openMaps(l)}
                                className="bg-[#1D9E75] text-white border-none rounded-lg px-5 py-2.5 text-[13px] cursor-pointer flex items-center gap-1.5"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                  <circle cx="12" cy="9" r="3" />
                                </svg>
                                {isAr ? "عرض على الخريطة" : "view on map"}
                              </button>
                              <button
                                onClick={() => getDirections(l)}
                                className="bg-gray-100 text-[#1a1a2e] border border-gray-200 rounded-lg px-5 py-2.5 text-[13px] cursor-pointer flex items-center gap-1.5"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                  <circle cx="12" cy="9" r="3" />
                                </svg>
                                {isAr ? "اتجاهات" : "directions"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 px-8 bg-white rounded-xl border border-black/7">
                <div className={`${displayFontClass} font-light text-2xl text-gray-300 mb-3 ${isAr ? "italic" : ""}`}>
                  {isAr ? "لا توجد أماكن قريبة" : "nothing nearby"}
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  {isAr ? `لا توجد أماكن ضمن ${searchRadius} كم` : `No places within ${searchRadius} km`}
                </p>
                <button
                  onClick={() => filterByDistance(50)}
                  className="bg-none border-none text-[#185FA5] text-[13px] cursor-pointer font-medium"
                >
                  {isAr ? "توسيع إلى 50 كم →" : "expand to 50 km →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── BOOKINGS TAB ──────────────────────────────────────────────────── */}
        {activeTab === "bookings" && (
          <div>
            <div className={`${displayFontClass} font-light text-xl text-[#111118] mb-4 ${isAr ? "italic" : ""}`}>
              {isAr ? "حجوزاتي" : "my bookings"}
            </div>
            {bookings.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white rounded-xl border border-black/7">
                <div className={`${displayFontClass} font-light text-2xl text-gray-300 mb-3 ${isAr ? "italic" : ""}`}>
                  {isAr ? "لا توجد حجوزات بعد" : "no bookings yet"}
                </div>
                <p className="text-[13px] text-gray-400 mb-4">
                  {isAr ? "اكتشف أماكن رائعة للإقامة" : "Discover amazing places to stay"}
                </p>
                <Link
                  to="/listings"
                  className="bg-[#1a1a2e] text-[#e8c547] px-6 py-2.5 rounded-lg text-[13px] inline-block no-underline"
                >
                  {isAr ? "استعرض القوائم →" : "browse listings →"}
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {bookings.map((b) => {
                  const { bg: sBg, c: sC } = statusStyle(b.status);
                  const n = nights(b.check_in, b.check_out);
                  return (
                    <div key={b.id} className="bg-white rounded-xl border border-black/7 p-4 md:p-5">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                        <div className="text-sm font-medium text-[#111118]">
                          {b.listing?.title || (isAr ? "قائمة" : "Listing")}
                        </div>
                        <span
                          className="text-[10px] font-medium tracking-wide uppercase px-2.5 py-0.5 rounded-full"
                          style={{ background: sBg, color: sC }}
                        >
                          {b.status === "confirmed" && (isAr ? "مؤكد" : "confirmed")}
                          {b.status === "pending" && (isAr ? "قيد الانتظار" : "pending")}
                          {b.status === "cancelled" && (isAr ? "ملغي" : "cancelled")}
                          {b.status === "checked_in" && (isAr ? "تم تسجيل الوصول" : "checked in")}
                          {b.status === "checked_out" && (isAr ? "تم تسجيل المغادرة" : "checked out")}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mb-4">{b.listing?.location}</div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        {[
                          { label: isAr ? "تسجيل الوصول" : "check-in", val: fmt(b.check_in) },
                          { label: isAr ? "تسجيل المغادرة" : "check-out", val: fmt(b.check_out) },
                          { label: isAr ? "الليالي" : "nights", val: `${n} ${n === 1 ? (isAr ? "ليلة" : "night") : (isAr ? "ليالي" : "nights")}` },
                          { label: isAr ? "الضيوف" : "guests", val: `${b.guests} ${b.guests === 1 ? (isAr ? "ضيف" : "guest") : (isAr ? "ضيوف" : "guests")}` },
                        ].map(({ label, val }) => (
                          <div key={label}>
                            <div className="text-[10px] tracking-wide uppercase text-gray-300 mb-0.5">{label}</div>
                            <div className="text-xs text-[#111118]">{val}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mb-4">
                        <div className="text-[10px] tracking-wide uppercase text-gray-300 mb-0.5">
                          {isAr ? "المجموع" : "total"}
                        </div>
                        <div className={`${displayFontClass} font-light text-xl text-[#1a1a2e] ${isAr ? "italic" : ""}`}>
                          {b.total_price} {isAr ? " دينار" : "LYD"}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {b.status !== "cancelled" && b.status !== "checked_out" && (
                          <>
                            <Link
                              to={`/listings/${b.listing_id}`}
                              className="bg-[#1a1a2e] text-[#e8c547] px-3.5 py-1.5 rounded-md text-xs no-underline"
                            >
                              {isAr ? "عرض القائمة" : "view listing"}
                            </Link>
                            <button
                              onClick={() => cancelBooking(b.id)}
                              className="bg-none border border-[rgba(163,45,45,.25)] text-[#A32D2D] px-3.5 py-1.5 rounded-md text-xs cursor-pointer"
                            >
                              {isAr ? "إلغاء" : "cancel"}
                            </button>
                          </>
                        )}
                        {b.listing?.coordinates && (
                          <button
                            onClick={() => openMaps(b.listing)}
                            className="bg-[#1D9E75] text-white border-none rounded-md px-3.5 py-1.5 text-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                              <circle cx="12" cy="9" r="3" />
                            </svg>
                            {isAr ? "خريطة" : "maps"}
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-300 mt-3">
                        {isAr ? "تم الحجز" : "booked"} {fmt(b.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}