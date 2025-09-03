import React from 'react';

interface OpsZeroLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export const OpsZeroLogo: React.FC<OpsZeroLogoProps> = ({ 
  className = '', 
  width = 200, 
  height = 80 
}) => {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 600 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* "ops" text in white */}
      <g>
        {/* O */}
        <circle cx="80" cy="120" r="50" stroke="white" strokeWidth="12" fill="none" />
        
        {/* P */}
        <path d="M180 70 L180 170 M180 70 L220 70 Q250 70 250 100 Q250 130 220 130 L180 130" 
              stroke="white" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* S */}
        <path d="M340 90 Q340 70 310 70 Q280 70 280 90 Q280 110 310 120 Q340 130 340 150 Q340 170 310 170 Q280 170 280 150" 
              stroke="white" strokeWidth="12" fill="none" strokeLinecap="round" />
      </g>
      
      {/* "0" with overlapping blue gradient rings */}
      <g>
        {/* First ring (back) - darker blue */}
        <circle cx="450" cy="120" r="50" stroke="url(#gradient1)" strokeWidth="12" fill="none" opacity="0.8" />
        
        {/* Second ring (front) - lighter blue */}
        <circle cx="470" cy="100" r="50" stroke="url(#gradient2)" strokeWidth="12" fill="none" />
      </g>
      
      {/* Gradients */}
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4A90E2" />
          <stop offset="100%" stopColor="#357ABD" />
        </linearGradient>
        <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6BB6FF" />
          <stop offset="100%" stopColor="#4A90E2" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default OpsZeroLogo;