import React from 'react';
import { Button } from '@/components/ui/button';

interface AnimationControlProps {
  isAnimating: boolean;
  animationSpeed: number;
  onToggleAnimation: () => void;
  onSetSpeed: (speed: number) => void;
  onReset: () => void;
}

const AnimationControl: React.FC<AnimationControlProps> = ({
  isAnimating,
  animationSpeed,
  onToggleAnimation,
  onSetSpeed,
  onReset
}) => {
  return (
    <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 backdrop-blur-xl bg-white/2 border border-white/30 rounded-3xl p-3 flex gap-3 items-center text-white shadow-xl">
      <Button
        onClick={onToggleAnimation}
        className={`px-4 py-2 border border-white/30 transition-all duration-300 hover:scale-[1.02] ${
          isAnimating
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
        }`}
        variant="ghost"
      >
        {isAnimating ? '⏸️ 일시정지' : '▶️ 시뮬레이션 시작'}
      </Button>

      <div className="flex gap-2">
        {[1, 2, 5].map(speed => (
          <Button
            key={speed}
            onClick={() => onSetSpeed(speed)}
            size="sm"
            className={`border border-white/30 transition-all duration-300 hover:scale-[1.02] ${
              animationSpeed === speed
                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                : 'bg-white/2 hover:bg-white/5 text-white'
            }`}
            variant="ghost"
          >
            {speed}x
          </Button>
        ))}
      </div>

      <Button
        onClick={onReset}
        size="sm"
        className="bg-white/2 hover:bg-white/5 border border-white/30 text-white transition-all duration-300 hover:scale-[1.02]"
        variant="ghost"
      >
        ⏮️ 리셋
      </Button>
    </div>
  );
};

export default AnimationControl;