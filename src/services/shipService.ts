import type { Ship } from '../types/ship';
import { PORTS } from '../utils/shipUtils';
import { generateRoute } from '../utils/shipUtils';
import { navigationApi } from './navigationApi';
import type { RouteStatus } from './navigationApi';
import shipsData from '../data/ships.json';

interface ShipData {
  id: string;
  name: string;
  position: [number, number];
  heading: number;
  speed: number;
  destination: string;
  status: 'normal' | 'warning' | 'emergency';
  estimatedArrival: string;
}

// JSON 데이터를 Ship 타입으로 변환
const transformShipData = (shipData: ShipData): Ship => {
  const destinationPort = PORTS[shipData.destination];
  const destinationCoords = destinationPort ? destinationPort.coordinates : shipData.position;

  return {
    id: shipData.id,
    name: shipData.name,
    position: shipData.position,
    heading: shipData.heading,
    speed: shipData.speed,
    destination: shipData.destination,
    status: shipData.status,
    estimatedArrival: shipData.estimatedArrival,
    destinationCoords,
    route: generateRoute(shipData.position, destinationCoords)
  };
};

// 선박 데이터 로드 - Backend API와 로컬 데이터 병합
export const loadShips = async (useBackend: boolean = false): Promise<Ship[]> => {
  try {
    if (useBackend) {
      // Backend API에서 경로가 계획된 선박 가져오기
      try {
        const backendShips = await navigationApi.getAllShips();

        // Backend 데이터를 Ship 타입으로 변환
        const shipsFromBackend: Ship[] = backendShips.map((routeStatus: RouteStatus) => {
          // 경로의 시작점과 끝점에서 위치 정보 추출
          const startPos = routeStatus.path_points[0] || [129.5560, 35.9940];
          const endPos = routeStatus.path_points[routeStatus.path_points.length - 1] || [129.5560, 35.9940];

          return {
            id: routeStatus.ship_id,
            name: routeStatus.ship_id, // Backend에서 name이 없으므로 ID 사용
            position: routeStatus.current_position || startPos,
            heading: 0, // 계산 필요
            speed: 12, // 기본값
            destination: '구룡포', // 기본값
            destinationCoords: endPos,
            status: routeStatus.status === 'active' ? 'normal' :
                   routeStatus.status === 'pending' ? 'warning' : 'normal',
            estimatedArrival: `${Math.round(routeStatus.arrival_time)}분`,
            route: routeStatus.path_points,
            optimization_mode: routeStatus.optimization_mode
          } as Ship;
        });

        // 로컬 데이터와 병합 (중복 제거)
        const localShips = shipsData.ships.map(transformShipData);
        const backendIds = new Set(shipsFromBackend.map(s => s.id));
        const nonDuplicateLocal = localShips.filter(s => !backendIds.has(s.id));

        return [...shipsFromBackend, ...nonDuplicateLocal];
      } catch (backendError) {
        console.warn('Backend API not available, using local data:', backendError);
        // Backend 실패시 로컬 데이터만 사용
        return shipsData.ships.map(transformShipData);
      }
    } else {
      // 로컬 데이터만 사용
      return shipsData.ships.map(transformShipData);
    }
  } catch (error) {
    console.error('Failed to load ships:', error);
    return [];
  }
};

// 실시간 선박 데이터 업데이트 (WebSocket 또는 폴링)
export const subscribeToShipUpdates = (callback: (ships: Ship[]) => void, useBackend: boolean = false) => {
  // Backend API 사용시 더 자주 업데이트 (3초)
  const updateInterval = useBackend ? 3000 : 5000;

  const interval = setInterval(async () => {
    const ships = await loadShips(useBackend);
    callback(ships);
  }, updateInterval);

  // 클린업 함수 반환
  return () => clearInterval(interval);
};

// 선박 위치 업데이트 API (나중에 서버로 전송)
export const updateShipPosition = async (shipId: string, position: [number, number]) => {
  try {
    // 실제 환경에서는 API 호출
    // await fetch(`/api/ships/${shipId}`, {
    //   method: 'PATCH',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ position })
    // });

    console.log(`Ship ${shipId} position updated to:`, position);
  } catch (error) {
    console.error('Failed to update ship position:', error);
  }
};