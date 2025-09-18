import mapboxgl from 'mapbox-gl';
import type { Ship } from '../../../types/ship';
import { calculateShipPosition } from '../../../utils/shipUtils';

export class ShipLayer {
  private map: mapboxgl.Map;
  private is3D: boolean = false;

  constructor(map: mapboxgl.Map) {
    this.map = map;
  }

  setMode(is3D: boolean) {
    this.is3D = is3D;
    this.updateLayerColors();
  }

  updateRouteColors(ships: Ship[], showAllRoutes: boolean, selectedShipId: string | null) {
    // 표시할 선박 결정
    const shipsToShow = showAllRoutes ? ships :
                       selectedShipId ? ships.filter(s => s.id === selectedShipId) : [];

    shipsToShow.forEach(ship => {
      const layerId = `route-line-${ship.id}`;
      if (this.map.getLayer(layerId)) {
        const isSelected = selectedShipId === ship.id;
        this.map.setPaintProperty(layerId, 'line-color', this.getShipColor(ship, isSelected));
        this.map.setPaintProperty(layerId, 'line-width', isSelected ? 4 : 2.5);
        this.map.setPaintProperty(layerId, 'line-opacity', 0.8);
      }
    });
  }

  private updateLayerColors() {
    // 글로우 레이어 색상 업데이트
    if (this.map.getLayer('ship-glow')) {
      this.map.setPaintProperty('ship-glow', 'circle-color', '#10B981');
      this.map.setPaintProperty('ship-glow', 'circle-opacity', 0.5);
    }

    // 선박 마커 색상 업데이트
    if (this.map.getLayer('ship-circles')) {
      this.map.setPaintProperty('ship-circles', 'circle-color', '#FFFFFF');
      this.map.setPaintProperty('ship-circles', 'circle-stroke-color', '#10B981');
      this.map.setPaintProperty('ship-circles', 'circle-stroke-width', 2.5);
    }

    // 방향 표시 색상 업데이트
    if (this.map.getLayer('ship-direction')) {
      this.map.setPaintProperty('ship-direction', 'text-color', '#10B981');
    }
  }

  private getShipColor(ship: Ship, isSelected: boolean = false): string {
    // 선택된 선박은 더 밝은 색상으로
    if (isSelected) {
      if (ship.status === 'emergency') return '#FF6B6B';
      if (ship.status === 'warning') return '#FFB84D';
      return '#34D399'; // 밝은 에메랄드
    }

    // 상태에 따른 색상
    if (ship.status === 'emergency') return '#EF4444';
    if (ship.status === 'warning') return '#F59E0B';
    return '#10B981'; // 에메랄드 그린 (normal)
  }

