"use client";

import { useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  Connection,
  Edge,
  Node,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Controls,
  Background,
  useReactFlow,
  OnSelectionChangeParams,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppStore } from '@/lib/store';
import { CustomNode } from './nodes/custom-node';
import { Toolbar } from './toolbar';

const nodeTypes = {
  custom: CustomNode,
};

function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const {
    currentTool,
    setCurrentTool,
    currentLayout,
    nodes,
    edges,
    setNodes,
    setEdges,
    saveToHistory,
    undo,
    selectedNodes,
    setSelectedNodes,
    clipboard,
    setClipboard,
  } = useAppStore();

  const { project } = useReactFlow();

  // Generate unique ID for new nodes
  const generateNodeId = useCallback(() => `node-${Date.now()}-${Math.random()}`, []);
  const generateEdgeId = useCallback(() => `edge-${Date.now()}-${Math.random()}`, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Copy (Ctrl+C)
      if (event.ctrlKey && event.key === 'c') {
        event.preventDefault();
        if (selectedNodes.length > 0) {
          const selectedNodeIds = selectedNodes.map(node => node.id);
          const selectedEdges = edges.filter(edge => 
            selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target)
          );
          setClipboard({ nodes: selectedNodes, edges: selectedEdges });
        }
      }
      
      // Paste (Ctrl+V)
      if (event.ctrlKey && event.key === 'v') {
        event.preventDefault();
        if (clipboard) {
          const nodeIdMap = new Map();
          const newNodes = clipboard.nodes.map(node => {
            const newId = generateNodeId();
            nodeIdMap.set(node.id, newId);
            return {
              ...node,
              id: newId,
              position: {
                x: node.position.x + 50,
                y: node.position.y + 50,
              },
              selected: false,
            };
          });
          
          const newEdges = clipboard.edges.map(edge => ({
            ...edge,
            id: generateEdgeId(),
            source: nodeIdMap.get(edge.source),
            target: nodeIdMap.get(edge.target),
          }));
          
          setNodes([...nodes, ...newNodes]);
          setEdges([...edges, ...newEdges]);
          saveToHistory();
        }
      }
      
      // Delete (Del)
      if (event.key === 'Delete') {
        event.preventDefault();
        if (selectedNodes.length > 0) {
          const selectedNodeIds = selectedNodes.map(node => node.id);
          setNodes(nodes.filter(node => !selectedNodeIds.includes(node.id)));
          setEdges(edges.filter(edge => 
            !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target)
          ));
          setSelectedNodes([]);
          saveToHistory();
        }
      }
      
      // Undo (Ctrl+Z)
      if (event.ctrlKey && event.key === 'z') {
        event.preventDefault();
        undo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodes, nodes, edges, clipboard, setNodes, setEdges, setSelectedNodes, setClipboard, saveToHistory, undo, generateNodeId, generateEdgeId]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes(applyNodeChanges(changes, nodes));
    },
    [nodes, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(applyEdgeChanges(changes, edges));
    },
    [edges, setEdges]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = { 
        id: generateEdgeId(),
        ...params,
        style: { stroke: '#70f', strokeWidth: 2 },
      };
      setEdges(addEdge(newEdge, edges));
      saveToHistory();
    },
    [edges, setEdges, saveToHistory, generateEdgeId]
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      // Close any open popups and editing state when clicking on empty canvas
      const state = useAppStore.getState();
      state.setEditingNodeId(null);
      
      // Force close all popups by triggering a global popup close event
      const popupCloseEvent = new CustomEvent('closeAllPopups');
      document.dispatchEvent(popupCloseEvent);
      
      if (currentTool === 'select') return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newNode: Node = {
        id: generateNodeId(),
        type: 'custom',
        position,
        data: {
          label: '',
          nodeType: currentTool === 'label' ? 'label' : currentTool,
          width: currentTool === 'label' ? 80 : currentTool === 'circle' ? 80 : 90,
          height: currentTool === 'label' ? 30 : currentTool === 'circle' ? 80 : 60,
          backgroundColor: undefined,
          textColor: undefined,
          borderStyle: 'solid',
        },
      };

      setNodes([...nodes, newNode]);
      saveToHistory();
      
      // Auto-switch back to select mode after creating a shape
      setCurrentTool('select');
    },
    [currentTool, project, nodes, setNodes, saveToHistory, setCurrentTool, generateNodeId]
  );

  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      setSelectedNodes(params.nodes);
    },
    [setSelectedNodes]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.stopPropagation();
      // Allow the node's own click handler to manage popup state
    },
    []
  );

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
    },
    []
  );

  const onNodeDragStop = useCallback(() => {
    saveToHistory();
  }, [saveToHistory]);

  // Custom node types with layout-aware handles
  const nodeTypes = useMemo(() => ({
    custom: (props: any) => <CustomNode {...props} layout={currentLayout} />,
  }), [currentLayout]);

  return (
    <div className="w-full h-full" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50 dark:bg-[#0a0a0a]"
        nodesDraggable={currentTool === 'select'}
        nodesConnectable={currentTool === 'select'}
        elementsSelectable={currentTool === 'select'}
        panOnDrag={currentTool === 'select'}
        zoomOnScroll={currentTool === 'select'}
        // connectionMode="loose"
      >
        <Controls 
          position="bottom-right" 
          className="bg-white dark:bg-[#101010] border border-gray-200 dark:border-gray-700"
        />
      </ReactFlow>
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <Toolbar />
      <FlowCanvas />
    </ReactFlowProvider>
  );
}