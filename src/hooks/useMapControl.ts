import { useState, useEffect, useRef } from 'react';

export const useMapControl = () => {
  const [is3D, setIs3D] = useState(true);
  const [showCongestion, setShowCongestion] = useState(true);
  const [showClustering, setShowClustering] = useState(false);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const toggleShowAllRoutes = () => {
    setShowAllRoutes(!showAllRoutes);
    setSelectedShipId(null);
  };

  return {
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
  };
};