  initialize(ships: Ship[], is3D: boolean = false) {
    this.is3D = is3D;
    if (this.map.getSource('ships')) {
      this.removeAllLayers();
    }

    this.map.addSource('ships', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: this.shipsToFeatures(ships, 0)
      }
    });

    // 선박 글로우 이펙트 (모드별 색상)
    this.map.addLayer({
      id: 'ship-glow',
      type: 'circle',
      source: 'ships',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 14,
          15, 20
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'status'], 'emergency'], '#EF4444',
          ['==', ['get', 'status'], 'warning'], '#F59E0B',
          '#10B981'
        ],
        'circle-blur': 0.6,
        'circle-opacity': 0.5
      }
    });

    // 선박 메인 마커 (모드별 디자인)
    this.map.addLayer({
      id: 'ship-circles',
      type: 'circle',
      source: 'ships',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 5,
          15, 7
        ],
        'circle-color': '#FFFFFF', // 흰색 중심
        'circle-stroke-width': 2.5,
        'circle-stroke-color': [
          'case',
          ['==', ['get', 'status'], 'emergency'], '#EF4444',
          ['==', ['get', 'status'], 'warning'], '#F59E0B',
          '#10B981'
        ],
        'circle-opacity': 1
      }
    });

    // 선박 방향 표시
    this.map.addLayer({
      id: 'ship-direction',
      type: 'symbol',
      source: 'ships',
      layout: {
        'text-field': '▲',
        'text-size': 10,
        'text-rotate': ['get', 'heading'],
        'text-rotation-alignment': 'map',
        'text-allow-overlap': true
      },
      paint: {
        'text-color': [
          'case',
          ['==', ['get', 'status'], 'emergency'], '#EF4444',
          ['==', ['get', 'status'], 'warning'], '#F59E0B',
          '#10B981'
        ],
        'text-halo-color': this.is3D ? '#000000' : '#000000',
        'text-halo-width': this.is3D ? 2 : 2
      }
    });
  }

  update(ships: Ship[], timeOffset: number) {
    if (!this.map.getSource('ships')) return;

    const features = this.shipsToFeatures(ships, timeOffset);

    (this.map.getSource('ships') as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features
    });
  }

  addRoutes(ships: Ship[], showAllRoutes: boolean, selectedShipId: string | null) {
    // 먼저 모든 경로 제거
    ships.forEach(ship => {
      const layerId = `route-line-${ship.id}`;
      const sourceId = `route-${ship.id}`;
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
      if (this.map.getSource(sourceId)) {
        this.map.removeSource(sourceId);
      }
    });

    // 표시할 선박 결정
    const shipsToShow = showAllRoutes ? ships :
                       selectedShipId ? ships.filter(s => s.id === selectedShipId) : [];

    shipsToShow.forEach(ship => {
      if (!ship.route || ship.route.length < 2) return;

      const sourceId = `route-${ship.id}`;
      const layerId = `route-line-${ship.id}`;

      this.map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: ship.route
          },
          properties: {}
        }
      });

      this.map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': this.getShipColor(ship, selectedShipId === ship.id),
          'line-width': selectedShipId === ship.id ? 4 : 2.5,
          'line-opacity': 0.8,
          'line-dasharray': this.is3D ? [4, 2] : [3, 3]
        }
      });
    });
  }

  addDestinationMarkers(ships: Ship[]) {
    ships.forEach(ship => {
      if (!ship.destinationCoords) return;

      const color = this.getShipColor(ship, false);
      const el = document.createElement('div');
      el.className = 'destination-marker';
      el.innerHTML = `
        <div style="
          width: 20px;
          height: 20px;
          background: ${color};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px ${color}40;
          position: relative;
        ">
          <div style="
            width: 8px;
            height: 8px;
            background: #ffffff;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      `;

      new mapboxgl.Marker(el)
        .setLngLat(ship.destinationCoords)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<h4>${ship.destination}</h4><p>${ship.name} 목적지</p>`)
        )
        .addTo(this.map);
    });
  }

  private shipsToFeatures(ships: Ship[], timeOffset: number): any[] {
    return ships.map(ship => {
      const position = timeOffset ? calculateShipPosition(ship, timeOffset) : ship.position;
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: position
        },
        properties: {
          id: ship.id,
          name: ship.name,
          heading: ship.heading,
          speed: ship.speed,
          destination: ship.destination,
          status: ship.status
        }
      };
    });
  }

  toggleVisibility(showShips: boolean) {
    const opacity = showShips ? 1 : 0;

    if (this.map.getLayer('ship-glow')) {
      this.map.setPaintProperty('ship-glow', 'circle-opacity', showShips ? 0.5 : 0);
    }
    if (this.map.getLayer('ship-circles')) {
      this.map.setPaintProperty('ship-circles', 'circle-opacity', opacity);
    }
    if (this.map.getLayer('ship-direction')) {
      this.map.setPaintProperty('ship-direction', 'text-opacity', showShips ? 1 : 0);
    }
  }

  private removeAllLayers() {
    if (this.map.getLayer('ship-glow')) this.map.removeLayer('ship-glow');
    if (this.map.getLayer('ship-circles')) this.map.removeLayer('ship-circles');
    if (this.map.getLayer('ship-direction')) this.map.removeLayer('ship-direction');
    if (this.map.getSource('ships')) this.map.removeSource('ships');
  }
}