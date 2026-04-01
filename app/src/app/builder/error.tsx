"use client";

import { Button } from "@/components/ui/button";

export default function BuilderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen bg-zinc-950 items-center justify-center">
      <div className="text-center space-y-4 max-w-md p-8">
        <h2 className="text-lg font-bold text-zinc-200">Something went wrong</h2>
        <p className="text-sm text-zinc-500">{error.message || "The builder encountered an error."}</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" className="border-zinc-700 text-zinc-300" onClick={reset}>
            Try again
          </Button>
          <Button
            variant="ghost"
            className="text-zinc-500"
            onClick={() => {
              localStorage.removeItem('ai-team-builder');
              window.location.reload();
            }}
          >
            Reset all data
          </Button>
        </div>
      </div>
    </div>
  );
}
