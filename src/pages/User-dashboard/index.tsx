// src/pages/User-dashboard/index.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../hooks/useLanguage';
import LoadingScreen from '../../components/LoadingScreen';
import Navbar from '../../components/Navbar';
import { apiService } from '../../services/api';

// Types
interface Listing {
  id: string;
  title: string;
  location: string;
  price: number;
  images?: string[];
  coordinates?: { lat: number; lng: number };
  is_active: boolean;
}

interface Booking {
  id: string;
  listing_id: string;
  listing?: Listing;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  status: 'confirmed' | 'pending' | 'cancelled';
  created_at?: string;
  createdAt?: string;
}

// ── helpers ──
const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const nights = (a: string, b: string) => Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

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

// Avatar palette
const AVATAR_PAL = [
  { bg: '#EEEDFE', c: '#3C3489' },
  { bg: '#E6F1FB', c: '#0C447C' },
  { bg: '#EAF3DE', c: '#27500A' },
  { bg: '#FAEEDA', c: '#633806' },
  { bg: '#E1F5EE', c: '#085041' },
  { bg: '#FBEAF0', c: '#72243E' },
];

const avi = (name: string) => AVATAR_PAL[(name?.charCodeAt(0) ?? 0) % AVATAR_PAL.length];
const initials = (name: string) =>
  name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '';

