import mapboxgl from 'mapbox-gl';
import type { Ship } from '../../../types/ship';
import { calculateShipPosition } from '../../../utils/shipUtils';

export class HeatmapLayer {
  private map: mapboxgl.Map;

  constructor(map: mapboxgl.Map) {
    this.map = map;
  }

  initialize(showCongestion: boolean, heatmapMode: boolean) {
    if (!this.map.getSource('ship-heatmap')) {
      this.map.addSource('ship-heatmap', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      this.map.addLayer({
        id: 'ship-heatmap-layer',
        type: 'heatmap',
        source: 'ship-heatmap',
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'weight'],
            0, 0,
            1, 1
          ],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 0.5,
            15, 1.5
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(0,212,255,0.4)',
            0.4, 'rgba(100,255,100,0.6)',
            0.6, 'rgba(255,255,0,0.7)',
            0.8, 'rgba(255,165,0,0.8)',
            1, 'rgba(255,0,0,0.9)'
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 20,
            13, 40,
            15, 60
          ],
          'heatmap-opacity': showCongestion && heatmapMode ? 0.8 : 0
        }
      });
    }
  }

  update(ships: Ship[], timeOffset: number) {
    const heatmapFeatures = ships.map(ship => {
      const position = calculateShipPosition(ship, timeOffset);

      let weight = 0.5;
      if (ship.status === 'warning') weight = 0.75;
      if (ship.status === 'emergency') weight = 1;

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: position
        },
        properties: {
          weight: weight
        }
      };
    });

    if (this.map.getSource('ship-heatmap')) {
      (this.map.getSource('ship-heatmap') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: heatmapFeatures as any
      });
    }
  }

  toggleVisibility(showCongestion: boolean, heatmapMode: boolean) {
    if (this.map.getLayer('ship-heatmap-layer')) {
      this.map.setPaintProperty('ship-heatmap-layer', 'heatmap-opacity',
        showCongestion && heatmapMode ? 0.8 : 0);
    }
  }
}