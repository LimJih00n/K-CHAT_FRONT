# Ship Control System - 프로젝트 작업 요약

## 📅 작업 날짜: 2025-09-16

## 🎯 프로젝트 개요

선박 관제 시스템으로 구룡포항 해역의 선박들을 실시간으로 모니터링하고 최적 경로를 계획하는 시스템입니다.

### 구성 요소
- **Frontend**: React + TypeScript + Mapbox GL (포트: 5173)
- **Backend**: FastAPI + Python + SQLite (포트: 8000)

---

## 🔧 주요 작업 내역

### 1. 테스트 모드 제거
- **작업 내용**: 구룡포 집중 테스트 모드 관련 기능 완전 제거
- **변경 파일**:
  - `/src/data/ships.json` - testModeShips 배열 제거 (10개 테스트 선박 삭제)
  - 관련 컴포넌트에서 테스트 모드 로직 제거

### 2. 2D/3D 모드 전환 버그 수정
- **문제**: 2D 모드로 전환 시 선박이 사라지는 현상
- **해결**:
  ```typescript
  // MapCore.tsx - toggle3D 함수 수정
  map.current.once('style.load', () => {
    // 모든 레이어 참조 리셋
    shipLayerRef.current = null;
    // 레이어 재초기화
    initializeLayers(ships);
    // 선박 레이어 재구성
    shipLayerRef.current.initialize(ships, new3D);
  });
  ```
- **결과**: 2D/3D 전환 시 모든 선박과 경로가 정상 표시

### 3. 색상 시스템 통일
- **작업 내용**: 선박 마커와 경로 색상 일치
- **색상 체계**:
  - Normal (정상): `#10B981` (에메랄드 그린)
  - Warning (경고): `#F59E0B` (앰버)
  - Emergency (긴급): `#EF4444` (레드)
- **변경 파일**: `/src/components/Map/layers/ShipLayer.ts`

### 4. Backend API 연동
- **새로 생성한 파일**:
  - `/src/services/navigationApi.ts` - API 통신 레이어
  - `/src/components/RoutePlanner/RoutePlanner.tsx` - 경로 계획 UI
  - `/src/components/ShipManagementPanel/ShipManagementPanel.tsx` - 선박 관리 패널

#### API 엔드포인트
```typescript
const API_BASE_URL = 'http://localhost:8000/api'

// 주요 API
GET    /api/ships           // 선박 목록 조회
POST   /api/route/plan      // 경로 계획 요청
POST   /api/route/accept    // 경로 승인/거부
DELETE /api/ship/{id}       // 선박 삭제
```

#### 좌표 변환 시스템
```typescript
// Backend: 픽셀 좌표 (2000x1400 그리드)
// Frontend: GPS 좌표 (위도/경도)
const GURYONGPO_CENTER = { lat: 35.9896, lng: 129.5554 };
const DEGREES_PER_PIXEL = 0.00001;

// 변환 함수
convertLatLngToPixel([lng, lat]): [x, y]
convertPixelToLatLng([x, y]): [lng, lat]
```

### 5. 선박 관리 패널 구현
- **위치**: 우측 상단 (right: 20px, top: 20px)
- **디자인**: Glass Morphism (backdrop-blur-xl, bg-white/10)
- **기능**:
  - Backend 선박 실시간 목록 (3초 간격 폴링)
  - 경로 재계획 버튼
  - 선박 삭제 기능
  - 수용 O/X 모드 표시
  - 접기/펼치기 기능

### 6. 구룡포항 좌표 수정
- **이전**: [129.5560, 35.9940]
- **수정**: [129.5554, 35.9896]
- **출처**: 한국관광공사 공식 데이터
- **효과**: 실제 구룡포항 부두 위치에 정확히 매칭

### 7. 2D 모드 클러스터링 지원
- **문제**: 클러스터링이 3D 모드에서만 표시
- **해결**:
  ```typescript
  // MapCore.tsx - toggle3D 함수
  if (showClustering && clusterLayerRef.current) {
    clusterLayerRef.current.toggleVisibility(true);
    clusterLayerRef.current.update(ships, timeOffset);
  }
  ```
- **결과**: 2D/3D 모두에서 히트맵 클러스터링 표시

