import { useEffect, useRef, useState } from 'react';
import logo from '@/assets/grofit-logo.png';

interface WatermarkedImageProps {
  src: string;
  alt: string;
  className?: string;
}

export default function WatermarkedImage({ src, alt, className = '' }: WatermarkedImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsLoading(true);

    // Load the main image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the main image
      ctx.drawImage(img, 0, 0);

      // Load and draw the watermark
      const watermark = new Image();
      watermark.crossOrigin = 'anonymous';
      
      watermark.onload = () => {
        // Calculate watermark size (10% of image width)
        const watermarkWidth = img.width * 0.15;
        const watermarkHeight = (watermark.height / watermark.width) * watermarkWidth;

        // Position watermark in bottom-right corner with padding
        const padding = img.width * 0.03;
        const x = img.width - watermarkWidth - padding;
        const y = img.height - watermarkHeight - padding;

        // Draw semi-transparent white background for watermark
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(x - 5, y - 5, watermarkWidth + 10, watermarkHeight + 10);

        // Draw watermark with slight transparency
        ctx.globalAlpha = 0.8;
        ctx.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);
        ctx.globalAlpha = 1.0;

        setIsLoading(false);
      };

      watermark.onerror = () => {
        // If watermark fails to load, just show the image without it
        setIsLoading(false);
      };

      watermark.src = logo;
    };

    img.onerror = () => {
      setIsLoading(false);
    };

    img.src = src;
  }, [src]);

  return (
    <div className="relative">
      {isLoading && (
        <div className={`bg-muted rounded flex items-center justify-center ${className}`}>
          <p className="text-sm text-muted-foreground">Laden...</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`${className} ${isLoading ? 'hidden' : ''}`}
      />
    </div>
  );
}
