"use client";
import { useState } from "react";

export const DEMO_URL = "https://en.wikipedia.org/wiki/Internet_bot";
export const DEMO_PROMPT =
  "Summarize the main themes of this page in 3 sentences.";

const MAX_PROMPT = 500;

type Props = {
  url: string;
  prompt: string;
  isRunning: boolean;
  onUrlChange: (v: string) => void;
  onPromptChange: (v: string) => void;
  onRunWithPassport: () => void;
  onRunWithoutPassport: () => void;
};

export function RunControls({
  url,
  prompt,
  isRunning,
  onUrlChange,
  onPromptChange,
  onRunWithPassport,
  onRunWithoutPassport,
}: Props) {
  const [urlError, setUrlError] = useState("");

  function handleUrlChange(value: string) {
    onUrlChange(value);
    if (value && !/^https?:\/\//.test(value)) {
      setUrlError("URL must start with https:// or http://");
    } else {
      setUrlError("");
    }
  }

  const urlValid = !urlError && url.trim().length > 0;
  const disabled = isRunning || !urlValid || prompt.trim().length === 0;

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-6 backdrop-blur shadow-[0_10px_30px_rgba(2,6,23,0.45)]">
      {/* URL */}
      <div className="mb-4">
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
          <svg
            className="h-4 w-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Target URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://example.com"
          className={`w-full rounded-lg border bg-black px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition focus:border-slate-500 ${
            urlError ? "border-red-600" : "border-slate-700"
          }`}
        />
        {urlError && (
          <p className="mt-1 text-xs text-red-400">{urlError}</p>
        )}
      </div>

      {/* Prompt */}
      <div className="mb-5">
        <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-300">
          <span>Prompt</span>
          <span
            className={`text-xs ${
              prompt.length > MAX_PROMPT ? "text-red-400" : "text-slate-500"
            }`}
          >
            {prompt.length}/{MAX_PROMPT}
          </span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value.slice(0, MAX_PROMPT))}
          rows={3}
          placeholder="What should the agent do on this page?"
          className="w-full resize-none rounded-lg border border-slate-700 bg-black px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition focus:border-slate-500"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onRunWithPassport}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: disabled
              ? undefined
              : "linear-gradient(135deg,rgb(47, 210, 85) 0%,rgb(46, 212, 52) 100%)",
            backgroundColor: disabled ? "#3f3f46" : undefined,
          }}
        >
          {isRunning ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Running…
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Run with Passport
            </>
          )}
        </button>

        <button
          onClick={onRunWithoutPassport}
          disabled={disabled}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-transparent px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01"
            />
          </svg>
          Run without Passport
        </button>
      </div>
    </div>
  );
}
