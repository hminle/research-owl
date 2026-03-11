"use client";

import {
  ReactFlow,
  Background,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Brain,
  Database,
  FileText,
  FileUp,
  MessageSquare,
  Monitor,
  Server,
  type LucideIcon,
} from "lucide-react";
import { presentationNodeTypes } from "./presentation-nodes";
import type { PresentationSlide, CardData } from "./presentation-data";

const cardIconMap: Record<string, LucideIcon> = {
  Brain,
  Database,
  FileText,
  FileUp,
  MessageSquare,
  Monitor,
  Server,
};

const cardColorMap: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    accent: "bg-blue-500" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", accent: "bg-emerald-500" },
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-700",  accent: "bg-violet-500" },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   accent: "bg-amber-500" },
  rose:    { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-700",    accent: "bg-rose-500" },
  sky:     { bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-700",     accent: "bg-sky-500" },
  orange:  { bg: "bg-orange-50",  border: "border-orange-200",  text: "text-orange-700",  accent: "bg-orange-500" },
  gray:    { bg: "bg-gray-50",    border: "border-gray-200",    text: "text-gray-600",    accent: "bg-gray-400" },
};

function SlideCard({ card }: { card: CardData }) {
  const c = cardColorMap[card.color] ?? cardColorMap.gray;
  const Icon = cardIconMap[card.icon] ?? Database;

  return (
    <div
      className={`
        rounded-2xl border-2 ${c.border} ${c.bg}
        px-8 py-8 min-w-[200px] max-w-[280px]
        flex flex-col items-center text-center gap-4
        shadow-sm hover:shadow-md transition-shadow
      `}
    >
      <div className={`rounded-2xl p-4 ${c.accent}`}>
        <Icon className="h-8 w-8 text-white" />
      </div>
      <div>
        <h3 className={`text-lg font-bold ${c.text}`}>{card.title}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          {card.description}
        </p>
      </div>
    </div>
  );
}

function CardsView({ cards }: { cards: CardData[] }) {
  return (
    <div className="flex items-center justify-center gap-8 flex-wrap h-full">
      {cards.map((card, i) => (
        <SlideCard key={i} card={card} />
      ))}
    </div>
  );
}

function FlowView({ slide }: { slide: PresentationSlide }) {
  return (
    <ReactFlow
      nodes={slide.nodes ?? []}
      edges={slide.edges ?? []}
      nodeTypes={presentationNodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
    </ReactFlow>
  );
}

export function PresentationSlideView({ slide }: { slide: PresentationSlide }) {
  return (
    <div className="flex flex-col items-center h-full">
      {/* Header */}
      <div className="text-center pt-10 pb-6 px-6 max-w-3xl">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {slide.title}
        </h2>
        <p className="text-lg text-muted-foreground mt-3 leading-relaxed">
          {slide.description}
        </p>
      </div>

      {/* Visual area */}
      <div className="flex-1 w-full min-h-0 px-8 pb-4">
        {slide.type === "cards" && slide.cards ? (
          <CardsView cards={slide.cards} />
        ) : (
          <FlowView slide={slide} />
        )}
      </div>
    </div>
  );
}
