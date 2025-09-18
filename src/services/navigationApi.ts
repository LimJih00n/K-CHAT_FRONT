import type { Ship } from '../types/ship';

// Backend API URL
const API_BASE_URL = 'http://localhost:8000/api';

// Coordinate conversion utilities
const GURYONGPO_CENTER = { lat: 35.9940, lng: 129.5560 };
const PIXEL_BOUNDS = { width: 2000, height: 1400 };
const DEGREES_PER_PIXEL = 0.00001; // Approximate scale

export const convertLatLngToPixel = (latLng: [number, number]): [number, number] => {
  const [lng, lat] = latLng;

  // Convert relative to Guryongpo center
  const deltaLng = lng - GURYONGPO_CENTER.lng;
  const deltaLat = lat - GURYONGPO_CENTER.lat;

  // Convert to pixels (approximate)
  const x = (deltaLng / DEGREES_PER_PIXEL) + PIXEL_BOUNDS.width / 2;
  const y = PIXEL_BOUNDS.height / 2 - (deltaLat / DEGREES_PER_PIXEL);

  return [Math.round(x), Math.round(y)];
};

export const convertPixelToLatLng = (pixel: [number, number]): [number, number] => {
  const [x, y] = pixel;

  // Convert from pixel to degrees
  const deltaLng = (x - PIXEL_BOUNDS.width / 2) * DEGREES_PER_PIXEL;
  const deltaLat = (PIXEL_BOUNDS.height / 2 - y) * DEGREES_PER_PIXEL;

  // Add to center coordinates
  const lng = GURYONGPO_CENTER.lng + deltaLng;
  const lat = GURYONGPO_CENTER.lat + deltaLat;

  return [lng, lat];
};

// API Types
export interface RouteRequest {
  ship_id: string;
  start_position: [number, number];
  goal_position: [number, number];
  departure_time: number;
  speed_knots: number;
}

export interface RouteResponse {
  ship_id: string;
  recommended_departure: number;
  arrival_time: number;
  path_points: [number, number][];
  segments: RouteSegment[];
  total_distance_nm: number;
  total_duration_minutes: number;
  optimization_type: string;
  time_saved_minutes?: number;
  detour_distance_nm?: number;
}

export interface RouteSegment {
  start_point: [number, number];
  end_point: [number, number];
  speed_knots: number;
  duration_minutes: number;
  distance_nm: number;
}

export interface RouteAcceptance {
  ship_id: string;
  accept: boolean;
}

export interface RouteStatus {
  ship_id: string;
  status: string;
  current_position?: [number, number];
  departure_time: number;
  arrival_time: number;
  path_points: [number, number][];
  optimization_mode: string;
}

// API Functions
export const navigationApi = {
  // Plan optimal route for a ship
  async planRoute(ship: Ship, departureTime: number = 0): Promise<RouteResponse> {
    const request: RouteRequest = {
      ship_id: ship.id,
      start_position: convertLatLngToPixel(ship.position),
      goal_position: convertLatLngToPixel(ship.destinationCoords),
      departure_time: departureTime,
      speed_knots: ship.speed
    };

    const response = await fetch(`${API_BASE_URL}/route/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error('Failed to plan route');
    }

    const data: RouteResponse = await response.json();

    // Convert pixel coordinates back to lat/lng for display
    data.path_points = data.path_points.map(point => convertPixelToLatLng(point));

    return data;
  },

  // Accept or reject recommended departure time
  async acceptRoute(shipId: string, accept: boolean): Promise<RouteResponse> {
    const acceptance: RouteAcceptance = {
      ship_id: shipId,
      accept: accept
    };

    const response = await fetch(`${API_BASE_URL}/route/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(acceptance)
    });

    if (!response.ok) {
      throw new Error('Failed to accept/reject route');
    }

    const data: RouteResponse = await response.json();

    // Convert coordinates if path_points exists
    if (data.path_points) {
      data.path_points = data.path_points.map(point => convertPixelToLatLng(point));
    }

    return data;
  },

  // Get all ships status
  async getAllShips(): Promise<RouteStatus[]> {
    const response = await fetch(`${API_BASE_URL}/ships`);

    if (!response.ok) {
      throw new Error('Failed to fetch ships');
    }

    const ships: RouteStatus[] = await response.json();

    // Convert coordinates for each ship
    return ships.map(ship => ({
      ...ship,
      current_position: ship.current_position ?
        convertPixelToLatLng(ship.current_position) : undefined,
      path_points: ship.path_points.map(point => convertPixelToLatLng(point))
    }));
  },

  // Get specific ship status
  async getShipStatus(shipId: string): Promise<RouteStatus> {
    const response = await fetch(`${API_BASE_URL}/ship/${shipId}`);

    if (!response.ok) {
      throw new Error('Ship not found');
    }

    const ship: RouteStatus = await response.json();

    return {
      ...ship,
      current_position: ship.current_position ?
        convertPixelToLatLng(ship.current_position) : undefined,
      path_points: ship.path_points.map(point => convertPixelToLatLng(point))
    };
  },

  // Delete ship from system
  async deleteShip(shipId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/ship/${shipId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete ship');
    }
  },

  // Get real-time ship locations from EUM API
  async getRealtimeLocations(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/eum/realtime`);

    if (!response.ok) {
      throw new Error('Failed to fetch real-time locations');
    }

    return response.json();
  }
};