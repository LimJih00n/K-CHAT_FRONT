import React from 'react';

interface TimeSliderProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

const TimeSlider: React.FC<TimeSliderProps> = ({ value, onChange, max = 120 }) => {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) {
      return `${mins}분`;
    }
    return `${hours}시간 ${mins}분`;
  };

  return (
    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 backdrop-blur-xl bg-white/2 border border-white/30 rounded-3xl p-4 min-w-[400px] text-white shadow-xl">
      <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
        시간 예측: +{formatTime(value)}
      </div>
      <input
        type="range"
        min="0"
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          height: '6px',
          borderRadius: '3px',
          background: `linear-gradient(to right, #00d4ff 0%, #00d4ff ${(value / max) * 100}%, #333 ${(value / max) * 100}%, #333 100%)`,
          outline: 'none',
          WebkitAppearance: 'none',
          appearance: 'none',
          cursor: 'pointer'
        }}
      />
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '5px',
        fontSize: '11px',
        opacity: 0.6
      }}>
        <span>현재</span>
        <span>+30분</span>
        <span>+1시간</span>
        <span>+1시간 30분</span>
        <span>+2시간</span>
      </div>
    </div>
  );
};

export default TimeSlider;