import React from 'react';
import MapCore from '../components/Map/MapCore';

const ShipMonitoringPage: React.FC = () => {
  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
      <MapCore />
    </div>
  );
};

export default ShipMonitoringPage;