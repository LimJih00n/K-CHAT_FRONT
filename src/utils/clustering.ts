import type { Ship } from '../types/ship';
import { calculateShipPosition } from './shipUtils';

export interface SimpleCluster {
  center: [number, number];
  ships: Ship[];
  density: number;
}

/**
 * 단순한 거리 기반 클러스터링
 */
export function createSimpleClusters(ships: Ship[], timeOffset: number, maxDistance: number = 0.02): SimpleCluster[] {
  if (ships.length === 0) return [];

  console.log(`🔨 새로운 클러스터링 시작: 선박=${ships.length}척, 거리임계값=${maxDistance}`);

  const clusters: SimpleCluster[] = [];
  const usedShips = new Set<string>();

  // 각 선박의 현재 위치 계산
  const shipsWithPositions = ships.map(ship => ({
    ship,
    position: calculateShipPosition(ship, timeOffset)
  }));

  for (const { ship, position } of shipsWithPositions) {
    if (usedShips.has(ship.id)) continue;

    // 새 클러스터 생성
    const clusterShips = [ship];
    usedShips.add(ship.id);

    // 근처의 다른 선박들 찾기
    for (const other of shipsWithPositions) {
      if (usedShips.has(other.ship.id)) continue;

      const distance = getDistance(position, other.position);
      if (distance <= maxDistance) {
        clusterShips.push(other.ship);
        usedShips.add(other.ship.id);
      }
    }

    // 클러스터 중심점 계산
    const positions = clusterShips.map(s => calculateShipPosition(s, timeOffset));
    const centerLng = positions.reduce((sum, pos) => sum + pos[0], 0) / positions.length;
    const centerLat = positions.reduce((sum, pos) => sum + pos[1], 0) / positions.length;

    // 밀도 계산 (단위 면적당 선박 수)
    const area = Math.PI * maxDistance * maxDistance;
    const density = clusterShips.length / area;

    clusters.push({
      center: [centerLng, centerLat],
      ships: clusterShips,
      density: density * 1000 // 스케일 조정
    });

    console.log(`📍 클러스터 ${clusters.length}: ${clusterShips.length}척 (${clusterShips.map(s => s.name).join(', ')})`);
  }

  console.log(`✅ 클러스터링 완료: 총 ${clusters.length}개 클러스터 생성`);
  return clusters;
}

/**
 * 두 좌표 간의 거리 계산 (유클리드 거리)
 */
function getDistance(pos1: [number, number], pos2: [number, number]): number {
  const dx = pos1[0] - pos2[0];
  const dy = pos1[1] - pos2[1];
  return Math.sqrt(dx * dx + dy * dy);
}