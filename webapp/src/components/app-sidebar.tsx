"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileUp, FlaskConical, Library, MessageSquare, Microscope, Layers, Network, Presentation, GitFork, ScatterChart } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { label: "Chat", href: "/", icon: MessageSquare },
  { label: "Research", href: "/research", icon: Microscope },
  { label: "Ingest Paper", href: "/ingest", icon: FileUp },
  { label: "Papers", href: "/papers", icon: Library },
  { label: "Documents", href: "/documents", icon: Layers },
  { label: "Graph", href: "/graph", icon: GitFork },
  { label: "Embeddings", href: "/embeddings", icon: ScatterChart },
  { label: "Evaluation", href: "/evaluation", icon: FlaskConical },
  { label: "Architecture", href: "/architecture", icon: Network },
  { label: "Presentation", href: "/presentation", icon: Presentation },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="h-12 border-b px-4 py-0">
        <Link href="/" className="flex h-full items-center gap-2">
          <Image
            src="/cute-owl-that-read-book.svg"
            alt="Research Owl logo"
            width={22}
            height={22}
          />
          <span className="font-semibold text-sm">Research Owl</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
