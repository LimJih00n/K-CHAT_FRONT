import React from 'react';

const Legend: React.FC = () => {
  return (
    <div style={{
      position: 'absolute',
      bottom: 40,
      right: 20,
      background: 'rgba(10, 10, 10, 0.85)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
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
  );
};

export default Legend;