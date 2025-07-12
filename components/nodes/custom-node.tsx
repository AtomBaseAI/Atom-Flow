"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useAppStore } from '@/lib/store';
import { NodePopup } from './node-popup';
import { Hexagon } from 'lucide-react';

interface CustomNodeData {
  label: string;
  nodeType: 'rectangle' | 'circle' | 'label';
  width?: number;
  height?: number;
  backgroundColor?: string;
  textColor?: string;
  borderStyle?: 'solid' | 'dashed';
}

interface CustomNodeProps extends NodeProps<CustomNodeData> {
  layout?: 'horizontal' | 'vertical';
}

export function CustomNode({ id, data, selected, layout = 'horizontal' }: CustomNodeProps) {
  const { editingNodeId, setEditingNodeId, nodes, setNodes, saveToHistory } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || '');
  const [showPopup, setShowPopup] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isTextEditing = editingNodeId === id;

  useEffect(() => {
    if (isTextEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isTextEditing]);

  // Listen for global popup close events
  useEffect(() => {
    const handleGlobalPopupClose = (event: CustomEvent) => {
      const exceptNodeId = event.detail?.exceptNodeId;
      if (exceptNodeId !== id && showPopup) {
        setShowPopup(false);
      }
    };

    document.addEventListener('closeAllPopups', handleGlobalPopupClose as EventListener);
    return () => {
      document.removeEventListener('closeAllPopups', handleGlobalPopupClose as EventListener);
    };
  }, [id, showPopup]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNodeId(id);
    setIsEditing(true);
    setShowPopup(false);
  }, [id, setEditingNodeId]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Close other popups first
    const popupCloseEvent = new CustomEvent('closeAllPopups', { detail: { exceptNodeId: id } });
    document.dispatchEvent(popupCloseEvent);
    
    if (!isTextEditing) {
      setShowPopup(true);
    }
  }, [isTextEditing, id]);

  // Close popup when clicking outside or on other nodes
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Don't close if clicking inside the popup
      if (target.closest('[data-popup-id="' + id + '"]')) {
        return;
      }
      
      // Don't close if clicking on the current node
      if (target.closest('[data-node-id="' + id + '"]')) {
        return;
      }
      
      // Close popup if clicking anywhere else (outside node and popup, including canvas or other nodes)
      if (showPopup) {
        setShowPopup(false);
      }
    };

    if (showPopup) {
      // Add event listener with slight delay to avoid immediate closure
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showPopup, id]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLabel(e.target.value);
  }, []);

  const handleTextSubmit = useCallback(() => {
    const updatedNodes = nodes.map(node => 
      node.id === id 
        ? { ...node, data: { ...node.data, label } }
        : node
    );
    setNodes(updatedNodes);
    setEditingNodeId(null);
    setIsEditing(false);
    saveToHistory();
  }, [id, label, nodes, setNodes, setEditingNodeId, saveToHistory]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === 'Escape') {
      setEditingNodeId(null);
      setIsEditing(false);
      setLabel(data.label || '');
    }
  }, [handleTextSubmit, setEditingNodeId, data.label]);

  const handleBlur = useCallback(() => {
    handleTextSubmit();
  }, [handleTextSubmit]);

  const updateNodeData = useCallback((updates: Partial<CustomNodeData>) => {
    const updatedNodes = nodes.map(node => 
      node.id === id 
        ? { ...node, data: { ...node.data, ...updates } }
        : node
    );
    setNodes(updatedNodes);
    saveToHistory();
  }, [id, nodes, setNodes, saveToHistory]);

  const handleDelete = useCallback(() => {
    const updatedNodes = nodes.filter(node => node.id !== id);
    setNodes(updatedNodes);
    setShowPopup(false);
    saveToHistory();
  }, [id, nodes, setNodes, saveToHistory]);

  const getNodeStyle = () => {
    // For circle nodes, ensure width and height are equal to maintain perfect circle
    const isCircle = data.nodeType === 'circle';
    const circleSize = isCircle ? Math.max(data.width || 90, data.height || 60) : undefined;
    
    const baseStyle = {
      width: isCircle ? circleSize : (data.width || 90),
      height: isCircle ? circleSize : (data.height || 60),
      position: 'relative' as const,
      borderRadius: data.nodeType === 'circle' ? '50%' : '8px',
      background: data.backgroundColor || (data.nodeType === 'label' ? 'transparent' : 'white'),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      fontWeight: '500',
      color: data.textColor || '#1f2937',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: data.nodeType === 'label' 
        ? 'none' 
        : `1px ${data.borderStyle || 'solid'} ${selected ? '#70f' : '#e5e7eb'}`,
      userSelect: 'none' as const,
    };

    return baseStyle;
  };

  const isDarkMode = typeof window !== 'undefined' && 
    document.documentElement.classList.contains('dark');

  const hasText = label && label.trim().length > 0;

  return (
    <>
      <div
        className={`react-flow__node-custom ${selected ? 'selected' : ''}`}
        data-node-id={id}
        style={{
          ...getNodeStyle(),
          border: data.nodeType === 'label' 
            ? 'none' 
            : `2px ${data.borderStyle || 'solid'} ${
                selected 
                  ? '#3b82f6' 
                  : isDarkMode 
                    ? '#404040' 
                    : '#e5e7eb'
              }`,
          background: data.backgroundColor || (
            data.nodeType === 'label' 
              ? 'transparent' 
              : isDarkMode 
                ? '#1a1a1a' 
                : 'white'
          ),
          color: data.textColor || (isDarkMode ? '#ffffff' : '#1f2937'),
        }}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
      >
        {/* Text Content or Hexagon Icon */}
        {isTextEditing ? (
          <textarea
            ref={textareaRef}
            value={label}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="editable-text"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              color: 'inherit',
              textAlign: 'center',
              width: '90%',
              height: '90%',
              padding: '4px',
            }}
            placeholder="Enter text..."
          />
        ) : (
          <div 
            className="text-content" 
            style={{ 
              width: '90%', 
              height: '90%',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              wordWrap: 'break-word',
              overflow: 'hidden',
            }}
          >
            {hasText ? (
              label
            ) : (
              <Hexagon 
                className="opacity-50" 
                size={Math.min((data.width || 120) * 0.3, (data.height || 80) * 0.3, 32)}
                style={{
                  color: data.textColor || (isDarkMode ? '#ffffff' : '#1f2937'),
                }}
              />
            )}
          </div>
        )}

        {/* Handles for connections */}
        <>
          {layout === 'horizontal' ? (
            <>
              <Handle 
                type="source" 
                position={Position.Right} 
                className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-0 hover:!opacity-100 !transition-opacity !duration-200" 
                style={{ right: -4 }}
              />
              <Handle 
                type="target" 
                position={Position.Left} 
                className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-0 hover:!opacity-100 !transition-opacity !duration-200" 
                style={{ left: -4 }}
              />
            </>
          ) : (
            <>
              <Handle 
                type="source" 
                position={Position.Bottom} 
                className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-0 hover:!opacity-100 !transition-opacity !duration-200" 
                style={{ bottom: -4 }}
              />
              <Handle 
                type="target" 
                position={Position.Top} 
                className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white !opacity-0 hover:!opacity-100 !transition-opacity !duration-200" 
                style={{ top: -4 }}
              />
            </>
          )}
        </>
      </div>

      {/* Node Popup */}
      {showPopup && !isTextEditing && (
        <NodePopup
          nodeId={id}
          nodeData={data}
          onClose={() => setShowPopup(false)}
          onUpdateData={updateNodeData}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}