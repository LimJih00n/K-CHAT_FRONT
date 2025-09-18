import mapboxgl from 'mapbox-gl';
import type { Ship } from '../../../types/ship';
import { createSimpleClusters, type SimpleCluster } from '../../../utils/clustering';
import { calculateShipPosition } from '../../../utils/shipUtils';

export class ClusterLayer {
  private map: mapboxgl.Map;
  private clusters: SimpleCluster[] = [];

  constructor(map: mapboxgl.Map) {
    this.map = map;
  }

  initialize(showClustering: boolean) {
    console.log('🏗️ ClusterLayer 초기화');

    // 클러스터 히트맵 소스
    if (!this.map.getSource('cluster-heatmap-source')) {
      this.map.addSource('cluster-heatmap-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      // 히트맵 레이어
      this.map.addLayer({
        id: 'cluster-heatmap-layer',
        type: 'heatmap',
        source: 'cluster-heatmap-source',
        paint: {
          'heatmap-weight': 1,  // 모든 선박이 동일한 가중치
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0.8,
            12, 1.5,
            16, 2.5
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.1, 'rgba(33,102,172,0.3)',     // 매우 연한 파랑
            0.3, 'rgba(103,169,207,0.5)',    // 연한 파랑
            0.5, 'rgba(209,229,240,0.6)',    // 하늘색
            0.7, 'rgba(253,219,199,0.8)',    // 연한 주황
            0.9, 'rgba(239,138,98,0.9)',     // 주황
            1, 'rgba(178,24,43,1)'           // 진한 빨강
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 40,     // 줌 8에서 40px
            12, 60,    // 줌 12에서 60px
            16, 80     // 줌 16에서 80px
          ],
          'heatmap-opacity': showClustering ? 0.8 : 0
        }
      });
    }
  }

  update(ships: Ship[], timeOffset: number) {
    console.log(`🔄 ClusterLayer 업데이트: ${ships.length}척 선박`);

    if (ships.length === 0) {
      this.clusters = [];
      this.updateMapSource([]);
      return;
    }

    // 모든 선박 위치를 히트맵 포인트로 변환 (자연스러운 퍼짐 효과를 위해)
    const features = ships.map((ship, index) => {
      const position = calculateShipPosition(ship, timeOffset);
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: position
        },
        properties: {
          shipId: ship.id,
          shipName: ship.name,
          shipCount: 1, // 각 선박당 가중치 1
          weight: 1
        }
      };
    });

    console.log(`🌊 히트맵 포인트 생성: ${features.length}개 선박 위치`);

    this.updateMapSource(features);

    // 클러스터링은 정보용으로만 실행
    this.clusters = createSimpleClusters(ships, timeOffset, 0.02);
  }

  private updateMapSource(features: any[]) {
    const source = this.map.getSource('cluster-heatmap-source') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features
      });
    }
  }

  toggleVisibility(showClustering: boolean) {
    console.log(`👁️ ClusterLayer 표시: ${showClustering}`);

    if (this.map.getLayer('cluster-heatmap-layer')) {
      this.map.setPaintProperty('cluster-heatmap-layer', 'heatmap-opacity', showClustering ? 0.7 : 0);
    }
  }

  getClusters(): SimpleCluster[] {
    return this.clusters;
  }
}