# K-means 클러스터링 기능 구현

## 작업 일시
2025년 9월 13일

## 작업 개요
선박 혼잡도 분석을 위한 K-means 클러스터링 기능을 구현하여 선박이 군집을 이루는 지역에서 열분포 형태의 시각화를 제공합니다.

## 완료된 작업

### 1. K-means 클러스터링 유틸리티 함수 생성
- **파일**: `src/utils/clustering.ts`
- **내용**:
  - KMeans 클래스 구현 (K-means++ 초기화 포함)
  - 클러스터링 알고리즘 실행 함수
  - 적응적 K 값 설정 (선박 수에 따라 자동 조정)
  - 엘보우 방법을 통한 최적 K 값 찾기 함수

### 2. ClusterLayer 클래스 구현
- **파일**: `src/components/Map/layers/ClusterLayer.ts`
- **내용**:
  - 클러스터 히트맵 레이어 (가우시안 분포 효과)
  - 클러스터 영역 표시 (원형)
  - 클러스터 중심점 마커
  - 클러스터 라벨 (군집 정보 표시)
  - 밀도에 따른 색상 그라데이션 (파랑 → 빨강)

### 3. MapCore에 클러스터링 모드 추가
- **파일**: `src/components/Map/MapCore.tsx`
- **변경사항**:
  - ClusterLayer import 및 ref 추가
  - initializeLayers에 클러스터 초기화 로직 추가
  - handleTimeUpdate에 클러스터 업데이트 로직 추가
  - toggleClustering 함수 구현
  - ControlPanel에 클러스터링 props 전달

### 4. 컨트롤 패널에 클러스터링 토글 버튼 추가
- **파일**: `src/components/Map/controls/ControlPanel.tsx`
- **변경사항**:
  - showClustering prop 추가
  - onToggleClustering prop 추가
  - 클러스터링 토글 버튼 UI 구현

### 5. useMapControl 훅 업데이트
- **파일**: `src/hooks/useMapControl.ts`
- **변경사항**:
  - showClustering 상태 추가
  - setShowClustering 함수 추가

## 기술적 특징

### K-means 알고리즘
- **초기화**: K-means++ 방법 사용으로 더 나은 클러스터링 결과
- **수렴**: 허용 오차 0.0001, 최대 반복 100회
- **적응적 K**: 선박 수에 따라 자동으로 클러스터 수 조정 (선박수/3, 최대 k값)

### 시각화 기능
- **히트맵**: 가우시안 분포 효과로 자연스러운 열분포 표현
- **색상 매핑**: 밀도에 따른 6단계 색상 (파랑 → 청록 → 초록 → 노랑 → 주황 → 빨강)
- **동적 반경**: 줌 레벨과 클러스터 크기에 따른 동적 반경 조정
- **클러스터 정보**: 군집 번호, 선박 수, 밀도 정보 라벨 표시

### 성능 최적화
- **빈 클러스터 처리**: 가장 큰 클러스터에서 가장 먼 점을 새 중심으로 설정
- **가우시안 분포 포인트**: 클러스터 중심 주변에 추가 포인트로 자연스러운 분포 표현
- **실시간 업데이트**: 시간 슬라이더와 애니메이션에 따른 실시간 클러스터 업데이트

## 사용법
1. 컨트롤 패널에서 "🧮 클러스터링 OFF" 버튼 클릭
2. 선박이 군집을 이루는 지역에서 열분포 형태의 시각화 확인
3. 시간 슬라이더나 애니메이션을 통해 시간에 따른 클러스터 변화 관찰

## 파일 변경 내역
- `src/utils/clustering.ts` (신규 생성)
- `src/components/Map/layers/ClusterLayer.ts` (신규 생성)
- `src/components/Map/MapCore.tsx` (수정)
- `src/components/Map/controls/ControlPanel.tsx` (수정)
- `src/hooks/useMapControl.ts` (수정)

## 다음 개선 사항
- 클러스터링 알고리즘 성능 최적화
- 사용자 정의 K 값 설정 기능
- 클러스터 분석 통계 정보 표시
- 클러스터 기반 경보 시스템