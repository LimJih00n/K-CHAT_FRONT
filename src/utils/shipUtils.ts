import type { Ship } from '../types/ship';

// Port 인터페이스 정의
interface Port {
  name: string;
  coordinates: [number, number];
}

// 포트 정보
export const PORTS: { [key: string]: Port } = {
  '울릉도': { name: '울릉도', coordinates: [130.9057, 37.4844] },
  '부산항': { name: '부산항', coordinates: [129.0756, 35.1796] },
  '포항항': { name: '포항항', coordinates: [129.3832, 36.0322] },
  '속초항': { name: '속초항', coordinates: [128.5918, 38.2070] },
  '감포항': { name: '감포항', coordinates: [129.5038, 35.8915] },
  '구룡포': { name: '구룡포', coordinates: [129.5554, 35.9896] }  // 정확한 구룡포항 좌표
};

// 두 지점 사이의 경로 생성 (베지어 곡선)
export function generateRoute(start: [number, number], end: [number, number]): [number, number][] {
  const points: [number, number][] = [];
  const steps = 50;

  // 중간 제어점 계산 (곡선 경로를 위해)
  const midLng = (start[0] + end[0]) / 2;
  const midLat = (start[1] + end[1]) / 2;

  // 경로를 약간 휘게 만들기 위한 오프셋
  const offset = 0.02 * (Math.random() - 0.5);
  const controlPoint: [number, number] = [
    midLng + offset,
    midLat + offset
  ];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lng = Math.pow(1 - t, 2) * start[0] +
                2 * (1 - t) * t * controlPoint[0] +
                Math.pow(t, 2) * end[0];
    const lat = Math.pow(1 - t, 2) * start[1] +
                2 * (1 - t) * t * controlPoint[1] +
                Math.pow(t, 2) * end[1];
    points.push([lng, lat]);
  }

  return points;
}

// 시간에 따른 선박 위치 계산
export function calculateShipPosition(
  ship: Ship,
  timeOffset: number // 시간 (분)
): [number, number] {
  if (!ship.route || ship.route.length < 2) {
    return ship.position;
  }

  // 속도를 기반으로 이동 거리 계산 (간단한 구현)
  const speedKmPerMin = (ship.speed * 1.852) / 60; // knots to km/min
  const totalDistance = speedKmPerMin * timeOffset;

  // 경로상에서 위치 찾기
  let accumulatedDistance = 0;
  for (let i = 0; i < ship.route.length - 1; i++) {
    const segmentDistance = getDistance(ship.route[i], ship.route[i + 1]);

    if (accumulatedDistance + segmentDistance >= totalDistance) {
      // 현재 세그먼트에서 위치 계산
      const ratio = (totalDistance - accumulatedDistance) / segmentDistance;
      return interpolatePosition(ship.route[i], ship.route[i + 1], ratio);
    }

    accumulatedDistance += segmentDistance;
  }

  // 목적지에 도착
  return ship.route[ship.route.length - 1];
}

// 두 좌표 사이의 거리 계산 (km)
function getDistance(coord1: [number, number], coord2: [number, number]): number {
  const R = 6371; // 지구 반경 (km)
  const dLat = toRad(coord2[1] - coord1[1]);
  const dLon = toRad(coord2[0] - coord1[0]);
  const lat1 = toRad(coord1[1]);
  const lat2 = toRad(coord2[1]);

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// 두 위치 사이를 보간
function interpolatePosition(
  start: [number, number],
  end: [number, number],
  ratio: number
): [number, number] {
  return [
    start[0] + (end[0] - start[0]) * ratio,
    start[1] + (end[1] - start[1]) * ratio
  ];
}

// 구역별 혼잡도 계산
export function calculateCongestion(
  ships: Ship[],
  bounds: [[number, number], [number, number]],
  timeOffset: number = 0
): number {
  // 시간에 따른 선박 위치 계산
  const shipsInBounds = ships.filter(ship => {
    const position = calculateShipPosition(ship, timeOffset);
    return position[0] >= bounds[0][0] && position[0] <= bounds[1][0] &&
           position[1] >= bounds[0][1] && position[1] <= bounds[1][1];
  });

  // 혼잡도 계산 (선박 수에 따라)
  const shipCount = shipsInBounds.length;

  // 더 민감한 혼잡도 계산
  if (shipCount === 0) return 0;
  if (shipCount === 1) return 20;
  if (shipCount === 2) return 40;
  if (shipCount === 3) return 60;
  if (shipCount === 4) return 80;
  if (shipCount >= 5) return 100;

  return 0;
}