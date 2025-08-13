'use client';

import { useEffect, useRef } from 'react';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QRCode({ value, size = 128, className = '' }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      generateQRCode(value, canvasRef.current, size);
    }
  }, [value, size]);

  const generateQRCode = (text: string, canvas: HTMLCanvasElement, size: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    // Simple QR code generation (for production, use a proper QR library like qrcode)
    // This creates a simple pattern as a placeholder
    const modules = 25; // QR code grid size
    const moduleSize = size / modules;

    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    // Generate a simple pattern based on text hash
    const hash = hashCode(text);
    ctx.fillStyle = '#000000';

    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        // Create a deterministic pattern based on hash and position
        const shouldFill = ((hash + row * 31 + col * 17) % 3) === 0;
        
        // Add positioning squares (corners)
        const isPositioning = 
          (row < 7 && col < 7) ||
          (row < 7 && col >= modules - 7) ||
          (row >= modules - 7 && col < 7);
        
        if (isPositioning) {
          const inSquare = 
            (row === 0 || row === 6 || col === 0 || col === 6) ||
            (row >= 2 && row <= 4 && col >= 2 && col <= 4);
          if (inSquare) {
            ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
          }
        } else if (shouldFill) {
          ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
        }
      }
    }
  };

  const hashCode = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  };

  return (
    <canvas 
      ref={canvasRef} 
      className={`border border-gray-200 rounded ${className}`}
      style={{ width: size, height: size }}
    />
  );
}