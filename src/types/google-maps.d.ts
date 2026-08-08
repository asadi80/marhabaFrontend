/// <reference types="@types/google.maps" />

declare global {
  interface Window {
    google: typeof google;
    handleDirections: (listingId: number) => void;
  }
}

export {};