"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TEMPLATES } from "@/lib/templates";

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
            Build Claude Code plugins visually. Design agentic workflows on a canvas,
            test with dry run, export production-ready plugins.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Link href="/builder">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                Start from Scratch
              </Button>
            </Link>
          </div>
          <div className="pt-8 grid grid-cols-3 gap-6 text-left">
            <div className="space-y-2">
              <div className="text-emerald-400 font-semibold text-sm">Visual Builder</div>
              <div className="text-xs text-zinc-500">Drag and drop rules, hooks, skills, agents. Draw connections. No code needed.</div>
            </div>
            <div className="space-y-2">
              <div className="text-emerald-400 font-semibold text-sm">Dry Run</div>
              <div className="text-xs text-zinc-500">Enter a prompt, see which components fire, estimate token costs before deploying.</div>
            </div>
            <div className="space-y-2">
              <div className="text-emerald-400 font-semibold text-sm">One-Click Export</div>
              <div className="text-xs text-zinc-500">Download as JSON plugin package. Install in Claude Code instantly.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Templates */}
      <div className="max-w-4xl mx-auto px-8 pb-24">
        <h2 className="text-2xl font-bold mb-6">Start from a Template</h2>
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
