/** Great-circle distance in kilometres between two lat/lng points. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Lat/lng bounding box that fully contains a circle of `radiusKm` around the point. */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01))
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  }
}

/** Human-friendly distance, deliberately coarse so exact locations aren't revealed. */
export function formatDistance(km: number | null | undefined): string | null {
  if (km === null || km === undefined || Number.isNaN(km)) return null
  if (km < 2) return 'Less than 2 km away'
  if (km < 100) return `${Math.round(km)} km away`
  return `${Math.round(km / 10) * 10} km away`
}