const statusStyle = (s: string) =>
  ({
    confirmed: { bg: '#EAF3DE', c: '#27500A' },
    pending: { bg: '#FAEEDA', c: '#633806' },
    cancelled: { bg: '#FCEBEB', c: '#791F1F' },
  })[s] ?? { bg: '#F1EFE8', c: '#444' };

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { lang, toggleLanguage } = useLanguage();
  const isAr = lang === 'ar';

  const [listings, setListings] = useState<Listing[]>([]);
  const [filtered, setFiltered] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState(10);
  const [mapCenter, setMapCenter] = useState({ lat: 51.505, lng: -0.09 });
  const [activeTab, setActiveTab] = useState('nearby');

  // Check authentication
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Fetch data
  useEffect(() => {
    if (isAuthenticated && user) {
      getUserLocation();
      fetchListings();
      fetchBookings();
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const getUserLocation = () => {
    if (!('geolocation' in navigator)) {
      setUserLocation({ lat: 51.505, lng: -0.09 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        setUserLocation({ lat, lng });
        setMapCenter({ lat, lng });
      },
      () => setUserLocation({ lat: 51.505, lng: -0.09 }),
    );
  };

  const fetchListings = async () => {
  try {
    const response = await apiService.getProtectedData<{ listings: Listing[] }>('/api/listings');
    if (response.success && response.data) {
      // Handle both response formats: { listings: [...] } or just [...]
      const allListings = Array.isArray(response.data) 
        ? response.data 
        : response.data.listings || [];
      const active = allListings.filter((l: Listing) => l.is_active !== false);
      setListings(active);
      setFiltered(active);
    } else {
      console.error('Failed to fetch listings:', response.message);
    }
  } catch (error) {
    console.error('Error fetching listings:', error);
  }
};

const fetchBookings = async () => {
  try {
    const response = await apiService.getProtectedData<{ bookings: Booking[] }>('/api/bookings');
    if (response.success && response.data) {
      // Handle both response formats
      const bookingsData = Array.isArray(response.data) 
        ? response.data 
        : response.data.bookings || [];
      setBookings(bookingsData);
    } else {
      console.error('Failed to fetch bookings:', response.message);
    }
  } catch (error) {
    console.error('Error fetching bookings:', error);
  }
};

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
            l.coordinates.lng,
          ) <= radius,
      ),
    );
    setSearchRadius(radius);
  };

  const openMaps = (l: Listing) => {
    if (l.coordinates) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${l.coordinates.lat},${l.coordinates.lng}`,
        '_blank',
      );
    }
  };

  const getDirections = (l: Listing) => {
    if (!userLocation) {
      alert(
        isAr
          ? 'قم بتفعيل خدمات الموقع أولاً'
          : 'Enable location services first',
      );
      return;
    }
    if (l.coordinates) {
      window.open(
        `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${l.coordinates.lat},${l.coordinates.lng}`,
        '_blank',
      );
    }
  };

  const cancelBooking = async (id: string) => {
    if (!confirm(isAr ? 'هل تريد إلغاء هذا الحجز؟' : 'Cancel this booking?'))
      return;
    try {
      const response = await apiService.putProtectedData(`/api/bookings/${id}`, {
        action: 'cancel',
      });
      if (response.success) {
        fetchBookings();
      }
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      alert(error instanceof Error ? error.message : 'Failed to cancel booking');
    }
  };

  if (authLoading || loading) return <LoadingScreen />;
  if (!isAuthenticated || !user) return null;

  const { bg: aviBg, c: aviColor } = avi(user.name);
  const ini = initials(user.name);

  const TABS = [
    { id: 'nearby', label: isAr ? 'الأماكن القريبة' : 'Nearby Places' },
    { id: 'bookings', label: `${isAr ? 'الحجوزات' : 'Bookings'} (${bookings.length})` },
    { id: 'listings', label: isAr ? 'تصفح العقارات' : 'Browse Listings', href: '/listings' },
  ];

  const displayFontClass = isAr
    ? "font-['Cairo','Tajawal',sans-serif]"
    : "font-['Fraunces',serif]";
  const bodyFontClass = isAr
    ? "font-['Cairo','Tajawal',sans-serif]"
    : "font-['DM_Mono',monospace]";

  const userInitials = user?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'H';

  return (
    <div className={`min-h-screen bg-[#f7f6f2] ${isAr ? 'rtl' : 'ltr'} ${bodyFontClass}`}>
      <Navbar
        NAV_LINKS={TABS}
        user={user}
        lang={lang}
        toggleLanguage={toggleLanguage}
        onTabChange={(tabId: string) => setActiveTab(tabId)}
      />

      <main className="max-w-[1200px] mx-auto p-4 md:p-6">
        {/* Profile strip */}
        <div className="bg-white rounded-xl border border-black/7 p-4 md:p-5 mb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-medium"
              style={{ background: aviBg, color: aviColor }}
            >
              {ini}
            </div>
            <div>
              <div className={`${displayFontClass} font-light text-xl text-[#111118] leading-tight ${isAr ? 'italic' : ''}`}>
                {user.name}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {isAr ? 'عضو منذ' : 'member since'} {fmt(user.created_at || user.createdAt || new Date().toISOString())}
              </div>
            </div>
          </div>
          <div className="flex gap-5 flex-wrap">
            {[
              { l: isAr ? 'الحجوزات' : 'bookings', v: bookings.length },
              { l: isAr ? 'القريبة' : 'nearby', v: filtered.length },
            ].map(({ l, v }) => (
              <div key={l} className={isAr ? 'text-left' : 'text-right'}>
                <div className={`${displayFontClass} font-light text-2xl text-[#111118] leading-tight ${isAr ? 'italic' : ''}`}>
                  {v}
                </div>
                <div className="text-[10px] tracking-wide uppercase text-gray-300 mt-0.5">
                  {l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── NEARBY TAB ── */}
        {activeTab === 'nearby' && (
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2.5 mb-4">
              <div className={`${displayFontClass} font-light text-xl text-[#111118] ${isAr ? 'italic' : ''}`}>
                {isAr ? 'الأماكن القريبة' : 'nearby places'}
                <span className="text-[13px] font-normal not-italic text-gray-400 ml-2">
                  ({filtered.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] tracking-wide uppercase text-gray-400">
                  {isAr ? 'نصف القطر' : 'radius'}
                </label>
                <select
                  onChange={(e) => filterByDistance(parseInt(e.target.value))}
                  value={searchRadius}
                  className="px-2.5 py-1.5 bg-[#fafaf8] border border-black/12 rounded-md text-xs outline-none"
                >
                  {[5, 10, 20, 50, 100].map((v) => (
                    <option key={v} value={v}>
                      {v} {isAr ? 'كم' : 'km'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Map placeholder */}
            <div className="rounded-xl overflow-hidden border border-black/8 mb-5 h-[clamp(280px,45vw,440px)] bg-gray-200 flex items-center justify-center">
              <p className="text-gray-500">
                {isAr ? 'خريطة الأماكن القريبة' : 'Nearby Places Map'}
                <br />
                <span className="text-xs">
                  {isAr ? '(يتم تحميل الخريطة...)' : '(Loading map...)'}
                </span>
              </p>
            </div>

            {/* Listing cards */}
            {filtered.length > 0 ? (
              <div className="flex flex-col gap-4">
                {filtered.map((l) => {
                  const dist =
                    userLocation && l.coordinates
                      ? haversine(
                          userLocation.lat,
                          userLocation.lng,
                          l.coordinates.lat,
                          l.coordinates.lng,
                        ).toFixed(1)
                      : null;
                  return (
                    <div
                      key={l.id}
                      className="flex flex-col sm:flex-row gap-5 bg-white rounded-xl border border-black/7 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="relative sm:w-[200px] sm:min-w-[200px] h-[200px] sm:h-[180px] overflow-hidden">
                        <img
                          src={l.images?.[0] || '/placeholder.jpg'}
                          alt={l.title}
                          className="w-full h-full object-cover transition-transform hover:scale-105"
                        />
                        {dist && (
                          <div className="absolute top-2 right-2 bg-[rgba(26,26,46,.85)] text-[#e8c547] text-[10px] px-2 py-0.5 rounded-full">
                            {dist} {isAr ? 'كم' : 'km'}
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
                          <div className={`${displayFontClass} font-light text-2xl text-[#1a1a2e] mb-3 ${isAr ? 'italic' : ''}`}>
                            {l.price} {isAr ? ' دينار' : 'LYD'}
                            <span className="text-base font-normal not-italic text-[#242323]">
                              / {isAr ? 'ليلة' : 'night'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2.5 flex-wrap">
                          <Link
                            to={`/listings/${l.id}`}
                            className="bg-[#1a1a2e] text-[#e8c547] px-5 py-2.5 rounded-lg text-[13px] transition-opacity hover:opacity-90"
                          >
                            {isAr ? 'عرض التفاصيل' : 'view details'} →
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
                                {isAr ? 'عرض على الخريطة' : 'view on map'}
                              </button>
                              <button
                                onClick={() => getDirections(l)}
                                className="bg-gray-100 text-[#1a1a2e] border border-gray-200 rounded-lg px-5 py-2.5 text-[13px] cursor-pointer flex items-center gap-1.5"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                  <circle cx="12" cy="9" r="3" />
                                </svg>
                                {isAr ? 'اتجاهات' : 'directions'}
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
                <div className={`${displayFontClass} font-light text-2xl text-gray-300 mb-3 ${isAr ? 'italic' : ''}`}>
                  {isAr ? 'لا توجد أماكن قريبة' : 'nothing nearby'}
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  {isAr ? `لا توجد أماكن ضمن ${searchRadius} كم` : `No places within ${searchRadius} km`}
                </p>
                <button
                  onClick={() => filterByDistance(50)}
                  className="bg-none border-none text-[#185FA5] text-[13px] cursor-pointer font-medium"
                >
                  {isAr ? 'توسيع إلى 50 كم →' : 'expand to 50 km →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── BOOKINGS TAB ── */}
        {activeTab === 'bookings' && (
          <div>
            <div className={`${displayFontClass} font-light text-xl text-[#111118] mb-4 ${isAr ? 'italic' : ''}`}>
              {isAr ? 'حجوزاتي' : 'my bookings'}
            </div>
            {bookings.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white rounded-xl border border-black/7">
                <div className={`${displayFontClass} font-light text-2xl text-gray-300 mb-3 ${isAr ? 'italic' : ''}`}>
                  {isAr ? 'لا توجد حجوزات بعد' : 'no bookings yet'}
                </div>
                <p className="text-[13px] text-gray-400 mb-4">
                  {isAr ? 'اكتشف أماكن رائعة للإقامة' : 'Discover amazing places to stay'}
                </p>
                <Link
                  to="/listings"
                  className="bg-[#1a1a2e] text-[#e8c547] px-6 py-2.5 rounded-lg text-[13px] inline-block"
                >
                  {isAr ? 'استعرض القوائم →' : 'browse listings →'}
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
                          {b.listing?.title || (isAr ? 'قائمة' : 'Listing')}
                        </div>
                        <span
                          className="text-[10px] font-medium tracking-wide uppercase px-2.5 py-0.5 rounded-full"
                          style={{ background: sBg, color: sC }}
                        >
                          {b.status === 'confirmed' && (isAr ? 'مؤكد' : 'confirmed')}
                          {b.status === 'pending' && (isAr ? 'قيد الانتظار' : 'pending')}
                          {b.status === 'cancelled' && (isAr ? 'ملغي' : 'cancelled')}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mb-4">{b.listing?.location}</div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        {[
                          { label: isAr ? 'تسجيل الوصول' : 'check-in', val: fmt(b.check_in) },
                          { label: isAr ? 'تسجيل المغادرة' : 'check-out', val: fmt(b.check_out) },
                          { label: isAr ? 'الليالي' : 'nights', val: `${n} ${n === 1 ? (isAr ? 'ليلة' : 'night') : (isAr ? 'ليالي' : 'nights')}` },
                          { label: isAr ? 'الضيوف' : 'guests', val: `${b.guests} ${b.guests === 1 ? (isAr ? 'ضيف' : 'guest') : (isAr ? 'ضيوف' : 'guests')}` },
                        ].map(({ label, val }) => (
                          <div key={label}>
                            <div className="text-[10px] tracking-wide uppercase text-gray-300 mb-0.5">{label}</div>
                            <div className="text-xs text-[#111118]">{val}</div>
                          </div>
                        ))}
                      </div>

                      <div>
                        <div className="text-[10px] tracking-wide uppercase text-gray-300 mb-0.5">
                          {isAr ? 'المجموع' : 'total'}
                        </div>
                        <div className={`${displayFontClass} font-light text-xl text-[#1a1a2e] ${isAr ? 'italic' : ''}`}>
                          {b.total_price} {isAr ? ' دينار' : 'LYD'}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap mt-4">
                        {b.status !== 'cancelled' && (
                          <>
                            <Link
                              to={`/listings/${b.listing_id}`}
                              className="bg-[#1a1a2e] text-[#e8c547] px-3.5 py-1.5 rounded-md text-xs"
                            >
                              {isAr ? 'عرض القائمة' : 'view listing'}
                            </Link>
                            <button
                              onClick={() => cancelBooking(b.id)}
                              className="bg-none border border-[rgba(163,45,45,.25)] text-[#A32D2D] px-3.5 py-1.5 rounded-md text-xs cursor-pointer"
                            >
                              {isAr ? 'إلغاء' : 'cancel'}
                            </button>
                          </>
                        )}
                        {b.listing?.coordinates && (
                          <button
                            onClick={() => openMaps(b.listing!)}
                            className="bg-[#1D9E75] text-white border-none rounded-md px-3.5 py-1.5 text-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                              <circle cx="12" cy="9" r="3" />
                            </svg>
                            {isAr ? 'خريطة' : 'maps'}
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-300 mt-3">
                        {isAr ? 'تم الحجز' : 'booked'} {fmt(b.created_at || b.createdAt || new Date().toISOString())}
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