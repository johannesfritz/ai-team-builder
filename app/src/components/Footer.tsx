import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 px-8 py-6">
      <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-zinc-600">
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-zinc-400 transition-colors">
            AI Team Builder
          </Link>
          <Link href="/builder" className="hover:text-zinc-400 transition-colors">
            Builder
          </Link>
          <Link href="/showcase" className="hover:text-zinc-400 transition-colors">
            Showcase
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/johannesfritz/ai-team-builder"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-400 transition-colors"
          >
            GitHub
          </a>
          <span className="text-zinc-700">Built for Claude Code plugins</span>
        </div>
      </div>
    </footer>
  );
}
