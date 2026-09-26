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

type ExecutionLogEntry = {
  nodeId: string;
  prompt: string;
  result: "YES" | "NO";
};

type RunRecord = {
  status: "running" | "completed" | "error" | "unknown";
  executionLog?: ExecutionLogEntry[];
  finalNodeId?: string | null;
  stepsExecuted?: number;
  error?: string;
};

export default function Home() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runRecord, setRunRecord] = useState<RunRecord | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

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

  // Replay the execution log as an animation: highlight each node in order,
  // pausing between steps, then animate the edge it took.
  const replayExecution = async (log: ExecutionLogEntry[]) => {
    for (let i = 0; i < log.length; i++) {
      const entry = log[i];
      setActiveNodeId(entry.nodeId);

      // Animate the outgoing edge this step took, if any
      const nextEntry = log[i + 1];
      if (nextEntry) {
        setEdges((eds) =>
          eds.map((e) =>
            e.source === entry.nodeId &&
            e.target === nextEntry.nodeId &&
            e.data?.branch === entry.result
              ? { ...e, animated: true }
              : e
          )
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    setActiveNodeId(null);
  };

  const runWorkflow = async () => {
    setIsRunning(true);
    setRunRecord({ status: "running" });
    setActiveNodeId(null);
    // Reset any previous edge animation
    setEdges((eds) => eds.map((e) => ({ ...e, animated: false })));

    try {
      const res = await fetch("/api/run-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      });
      const { runId } = await res.json();

      // Poll for completion
      const poll = async (): Promise<void> => {
        const statusRes = await fetch(`/api/run-status?runId=${runId}`);
        const record: RunRecord = await statusRes.json();

        if (record.status === "running" || record.status === "unknown") {
          await new Promise((r) => setTimeout(r, 500));
          return poll();
        }

        setRunRecord(record);
        setIsRunning(false);

        if (record.status === "completed" && record.executionLog) {
          await replayExecution(record.executionLog);
        }
      };

      await poll();
    } catch (err) {
      setRunRecord({ status: "error", error: String(err) });
      setIsRunning(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flowmind-workflow.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { nodes: importedNodes, edges: importedEdges } = JSON.parse(
          reader.result as string
        );
        setNodes(importedNodes);
        setEdges(importedEdges);
        const maxId = importedNodes.reduce(
          (max: number, n: Node) => Math.max(max, Number(n.id) || 0),
          0
        );
        nodeIdCounter = maxId + 1;
      } catch {
        alert("Invalid workflow JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Apply visual highlight to the currently active node
  const displayNodes = nodes.map((n) => ({
    ...n,
    style: {
      ...n.style,
      ...(n.id === activeNodeId
        ? { border: "3px solid #2563eb", boxShadow: "0 0 12px #2563eb" }
        : {}),
    },
  }));

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
          flexWrap: "wrap",
        }}
      >
        <Button onClick={addNode}>+ Add Node</Button>
        <Button onClick={runWorkflow} disabled={isRunning} variant="default">
          {isRunning ? "Running..." : "▶ Run Workflow"}
        </Button>
        <Button onClick={exportJson} variant="outline">
          Export JSON
        </Button>
                <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 36,
            padding: "0 16px",
            borderRadius: 6,
            border: "1px solid #d4d4d8",
            background: "white",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Import JSON
          <input
            type="file"
            accept="application/json"
            onChange={importJson}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {runRecord && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            top: 60,
            left: 12,
            background: "white",
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: "10px 14px",
            maxWidth: 420,
            fontSize: 13,
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          <strong>
            Status: {runRecord.status}
            {isRunning && " (waiting for result...)"}
          </strong>
          {runRecord.status === "error" && (
            <p style={{ color: "#dc2626" }}>{runRecord.error}</p>
          )}
          {runRecord.executionLog && (
            <ul style={{ marginTop: 8, paddingLeft: 16 }}>
              {runRecord.executionLog.map((entry, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  Node {entry.nodeId}: "{entry.prompt}" →{" "}
                  <strong
                    style={{
                      color: entry.result === "YES" ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {entry.result}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ReactFlow
        nodes={displayNodes}
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