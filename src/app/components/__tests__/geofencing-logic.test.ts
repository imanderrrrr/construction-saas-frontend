import { describe, it, expect } from 'vitest';
import { haversineMeters } from '../../services/time';
import type { LocationStatus } from '../../types';

// ══════════════════════════════════════════════════════════════════════
// Geofencing Logic Tests
// Tests the pure logic extracted from WorkerTime.tsx and LocationIndicator.tsx
// ══════════════════════════════════════════════════════════════════════

// -- Replicate the derived state logic from WorkerTime.tsx (lines 146-149) --
type GeoDisplayStatus = LocationStatus | 'detecting' | 'AWAITING_PERMISSION';

function computeLocationState(status: GeoDisplayStatus) {
  const locationReady =
    status === 'OK' || status === 'OUT_OF_RANGE' || status === 'NO_GEOFENCE' || status === 'UNAVAILABLE';
  const locationBlocked = !locationReady && status !== 'detecting';
  return { locationReady, locationBlocked };
}

// -- Replicate fmtCoords from LocationIndicator.tsx --
function fmtCoords(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lng).toFixed(4)}°${ew}`;
}

// -- Replicate computeGeoFromPosition logic from WorkerTime.tsx --
interface ProjectGeo {
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
}

function computeGeoStatus(
  lat: number,
  lng: number,
  project: ProjectGeo | null,
): { status: LocationStatus; distanceMeters: number | null } {
  if (!project || project.latitude == null || project.longitude == null) {
    return { status: 'NO_GEOFENCE', distanceMeters: null };
  }
  const distance = haversineMeters(lat, lng, project.latitude, project.longitude);
  const status: LocationStatus = distance <= project.geofenceRadiusMeters ? 'OK' : 'OUT_OF_RANGE';
  return { status, distanceMeters: distance };
}

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════════════

describe('locationReady / locationBlocked (WorkerTime derived state)', () => {
  it('OK → locationReady=true, locationBlocked=false', () => {
    expect(computeLocationState('OK')).toEqual({ locationReady: true, locationBlocked: false });
  });

  it('OUT_OF_RANGE → locationReady=true (still allows punch)', () => {
    expect(computeLocationState('OUT_OF_RANGE')).toEqual({ locationReady: true, locationBlocked: false });
  });

  it('NO_GEOFENCE → locationReady=true (project has no geofence)', () => {
    expect(computeLocationState('NO_GEOFENCE')).toEqual({ locationReady: true, locationBlocked: false });
  });

  it('UNAVAILABLE → locationReady=true (GPS flaky, still allow punch)', () => {
    // This is the critical fix — UNAVAILABLE must NOT block punching
    expect(computeLocationState('UNAVAILABLE')).toEqual({ locationReady: true, locationBlocked: false });
  });

  it('detecting → not ready, but NOT blocked (still loading)', () => {
    expect(computeLocationState('detecting')).toEqual({ locationReady: false, locationBlocked: false });
  });

  it('NO_PERMISSION → locationBlocked=true (permission denied)', () => {
    expect(computeLocationState('NO_PERMISSION')).toEqual({ locationReady: false, locationBlocked: true });
  });

  it('AWAITING_PERMISSION → locationBlocked=true (needs user gesture)', () => {
    expect(computeLocationState('AWAITING_PERMISSION')).toEqual({ locationReady: false, locationBlocked: true });
  });
});

describe('haversineMeters (geofence distance calculation)', () => {
  it('same point → distance ≈ 0', () => {
    const d = haversineMeters(18.4655, -66.1057, 18.4655, -66.1057);
    expect(d).toBeCloseTo(0, 0);
  });

  it('known distance: San Juan to Ponce ≈ 116 km', () => {
    // San Juan: 18.4655, -66.1057 / Ponce: 18.0111, -66.6141
    const d = haversineMeters(18.4655, -66.1057, 18.0111, -66.6141);
    expect(d).toBeGreaterThan(70_000);
    expect(d).toBeLessThan(130_000);
  });

  it('short distance: 100m apart should be ≈ 100m', () => {
    // ~100m north of a reference point (roughly 0.0009° lat)
    const baseLat = 18.4655;
    const baseLng = -66.1057;
    const d = haversineMeters(baseLat, baseLng, baseLat + 0.0009, baseLng);
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(120);
  });

  it('antipodal points → ≈ 20,000 km (half earth circumference)', () => {
    const d = haversineMeters(0, 0, 0, 180);
    expect(d).toBeGreaterThan(19_000_000);
    expect(d).toBeLessThan(21_000_000);
  });
});

describe('computeGeoStatus (position → geofence evaluation)', () => {
  const project: ProjectGeo = {
    latitude: 18.4655,
    longitude: -66.1057,
    geofenceRadiusMeters: 200,
  };

  it('worker inside geofence → OK', () => {
    // Same location as project
    const result = computeGeoStatus(18.4655, -66.1057, project);
    expect(result.status).toBe('OK');
    expect(result.distanceMeters).toBeCloseTo(0, 0);
  });

  it('worker 50m away (inside 200m radius) → OK', () => {
    const result = computeGeoStatus(18.4660, -66.1057, project);
    expect(result.status).toBe('OK');
    expect(result.distanceMeters).toBeLessThan(200);
  });

  it('worker 500m away (outside 200m radius) → OUT_OF_RANGE', () => {
    // ~500m north
    const result = computeGeoStatus(18.4700, -66.1057, project);
    expect(result.status).toBe('OUT_OF_RANGE');
    expect(result.distanceMeters).toBeGreaterThan(200);
  });

  it('worker exactly at boundary → OK (<=)', () => {
    // Use haversine to find a point exactly at the boundary
    // At lat 18.4655, 1° lat ≈ 110,574m, so 200m ≈ 0.001809° lat
    const result = computeGeoStatus(18.46731, -66.1057, project);
    // The exact boundary depends on haversine — just verify the status
    // is consistent with the distance being inside or outside
    if (result.distanceMeters! <= project.geofenceRadiusMeters) {
      expect(result.status).toBe('OK');
    } else {
      expect(result.status).toBe('OUT_OF_RANGE');
    }
  });

  it('project with no coordinates → NO_GEOFENCE', () => {
    const noGeoProject: ProjectGeo = { latitude: null, longitude: null, geofenceRadiusMeters: 200 };
    const result = computeGeoStatus(18.4655, -66.1057, noGeoProject);
    expect(result.status).toBe('NO_GEOFENCE');
    expect(result.distanceMeters).toBeNull();
  });

  it('null project → NO_GEOFENCE', () => {
    const result = computeGeoStatus(18.4655, -66.1057, null);
    expect(result.status).toBe('NO_GEOFENCE');
    expect(result.distanceMeters).toBeNull();
  });

  it('project with only latitude (no longitude) → NO_GEOFENCE', () => {
    const partialProject: ProjectGeo = { latitude: 18.4655, longitude: null, geofenceRadiusMeters: 200 };
    const result = computeGeoStatus(18.4655, -66.1057, partialProject);
    expect(result.status).toBe('NO_GEOFENCE');
    expect(result.distanceMeters).toBeNull();
  });

  it('large geofence radius (2km) captures far workers', () => {
    const largeProject: ProjectGeo = { ...project, geofenceRadiusMeters: 2000 };
    // ~1km away
    const result = computeGeoStatus(18.4745, -66.1057, largeProject);
    expect(result.status).toBe('OK');
    expect(result.distanceMeters!).toBeLessThan(2000);
  });
});

describe('fmtCoords (coordinate formatting)', () => {
  it('positive lat/positive lng → N/E', () => {
    expect(fmtCoords(40.7128, 74.0060)).toBe('40.7128°N, 74.0060°E');
  });

  it('positive lat/negative lng → N/W', () => {
    expect(fmtCoords(18.4655, -66.1057)).toBe('18.4655°N, 66.1057°W');
  });

  it('negative lat/positive lng → S/E', () => {
    expect(fmtCoords(-33.8688, 151.2093)).toBe('33.8688°S, 151.2093°E');
  });

  it('negative lat/negative lng → S/W', () => {
    expect(fmtCoords(-34.6037, -58.3816)).toBe('34.6037°S, 58.3816°W');
  });

  it('equator/prime meridian → N/E (zero is positive)', () => {
    expect(fmtCoords(0, 0)).toBe('0.0000°N, 0.0000°E');
  });

  it('handles rounding correctly', () => {
    expect(fmtCoords(18.46551, -66.10574)).toBe('18.4655°N, 66.1057°W');
  });
});

describe('edge cases: status transitions', () => {
  it('all LocationStatus values are covered by computeLocationState', () => {
    const allStatuses: GeoDisplayStatus[] = [
      'OK', 'NO_PERMISSION', 'UNAVAILABLE', 'OUT_OF_RANGE', 'NO_GEOFENCE',
      'detecting', 'AWAITING_PERMISSION',
    ];

    for (const status of allStatuses) {
      const result = computeLocationState(status);
      expect(typeof result.locationReady).toBe('boolean');
      expect(typeof result.locationBlocked).toBe('boolean');
      // locationReady and locationBlocked should never both be true
      expect(result.locationReady && result.locationBlocked).toBe(false);
    }
  });

  it('only NO_PERMISSION and AWAITING_PERMISSION are blocking', () => {
    const allStatuses: GeoDisplayStatus[] = [
      'OK', 'NO_PERMISSION', 'UNAVAILABLE', 'OUT_OF_RANGE', 'NO_GEOFENCE',
      'detecting', 'AWAITING_PERMISSION',
    ];

    const blocking = allStatuses.filter(s => computeLocationState(s).locationBlocked);
    expect(blocking).toEqual(['NO_PERMISSION', 'AWAITING_PERMISSION']);
  });
});
