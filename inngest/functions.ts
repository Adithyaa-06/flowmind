import { inngest } from "./client";
import { askYesNo } from "@/lib/llm";

type FlowNode = {
  id: string;
  data: { label: string };
};

type FlowEdge = {
  source: string;
  target: string;
  data?: { branch?: "YES" | "NO" };
};

export const helloWorld = inngest.createFunction(
  { id: "hello-world", triggers: [{ event: "test/hello" }] },
  async ({ event, step }) => {
    return { message: `Hello, ${event.data.name}!` };
  }
);

export const runWorkflow = inngest.createFunction(
  { id: "run-workflow", triggers: [{ event: "workflow/run" }] },
  async ({ event, step }) => {
    const nodes: FlowNode[] = event.data.nodes;
    const edges: FlowEdge[] = event.data.edges;

    const targetIds = new Set(edges.map((e) => e.target));
    const startNode = nodes.find((n) => !targetIds.has(n.id));

    if (!startNode) {
      return { error: "No start node found (graph may have a cycle)" };
    }

    const executionLog: { nodeId: string; prompt: string; result: "YES" | "NO" }[] = [];
    let currentNode: FlowNode | undefined = startNode;
    let steps = 0;
    const MAX_STEPS = 50;

    while (currentNode && steps < MAX_STEPS) {
      const node = currentNode;
      steps++;

      const result = await step.run(`decide-${node.id}`, async () => {
        return askYesNo(node.data.label);
      });

      executionLog.push({
        nodeId: node.id,
        prompt: node.data.label,
        result,
      });

      const nextEdge = edges.find(
        (e) => e.source === node.id && e.data?.branch === result
      );

      if (!nextEdge) {
        currentNode = undefined;
        break;
      }

      currentNode = nodes.find((n) => n.id === nextEdge.target);
    }

    return {
      executionLog,
      finalNodeId: executionLog[executionLog.length - 1]?.nodeId ?? null,
      stepsExecuted: steps,
    };
  }
);