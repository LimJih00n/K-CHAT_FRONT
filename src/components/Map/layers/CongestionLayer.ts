import mapboxgl from 'mapbox-gl';
import type { CongestionZone, Ship } from '../../../types/ship';
import { PORTS } from '../../../utils/shipUtils';
import { calculateShipPosition } from '../../../utils/shipUtils';

export class CongestionLayer {
  private map: mapboxgl.Map;
  private gridLookup: Map<string, CongestionZone>;
  private gridSize: number = 0.005;

  constructor(map: mapboxgl.Map) {
    this.map = map;
    this.gridLookup = new Map();
  }

  private getGridKey(lng: number, lat: number): string {
    const adjustedLng = lng + this.gridSize / 2;
    const adjustedLat = lat + this.gridSize / 2;
    const gridLng = Math.floor(adjustedLng / this.gridSize) * this.gridSize;
    const gridLat = Math.floor(adjustedLat / this.gridSize) * this.gridSize;
    return `${gridLng.toFixed(4)}-${gridLat.toFixed(4)}`;
  }

  initialize(showCongestion: boolean, heatmapMode: boolean): CongestionZone[] {
    const guryongpoCenter = PORTS['구룡포'].coordinates;
    const centerLng = guryongpoCenter[0];
    const centerLat = guryongpoCenter[1];
    const radius = 0.09;

    const zones: CongestionZone[] = [];

    for (let lng = centerLng - radius; lng <= centerLng + radius; lng += this.gridSize) {
      for (let lat = centerLat - radius; lat <= centerLat + radius; lat += this.gridSize) {
        const distance = Math.sqrt(
          Math.pow(lng - centerLng, 2) + Math.pow(lat - centerLat, 2)
        );

        if (distance <= radius) {
          const offsetLng = lng - this.gridSize / 2;
          const offsetLat = lat - this.gridSize / 2;
          const zone: CongestionZone = {
            id: `zone-${lng}-${lat}`,
            bounds: [[offsetLng, offsetLat], [offsetLng + this.gridSize, offsetLat + this.gridSize]],
            congestionLevel: 0,
            shipCount: 0
          };
          zones.push(zone);

          const key = this.getGridKey(lng, lat);
          this.gridLookup.set(key, zone);
        }
      }
    }

    this.addLayers(zones, showCongestion, heatmapMode);
    return zones;
  }

  private addLayers(zones: CongestionZone[], showCongestion: boolean, heatmapMode: boolean) {
    if (!this.map.getSource('congestion-zones')) {
      this.map.addSource('congestion-zones', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: this.zonesToFeatures(zones)
        }
      });

      this.map.addLayer({
        id: 'congestion-fill',
        type: 'fill',
        source: 'congestion-zones',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'congestionLevel'],
            0, 'rgba(255, 255, 255, 0.05)',
            20, 'rgba(100, 255, 100, 0.4)',
            40, 'rgba(255, 255, 0, 0.5)',
            60, 'rgba(255, 165, 0, 0.6)',
            80, 'rgba(255, 100, 0, 0.7)',
            100, 'rgba(255, 0, 0, 0.8)'
          ],
          'fill-opacity': showCongestion && !heatmapMode ? 1 : 0
        }
      });

      this.map.addLayer({
        id: 'congestion-border',
        type: 'line',
        source: 'congestion-zones',
        paint: {
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'congestionLevel'],
            0, 'rgba(255, 255, 255, 0.2)',
            20, 'rgba(100, 255, 100, 0.6)',
            40, 'rgba(255, 255, 0, 0.7)',
            60, 'rgba(255, 165, 0, 0.8)',
            80, 'rgba(255, 100, 0, 0.9)',
            100, 'rgba(255, 0, 0, 1)'
          ],
          'line-width': 1,
          'line-opacity': showCongestion && !heatmapMode ? 1 : 0
        }
      });
    }
  }

  update(ships: Ship[], timeOffset: number): CongestionZone[] {
    this.gridLookup.forEach(zone => {
      zone.congestionLevel = 0;
      zone.shipCount = 0;
    });

    ships.forEach(ship => {
      const position = calculateShipPosition(ship, timeOffset);
      const key = this.getGridKey(position[0], position[1]);
      const zone = this.gridLookup.get(key);

      if (zone) {
        zone.shipCount++;
        if (zone.shipCount === 1) zone.congestionLevel = 20;
        else if (zone.shipCount === 2) zone.congestionLevel = 40;
        else if (zone.shipCount === 3) zone.congestionLevel = 60;
        else if (zone.shipCount === 4) zone.congestionLevel = 80;
        else if (zone.shipCount >= 5) zone.congestionLevel = 100;
      }
    });

    const updatedZones = Array.from(this.gridLookup.values());

    if (this.map.getSource('congestion-zones')) {
      (this.map.getSource('congestion-zones') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: this.zonesToFeatures(updatedZones)
      });
    }

    return updatedZones;
  }

  private zonesToFeatures(zones: CongestionZone[]): any[] {
    return zones.map(zone => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [zone.bounds[0][0], zone.bounds[0][1]],
          [zone.bounds[1][0], zone.bounds[0][1]],
          [zone.bounds[1][0], zone.bounds[1][1]],
          [zone.bounds[0][0], zone.bounds[1][1]],
          [zone.bounds[0][0], zone.bounds[0][1]]
        ]]
      },
      properties: {
        id: zone.id,
        congestionLevel: zone.congestionLevel
      }
    }));
  }

  toggleVisibility(showCongestion: boolean, heatmapMode: boolean) {
    if (this.map.getLayer('congestion-fill')) {
      this.map.setPaintProperty('congestion-fill', 'fill-opacity',
        showCongestion && !heatmapMode ? 1 : 0);
    }
    if (this.map.getLayer('congestion-border')) {
      this.map.setPaintProperty('congestion-border', 'line-opacity',
        showCongestion && !heatmapMode ? 1 : 0);
    }
  }
}