"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Palette,
  Type,
  Square,
  Trash2,
  Minus,
  MoreHorizontal
} from 'lucide-react';

interface NodePopupProps {
  nodeId: string;
  nodeData: any;
  onClose: () => void;
  onUpdateData: (updates: any) => void;
  onDelete: () => void;
}

const backgroundColors = [
  { name: 'Purple Gradient', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Pink Gradient', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'Blue Gradient', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { name: 'Green Gradient', value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
];

const textColors = [
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#ffffff' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Red', value: '#ef4444' },
];

export function NodePopup({ nodeId, nodeData, onClose, onUpdateData, onDelete }: NodePopupProps) {
  const [showBackgroundColors, setShowBackgroundColors] = useState(false);
  const [showTextColors, setShowTextColors] = useState(false);
  const [showBorderOptions, setShowBorderOptions] = useState(false);
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

  const handleBackgroundColorChange = (color: string) => {
    onUpdateData({ backgroundColor: color });
    setShowBackgroundColors(false);
  };

  const handleTextColorChange = (color: string) => {
    onUpdateData({ textColor: color });
    setShowTextColors(false);
  };

  const handleBorderStyleChange = (style: 'solid' | 'dashed') => {
    onUpdateData({ borderStyle: style });
    setShowBorderOptions(false);
  };

  const closeAllDropdowns = () => {
    setShowBackgroundColors(false);
    setShowTextColors(false);
    setShowBorderOptions(false);
  };

  return (
    <div
      ref={popupRef}
      data-popup-id={nodeId}
      className="absolute -top-8 left-1/2 transform -translate-x-1/2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-xl p-0"
      style={{ minWidth: '80px' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-center gap-1 h-5">
        {/* Background Color */}
        <div className="relative h-full flex justify-center items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-full w-3 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => {
              setShowBackgroundColors(!showBackgroundColors);
              setShowTextColors(false);
              setShowBorderOptions(false);
            }}
            title="Background Color"
          >
            <Palette className="h-2 w-2" />
          </Button>

          {showBackgroundColors && (
            <div className="absolute top-6 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-2 shadow-lg z-10">
              <div className="grid grid-cols-2 gap-1 w-10">
                {backgroundColors.map((color, index) => (
                  <button
                    key={index}
                    className="h-4 w-4 rounded border border-gray-300 dark:border-gray-500 hover:scale-110 transition-transform"
                    style={{ background: color.value }}
                    onClick={() => handleBackgroundColorChange(color.value)}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Text Color */}
        <div className="relative h-full flex justify-center items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-full w-3 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => {
              setShowTextColors(!showTextColors);
              setShowBackgroundColors(false);
              setShowBorderOptions(false);
            }}
            title="Text Color"
          >
            <Type className="h-2 w-2" />
          </Button>

          {showTextColors && (
            <div className="absolute top-6 left-0  bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-2 shadow-lg z-10">
              <div className="grid grid-cols-2 gap-1 w-10">
                {textColors.map((color, index) => (
                  <button
                    key={index}
                    className="h-4 w-4 rounded border border-gray-300 dark:border-gray-500 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color.value }}
                    onClick={() => handleTextColorChange(color.value)}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Border Style */}
        <div className="relative h-full flex justify-center items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-full w-3 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => {
              setShowBorderOptions(!showBorderOptions);
              setShowBackgroundColors(false);
              setShowTextColors(false);
            }}
            title="Border Style"
          >
            <Square className="h-2 w-2" />
          </Button>

          {showBorderOptions && (
            <div className="absolute top-6 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-1 shadow-lg z-10 whitespace-nowrap">
              <div className="flex flex-col gap-1">
                <button
                  className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-xs"
                  onClick={() => handleBorderStyleChange('solid')}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-xs"
                  onClick={() => handleBorderStyleChange('dashed')}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Delete */}
        <Button
          variant="ghost"
          size="sm"
          className="h-full w-3 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="h-2 w-2" />
        </Button>
      </div>
    </div>
  );
}