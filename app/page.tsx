"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Compass, Swords, ArrowRight, Loader2, Sparkles, BookOpen } from "lucide-react";
import { WikipediaCandidate } from "@/lib/schemas";

interface RecentTopic {
  id: string;
  name: string;
  wikiTitle: string;
  lastStudiedAt: string;
  contentId: string;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("q") || "";

  const [query, setQuery] = useState(queryParam);
  const [isResolving, setIsResolving] = useState(false);
  const [candidates, setCandidates] = useState<WikipediaCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<WikipediaCandidate | null>(null);

  // Generation state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");
  const [jobError, setJobError] = useState<string | null>(null);

  // Recent topics
  const [recentTopics, setRecentTopics] = useState<RecentTopic[]>([]);

  useEffect(() => {
    fetch("/api/learner")
      .then((res) => res.json())
      .then((data) => {
        if (data.recentTopics) {
          setRecentTopics(data.recentTopics);
        }
      })
      .catch((err) => console.error("Failed to load recent topics:", err));
  }, []);

  const pollJob = useCallback((jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        const job = data.job;

        setJobProgress(job.progressPercent || 25);
        setJobMessage(job.message || "Synthesizing content...");

        if (job.status === "completed" && job.contentId) {
          clearInterval(interval);
          setTimeout(() => {
            router.push(`/quiz/${job.contentId}`);
          }, 800);
        } else if (job.status === "failed") {
          clearInterval(interval);
          setJobError(job.error || "Generation failed.");
          setActiveJobId(null);
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 1500);
  }, [router]);

