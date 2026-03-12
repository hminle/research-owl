import {
  ToolLoopAgent,
  InferAgentUIMessage,
  stepCountIs,
  tool,
  readUIMessageStream,
} from "ai";
import { z } from "zod";
import { createKbReviewAgent } from "./kb-review-agent";
import { createWebScoutAgent } from "./web-scout-agent";
import { createResearchPlannerAgent } from "./research-planner-agent";
import { createSynthesisAgent } from "./synthesis-agent";
import {
  getLanguageModel,
  getProviderOptions,
  DEFAULT_MODEL,
} from "@/lib/ai/providers";

const ORCHESTRATOR_INSTRUCTIONS = `You are the Research Director, an orchestrator agent that coordinates a team of specialized research agents to produce comprehensive research analyses.

YOUR TEAM:
1. **review_kb** — Knowledge Base Review Agent: Searches papers already in the knowledge base
2. **scout_web** — Web Scout Agent: Searches arXiv for new relevant papers
3. **plan_research** — Research Planner Agent: Creates structured research plans with experiments
4. **synthesize** — Synthesis Agent: Combines all findings into a polished research document

WORKFLOW:
For a research task, follow this sequence:

1. First, delegate to review_kb to search the existing knowledge base for relevant papers
2. In parallel or after, delegate to scout_web to find additional papers on arXiv
3. Once you have literature findings, delegate to plan_research with the combined findings
4. Finally, delegate to synthesize to produce the final comprehensive report

IMPORTANT RULES:
- Always start with review_kb AND scout_web to build a comprehensive picture
- Pass the findings from previous agents as context to subsequent agents
- When delegating, provide clear and specific task descriptions including the research topic
- The synthesis agent should receive ALL findings from the other agents
- If a sub-agent returns insufficient results, you may re-delegate with refined queries
- Keep your own responses brief — the sub-agents do the heavy lifting`;

function createSubagentTools(modelId?: string) {
  const reviewKbTool = tool({
    description:
      "Delegate to the Knowledge Base Review Agent to search existing ingested papers. " +
      "Returns a structured literature summary from the knowledge base.",
    inputSchema: z.object({
      task: z
        .string()
        .describe(
          "The research topic or question to search for in the knowledge base"
        ),
    }),
    execute: async function* ({ task }, { abortSignal }) {
      const agent = createKbReviewAgent(modelId);
      const result = await agent.stream({ prompt: task, abortSignal });
      for await (const message of readUIMessageStream({
        stream: result.toUIMessageStream(),
      })) {
        yield message;
      }
    },
    toModelOutput: ({ output: message }) => {
      const lastTextPart = message?.parts.findLast(
        (p: { type: string }) => p.type === "text"
      );
      return {
        type: "text" as const,
        value:
          (lastTextPart as { text?: string } | undefined)?.text ??
          "KB review completed.",
      };
    },
  });

  const scoutWebTool = tool({
    description:
      "Delegate to the Web Scout Agent to search arXiv for new papers not in the knowledge base. " +
      "Returns a list of relevant papers found externally.",
    inputSchema: z.object({
      task: z
        .string()
        .describe("The research topic to search for on arXiv"),
    }),
    execute: async function* ({ task }, { abortSignal }) {
      const agent = createWebScoutAgent(modelId);
      const result = await agent.stream({ prompt: task, abortSignal });
      for await (const message of readUIMessageStream({
        stream: result.toUIMessageStream(),
      })) {
        yield message;
      }
    },
    toModelOutput: ({ output: message }) => {
      const lastTextPart = message?.parts.findLast(
        (p: { type: string }) => p.type === "text"
      );
      return {
        type: "text" as const,
        value:
          (lastTextPart as { text?: string } | undefined)?.text ??
          "Web scouting completed.",
      };
    },
  });

  const planResearchTool = tool({
    description:
      "Delegate to the Research Planner Agent to create a structured research plan. " +
      "Pass the literature findings from review_kb and scout_web as context.",
    inputSchema: z.object({
      task: z
        .string()
        .describe(
          "The research topic and literature findings to base the plan on"
        ),
    }),
    execute: async function* ({ task }, { abortSignal }) {
      const agent = createResearchPlannerAgent(modelId);
      const result = await agent.stream({ prompt: task, abortSignal });
      for await (const message of readUIMessageStream({
        stream: result.toUIMessageStream(),
      })) {
        yield message;
      }
    },
    toModelOutput: ({ output: message }) => {
      const lastTextPart = message?.parts.findLast(
        (p: { type: string }) => p.type === "text"
      );
      return {
        type: "text" as const,
        value:
          (lastTextPart as { text?: string } | undefined)?.text ??
          "Research plan completed.",
      };
    },
  });

  const synthesizeTool = tool({
    description:
      "Delegate to the Synthesis Agent to combine all findings into a polished research document. " +
      "Pass ALL findings from review_kb, scout_web, and plan_research.",
    inputSchema: z.object({
      task: z
        .string()
        .describe(
          "All research findings and the plan to synthesize into a final report"
        ),
    }),
    execute: async function* ({ task }, { abortSignal }) {
      const agent = createSynthesisAgent(modelId);
      const result = await agent.stream({ prompt: task, abortSignal });
      for await (const message of readUIMessageStream({
        stream: result.toUIMessageStream(),
      })) {
        yield message;
      }
    },
    toModelOutput: ({ output: message }) => {
      const lastTextPart = message?.parts.findLast(
        (p: { type: string }) => p.type === "text"
      );
      return {
        type: "text" as const,
        value:
          (lastTextPart as { text?: string } | undefined)?.text ??
          "Synthesis completed.",
      };
    },
  });

  return {
    review_kb: reviewKbTool,
    scout_web: scoutWebTool,
    plan_research: planResearchTool,
    synthesize: synthesizeTool,
  };
}

export function createOrchestratorAgent(modelId?: string) {
  const id = modelId ?? DEFAULT_MODEL;
  const model = getLanguageModel(id);
  const providerOptions = getProviderOptions(id);

  return new ToolLoopAgent({
    model,
    instructions: ORCHESTRATOR_INSTRUCTIONS,
    tools: createSubagentTools(modelId),
    temperature: 0.3,
    providerOptions,
    stopWhen: stepCountIs(12),
  });
}

// Type for frontend rendering
const _defaultTools = createSubagentTools();
const _defaultAgent = new ToolLoopAgent({
  model: getLanguageModel(),
  tools: _defaultTools,
});

export type OrchestratorUIMessage = InferAgentUIMessage<typeof _defaultAgent>;
