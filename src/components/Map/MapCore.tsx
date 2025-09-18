import { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '../../styles/mapbox-custom.css';
import type { Ship, CongestionZone } from '../../types/ship';
import { PORTS } from '../../utils/shipUtils';
import { loadShips, subscribeToShipUpdates } from '../../services/shipService';
import type { RouteResponse } from '../../services/navigationApi';
import RoutePlanner from '../RoutePlanner/RoutePlanner';
import ShipManagementPanel from '../ShipManagementPanel/ShipManagementPanel';

// Layers
import { ShipLayer } from './layers/ShipLayer';
import { CongestionLayer } from './layers/CongestionLayer';
import { HeatmapLayer } from './layers/HeatmapLayer';
import { ClusterLayer } from './layers/ClusterLayer';

// Controls
import ControlPanel from './controls/ControlPanel';
import TimeSlider from '../TimeSlider/TimeSlider';
import Legend from './overlays/Legend';
import ShipInfoCard from './overlays/ShipInfoCard';

// Hooks
import { useMapControl } from '../../hooks/useMapControl';
import { useAnimation } from '../../hooks/useAnimation';

// Mapbox 토큰 설정
mapboxgl.accessToken = 'pk.eyJ1Ijoiamlob29ubGltIiwiYSI6ImNtZmc3b3kzbDBkaWMyanB2eHA0ZDVza2EifQ.XZPx6Pg4RXFGRhvhLgAPXg';

const MapCore = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [ships, setShips] = useState<Ship[]>([]);
  const [congestionZones, setCongestionZones] = useState<CongestionZone[]>([]);
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [planningShip, setPlanningShip] = useState<Ship | null>(null);
  const [useBackendAPI, setUseBackendAPI] = useState(true); // Backend API 사용 여부

  // Layers
  const shipLayerRef = useRef<ShipLayer | null>(null);
  const congestionLayerRef = useRef<CongestionLayer | null>(null);
  const heatmapLayerRef = useRef<HeatmapLayer | null>(null);
  const clusterLayerRef = useRef<ClusterLayer | null>(null);

  // Custom hooks
  const {
    is3D,
    setIs3D,
    showCongestion,
    setShowCongestion,
    showClustering,
    setShowClustering,
    showAllRoutes,
    toggleShowAllRoutes,
    selectedShipId,
    setSelectedShipId,
    isLoading,
    setIsLoading
  } = useMapControl();

  const handleTimeUpdate = useCallback((offset: number) => {
    if (ships.length > 0 && map.current) {
      // Update ship positions
      if (shipLayerRef.current) {
        shipLayerRef.current.update(ships, offset);
      }

      // Update congestion
      if (congestionLayerRef.current) {
        const zones = congestionLayerRef.current.update(ships, offset);
        setCongestionZones(zones);
      }

      // Update clustering
      if (showClustering && clusterLayerRef.current) {
        clusterLayerRef.current.update(ships, offset);
      }
    }
  }, [ships, showClustering]);

  const {
    timeOffset,
    setTimeOffset,
    isAnimating,
    setIsAnimating,
    animationSpeed,
    setAnimationSpeed,
    resetAnimation
  } = useAnimation(handleTimeUpdate);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const guryongpoCenter: [number, number] = [129.5554, 35.9896];  // 정확한 구룡포항 좌표

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: guryongpoCenter,
      zoom: 13.5,
      pitch: 45,
    });

    map.current.on('load', () => {
      hideMountainLabels();
      addCoastlineLayer();
      initializeLayers([]); // Initialize with empty ships initially
      setupEventHandlers();

      // Add controls
      map.current!.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.current!.addControl(new mapboxgl.ScaleControl({ maxWidth: 80, unit: 'metric' }), 'bottom-left');
    });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // Load ship data
  useEffect(() => {
    const loadShipData = async () => {
      setIsLoading(true);
      const shipData = await loadShips(useBackendAPI);
      setShips(shipData);
      setIsLoading(false);
    };
    loadShipData();

    // Subscribe to updates
    const unsubscribe = subscribeToShipUpdates(setShips, useBackendAPI);
    return () => unsubscribe();
  }, [useBackendAPI]);

  // Initialize layers when ships are loaded
  useEffect(() => {
    if (ships.length > 0 && map.current) {
      const initShips = () => {
        if (shipLayerRef.current) {
          shipLayerRef.current.initialize(ships, is3D);
          shipLayerRef.current.addDestinationMarkers(ships);
        }
      };

      if (map.current.loaded()) {
        initShips();
      } else {
        map.current.once('load', initShips);
      }
    }
  }, [ships]);

  // Update routes when selection changes
  useEffect(() => {
    if (ships.length > 0 && shipLayerRef.current) {
      shipLayerRef.current.addRoutes(ships, showAllRoutes, selectedShipId);
    }
  }, [selectedShipId, showAllRoutes, ships]);

  const initializeLayers = (shipData: Ship[] = []) => {
    if (!map.current) return;

    // Initialize layer classes
    if (!shipLayerRef.current) {
      shipLayerRef.current = new ShipLayer(map.current);
    }
    if (!congestionLayerRef.current) {
      congestionLayerRef.current = new CongestionLayer(map.current);
    }
    if (!heatmapLayerRef.current) {
      heatmapLayerRef.current = new HeatmapLayer(map.current);
    }
    if (!clusterLayerRef.current) {
      clusterLayerRef.current = new ClusterLayer(map.current);
    }

    // Initialize congestion zones
    const zones = congestionLayerRef.current.initialize(showCongestion, false);
    setCongestionZones(zones);

    // Initialize clustering
    clusterLayerRef.current.initialize(showClustering);

    // Initialize ships if provided or already loaded
    const shipsToInit = shipData.length > 0 ? shipData : ships;
    if (shipsToInit.length > 0 && shipLayerRef.current) {
      shipLayerRef.current.initialize(shipsToInit, is3D);
      shipLayerRef.current.addDestinationMarkers(shipsToInit);
      // Also add routes when initializing
      shipLayerRef.current.addRoutes(shipsToInit, showAllRoutes, selectedShipId);
    }
  };

  const setupEventHandlers = () => {
    if (!map.current) return;

    // Ship click event - 경로 계획 기능 추가
    map.current.on('click', 'ship-circles', (e) => {
      if (!e.features || !e.features[0]) return;

      const properties = e.features[0].properties;
      const coordinates = (e.features[0].geometry as any).coordinates.slice();
      const clickedShipId = properties?.id;

      // Find the clicked ship for route planning
      const clickedShip = ships.find(s => s.id === clickedShipId);
      if (clickedShip && e.originalEvent) {
        // Ctrl/Cmd 키와 함께 클릭하면 경로 계획 모드
        if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
          setPlanningShip(clickedShip);
          setShowRoutePlanner(true);
          return;
        }
      }

      setSelectedShipId(prevId => prevId === clickedShipId ? null : clickedShipId);

      // Create a DOM element for the popup
      const popupElement = document.createElement('div');

      // Create React root and render the component
      const root = createRoot(popupElement);
      root.render(
        <ShipInfoCard
          name={properties?.name || 'Unknown'}
          speed={properties?.speed || 0}
          heading={properties?.heading || 0}
          destination={properties?.destination || 'Unknown'}
          status={properties?.status || 'Unknown'}
          isDarkMode={false}
          onClose={() => popup.remove()}
        />
      );

      const popup = new mapboxgl.Popup({
        className: 'ship-popup-glass',
        closeButton: false,
        closeOnClick: false
      })
        .setLngLat(coordinates)
        .setDOMContent(popupElement)
        .addTo(map.current!);

      // Clean up the root when popup is removed
      popup.on('close', () => {
        root.unmount();
      });
    });

    // Mouse cursor change
    map.current.on('mouseenter', 'ship-circles', () => {
      map.current!.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'ship-circles', () => {
      map.current!.getCanvas().style.cursor = '';
    });

    // Cluster hover events
    map.current.on('mouseenter', 'cluster-center-points', () => {
      map.current!.getCanvas().style.cursor = 'pointer';
      if (map.current!.getLayer('cluster-labels')) {
        map.current!.setPaintProperty('cluster-labels', 'text-opacity', 1);
      }
    });

    map.current.on('mouseleave', 'cluster-center-points', () => {
      map.current!.getCanvas().style.cursor = '';
      if (map.current!.getLayer('cluster-labels')) {
        map.current!.setPaintProperty('cluster-labels', 'text-opacity', 0);
      }
    });
  };

  const hideMountainLabels = () => {
    if (!map.current) return;

    const layers = map.current.getStyle().layers;
    if (layers) {
      layers.forEach(layer => {
        if (layer.type === 'symbol') {
          map.current!.setLayoutProperty(layer.id, 'visibility', 'none');
        }
      });
    }
  };

  const addCoastlineLayer = () => {
    if (!map.current) return;

    const layers = map.current.getStyle().layers;
    if (layers) {
      layers.forEach(layer => {
        if (layer.id && layer.id.includes('water')) {
          if (layer.type === 'fill') {
            map.current!.setPaintProperty(layer.id, 'fill-color', isDarkMode ? '#1a2025' : '#a8d4f0');
            map.current!.setPaintProperty(layer.id, 'fill-outline-color', isDarkMode ? '#00ccff' : '#4a90e2');
          }
        }
        if (layer.id && (layer.id.includes('land') || layer.id.includes('landuse'))) {
          if (layer.type === 'fill') {
            map.current!.setPaintProperty(layer.id, 'fill-color', isDarkMode ? '#1a1a1a' : '#f8f8f8');
          }
        }
      });
    }
  };


  const toggle3D = () => {
    if (!map.current) return;

    const new3D = !is3D;
    setIs3D(new3D);

    map.current.setStyle(new3D ? 'mapbox://styles/mapbox/satellite-streets-v12' : 'mapbox://styles/mapbox/streets-v12');

    map.current.easeTo({
      pitch: new3D ? 45 : 0,
      duration: 1000
    });

    map.current.once('style.load', () => {
      hideMountainLabels();
      addCoastlineLayer();

      // Reset all layer references to ensure proper re-initialization
      shipLayerRef.current = null;
      congestionLayerRef.current = null;
      heatmapLayerRef.current = null;
      clusterLayerRef.current = null;

      // Re-initialize all layers with current ships data
      initializeLayers(ships);

      // Re-initialize ship layer with proper mode
      if (ships.length > 0) {
        if (!shipLayerRef.current) {
          shipLayerRef.current = new ShipLayer(map.current);
        }
        shipLayerRef.current.initialize(ships, new3D);
        shipLayerRef.current.addDestinationMarkers(ships);
        shipLayerRef.current.addRoutes(ships, showAllRoutes, selectedShipId);
        shipLayerRef.current.updateRouteColors(ships, showAllRoutes, selectedShipId);
      }

      // Re-apply clustering if it was enabled
      if (showClustering && clusterLayerRef.current) {
        clusterLayerRef.current.toggleVisibility(true);
        clusterLayerRef.current.update(ships, timeOffset);
      }
    });
  };

  const toggleCongestion = () => {
    const newShowCongestion = !showCongestion;
    setShowCongestion(newShowCongestion);

    if (congestionLayerRef.current) {
      congestionLayerRef.current.toggleVisibility(newShowCongestion, false);
    }
  };


  const toggleClustering = () => {
    const newShowClustering = !showClustering;
    console.log(`🔄 새로운 클러스터 시스템 토글: ${showClustering} → ${newShowClustering}, 선박수: ${ships.length}`);
    setShowClustering(newShowClustering);

    if (clusterLayerRef.current) {
      // 표시/숨김 토글
      clusterLayerRef.current.toggleVisibility(newShowClustering);

      // 활성화시 즉시 업데이트
      if (newShowClustering && ships.length > 0) {
        clusterLayerRef.current.update(ships, timeOffset);
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      <ControlPanel
        shipCount={ships.length}
        is3D={is3D}
        showCongestion={showCongestion}
        showClustering={showClustering}
        showAllRoutes={showAllRoutes}
        onToggle3D={toggle3D}
        onToggleCongestion={toggleCongestion}
        onToggleClustering={toggleClustering}
        onToggleAllRoutes={toggleShowAllRoutes}
      />

      <Legend />


      <TimeSlider
        value={timeOffset}
        onChange={setTimeOffset}
        max={120}
      />

      {/* Ship Management Panel */}
      <ShipManagementPanel
        ships={ships}
        onPlanRoute={(ship) => {
          setPlanningShip(ship);
          setShowRoutePlanner(true);
        }}
        useBackendAPI={useBackendAPI}
      />

      {/* Backend API 토글 버튼 */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '350px',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '8px',
        padding: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={useBackendAPI}
            onChange={(e) => setUseBackendAPI(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
            Backend API {useBackendAPI ? 'ON' : 'OFF'}
          </span>
        </label>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
          {useBackendAPI ? '🟢 서버 연결됨' : '🔴 로컬 데이터'}
        </div>
        <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
          Ctrl+클릭으로 경로 계획
        </div>
      </div>

      {/* Route Planner Component */}
      {showRoutePlanner && planningShip && (
        <RoutePlanner
          ship={planningShip}
          onRoutePlanned={(route) => {
            console.log('Route planned:', route);
            // Update the ship's route on the map
            if (shipLayerRef.current) {
              const updatedShip = {
                ...planningShip,
                route: route.path_points,
                optimization_mode: route.optimization_type === 'time_adjusted' ? 'flexible' : 'fixed' as 'flexible' | 'fixed'
              };
              const updatedShips = ships.map(s =>
                s.id === planningShip.id ? updatedShip : s
              );
              setShips(updatedShips);
              shipLayerRef.current.update(updatedShips, timeOffset);
            }
            setShowRoutePlanner(false);
            setPlanningShip(null);
          }}
          onClose={() => {
            setShowRoutePlanner(false);
            setPlanningShip(null);
          }}
        />
      )}
    </div>
  );
};

export default MapCore;