  const listenToJob = useCallback((jobId: string) => {
    const eventSource = new EventSource(`/api/jobs/${jobId}/stream`);

    eventSource.addEventListener("update", (e) => {
      try {
        const job = JSON.parse(e.data);
        setJobProgress(job.progressPercent || 20);
        setJobMessage(job.message || "Processing...");

        if (job.status === "completed" && job.contentId) {
          eventSource.close();
          setTimeout(() => {
            router.push(`/quiz/${job.contentId}`);
          }, 800);
        } else if (job.status === "failed") {
          eventSource.close();
          setJobError(job.error || "Generation encountered an error.");
          setActiveJobId(null);
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    });

    eventSource.addEventListener("error", () => {
      eventSource.close();
      // Fallback to polling
      pollJob(jobId);
    });
  }, [router, pollJob]);

  const startGeneration = useCallback(async (candidate: WikipediaCandidate) => {
    setSelectedCandidate(candidate);
    setCandidates([]);
    setJobError(null);
    setJobProgress(10);
    setJobMessage("Initializing mission generator...");

    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: candidate.pageId,
          title: candidate.title,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation request failed");

      if (data.cached && data.contentId) {
        // Cached quiz immediately ready
        setJobProgress(100);
        setJobMessage("Archive match found! Entering arena...");
        setTimeout(() => {
          router.push(`/quiz/${data.contentId}`);
        }, 600);
        return;
      }

      // Track async job via SSE or polling
      setActiveJobId(data.jobId);
      listenToJob(data.jobId);
    } catch (err: any) {
      setJobError(err.message || "Failed to initiate generation");
      setActiveJobId(null);
    }
  }, [router, listenToJob]);

  const executeResolve = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setIsResolving(true);
    setCandidates([]);
    setSelectedCandidate(null);
    setJobError(null);

    try {
      const res = await fetch("/api/topic/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchTerm.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");

      if (!data.candidates || data.candidates.length === 0) {
        setJobError("No matching historical records found. Try another topic!");
        setIsResolving(false);
        return;
      }

      if (data.candidates.length === 1) {
        // Direct match, start generation immediately
        startGeneration(data.candidates[0]);
      } else {
        // Disambiguation needed
        setCandidates(data.candidates);
      }
    } catch (err: any) {
      setJobError(err.message || "Failed to resolve topic.");
    } finally {
      setIsResolving(false);
    }
  }, [startGeneration]);

  // If query parameter is provided on mount (e.g. from follow-up topic chips), auto-trigger search
  useEffect(() => {
    if (queryParam && queryParam.trim().length > 0) {
      setQuery(queryParam);
      executeResolve(queryParam);
    }
  }, [queryParam, executeResolve]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isResolving) return;
    executeResolve(query);
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-game-surface via-game-surfaceLight to-[#1a1236] border-2 border-game-purple/40 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-game-purple/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-game-purple/20 border border-game-purple/40 text-game-purple-light text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-game-yellow" />
            AI-Powered Grounded History Quizzes
          </div>
          <h1 className="font-heading text-4xl sm:text-6xl text-white tracking-wide uppercase italic leading-none mb-4">
            ENTER THE <span className="text-game-yellow text-shadow">CHRONO ARENA</span>
          </h1>
          <p className="text-slate-300 text-base sm:text-lg mb-8 font-medium">
            Name any historical era, battle, leader, or civilization. The engine retrieves verified Wikipedia records and crafts a custom 10-question battle challenge.
          </p>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Battle of Waterloo, Samurai, Roman Empire..."
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-game-bg/90 border-2 border-game-border focus:border-game-blue text-white placeholder-slate-500 font-semibold focus:outline-none transition-colors"
                disabled={isResolving || activeJobId !== null}
              />
            </div>
            <button
              type="submit"
              disabled={isResolving || activeJobId !== null || !query.trim()}
              className="tactile-btn gamer-cut px-8 py-4 bg-gradient-to-r from-game-yellow via-amber-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-game-bg font-heading text-xl font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isResolving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  SCOUTING...
                </>
              ) : (
                <>
                  <Swords className="w-5 h-5" />
                  LAUNCH MISSION
                </>
              )}
            </button>
          </form>

          {jobError && (
            <div className="mt-4 p-4 rounded-xl bg-game-red/20 border border-game-red text-red-200 text-sm font-semibold">
              ⚠️ {jobError}
            </div>
          )}
        </div>
      </section>

      {/* Disambiguation Modal / Cards */}
      {candidates.length > 1 && (
        <section className="bg-game-surface border-2 border-game-border rounded-2xl p-6 sm:p-8 animate-in fade-in">
          <div className="flex items-center gap-2 mb-4 text-game-blue font-heading text-xl uppercase tracking-wider">
            <Compass className="w-5 h-5" />
            MULTIPLE HISTORICAL TIMELINES DETECTED. CHOOSE YOUR TARGET:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {candidates.map((c) => (
              <button
                key={c.pageId}
                onClick={() => startGeneration(c)}
                className="tactile-btn text-left p-5 rounded-xl bg-game-surfaceLight border-2 border-game-border hover:border-game-blue flex flex-col justify-between group transition-all"
              >
                <div>
                  <h3 className="font-heading text-lg text-white group-hover:text-game-blue uppercase italic mb-1">
                    {c.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-3">
                    {c.description}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-game-blue uppercase tracking-wider">
                  Target Era <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Generation Active Overlay */}
      {activeJobId && (
        <section className="bg-game-surface border-2 border-game-blue/50 rounded-2xl p-8 text-center shadow-glow-blue animate-in fade-in">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-game-blue/20 border border-game-blue flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-game-blue animate-spin" />
            </div>
            <h2 className="font-heading text-2xl text-white uppercase italic tracking-wider">
              CONSTRUCTING BATTLE GROUND: {selectedCandidate?.title || query}
            </h2>
            <p className="text-sm font-semibold text-slate-300">
              {jobMessage}
            </p>
            {/* Progress bar */}
            <div className="w-full bg-game-bg h-4 rounded-full overflow-hidden border border-game-border p-0.5">
              <div
                className="bg-gradient-to-r from-game-purple via-game-blue to-game-yellow h-full rounded-full transition-all duration-300"
                style={{ width: `${jobProgress}%` }}
              />
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {jobProgress}% COMPLETE
            </div>
          </div>
        </section>
      )}

      {/* Recent Missions Grid */}
      {recentTopics.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-white font-heading text-2xl uppercase tracking-wider italic">
            <BookOpen className="w-6 h-6 text-game-purple" />
            RECENT BATTLE MISSIONS
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentTopics.map((topic, idx) => {
              // Cycle through game rarity colors
              const rarityStyles = [
                "border-game-rarity-legendary hover:shadow-glow-yellow",
                "border-game-rarity-epic hover:shadow-glow-purple",
                "border-game-rarity-rare hover:shadow-glow-blue",
                "border-game-rarity-uncommon",
              ];
              const style = rarityStyles[idx % rarityStyles.length];

              return (
                <div
                  key={topic.id}
                  className={`bg-game-surface border-2 ${style} rounded-2xl p-5 flex flex-col justify-between hover:-translate-y-1 transition-all`}
                >
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                      CHRONO RECORD #{topic.id.slice(-4)}
                    </div>
                    <h3 className="font-heading text-xl text-white uppercase italic line-clamp-1 mb-2">
                      {topic.name}
                    </h3>
                  </div>
                  <div className="mt-4 pt-3 border-t border-game-border flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">
                      Ready for Replay
                    </span>
                    <button
                      onClick={() => router.push(`/quiz/${topic.contentId}`)}
                      className="tactile-btn px-4 py-2 bg-game-purple hover:bg-game-purple-dark text-white rounded-lg font-heading text-sm uppercase tracking-wider flex items-center gap-1.5"
                    >
                      ENTER <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-game-blue animate-spin" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
