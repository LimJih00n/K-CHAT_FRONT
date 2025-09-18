import React from 'react';
import { Ship } from 'lucide-react';

interface ShipInfoCardProps {
  name: string;
  speed: number;
  heading: number;
  destination: string;
  status: string;
  isDarkMode: boolean;
  onClose?: () => void;
}

const ShipInfoCard: React.FC<ShipInfoCardProps> = ({
  name,
  speed,
  heading,
  destination,
  status,
  isDarkMode,
  onClose
}) => {
  return (
    <div className={`backdrop-blur-xl rounded-2xl p-4 w-[220px] shadow-xl transition-all duration-300 border border-white/30 bg-white/2 text-white`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Ship className="w-4 h-4 text-blue-400" />
          <h3 className={`text-lg font-bold text-white`}>
            {name}
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`w-6 h-6 rounded-full transition-all duration-200 hover:scale-105 border border-white/30 bg-white/10 hover:bg-white/20 text-white`}
            aria-label="닫기"
          >
            ×
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className={`text-sm text-white`}>
          <span className="font-medium">속도:</span>
          <span className="ml-2 text-blue-400 font-semibold">{speed} knots</span>
        </div>

        <div className={`text-sm text-white`}>
          <span className="font-medium">방향:</span>
          <span className={`ml-2 font-semibold text-gray-400`}>{heading}°</span>
        </div>

        <div className={`text-sm text-white`}>
          <span className="font-medium">목적지:</span>
          <span className={`ml-2 font-semibold text-gray-400`}>{destination}</span>
        </div>

        <div className={`text-sm text-white`}>
          <span className="font-medium">상태:</span>
          <span className={`ml-2 font-semibold ${
            status === '정상' ? 'text-green-400' :
            status === '주의' ? 'text-yellow-400' :
            status === '긴급' ? 'text-red-400' :
            'text-gray-400'
          }`}>{status}</span>
        </div>
      </div>

      <div className={`mt-3 pt-3 border-t text-xs text-center italic border-white/20 text-white/70`}>
        클릭하여 경로 표시/숨기기
      </div>
    </div>
  );
};

export default ShipInfoCard;