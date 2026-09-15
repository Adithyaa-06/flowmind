"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const initialNodes: Node[] = [
  {
    id: "1",
    position: { x: 250, y: 50 },
    data: { label: "Is this a support request?" },
  },
];

const initialEdges: Edge[] = [];

let nodeIdCounter = 2;

export default function Home() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("flowmind-graph");
    if (saved) {
      const { nodes: savedNodes, edges: savedEdges } = JSON.parse(saved);
      setNodes(savedNodes);
      setEdges(savedEdges);

      const maxId = savedNodes.reduce(
        (max: number, n: Node) => Math.max(max, Number(n.id) || 0),
        0
      );
      nodeIdCounter = maxId + 1;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("flowmind-graph", JSON.stringify({ nodes, edges }));
  }, [nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const isYes = window.confirm(
        "Is this the YES path? (Cancel = NO path)"
      );
      const newEdge: Edge = {
        ...connection,
        id: `${connection.source}-${connection.target}-${isYes ? "yes" : "no"}`,
        label: isYes ? "YES" : "NO",
        style: { stroke: isYes ? "#16a34a" : "#dc2626" },
        labelStyle: { fill: isYes ? "#16a34a" : "#dc2626", fontWeight: 700 },
        data: { branch: isYes ? "YES" : "NO" },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const addNode = () => {
    const id = String(nodeIdCounter++);
    const newNode: Node = {
      id,
      position: {
        x: 250 + Math.random() * 200,
        y: 150 + nodeIdCounter * 80,
      },
      data: { label: "New decision node — double-click to edit" },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const onNodeDoubleClick = (_: React.MouseEvent, node: Node) => {
    setEditingNodeId(node.id);
    setDraftPrompt(node.data.label as string);
  };

  const savePrompt = () => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === editingNodeId
          ? { ...n, data: { ...n.data, label: draftPrompt } }
          : n
      )
    );
    setEditingNodeId(null);
  };

  const runWorkflow = async () => {
    setIsRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/run-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      });
      const data = await res.json();
      setRunResult(
        `Workflow triggered (event: ${data.eventId}). Check http://localhost:8288/runs for live execution.`
      );
    } catch (err) {
      setRunResult(`Error: ${err}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <div
        style={{
          position: "absolute",
          zIndex: 10,
          top: 12,
          left: 12,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <Button onClick={addNode}>+ Add Node</Button>
        <Button onClick={runWorkflow} disabled={isRunning} variant="default">
          {isRunning ? "Running..." : "▶ Run Workflow"}
        </Button>
      </div>

      {runResult && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            top: 60,
            left: 12,
            background: "white",
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: "8px 12px",
            maxWidth: 400,
            fontSize: 13,
          }}
        >
          {runResult}
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      <Dialog
        open={editingNodeId !== null}
        onOpenChange={(open) => !open && setEditingNodeId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit node prompt</DialogTitle>
          </DialogHeader>
          <Textarea
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            placeholder="Enter the AI decision prompt..."
            rows={4}
          />
          <DialogFooter>
            <Button onClick={savePrompt}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}