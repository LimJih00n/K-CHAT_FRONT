import React, { useState, useEffect } from 'react';
import { navigationApi } from '../../services/navigationApi';
import type { RouteStatus } from '../../services/navigationApi';
import type { Ship } from '../../types/ship';
import { Button } from '../ui/button';
import { Anchor, Navigation, AlertCircle } from 'lucide-react';

interface ShipManagementPanelProps {
  ships: Ship[];
  onPlanRoute: (ship: Ship) => void;
  useBackendAPI: boolean;
}

const ShipManagementPanel: React.FC<ShipManagementPanelProps> = ({
  ships,
  onPlanRoute,
  useBackendAPI
}) => {
  const [backendShips, setBackendShips] = useState<RouteStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Backend에서 선박 목록 가져오기
  const fetchBackendShips = async () => {
    if (!useBackendAPI) return;

    setLoading(true);
    try {
      const ships = await navigationApi.getAllShips();
      setBackendShips(ships);
    } catch (error) {
      console.error('Failed to fetch backend ships:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (useBackendAPI) {
      fetchBackendShips();
      // 3초마다 업데이트
      const interval = setInterval(fetchBackendShips, 3000);
      return () => clearInterval(interval);
    } else {
      setBackendShips([]);
    }
  }, [useBackendAPI]);

  // 선박 삭제
  const handleDeleteShip = async (shipId: string) => {
    try {
      await navigationApi.deleteShip(shipId);
      fetchBackendShips();
    } catch (error) {
      console.error('Failed to delete ship:', error);
    }
  };

  // 경로 계획이 필요한 선박 찾기
  const findShipForPlanning = (shipId: string): Ship | null => {
    const ship = ships.find(s => s.id === shipId);
    if (!ship) {
      // Backend 데이터로부터 Ship 객체 생성
      const backendShip = backendShips.find(s => s.ship_id === shipId);
      if (backendShip && backendShip.current_position) {
        return {
          id: backendShip.ship_id,
          name: backendShip.ship_id,
          position: backendShip.current_position,
          heading: 0,
          speed: 12,
          destination: '구룡포',
          destinationCoords: backendShip.path_points[backendShip.path_points.length - 1],
          status: 'normal',
          estimatedArrival: `${Math.round(backendShip.arrival_time)}분`,
          route: backendShip.path_points
        };
      }
    }
    return ship;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'accepted': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getOptimizationBadge = (mode: string) => {
    return mode === 'flexible' ? (
      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400">
        수용 O
      </span>
    ) : (
      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-400">
        수용 X
      </span>
    );
  };

  return (
    <div className={`absolute backdrop-blur-xl rounded-3xl shadow-xl transition-all duration-300 bg-white/10 text-white ${
      isCollapsed ? 'w-12' : 'w-80'
    }`} style={{
      top: '20px',  // 우측 상단에 위치
      right: '20px',
      zIndex: 999,
    }}>
      <div className={`p-4 border-b border-white/20 flex ${
        isCollapsed ? 'justify-center' : 'justify-between'
      } items-center`}>
        {!isCollapsed && (
          <>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Anchor className="w-5 h-5" />
              선박 관리
              {useBackendAPI && (
                <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded">
                  LIVE
                </span>
              )}
            </h3>
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-white/60 hover:text-white transition-colors"
            >
              ▶
            </button>
          </>
        )}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="text-white/60 hover:text-white transition-colors"
          >
            ◀
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="max-h-96 overflow-y-auto p-3">
          {!useBackendAPI ? (
            <div className="py-8 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-3 text-white/40" />
              <div className="text-sm text-white/60 mb-2">
                Backend API 비활성화
              </div>
              <div className="text-xs text-white/40">
                Backend API를 활성화하면<br/>
                서버의 선박 목록을 볼 수 있습니다
              </div>
            </div>
          ) : loading && backendShips.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-sm text-white/60">
                선박 목록 로딩 중...
              </div>
            </div>
          ) : backendShips.length === 0 ? (
            <div className="py-8 text-center">
              <Navigation className="w-8 h-8 mx-auto mb-3 text-white/40" />
              <div className="text-sm text-white/60 mb-2">
                등록된 선박이 없습니다
              </div>
              <div className="text-xs text-white/40">
                Ctrl+클릭으로 선박을 선택하여<br/>
                경로 계획을 시작하세요
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {backendShips.map((ship) => (
                <div
                  key={ship.ship_id}
                  className="bg-black/20 backdrop-blur rounded-xl p-3 border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-sm font-medium mb-1 flex items-center gap-1.5">
                        <span className="text-white/90">{ship.ship_id}</span>
                        {ship.optimization_mode && getOptimizationBadge(ship.optimization_mode)}
                      </div>
                      <div className="text-xs text-white/50">
                        상태: <span style={{
                          color: getStatusColor(ship.status),
                          fontWeight: 'bold'
                        }}>{ship.status}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteShip(ship.ship_id)}
                      className="px-2 py-1 text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-all"
                    >
                      삭제
                    </button>
                  </div>

                  <div className="text-[11px] text-white/50 mb-2 space-y-0.5">
                    <div>출발: {Math.round(ship.departure_time)}분 후</div>
                    <div>도착: {Math.round(ship.arrival_time)}분 후</div>
                    <div>경로점: {ship.path_points.length}개</div>
                  </div>

                  <div className="flex gap-1.5">
                    <Button
                      onClick={() => {
                        const shipForPlanning = findShipForPlanning(ship.ship_id);
                        if (shipForPlanning) {
                          onPlanRoute(shipForPlanning);
                        }
                      }}
                      className="flex-1 py-1.5 text-[11px] bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded transition-all"
                      variant="ghost"
                    >
                      경로 재계획
                    </Button>
                    {ship.status === 'pending' && (
                      <Button
                        onClick={() => navigationApi.acceptRoute(ship.ship_id, true)}
                        className="flex-1 py-1.5 text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded transition-all"
                        variant="ghost"
                      >
                        승인
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <div className="mt-3 py-2 px-3 bg-blue-500/10 backdrop-blur rounded-lg text-[11px] text-blue-400 text-center border border-blue-500/20">
                총 {backendShips.length}개 선박이 등록됨
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShipManagementPanel;