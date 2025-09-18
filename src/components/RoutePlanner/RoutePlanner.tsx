import React, { useState } from 'react';
import { navigationApi } from '../../services/navigationApi';
import type { RouteResponse } from '../../services/navigationApi';
import type { Ship } from '../../types/ship';
import { Button } from '../ui/button';

interface RoutePlannerProps {
  ship: Ship;
  onRoutePlanned?: (route: RouteResponse) => void;
  onClose?: () => void;
}

const RoutePlanner: React.FC<RoutePlannerProps> = ({ ship, onRoutePlanned, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [plannedRoute, setPlannedRoute] = useState<RouteResponse | null>(null);
  const [departureTime, setDepartureTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handlePlanRoute = async () => {
    setLoading(true);
    setError(null);

    try {
      const route = await navigationApi.planRoute(ship, departureTime);
      setPlannedRoute(route);

      if (route.recommended_departure !== departureTime) {
        console.log(`시스템 추천 출발시간: ${route.recommended_departure}분 (${route.time_saved_minutes}분 절약)`);
      }
    } catch (err) {
      setError('경로 계획 실패: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRoute = async (accept: boolean) => {
    if (!plannedRoute) return;

    setLoading(true);
    try {
      const finalRoute = await navigationApi.acceptRoute(ship.id, accept);

      if (onRoutePlanned) {
        onRoutePlanned(finalRoute);
      }

      // Show success message
      const mode = accept ? '수용 O (유연한 시간)' : '수용 X (고정 시간)';
      console.log(`경로 확정: ${mode}`);

      // Close planner
      if (onClose) {
        onClose();
      }
    } catch (err) {
      setError('경로 승인 실패: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
  };

  return (
    <div className="route-planner-container" style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      width: '380px',
      zIndex: 1000,
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
          🚢 경로 계획: {ship.name}
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <strong>출발지:</strong> 현재 위치
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>목적지:</strong> {ship.destination}
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>속도:</strong> {ship.speed} 노트
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          희망 출발 시간 (분 후):
        </label>
        <input
          type="number"
          value={departureTime}
          onChange={(e) => setDepartureTime(Number(e.target.value))}
          disabled={loading}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px'
          }}
          min="0"
        />
      </div>

      {error && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '6px',
          padding: '10px',
          marginBottom: '15px',
          color: '#DC2626'
        }}>
          {error}
        </div>
      )}

      {!plannedRoute && (
        <Button
          onClick={handlePlanRoute}
          disabled={loading}
          style={{
            width: '100%',
            background: '#10B981',
            color: 'white',
            padding: '10px',
            borderRadius: '6px',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? '계획 중...' : '경로 계획'}
        </Button>
      )}

      {plannedRoute && (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            background: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '20px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#047857' }}>
              📊 경로 분석 결과
            </h4>

            <div style={{ marginBottom: '8px' }}>
              <strong>총 거리:</strong> {plannedRoute.total_distance_nm.toFixed(1)} 해리
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>예상 소요시간:</strong> {formatTime(plannedRoute.total_duration_minutes)}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>도착 예정:</strong> {formatTime(plannedRoute.arrival_time)}
            </div>

            {plannedRoute.recommended_departure !== departureTime && (
              <div style={{
                marginTop: '12px',
                padding: '10px',
                background: '#FEF3C7',
                borderRadius: '6px',
                border: '1px solid #FCD34D'
              }}>
                <div style={{ marginBottom: '5px', fontWeight: 'bold', color: '#92400E' }}>
                  ⚡ 최적화 추천
                </div>
                <div style={{ fontSize: '14px' }}>
                  출발 시간을 {formatTime(plannedRoute.recommended_departure)}로 조정하면
                  {plannedRoute.time_saved_minutes && (
                    <span> {formatTime(plannedRoute.time_saved_minutes)} 단축 가능</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {plannedRoute.recommended_departure !== departureTime ? (
              <>
                <Button
                  onClick={() => handleAcceptRoute(true)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    background: '#10B981',
                    color: 'white',
                    padding: '10px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  수용 O<br />
                  <small>(추천 시간)</small>
                </Button>
                <Button
                  onClick={() => handleAcceptRoute(false)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    background: '#F59E0B',
                    color: 'white',
                    padding: '10px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  수용 X<br />
                  <small>(원래 시간)</small>
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleAcceptRoute(true)}
                disabled={loading}
                style={{
                  width: '100%',
                  background: '#10B981',
                  color: 'white',
                  padding: '10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                경로 확정
              </Button>
            )}
          </div>

          <Button
            onClick={() => {
              setPlannedRoute(null);
              setError(null);
            }}
            style={{
              width: '100%',
              marginTop: '10px',
              background: '#E5E7EB',
              color: '#374151',
              padding: '8px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            다시 계획
          </Button>
        </div>
      )}
    </div>
  );
};

export default RoutePlanner;