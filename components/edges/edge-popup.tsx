"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Palette,
  Minus,
  MoreHorizontal,
  Trash2,
  ArrowRight,
  Zap,
  Square,
} from 'lucide-react';

interface EdgePopupProps {
  edgeId: string;
  edgeData: any;
  onClose: () => void;
  onUpdateData: (updates: any) => void;
  onDelete: () => void;
}

const edgeColors = [
  { name: 'Purple', value: '#70f' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
];

const strokeWidths = [
  { name: 'Thin', value: 1 },
  { name: 'Normal', value: 2 },
  { name: 'Thick', value: 3 },
  { name: 'Extra Thick', value: 4 },
];

export function EdgePopup({ edgeId, edgeData, onClose, onUpdateData, onDelete }: EdgePopupProps) {
  const [showColors, setShowColors] = useState(false);
  const [showWidths, setShowWidths] = useState(false);
  const [showStyles, setShowStyles] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleColorChange = (color: string) => {
    onUpdateData({ strokeColor: color });
    setShowColors(false);
  };

  const handleWidthChange = (width: number) => {
    onUpdateData({ strokeWidth: width });
    setShowWidths(false);
  };

  const handleStyleChange = (style: 'solid' | 'dashed') => {
    onUpdateData({ strokeStyle: style });
    setShowStyles(false);
  };

  const toggleArrow = () => {
    onUpdateData({ showArrow: !edgeData.showArrow });
  };

  const toggleAnimation = () => {
    onUpdateData({ animated: !edgeData.animated });
  };

  const closeAllDropdowns = () => {
    setShowColors(false);
    setShowWidths(false);
    setShowStyles(false);
  };

  return (
    <div
      ref={popupRef}
      data-popup-id={edgeId}
      className="bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-600 rounded-md shadow-xl p-0 z-10"
      style={{ minWidth: '40px', minHeight:'60px' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-center flex-col gap-1 h-16 p-1">
        <div className='h-1/3 w-full flex flex-row gap-1'>
          {/* Color */}
          <div className="relative h-full flex justify-center items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-full w-2 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => {
                setShowColors(!showColors);
                setShowWidths(false);
                setShowStyles(false);
              }}
              title="Edge Color"
            >
              <Palette className="h-1 w-1" />
            </Button>

            {showColors && (
              <div className="absolute top-7 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-2 shadow-lg z-10">
                <div className="grid grid-cols-3 gap-1 w-16">
                  {edgeColors.map((color, index) => (
                    <button
                      key={index}
                      className="h-4 w-4 rounded border border-gray-300 dark:border-gray-500 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color.value }}
                      onClick={() => handleColorChange(color.value)}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Width */}
          <div className="relative h-full flex justify-center items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-full w-2 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => {
                setShowWidths(!showWidths);
                setShowColors(false);
                setShowStyles(false);
              }}
              title="Line Width"
            >
              <Square className="h-1 w-1" />
            </Button>

            {showWidths && (
              <div className="absolute top-7 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-1 shadow-lg z-10 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  {strokeWidths.map((width, index) => (
                    <button
                      key={index}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-xs"
                      onClick={() => handleWidthChange(width.value)}
                    >
                      <div
                        className="bg-gray-600 rounded"
                        style={{
                          width: '10px',
                          height: `${width.value}px`,
                          minHeight: '1px'
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className='h-1/3 w-full flex flex-row gap-1'>
          {/* Style */}
          <div className="relative h-full flex justify-center items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-full w-2 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => {
                setShowStyles(!showStyles);
                setShowColors(false);
                setShowWidths(false);
              }}
              title="Line Style"
            >
              <Minus className="h-1 w-1" />
            </Button>

            {showStyles && (
              <div className="absolute top-7 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-1 shadow-lg z-10 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <button
                    className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-xs"
                    onClick={() => handleStyleChange('solid')}
                  >
                    <Minus className="h-2 w-2" />
                  </button>
                  <button
                    className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-xs"
                    onClick={() => handleStyleChange('dashed')}
                  >
                    <MoreHorizontal className="h-2 w-2" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Arrow Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={`h-full w-4 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 ${edgeData.showArrow !== false ? 'text-blue-500' : 'text-gray-400'
              }`}
            onClick={toggleArrow}
            title="Toggle Arrow"
          >
            <ArrowRight className="h-2 w-2" />
          </Button>
        </div>

        <div className='h-1/3 w-full flex flex-row gap-1'>
          {/* Animation Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={`h-full w-2 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 ${edgeData.animated ? 'text-yellow-500' : 'text-gray-400'
              }`}
            onClick={toggleAnimation}
            title="Toggle Animation"
          >
            <Zap className="h-1 w-1" />
          </Button>

          {/* Delete */}
          <Button
            variant="ghost"
            size="sm"
            className="h-full w-2 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-1 w-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}