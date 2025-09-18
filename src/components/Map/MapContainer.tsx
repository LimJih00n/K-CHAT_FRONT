import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import TimeSlider from '../TimeSlider/TimeSlider';
import type { Ship, CongestionZone } from '../../types/ship';
import { PORTS, calculateShipPosition, calculateCongestion, generateRoute } from '../../utils/shipUtils';
import { loadShips, subscribeToShipUpdates } from '../../services/shipService';

// Mapbox 토큰 설정
mapboxgl.accessToken = 'pk.eyJ1Ijoiamlob29ubGltIiwiYSI6ImNtZmc3b3kzbDBkaWMyanB2eHA0ZDVza2EifQ.XZPx6Pg4RXFGRhvhLgAPXg';


const MapContainer = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [ships, setShips] = useState<Ship[]>([]);
  const [is3D, setIs3D] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [timeOffset, setTimeOffset] = useState(0); // 시간 오프셋 (분)
  const [congestionZones, setCongestionZones] = useState<CongestionZone[]>([]);
  const gridLookupRef = useRef<Map<string, CongestionZone>>(new Map());
  const [showCongestion, setShowCongestion] = useState(true); // 혼잡도 표시 토글
  const [heatmapMode, setHeatmapMode] = useState(true); // 히트맵 모드 (true: 히트맵, false: 그리드)
  const [showAllRoutes, setShowAllRoutes] = useState(false); // 모든 경로 표시 토글
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null); // 선택된 선박 ID
  const [isLoading, setIsLoading] = useState(true); // 로딩 상태
  const [isAnimating, setIsAnimating] = useState(false); // 애니메이션 상태
  const [animationSpeed, setAnimationSpeed] = useState(1); // 애니메이션 속도 (1x, 2x, 5x)
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // 포항 구룡포 항구 좌표 (동해안) - 실제 항구 위치
    const guryongpoCenter: [number, number] = [129.5560, 35.9940];

    // 지도 초기화 (다크 해양 스타일로 시작)
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11', // 다크 모던 스타일
      center: guryongpoCenter,
      zoom: 13.5,  // 적절한 확대 레벨
      pitch: 0, // 2D 뷰로 시작
    });

    // 지도 로드 완료 후
    map.current.on('load', () => {
      // 산 라벨 숨기기
      hideMountainLabels();
      // 해안선 강조 레이어 추가
      addCoastlineLayer();
      // 혼잡 구역 초기화
      initializeCongestionZones();
      // 히트맵 레이어 초기화
      initializeHeatmapLayer();
      // addShipLayers는 ships 데이터가 로드된 후 useEffect에서 호출됨

      // 선박 클릭 이벤트
      map.current!.on('click', 'ship-circles', (e) => {
        if (!e.features || !e.features[0]) return;

        const properties = e.features[0].properties;
        const coordinates = (e.features[0].geometry as any).coordinates.slice();
        const clickedShipId = properties?.id;

        // 선택된 선박 ID 업데이트
        setSelectedShipId(prevId => prevId === clickedShipId ? null : clickedShipId);

        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(`
            <div style="padding: 10px;">
              <h3 style="margin: 0 0 10px 0;">${properties?.name}</h3>
              <p style="margin: 5px 0;"><strong>속도:</strong> ${properties?.speed} knots</p>
              <p style="margin: 5px 0;"><strong>방향:</strong> ${properties?.heading}°</p>
              <p style="margin: 5px 0;"><strong>목적지:</strong> ${properties?.destination}</p>
              <p style="margin: 5px 0;"><strong>상태:</strong> ${properties?.status}</p>
              <p style="margin: 5px 0; color: #00d4ff;"><small>클릭하여 경로 표시/숨기기</small></p>
            </div>
          `)
          .addTo(map.current!);
      });

      // 마우스 커서 변경
      map.current!.on('mouseenter', 'ship-circles', () => {
        map.current!.getCanvas().style.cursor = 'pointer';
      });

      map.current!.on('mouseleave', 'ship-circles', () => {
        map.current!.getCanvas().style.cursor = '';
      });

      // 호버 시 글로우 효과 강화
      map.current!.on('mouseenter', 'ship-circles', (e) => {
        if (e.features && e.features[0]) {
          map.current!.setPaintProperty('ship-glow', 'circle-opacity', [
            'case',
            ['==', ['get', 'id'], e.features[0].properties?.id],
            0.5,
            0.3
          ]);
          map.current!.setPaintProperty('ship-glow', 'circle-radius', [
            'case',
            ['==', ['get', 'id'], e.features[0].properties?.id],
            [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 15,
              15, 22
            ],
            [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 12,
              15, 18
            ]
          ]);
        }
      });

      map.current!.on('mouseleave', 'ship-circles', () => {
        map.current!.setPaintProperty('ship-glow', 'circle-opacity', 0.3);
        map.current!.setPaintProperty('ship-glow', 'circle-radius', [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 12,
          15, 18
        ]);
      });

      // 네비게이션 컨트롤 추가
      map.current!.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // 스케일 컨트롤 추가
      map.current!.addControl(new mapboxgl.ScaleControl({ maxWidth: 80, unit: 'metric' }), 'bottom-left');
    });

    // 클린업
    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // 선박 데이터 로드
  useEffect(() => {
    const loadShipData = async () => {
      setIsLoading(true);
      const shipData = await loadShips();
      setShips(shipData);
      setIsLoading(false);
    };

    loadShipData();
  }, []);

  // 선박 데이터가 로드되면 레이어 추가
  useEffect(() => {
    if (ships.length > 0 && map.current) {
      if (map.current.loaded()) {
        addShipLayers();
      } else {
        map.current.once('load', () => {
          addShipLayers();
        });
      }
    }
  }, [ships]);

  // 시간 변경에 따른 업데이트
  useEffect(() => {
    if (ships.length > 0) {
      updateShipPositions();
      if (heatmapMode) {
        updateHeatmap();
      } else {
        updateCongestionZones();
      }
    }
  }, [timeOffset, heatmapMode]); // ships 의존성 제거하여 무한 루프 방지

  // 선택된 선박 또는 전체 경로 표시 상태 변경시 경로 업데이트
  useEffect(() => {
    if (ships.length > 0) {
      addShipRoutes(ships, showAllRoutes);
    }
  }, [selectedShipId, showAllRoutes, ships]);

  // 애니메이션 효과 (속도를 1/3으로 감소)
  useEffect(() => {
    if (isAnimating) {
      let frameCount = 0;
      const animate = () => {
        frameCount++;
        // 3프레임마다 한 번씩만 업데이트 (속도 1/3)
        if (frameCount % 3 === 0) {
          setTimeOffset(prev => {
            const next = prev + animationSpeed * 0.3; // 속도를 30%로 줄임
            return next > 120 ? 0 : next; // 2시간 후 리셋
          });
        }
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, animationSpeed]);

  // 좌표를 격자 키로 변환 (floor 사용으로 정확한 매핑)
  const getGridKey = (lng: number, lat: number, gridSize: number) => {
    // 오프셋 보정 (격자가 반칸 위로 올라가 있음)
    const adjustedLng = lng + gridSize / 2;
    const adjustedLat = lat + gridSize / 2;
    const gridLng = Math.floor(adjustedLng / gridSize) * gridSize;
    const gridLat = Math.floor(adjustedLat / gridSize) * gridSize;
    return `${gridLng.toFixed(4)}-${gridLat.toFixed(4)}`;
  };

  // 히트맵 레이어 초기화
  const initializeHeatmapLayer = () => {
    if (!map.current) return;

    // 히트맵 소스가 없으면 추가
    if (!map.current.getSource('ship-heatmap')) {
      map.current.addSource('ship-heatmap', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      // 히트맵 레이어 추가
      map.current.addLayer({
        id: 'ship-heatmap-layer',
        type: 'heatmap',
        source: 'ship-heatmap',
        paint: {
          // 히트맵 가중치 설정
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'weight'],
            0, 0,
            1, 1
          ],
          // 히트맵 강도
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 0.5,
            15, 1.5
          ],
          // 히트맵 색상 그라데이션
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(0,212,255,0.4)',  // 청록색
            0.4, 'rgba(100,255,100,0.6)', // 연한 초록
            0.6, 'rgba(255,255,0,0.7)',   // 노랑
            0.8, 'rgba(255,165,0,0.8)',   // 주황
            1, 'rgba(255,0,0,0.9)'         // 빨강
          ],
          // 히트맵 반경
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 20,
            13, 40,
            15, 60
          ],
          // 히트맵 불투명도
          'heatmap-opacity': showCongestion && heatmapMode ? 0.8 : 0
        }
      });
    }
  };

  // 히트맵 데이터 업데이트
  const updateHeatmap = () => {
    if (!map.current || ships.length === 0) return;

    // 선박 위치를 히트맵 포인트로 변환
    const heatmapFeatures = ships.map(ship => {
      const position = calculateShipPosition(ship, timeOffset);

      // 선박 상태에 따른 가중치 설정
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

    // 히트맵 데이터 업데이트
    if (map.current.getSource('ship-heatmap')) {
      (map.current.getSource('ship-heatmap') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: heatmapFeatures as any
      });
    }
  };

  // 혼잡 구역 초기화
  const initializeCongestionZones = () => {
    if (!map.current) return;

    // 구룡포 중심 좌표
    const guryongpoCenter = PORTS['구룡포'].coordinates;
    const centerLng = guryongpoCenter[0];
    const centerLat = guryongpoCenter[1];

    // 10km를 위경도로 변환 (대략 0.09도)
    const radius = 0.09;

    // 지도 영역을 그리드로 분할 - 구룡포 주변 10km만
    const gridSize = 0.005; // 약 500m - 10배 큰 그리드
    const zones: CongestionZone[] = [];
    const gridLookup = new Map<string, CongestionZone>();

    for (let lng = centerLng - radius; lng <= centerLng + radius; lng += gridSize) {
      for (let lat = centerLat - radius; lat <= centerLat + radius; lat += gridSize) {
        // 구룡포로부터의 거리 계산
        const distance = Math.sqrt(
          Math.pow(lng - centerLng, 2) + Math.pow(lat - centerLat, 2)
        );

        // 반경 내에 있는 경우만 추가
        if (distance <= radius) {
          // 격자를 반칸 위로 올려서 선박이 중앙에 오도록 조정
          const offsetLng = lng - gridSize / 2;
          const offsetLat = lat - gridSize / 2;
          const zone: CongestionZone = {
            id: `zone-${lng}-${lat}`,
            bounds: [[offsetLng, offsetLat], [offsetLng + gridSize, offsetLat + gridSize]],
            congestionLevel: 0,
            shipCount: 0
          };
          zones.push(zone);

          // 격자 룩업 테이블에 저장
          const key = getGridKey(lng, lat, gridSize);
          gridLookup.set(key, zone);
        }
      }
    }

    gridLookupRef.current = gridLookup;
    setCongestionZones(zones);

    // 혼잡도 레이어 추가
    if (!map.current.getSource('congestion-zones')) {
      map.current.addSource('congestion-zones', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: zones.map(zone => ({
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
          }))
        }
      });

      map.current.addLayer({
        id: 'congestion-fill',
        type: 'fill',
        source: 'congestion-zones',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'congestionLevel'],
            0, 'rgba(255, 255, 255, 0.05)',  // 흰색 네온 기본 격자 (더 투명하게)
            20, 'rgba(100, 255, 100, 0.4)',  // 연한 초록
            40, 'rgba(255, 255, 0, 0.5)',    // 노랑
            60, 'rgba(255, 165, 0, 0.6)',    // 주황
            80, 'rgba(255, 100, 0, 0.7)',    // 진한 주황
            100, 'rgba(255, 0, 0, 0.8)'       // 빨강
          ],
          'fill-opacity': showCongestion && !heatmapMode ? 1 : 0
        }
      });
    }
    // 혼잡도 경계선 레이어 추가 - 혼잡도가 있는 곳만 표시
    if (!map.current.getLayer('congestion-border')) {
      map.current.addLayer({
        id: 'congestion-border',
        type: 'line',
        source: 'congestion-zones',
        paint: {
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'congestionLevel'],
            0, 'rgba(255, 255, 255, 0.2)',   // 흰색 네온 경계선
            20, 'rgba(100, 255, 100, 0.6)',  // 연한 초록
            40, 'rgba(255, 255, 0, 0.7)',    // 노랑
            60, 'rgba(255, 165, 0, 0.8)',    // 주황
            80, 'rgba(255, 100, 0, 0.9)',    // 진한 주황
            100, 'rgba(255, 0, 0, 1)'         // 빨강
          ],
          'line-width': 1,  // 선 두께 약간 증가
          'line-opacity': showCongestion && !heatmapMode ? 1 : 0
        }
      });
    }
  };

  // 선박 경로 표시 (개별 또는 전체)
  const addShipRoutes = (shipList: Ship[], showAll: boolean = false) => {
    if (!map.current) return;

    // 먼저 모든 경로 제거
    ships.forEach(ship => {
      const layerId = `route-line-${ship.id}`;
      const sourceId = `route-${ship.id}`;
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
      if (map.current!.getSource(sourceId)) {
        map.current!.removeSource(sourceId);
      }
    });

    // 표시할 선박 결정
    const shipsToShow = showAll ? shipList :
                       selectedShipId ? shipList.filter(s => s.id === selectedShipId) : [];

    shipsToShow.forEach(ship => {
      if (!ship.route || ship.route.length < 2) return;

      const sourceId = `route-${ship.id}`;
      const layerId = `route-line-${ship.id}`;

      map.current!.addSource(sourceId, {
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

      map.current!.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': [
            'match',
            ship.status,
            'warning', '#ffa500',
            'emergency', '#ff0066',
            '#00d4ff'
          ],
          'line-width': selectedShipId === ship.id ? 3 : 2,
          'line-opacity': selectedShipId === ship.id ? 0.8 : 0.4,
          'line-dasharray': [2, 4]
        }
      });
    });
  };

  // 목적지 마커 추가
  const addDestinationMarkers = (shipList: Ship[]) => {
    if (!map.current) return;

    shipList.forEach(ship => {
      if (!ship.destinationCoords) return;

      const el = document.createElement('div');
      el.className = 'destination-marker';
      el.innerHTML = `<div style="
        width: 20px;
        height: 20px;
        background: rgba(255, 255, 255, 0.9);
        border: 2px solid ${
          ship.status === 'warning' ? '#ffa500' :
          ship.status === 'emergency' ? '#ff0066' : '#00d4ff'
        };
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
      ">📍</div>`;

      new mapboxgl.Marker(el)
        .setLngLat(ship.destinationCoords)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<h4>${ship.destination}</h4><p>${ship.name} 목적지</p>`)
        )
        .addTo(map.current!);
    });
  };

  // 시간에 따른 선박 위치 업데이트
  const updateShipPositions = () => {
    if (!map.current || !map.current.getSource('ships')) return;

    const updatedFeatures = ships.map(ship => {
      const newPosition = calculateShipPosition(ship, timeOffset);
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: newPosition
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

    (map.current.getSource('ships') as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: updatedFeatures as any
    });
  };

  // 혼잡도 업데이트 (최적화 버전)
  const updateCongestionZones = () => {
    if (!map.current || !gridLookupRef.current.size || ships.length === 0) return;

    const gridSize = 0.005; // 10배 큰 그리드로 변경
    const gridLookup = gridLookupRef.current;

    // 모든 격자의 혼잡도를 초기화
    gridLookup.forEach(zone => {
      zone.congestionLevel = 0;
      zone.shipCount = 0;
    });

    // 선박 위치만 확인하여 해당 격자 업데이트
    ships.forEach(ship => {
      const position = calculateShipPosition(ship, timeOffset);
      const key = getGridKey(position[0], position[1], gridSize);
      const zone = gridLookup.get(key);

      if (zone) {
        zone.shipCount++;
        // 선박 수에 따른 혼잡도 계산
        if (zone.shipCount === 1) zone.congestionLevel = 20;
        else if (zone.shipCount === 2) zone.congestionLevel = 40;
        else if (zone.shipCount === 3) zone.congestionLevel = 60;
        else if (zone.shipCount === 4) zone.congestionLevel = 80;
        else if (zone.shipCount >= 5) zone.congestionLevel = 100;
      }
    });

    // 업데이트된 격자들만 배열로 변환
    const updatedZones = Array.from(gridLookup.values());
    setCongestionZones([...updatedZones]);

    if (map.current.getSource('congestion-zones')) {
      (map.current.getSource('congestion-zones') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: updatedZones.map(zone => ({
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
        }))
      });
    }
  };

  // 모든 텍스트 라벨 숨기기 함수
  const hideMountainLabels = () => {
    if (!map.current) return;

    const layers = map.current.getStyle().layers;
    if (layers) {
      layers.forEach(layer => {
        // 모든 텍스트 라벨 숨기기 (symbol 타입의 모든 레이어)
        if (layer.type === 'symbol') {
          map.current!.setLayoutProperty(layer.id, 'visibility', 'none');
        }
      });
    }
  };

  // 해안선 강조 레이어 추가 함수
  const addCoastlineLayer = () => {
    if (!map.current) return;

    // 물/바다 영역은 기본 스타일 유지 (색상 변경 제거)

    // 해안선 그라데이션 효과 추가
    if (!map.current.getSource('coastline-gradient')) {
      map.current.addSource('coastline-gradient', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
    }

    // 해안선 하이라이트 추가
    const layers = map.current.getStyle().layers;
    if (layers) {
      layers.forEach(layer => {
        // 물 관련 레이어들 강조
        if (layer.id && layer.id.includes('water')) {
          if (layer.type === 'fill') {
            map.current!.setPaintProperty(layer.id, 'fill-outline-color', isDarkMode ? '#00ccff' : '#0066cc');
          }
        }
        // 육지 레이어 조정
        if (layer.id && (layer.id.includes('land') || layer.id.includes('landuse'))) {
          if (layer.type === 'fill') {
            map.current!.setPaintProperty(layer.id, 'fill-color', isDarkMode ? '#1a1a1a' : '#f0f0f0');
          }
        }
      });
    }

    // 커스텀 해안선 윤곽선 추가
    if (!map.current.getLayer('custom-coastline')) {
      // 물 레이어 위에 윤곽선 추가
      const waterLayer = layers?.find(layer => layer.id === 'water');
      if (waterLayer) {
        try {
          map.current.addLayer({
            id: 'custom-coastline',
            type: 'line',
            source: 'composite',
            'source-layer': 'water',
            paint: {
              'line-color': isDarkMode ? '#00ffff' : '#0080ff',
              'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 1,
                15, 3
              ],
              'line-opacity': 0.8,
              'line-blur': 0.5
            }
          });
        } catch (err) {
          // 에러 무시 - 일부 스타일에서는 water-shadow 레이어가 없을 수 있음
        }
      }
    }
  };

  // 낮/밤 모드 전환 함수
  const toggleDarkMode = () => {
    if (!map.current) return;

    if (isDarkMode) {
      // 라이트 모드로 전환 (최소한의 도로 표시)
      map.current.setStyle('mapbox://styles/mapbox/light-v11');
      setIsDarkMode(false);
    } else {
      // 다크 모드로 전환
      map.current.setStyle('mapbox://styles/mapbox/dark-v11');
      setIsDarkMode(true);
    }

    // 스타일 변경 후 레이어 재생성
    map.current.once('style.load', () => {
      // 산 라벨 숨기기
      hideMountainLabels();

      // 라이트 모드에서 도로 스타일 조정
      if (!isDarkMode) {
        // 도로 라벨 투명도 감소
        const roadLayers = ['road-label', 'road-number-shield', 'road-exit-shield'];
        roadLayers.forEach(layerId => {
          if (map.current!.getLayer(layerId)) {
            map.current!.setPaintProperty(layerId, 'text-opacity', 0.3);
            map.current!.setPaintProperty(layerId, 'text-color', '#999999');
          }
        });

        // 도로 라인 색상 조정
        const roadLineLayers = ['road-primary', 'road-secondary', 'road-street', 'road-minor'];
        roadLineLayers.forEach(layerId => {
          if (map.current!.getLayer(layerId)) {
            map.current!.setPaintProperty(layerId, 'line-color', '#e0e0e0');
          }
        });
      }
      addCoastlineLayer();
      addShipLayers();
      // 혼잡도 레이어 재생성
      if (showCongestion) {
        initializeCongestionZones();
        initializeHeatmapLayer();
      }
    });
  };

  // 2D/3D 전환 함수
  const toggle3D = () => {
    if (!map.current) return;

    if (!is3D) {
      // 3D 뷰로 전환 (위성 스타일) - 위에서 수직으로 보기
      map.current.setStyle('mapbox://styles/mapbox/satellite-streets-v12');
      map.current.easeTo({
        pitch: 0,  // 수직으로 위에서 보기 (기울기 없음)
        duration: 1000
      });
      setIs3D(true);
    } else {
      // 2D 뷰로 전환 (현재 테마 유지)
      map.current.setStyle(isDarkMode ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11');
      map.current.easeTo({
        pitch: 0,
        duration: 1000
      });
      setIs3D(false);
    }

    // 스타일 변경 후 레이어 재생성
    map.current.once('style.load', () => {
      hideMountainLabels();
      addCoastlineLayer();
      addShipLayers();
      // 혼잡도 레이어 재생성
      if (showCongestion) {
        initializeCongestionZones();
        initializeHeatmapLayer();
      }
    });
  };

  // 선박 레이어 추가 함수
  const addShipLayers = () => {
    if (!map.current || ships.length === 0) return;

    // 기존 소스가 있으면 제거
    if (map.current.getSource('ships')) {
      if (map.current.getLayer('ship-glow')) map.current.removeLayer('ship-glow');
      if (map.current.getLayer('ship-circles')) map.current.removeLayer('ship-circles');
      if (map.current.getLayer('ship-direction')) map.current.removeLayer('ship-direction');
      map.current.removeSource('ships');
    }

    // 선박 데이터 소스 추가
    map.current.addSource('ships', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: ships.map(ship => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: ship.position
          },
          properties: {
            id: ship.id,
            name: ship.name,
            heading: ship.heading,
            speed: ship.speed,
            destination: ship.destination,
            status: ship.status,
            estimatedArrival: ship.estimatedArrival
          }
        }))
      }
    });

    // 선박 글로우 이펙트
    map.current.addLayer({
      id: 'ship-glow',
      type: 'circle',
      source: 'ships',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 12,
          15, 18
        ],
        'circle-color': [
          'match',
          ['get', 'status'],
          'warning', '#ffa500',
          'emergency', '#ff0066',
          '#00d4ff'
        ],
        'circle-blur': 0.8,
        'circle-opacity': 0.3
      }
    });

    // 선박 메인 마커 (미니멀한 점)
    map.current.addLayer({
      id: 'ship-circles',
      type: 'circle',
      source: 'ships',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 4,
          15, 6
        ],
        'circle-color': [
          'match',
          ['get', 'status'],
          'warning', '#ffa500',
          'emergency', '#ff0066',
          '#00d4ff'
        ],
        'circle-opacity': 1
      }
    });

    // 선박 방향 표시 (미니멀한 화살표)
    map.current.addLayer({
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
        'text-color': 'rgba(255, 255, 255, 0.8)',
        'text-halo-color': 'rgba(0, 0, 0, 0.5)',
        'text-halo-width': 0.5
      }
    });

    // 목적지 마커 추가 (경로는 클릭할 때만 표시)
    addDestinationMarkers(ships);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* 컨트롤 패널 */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(10, 10, 10, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        minWidth: '200px'
      }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>선박 관제 시스템</h2>
        <p style={{ margin: '5px 0', fontSize: '14px' }}>포항 구룡포 해역</p>
        <p style={{ margin: '5px 0', fontSize: '14px' }}>활성 선박: {ships.length}척</p>

        <button
          onClick={toggle3D}
          style={{
            marginTop: '10px',
            padding: '8px 15px',
            background: is3D ? '#ff6b35' : '#00a8ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          {is3D ? '2D 지도로 전환' : '3D 위성뷰로 전환'}
        </button>

        <button
          onClick={toggleDarkMode}
          style={{
            marginTop: '10px',
            padding: '8px 15px',
            background: isDarkMode ? '#4a5568' : '#f7fafc',
            color: isDarkMode ? 'white' : 'black',
            border: isDarkMode ? 'none' : '1px solid #cbd5e0',
            borderRadius: '4px',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          {isDarkMode ? '☀️ 낮 모드' : '🌙 밤 모드'}
        </button>

        <button
          onClick={() => {
            setShowCongestion(!showCongestion);
            if (map.current) {
              if (heatmapMode) {
                if (map.current.getLayer('ship-heatmap-layer')) {
                  map.current.setPaintProperty('ship-heatmap-layer', 'heatmap-opacity', !showCongestion ? 0.8 : 0);
                }
              } else {
                if (map.current.getLayer('congestion-fill')) {
                  map.current.setPaintProperty('congestion-fill', 'fill-opacity', !showCongestion ? 1 : 0);
                }
                if (map.current.getLayer('congestion-border')) {
                  map.current.setPaintProperty('congestion-border', 'line-opacity', !showCongestion ? 1 : 0);
                }
              }
            }
          }}
          style={{
            marginTop: '10px',
            padding: '8px 15px',
            background: showCongestion ? '#10b981' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          {showCongestion ? '🗺️ 혼잡도 숨기기' : '🗺️ 혼잡도 표시'}
        </button>

        <button
          onClick={() => {
            setHeatmapMode(!heatmapMode);
            if (map.current) {
              if (!heatmapMode) {
                // 히트맵 모드로 전환
                if (map.current.getLayer('ship-heatmap-layer')) {
                  map.current.setPaintProperty('ship-heatmap-layer', 'heatmap-opacity', showCongestion ? 0.8 : 0);
                }
                if (map.current.getLayer('congestion-fill')) {
                  map.current.setPaintProperty('congestion-fill', 'fill-opacity', 0);
                }
                if (map.current.getLayer('congestion-border')) {
                  map.current.setPaintProperty('congestion-border', 'line-opacity', 0);
                }
                updateHeatmap();
              } else {
                // 그리드 모드로 전환
                if (map.current.getLayer('ship-heatmap-layer')) {
                  map.current.setPaintProperty('ship-heatmap-layer', 'heatmap-opacity', 0);
                }
                if (map.current.getLayer('congestion-fill')) {
                  map.current.setPaintProperty('congestion-fill', 'fill-opacity', showCongestion ? 1 : 0);
                }
                if (map.current.getLayer('congestion-border')) {
                  map.current.setPaintProperty('congestion-border', 'line-opacity', showCongestion ? 1 : 0);
                }
                updateCongestionZones();
              }
            }
          }}
          style={{
            marginTop: '10px',
            padding: '8px 15px',
            background: heatmapMode ? '#8b5cf6' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          {heatmapMode ? '🔥 히트맵 모드' : '⬜ 그리드 모드'}
        </button>

        <button
          onClick={() => {
            setShowAllRoutes(!showAllRoutes);
            setSelectedShipId(null); // 개별 선택 초기화
          }}
          style={{
            marginTop: '10px',
            padding: '8px 15px',
            background: showAllRoutes ? '#8b5cf6' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          {showAllRoutes ? '🛤️ 모든 경로 숨기기' : '🛤️ 모든 경로 표시'}
        </button>
      </div>

      {/* 범례 */}
      <div style={{
        position: 'absolute',
        bottom: 40,
        right: 20,
        background: 'rgba(10, 10, 10, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px'
      }}>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ color: '#00d4ff' }}>● </span>정상
        </div>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ color: '#ffa500' }}>● </span>주의
        </div>
        <div>
          <span style={{ color: '#ff0066' }}>● </span>긴급
        </div>
      </div>

      {/* 애니메이션 컨트롤 */}
      <div style={{
        position: 'absolute',
        bottom: 160,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(10, 10, 10, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        color: 'white',
        padding: '10px 15px',
        borderRadius: '8px',
        display: 'flex',
        gap: '10px',
        alignItems: 'center'
      }}>
        <button
          onClick={() => setIsAnimating(!isAnimating)}
          style={{
            padding: '8px 15px',
            background: isAnimating ? '#ef4444' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {isAnimating ? '⏸️ 일시정지' : '▶️ 시뮬레이션 시작'}
        </button>

        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            onClick={() => setAnimationSpeed(1)}
            style={{
              padding: '6px 12px',
              background: animationSpeed === 1 ? '#3b82f6' : '#4b5563',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            1x
          </button>
          <button
            onClick={() => setAnimationSpeed(2)}
            style={{
              padding: '6px 12px',
              background: animationSpeed === 2 ? '#3b82f6' : '#4b5563',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            2x
          </button>
          <button
            onClick={() => setAnimationSpeed(5)}
            style={{
              padding: '6px 12px',
              background: animationSpeed === 5 ? '#3b82f6' : '#4b5563',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            5x
          </button>
        </div>

        <button
          onClick={() => setTimeOffset(0)}
          style={{
            padding: '6px 12px',
            background: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          ⏮️ 리셋
        </button>
      </div>

      {/* 시간 슬라이더 */}
      <TimeSlider
        value={timeOffset}
        onChange={setTimeOffset}
        max={120}
      />
    </div>
  );
};

export default MapContainer;