"use client";

import { useState, useRef, useEffect } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
  useReactFlow,
} from 'reactflow';
import { EdgePopup } from './edge-popup';

interface CustomEdgeData {
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed';
  animated?: boolean;
  showArrow?: boolean;
}

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
}: EdgeProps<CustomEdgeData>) {
  const [showPopup, setShowPopup] = useState(false);
  const { setEdges, getEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Listen for global popup close events
  useEffect(() => {
    const handleGlobalPopupClose = (event: CustomEvent) => {
      const exceptEdgeId = event.detail?.exceptEdgeId;
      if (exceptEdgeId !== id && showPopup) {
        setShowPopup(false);
      }
    };

    document.addEventListener('closeAllPopups', handleGlobalPopupClose as EventListener);
    return () => {
      document.removeEventListener('closeAllPopups', handleGlobalPopupClose as EventListener);
    };
  }, [id, showPopup]);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Close other popups first
    const popupCloseEvent = new CustomEvent('closeAllPopups', { detail: { exceptEdgeId: id } });
    document.dispatchEvent(popupCloseEvent);
    
    setShowPopup(true);
  };

  const updateEdgeData = (updates: Partial<CustomEdgeData>) => {
    const edges = getEdges();
    const updatedEdges = edges.map(edge => 
      edge.id === id 
        ? { ...edge, data: { ...edge.data, ...updates } }
        : edge
    );
    setEdges(updatedEdges);
  };

  const handleDelete = () => {
    const edges = getEdges();
    const updatedEdges = edges.filter(edge => edge.id !== id);
    setEdges(updatedEdges);
    setShowPopup(false);
  };

  // Edge styling
  const strokeColor = data?.strokeColor || '#70f';
  const strokeWidth = data?.strokeWidth || 2;
  const strokeStyle = data?.strokeStyle || 'solid';
  const animated = data?.animated || false;
  const showArrow = data?.showArrow !== true; // Default to true

  const edgeStyle = {
    stroke: strokeColor,
    strokeWidth,
    strokeDasharray: strokeStyle === 'dashed' ? '5,5' : 'none',
    ...style,
  };

  // Arrow marker ID
  const markerId = `arrow-${id}`;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth="12"
          markerHeight="12"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0,0 0,6 9,3"
            fill={strokeColor}
            stroke={strokeColor}
            strokeWidth="1"
          />
        </marker>
      </defs>
      
      {/* Wrap BaseEdge in a group with onClick handler */}
      <g onClick={handleClick}>
        <BaseEdge
          path={edgePath}
          style={{
            ...edgeStyle,
            markerEnd: showArrow ? `url(#${markerId})` : 'none',
            filter: selected ? `drop-shadow(0 0 6px ${strokeColor})` : `drop-shadow(0 0 3px ${strokeColor})`,
            animation: animated ? 'flow 1s linear infinite' : 'none',
          }}
        />
      </g>
      
      {/* Only show the button when the edge is selected */}
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              className={`w-4 h-4 bg-white dark:bg-gray-800 border-2 rounded-full hover:scale-110 transition-all opacity-100 border-blue-500 shadow-sm hover:shadow-md`}
              style={{ borderColor: strokeColor }}
              onClick={handleClick}
              title="Customize edge"
            >
              <div className="w-1 h-1 bg-gray-400 rounded-full mx-auto" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Edge Popup */}
      {showPopup && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 0}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <EdgePopup
              edgeId={id}
              edgeData={data || {}}
              onClose={() => setShowPopup(false)}
              onUpdateData={updateEdgeData}
              onDelete={handleDelete}
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}