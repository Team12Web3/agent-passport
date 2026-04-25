"use client";
import { useState } from "react";

type Props = {
  url: string;
  compact?: boolean;
  overlay?: React.ReactNode;
};

export function BrowserChrome({ url, compact = false, overlay }: Props) {
  const [iframeBlocked, setIframeBlocked] = useState(false);

  const displayUrl =
    url.length > 60 ? url.slice(0, 57) + "…" : url;

  const frameHeight = compact ? "h-[200px]" : "h-[360px]";

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
      {/* Tab bar */}
      <div className="flex items-center gap-2 border-b border-zinc-700 bg-zinc-800 px-3 py-2">
        {/* Traffic lights */}
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <div className="h-3 w-3 rounded-full bg-yellow-400" />
          <div className="h-3 w-3 rounded-full bg-green-500" />
        </div>

        {/* Address bar */}
        <div className="mx-2 flex flex-1 items-center gap-2 rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300">
          <svg
            className="h-3 w-3 shrink-0 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="truncate">{displayUrl || "about:blank"}</span>
        </div>
      </div>

      {/* iframe area */}
      <div className={`relative ${frameHeight} bg-white`}>
        {!iframeBlocked && url ? (
          <iframe
            src={url}
            sandbox="allow-same-origin"
            className="h-full w-full"
            title="Target URL"
            onError={() => setIframeBlocked(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-zinc-100 text-zinc-500">
            <svg
              className="h-8 w-8 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm font-medium">{displayUrl}</span>
            <span className="text-xs text-zinc-400">
              Preview blocked by browser security policy
            </span>
          </div>
        )}

        {/* Overlay (used for blocked / trust demo states) */}
        {overlay}
      </div>
    </div>
  );
}
