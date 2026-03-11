"use client";

import { X, FileCode, Layers, ArrowRight, Plug } from "lucide-react";
import type { ComponentDetail } from "./architecture-data";

interface DetailPanelProps {
  detail: ComponentDetail;
  onClose: () => void;
}

export function DetailPanel({ detail, onClose }: DetailPanelProps) {
  return (
    <div className="h-full border-l bg-background overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-3">
        <h2 className="text-base font-semibold truncate pr-2">{detail.title}</h2>
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {detail.description}
        </p>

        {/* Technologies */}
        <Section title="Technologies" icon={<Layers className="h-3.5 w-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {detail.technologies.map((tech) => (
              <span
                key={tech}
                className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
              >
                {tech}
              </span>
            ))}
          </div>
        </Section>

        {/* Sub-components */}
        {detail.subComponents && detail.subComponents.length > 0 && (
          <Section title="Components" icon={<Layers className="h-3.5 w-3.5" />}>
            <div className="space-y-2">
              {detail.subComponents.map((sub) => (
                <div key={sub.name} className="rounded-lg border p-3">
                  <div className="text-sm font-medium">{sub.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {sub.description}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Data Flow */}
        {detail.dataFlow && detail.dataFlow.length > 0 && (
          <Section title="Data Flow" icon={<ArrowRight className="h-3.5 w-3.5" />}>
            <ol className="space-y-1.5">
              {detail.dataFlow.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* API Endpoints */}
        {detail.endpoints && detail.endpoints.length > 0 && (
          <Section title="API Endpoints" icon={<Plug className="h-3.5 w-3.5" />}>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-2 py-1.5 font-medium">Method</th>
                    <th className="text-left px-2 py-1.5 font-medium">Path</th>
                    <th className="text-left px-2 py-1.5 font-medium">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.endpoints.map((ep) => (
                    <tr key={ep.path} className="border-t">
                      <td className="px-2 py-1.5">
                        <span className="rounded bg-emerald-100 text-emerald-700 px-1 py-0.5 font-mono font-medium">
                          {ep.method}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">
                        {ep.path}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{ep.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Key Files */}
        <Section title="Key Files" icon={<FileCode className="h-3.5 w-3.5" />}>
          <ul className="space-y-1">
            {detail.keyFiles.map((file) => (
              <li key={file} className="text-xs font-mono text-muted-foreground">
                {file}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
