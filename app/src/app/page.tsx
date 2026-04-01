import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col items-center justify-center p-8">
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
              Start Building
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
            <div className="text-xs text-zinc-500">Push to GitHub or download as MCPB bundle. Install in Claude Code instantly.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
