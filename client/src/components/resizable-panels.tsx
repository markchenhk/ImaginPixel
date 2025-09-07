import { useState, useRef, useCallback, useEffect } from 'react';

interface ResizablePanelsProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLeftWidth?: number; // percentage (0-100)
  minLeftWidth?: number; // percentage
  maxLeftWidth?: number; // percentage
}

export function ResizablePanels({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 35,
  minLeftWidth = 20,
  maxLeftWidth = 80,
}: ResizablePanelsProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const newLeftWidth = (mouseX / containerRect.width) * 100;

    // Clamp the width between min and max values
    const clampedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newLeftWidth));
    setLeftWidth(clampedWidth);
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden h-full">
      {/* Left Panel */}
      <div 
        className="h-full overflow-hidden"
        style={{ width: `${leftWidth}%` }}
      >
        {leftPanel}
      </div>

      {/* Resizable Divider */}
      <div
        className={`
          w-1 h-full bg-[#2a2a2a] hover:bg-[#ffd700] transition-colors duration-200 cursor-col-resize relative group
          ${isDragging ? 'bg-[#ffd700]' : ''}
        `}
        onMouseDown={handleMouseDown}
        data-testid="panel-divider"
      >
        {/* Visual handle indicator */}
        <div className="absolute inset-y-0 left-0 w-1 bg-current opacity-50" />
        
        {/* Expanded hover area for easier grabbing */}
        <div className="absolute inset-y-0 -left-1 -right-1 w-3" />
        
        {/* Drag handle dots (visible on hover) */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex flex-col gap-1">
            <div className="w-1 h-1 bg-current rounded-full" />
            <div className="w-1 h-1 bg-current rounded-full" />
            <div className="w-1 h-1 bg-current rounded-full" />
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div 
        className="h-full overflow-hidden"
        style={{ width: `${100 - leftWidth}%` }}
      >
        {rightPanel}
      </div>
    </div>
  );
}