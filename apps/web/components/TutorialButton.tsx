'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';

interface TutorialButtonProps {
  className?: string;
  onClick?: () => void;
}

export default function TutorialButton({ className = '', onClick }: TutorialButtonProps) {

  return (
    <button
      onClick={onClick}
      className={`
        relative group flex items-center justify-center w-9 h-9 
        text-gray-600 hover:text-blue-600 hover:bg-blue-50 
        rounded-lg transition-all duration-200
        ${className}
      `}
      title="Tutorial & Help"
    >
      <HelpCircle className="w-5 h-5" />
      
      {/* Tooltip */}
      <div className="absolute top-full mt-2 right-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
        Tutorial & Help
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
      </div>

      {/* Subtle animation dot */}
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full opacity-75 animate-pulse"></div>
    </button>
  );
}