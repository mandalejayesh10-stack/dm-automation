"use client";

import { useCallback } from "react";
import { ReactFlow, Background, Controls, MiniMap, addEdge, useEdgesState, useNodesState, type Connection, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Bot, Clock, Mail, MessageCircle, Tags, Webhook } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";

const initialNodes: Node[] = [
  { id: "1", position: { x: 60, y: 80 }, data: { label: "Comment Trigger: price" }, type: "input" },
  { id: "2", position: { x: 360, y: 80 }, data: { label: "Send DM" } },
  { id: "3", position: { x: 660, y: 80 }, data: { label: "AI Reply" } },
  { id: "4", position: { x: 660, y: 240 }, data: { label: "Collect Email" } },
  { id: "5", position: { x: 960, y: 160 }, data: { label: "Tag Lead + Send Offer" }, type: "output" }
];

const initialEdges = [
  { id: "e1-2", source: "1", target: "2", animated: true, style: { stroke: "#FFD600" } },
  { id: "e2-3", source: "2", target: "3", animated: true, style: { stroke: "#FFD600" } },
  { id: "e3-4", source: "3", target: "4", animated: true, style: { stroke: "#FFD600" } },
  { id: "e4-5", source: "4", target: "5", animated: true, style: { stroke: "#FFD600" } }
];

const palette = [
  ["Comment Trigger", MessageCircle],
  ["Send DM", Mail],
  ["AI Reply", Bot],
  ["Delay", Clock],
  ["Webhook", Webhook],
  ["Tag Lead", Tags]
];

export default function FlowBuilderPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: "#FFD600" } }, eds)), [setEdges]);

  return (
    <DashboardShell>
      <div className="grid h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-[240px_1fr_320px]">
        <aside className="border-b border-white/10 bg-black/30 p-4 lg:border-b-0 lg:border-r">
          <h1 className="text-xl font-black">Flow Builder</h1>
          <div className="mt-5 grid gap-2">
            {palette.map(([label, Icon]) => (
              <button key={label as string} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-3 text-left text-sm font-semibold hover:border-signal/40">
                <Icon className="h-4 w-4 text-signal" />
                {label as string}
              </button>
            ))}
          </div>
        </aside>
        <section className="min-h-[560px] bg-[#090909]">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
            <Background color="#ffffff20" gap={24} />
            <MiniMap nodeColor="#FFD600" maskColor="rgba(0,0,0,0.6)" />
            <Controls />
          </ReactFlow>
        </section>
        <aside className="border-t border-white/10 bg-black/30 p-4 lg:border-l lg:border-t-0">
          <h2 className="font-bold">Node configuration</h2>
          <div className="mt-5 space-y-4">
            <label className="block text-sm text-white/60">
              Keyword
              <input className="mt-2 w-full rounded-md border border-white/10 bg-white/7 px-3 py-2 text-white outline-none focus:border-signal" defaultValue="price" />
            </label>
            <label className="block text-sm text-white/60">
              DM template
              <textarea className="mt-2 min-h-32 w-full rounded-md border border-white/10 bg-white/7 px-3 py-2 text-white outline-none focus:border-signal" defaultValue="Hey {{first_name}}, I sent the launch offer here." />
            </label>
            <button className="w-full rounded-md bg-signal px-4 py-3 text-sm font-black text-black">Save automation</button>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
