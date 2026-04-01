"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TEMPLATES } from "@/lib/templates";

const REAL_PLUGINS = [
  {
    name: "Iran Conflict Monitor",
    slug: "iran-monitor",
    description: "9-phase monitoring cycle with parallel region search, source verification, GTA taxonomy mapping, and Slack notifications. Demonstrates multi-agent orchestration.",
    category: "Monitoring",
    stats: "4 commands, 1 agent, 1 rule",
    highlight: "/update runs a full sweep: search 7 regions in parallel, verify sources, deduplicate, push to database, notify Slack.",
  },
  {
    name: "Data Science Team",
    slug: "cc-data-science-team",
    description: "Structured document classification, version comparison, external database matching, and analytical workflows with 5 quality gates.",
    category: "Analytics",
    stats: "12 agents, 3 commands, 8 skills, 3 rules",
    highlight: "/analytics-ready runs 5 quality checks before any deliverable ships. Red-team agent attacks your analysis.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center p-8 pt-24 pb-16">
        <div className="max-w-2xl text-center space-y-6">
          <h1 className="text-5xl font-bold tracking-tight">
            AI Team<span className="text-emerald-400"> Builder</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed">
            Design agentic teams visually. Build Claude Code plugins with agents,
            skills, hooks, and commands — test with dry run, export production-ready.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Link href="/builder">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                Start Building
              </Button>
            </Link>
            <Link href="/showcase">
              <Button size="lg" variant="outline" className="border-zinc-700 text-zinc-300">
                Explore Real Plugins
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-8 pb-16">
        <h2 className="text-2xl font-bold mb-6">How it works</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { step: "1", title: "Define your team", desc: "Add agents, skills, rules, and commands. Each has guided creation with inline help." },
            { step: "2", title: "Build workflows", desc: "See how your slash commands execute step by step. Connect components visually." },
            { step: "3", title: "Test with dry run", desc: "Enter a prompt, see which components fire, estimate token costs before deploying." },
            { step: "4", title: "Export and install", desc: "Download as a Claude Code plugin. Install with one command." },
          ].map(item => (
            <div key={item.step} className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold text-white">
                {item.step}
              </div>
              <div className="text-sm font-semibold text-zinc-200">{item.title}</div>
              <div className="text-xs text-zinc-500 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-world plugins */}
      <div className="max-w-4xl mx-auto px-8 pb-16">
        <h2 className="text-2xl font-bold mb-2">Real-world plugins</h2>
        <p className="text-sm text-zinc-500 mb-6">Production Claude Code plugins you can explore and open in the builder.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REAL_PLUGINS.map(plugin => (
            <Link key={plugin.slug} href="/showcase">
              <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-600 transition-colors p-5 cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                    {plugin.category}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                    {plugin.stats}
                  </Badge>
                </div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">{plugin.name}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed mb-3">{plugin.description}</p>
                <div className="text-[11px] text-emerald-500 font-mono leading-relaxed">
                  {plugin.highlight}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Templates */}
      <div className="max-w-4xl mx-auto px-8 pb-24">
        <h2 className="text-2xl font-bold mb-2">Start from a template</h2>
        <p className="text-sm text-zinc-500 mb-6">Pre-built plugin configurations for common use cases.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map(template => (
            <Link key={template.id} href={`/builder?template=${template.id}`}>
              <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-600 transition-colors p-4 cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                    {template.category}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                    {template.nodes.length} nodes
                  </Badge>
                </div>
                <h3 className="text-sm font-semibold text-zinc-200 mb-1">{template.name}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{template.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
