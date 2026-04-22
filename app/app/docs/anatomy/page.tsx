"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function AnatomyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="border-b border-zinc-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-bold">
            AI Team<span className="text-emerald-400"> Builder</span>
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-sm text-zinc-400">Docs</span>
          <span className="text-zinc-600">/</span>
          <span className="text-sm text-zinc-400">Workflow Anatomy</span>
        </div>
        <Link href="/builder?template=podcast-team">
          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300">
            Open Podcast Template
          </Button>
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-10">
        <h1 className="text-3xl font-bold mb-2">Workflow Anatomy</h1>
        <p className="text-zinc-400 mb-8">
          Every workflow you build runs in four phases. Once you see them, you stop thinking
          about &ldquo;config files&rdquo; and start thinking about pipelines.
        </p>

        {/* Worked example */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-8">
          <div className="text-xs text-zinc-500 mb-3">Worked example: the Podcast Team template</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/templates/podcast-team.svg"
            alt="Podcast team workflow chain showing rule, pipeline of agents, and entry command"
            className="min-w-[600px] w-full h-auto"
          />
        </div>

        <p className="text-sm text-zinc-400 leading-relaxed mb-8">
          When a user types <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-emerald-400">/produce-episode</code>,
          Claude Code doesn&rsquo;t just run a single prompt. The plugin you built sets up context, fires triggers,
          executes a chain of agents, and returns the result. The Workflow page in the builder makes those four
          phases visible as a top-to-bottom timeline.
        </p>

        {/* Phase 1 */}
        <div className="mb-6 border-l-4 border-blue-500 pl-4 py-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-blue-600 text-white text-[10px]">SETUP</Badge>
            <h2 className="text-lg font-semibold text-zinc-200">1. Rules load</h2>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Rules are markdown files with shared context that Claude reads at session start. In the podcast template,
            <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-blue-400 mx-1">podcast-production-standards</code>
            sets banned phrases, file conventions, and quality-gate ordering. Rules with no path filter load globally.
            Rules with a <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-300">paths</code> filter load
            only when matching files are touched. This is your pipeline&rsquo;s shared vocabulary.
          </p>
        </div>

        {/* Phase 2 */}
        <div className="mb-6 border-l-4 border-orange-500 pl-4 py-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-orange-600 text-white text-[10px]">TRIGGER</Badge>
            <h2 className="text-lg font-semibold text-zinc-200">2. Hooks fire on events</h2>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Hooks attach to Claude Code events: <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-orange-400">PreToolUse</code>,
            <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-orange-400 mx-1">PostToolUse</code>,
            <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-orange-400">UserPromptSubmit</code>, and so on.
            They run shell commands or inject context when their matcher fires. The podcast template doesn&rsquo;t
            use hooks &mdash; it&rsquo;s a chain that runs only when the user types the slash command. But many
            workflows use hooks to enforce checks before edits land or to inject standards on every prompt.
          </p>
        </div>

        {/* Phase 3 */}
        <div className="mb-6 border-l-4 border-red-500 pl-4 py-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-red-600 text-white text-[10px]">EXECUTE</Badge>
            <h2 className="text-lg font-semibold text-zinc-200">3. Agents and skills run in pipeline order</h2>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            This is where the work happens. The podcast template chains seven agents: <span className="text-red-400">content-analyst</span> {' → '}
            <span className="text-red-400">script-writer</span> {' → '}
            <span className="text-red-400">script-reviewer</span> {' → '}
            <span className="text-red-400">voice-producer</span> {' → '}
            <span className="text-red-400">audio-engineer</span> {' → '}
            <span className="text-red-400">qa-reviewer</span>, with <span className="text-red-400">podcast-fact-checker</span> running in parallel
            from <span className="text-red-400">script-writer</span>. The output of each step feeds the next.
            Skills are reusable knowledge bundles &mdash; the <span className="text-emerald-400">pronunciation-lexicon</span> skill,
            for example, is loaded by <span className="text-red-400">script-writer</span> so phonetic guidance is available
            without bloating every agent&rsquo;s system prompt.
          </p>
        </div>

        {/* Phase 4 */}
        <div className="mb-10 border-l-4 border-purple-500 pl-4 py-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-600 text-white text-[10px]">ENTRY</Badge>
            <h2 className="text-lg font-semibold text-zinc-200">4. The slash command itself</h2>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            The command is the user&rsquo;s entry point and the workflow&rsquo;s name.
            Typing <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-purple-400">/produce-episode</code> in
            Claude Code is what kicks the whole chain off. The command&rsquo;s prompt is short &mdash; it doesn&rsquo;t need to
            do the work itself, because the agents and rules already in place handle that. Think of the command as
            the front door, and everything above it as what waits inside.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-2">Try it</h3>
          <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
            Open the podcast template and switch between the Workflow view (the Gantt-style timeline) and the Canvas
            view (the network graph). Same data, two representations.
          </p>
          <div className="flex gap-2">
            <Link href="/builder?template=podcast-team">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Open Podcast Template
              </Button>
            </Link>
            <Link href="/builder?template=writing-team">
              <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300">
                Open Writing Referee
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
