export interface Ship {
  id: string;
  name: string;
  position: [number, number]; // [lng, lat]
  heading: number;
  speed: number;
  destination: string;
  destinationCoords: [number, number]; // 목적지 좌표
  status: 'normal' | 'warning' | 'emergency';
  estimatedArrival: string; // 예상 도착 시간
  route?: [number, number][]; // 예상 경로
  optimization_mode?: 'flexible' | 'fixed'; // 경로 최적화 모드
}

export interface Port {
  name: string;
  coordinates: [number, number];
}

export interface CongestionZone {
  id: string;
  bounds: [[number, number], [number, number]]; // SW, NE corners
  congestionLevel: number; // 0-100
  shipCount: number;
}