### 8. Backend 중복 ship_id 에러 수정
- **문제**: 같은 선박 재계획 시 UNIQUE constraint 에러
- **해결**: UPDATE/INSERT 분기 처리
  ```python
  # app.py
  existing = db.query(DBShipRoute).filter(DBShipRoute.ship_id == request.ship_id).first()
  if existing:
      # UPDATE 기존 레코드
  else:
      # INSERT 새 레코드
  ```

---

## 📊 데이터 흐름

### 1. 선박 데이터 로드
```
Frontend 시작
    ↓
Backend API ON/OFF 확인
    ↓
[ON] navigationApi.getAllShips() → 백엔드 선박 + 로컬 JSON 병합
[OFF] 로컬 JSON 데이터만 사용 (20개 선박)
    ↓
3초마다 자동 갱신 (폴링)
```

### 2. 경로 계획 프로세스
```
Ctrl+클릭 or "경로 재계획" 버튼
    ↓
RoutePlanner 컴포넌트 오픈
    ↓
POST /api/route/plan (출발시간, 속도, 위치 전송)
    ↓
Backend: A* 알고리즘 경로 최적화
    ↓
추천 출발시간 제시
    ↓
사용자 선택: "수용 O" (flexible) / "수용 X" (fixed)
    ↓
POST /api/route/accept
    ↓
지도에 최종 경로 표시
```

### 3. 시간 시뮬레이션
```
TimeSlider 조작 (0~120분)
    ↓
calculateShipPosition(ship, timeOffset)
    ↓
경로를 따라 보간된 위치 계산
    ↓
선박 아이콘 실시간 이동
```

---

## 🐛 해결된 버그
1. ✅ 2D 모드 전환 시 선박 사라짐
2. ✅ 선박 마커와 경로 색상 불일치
3. ✅ Backend 중복 ship_id 에러
4. ✅ navigationApi의 RouteStatus 타입 export 에러
5. ✅ 2D 모드에서 클러스터링 미표시

---

## 📁 프로젝트 구조

```
ship-control/
├── src/
│   ├── components/
│   │   ├── Map/
│   │   │   ├── MapCore.tsx          # 메인 지도 컴포넌트
│   │   │   ├── layers/
│   │   │   │   ├── ShipLayer.ts     # 선박 표시 레이어
│   │   │   │   ├── ClusterLayer.ts  # 클러스터링 레이어
│   │   │   │   └── CongestionLayer.ts
│   │   │   └── controls/
│   │   │       └── ControlPanel.tsx
│   │   ├── RoutePlanner/
│   │   │   └── RoutePlanner.tsx     # 경로 계획 UI
│   │   └── ShipManagementPanel/
│   │       └── ShipManagementPanel.tsx # 선박 관리 패널
│   ├── services/
│   │   ├── navigationApi.ts         # Backend API 통신
│   │   └── shipService.ts          # 선박 데이터 관리
│   ├── utils/
│   │   └── shipUtils.ts            # 선박 관련 유틸리티
│   └── types/
│       └── ship.ts                 # 타입 정의
└── work-log/
    └── project-summary.md          # 이 문서

awesome-ship-navigator/ (Backend)
├── app.py                          # FastAPI 메인
├── database.py                     # SQLAlchemy 설정
├── core_optimizer.py               # A* 경로 최적화
└── models.py                       # Pydantic 모델
```

---

## 🚀 실행 방법

### Backend
```bash
cd awesome-ship-navigator
source venv/bin/activate
python app.py
# http://localhost:8000
```

### Frontend
```bash
cd ship-control
npm run dev
# http://localhost:5173
```

### 사용 방법
1. Frontend에서 "Backend API ON" 토글 활성화
2. Ctrl+클릭으로 선박 선택 → 경로 계획
3. 출발 시간 입력 후 "경로 계획" 클릭
4. "수용 O" (시간 조정 가능) 또는 "수용 X" (고정 시간) 선택
5. TimeSlider로 시간 경과 시뮬레이션

---

## 📝 추후 개선 사항
- [ ] WebSocket 실시간 통신 구현 (현재 3초 폴링)
- [ ] 실제 EUM API 선박 데이터 연동
- [ ] 다중 선박 동시 경로 계획
- [ ] 날씨 데이터 연동
- [ ] 경로 히스토리 관리