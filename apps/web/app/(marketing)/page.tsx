import Link from "next/link";
import { Github } from "lucide-react";
import { Hero } from "@/components/shell/Hero";
import { HowItWorks } from "@/components/shell/HowItWorks";
import { ProblemSection } from "@/components/shell/ProblemSection";
import { siteConfig } from "@/lib/site";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <ProblemSection />

      <section className="bg-white text-slate-950">
        <HowItWorks />
      </section>

      <section className="bg-[#f5f6f8] text-slate-950">
        <div className="mx-auto w-full max-w-5xl px-6 py-20 text-center sm:py-24">
          <p className="text-3xl font-semibold italic leading-tight text-slate-900 sm:text-5xl">
            Trust by signature, not by CAPTCHA.
          </p>
          <div className="mt-8 flex items-center justify-center gap-5 text-sm text-slate-500">
            <Link
              href={siteConfig.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 transition hover:text-slate-900"
            >
              <Github className="h-4 w-4" />
              GitHub
            </Link>
            <span>Built at Web3NZ Hackathon 2026</span>
          </div>
        </div>
      </section>
    </main>
  );
}
