import { useState, useEffect, useRef } from 'react';

export const useAnimation = (onTimeUpdate: (offset: number) => void) => {
  const [timeOffset, setTimeOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (isAnimating) {
      let frameCount = 0;
      const animate = () => {
        frameCount++;
        // 3프레임마다 한 번씩만 업데이트 (속도 1/3)
        if (frameCount % 3 === 0) {
          setTimeOffset(prev => {
            const next = prev + animationSpeed * 0.3;
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

  useEffect(() => {
    onTimeUpdate(timeOffset);
  }, [timeOffset, onTimeUpdate]);

  const resetAnimation = () => {
    setTimeOffset(0);
  };

  return {
    timeOffset,
    setTimeOffset,
    isAnimating,
    setIsAnimating,
    animationSpeed,
    setAnimationSpeed,
    resetAnimation
  };
};