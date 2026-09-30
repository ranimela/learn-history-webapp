"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Compass,
  Swords,
  ArrowRight,
  Loader2,
  Sparkles,
  BookOpen,
  Shield,
  History,
  Trophy,
  Clock,
  RotateCcw,
} from "lucide-react";
import { WikipediaCandidate } from "@/lib/schemas";
import { soundFX } from "@/lib/audio";

interface RecentTopic {
  id: string;
  name: string;
  wikiTitle: string;
  wikiPageId?: number;
  lastStudiedAt: string;
  contentId: string;
}

interface BattleLogEntry {
  attemptId: string;
  contentId: string;
  topicName: string;
  wikiPageId?: number;
  score: number;
  nQuestions: number;
  difficulty: number;
  totalXpEarned: number;
  finishedAt: string;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("q") || "";

  const [query, setQuery] = useState(queryParam);
  const [difficulty, setDifficulty] = useState<number>(2); // 1 = Recruit, 2 = Veteran, 3 = Legend
  const [isResolving, setIsResolving] = useState(false);
  const [candidates, setCandidates] = useState<WikipediaCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<WikipediaCandidate | null>(null);

  // Generation state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");
  const [jobError, setJobError] = useState<string | null>(null);

  // Recent topics & Combat Log
  const [recentTopics, setRecentTopics] = useState<RecentTopic[]>([]);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);

  const loadLearnerData = useCallback(() => {
    fetch("/api/learner")
      .then((res) => res.json())
      .then((data) => {
        if (data.recentTopics) {
          setRecentTopics(data.recentTopics);
        }
        if (data.battleLog) {
          setBattleLog(data.battleLog);
        }
      })
      .catch((err) => console.error("Failed to load learner history:", err));
  }, []);

  useEffect(() => {
    loadLearnerData();
  }, [loadLearnerData]);

  const pollJob = useCallback(
    (jobId: string) => {
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
              router.push(`/quiz/${job.contentId}?difficulty=${difficulty}`);
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
    },
    [router, difficulty]
  );

  const listenToJob = useCallback(
    (jobId: string) => {
      const eventSource = new EventSource(`/api/jobs/${jobId}/stream`);

      eventSource.addEventListener("update", (e) => {
        try {
          const job = JSON.parse(e.data);
          setJobProgress(job.progressPercent || 20);
          setJobMessage(job.message || "Processing...");

          if (job.status === "completed" && job.contentId) {
            eventSource.close();
            setTimeout(() => {
              router.push(`/quiz/${job.contentId}?difficulty=${difficulty}`);
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
        pollJob(jobId);
      });
    },
    [router, pollJob, difficulty]
  );

  const startGeneration = useCallback(
    async (candidate: WikipediaCandidate) => {
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
            difficulty,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation request failed");

        if (data.cached && data.contentId) {
          // Cached quiz immediately ready
          setJobProgress(100);
          setJobMessage("Archive match found! Entering arena...");
          setTimeout(() => {
            router.push(`/quiz/${data.contentId}?difficulty=${difficulty}`);
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
    },
    [router, listenToJob, difficulty]
  );

  const executeResolve = useCallback(
    async (searchTerm: string) => {
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
          startGeneration(data.candidates[0]);
        } else {
          setCandidates(data.candidates);
        }
      } catch (err: any) {
        setJobError(err.message || "Failed to resolve topic.");
      } finally {
        setIsResolving(false);
      }
    },
    [startGeneration]
  );

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

  const handleEnterTopic = (pageId?: number, title?: string) => {
    if (pageId && title) {
      startGeneration({ pageId, title, description: title });
    } else if (title) {
      executeResolve(title);
    }
  };

  const getDifficultyMeta = (level: number) => {
    switch (level) {
      case 1:
        return {
          badgeText: "LEVEL 1: RECRUIT",
          badgeStyle: "border-emerald-500/50 text-emerald-400 bg-emerald-500/10",
          tagLabel: "RECRUIT",
          tagColor: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
          description:
            "Casual / Foundational: Direct questions on iconic events, famous leaders, and core dates.",
        };
      case 3:
        return {
          badgeText: "LEVEL 3: LEGEND",
          badgeStyle: "border-amber-500/50 text-amber-400 bg-amber-500/10 shadow-glow-yellow",
          tagLabel: "LEGEND",
          tagColor: "border-amber-500/40 text-amber-400 bg-amber-500/10",
          description:
            "Expert / High Challenge: Deep strategic dilemmas, subtle distinctions, and nuanced timelines.",
        };
      case 2:
      default:
        return {
          badgeText: "LEVEL 2: VETERAN",
          badgeStyle: "border-cyan-500/50 text-cyan-400 bg-cyan-500/10",
          tagLabel: "VETERAN",
          tagColor: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10",
          description:
            "Standard / Strategic: Balanced questions analyzing turning points, causes, and consequences.",
        };
    }
  };

  const currentDiffMeta = getDifficultyMeta(difficulty);

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
              className="tactile-btn gamer-cut px-8 py-4 bg-gradient-to-r from-game-yellow via-amber-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-game-bg font-heading text-xl font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-tactile"
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

          {/* Horizontal Difficulty Selector Bar */}
          <div className="mt-6 pt-5 border-t border-game-purple/30 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="difficulty-slider"
                className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Shield className="w-4 h-4 text-game-yellow" /> MISSION DIFFICULTY LEVEL
              </label>
              <span
                className={`font-heading text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border transition-all ${currentDiffMeta.badgeStyle}`}
              >
                {currentDiffMeta.badgeText}
              </span>
            </div>

            {/* Range Slider Track */}
            <div className="relative py-1">
              <input
                id="difficulty-slider"
                type="range"
                min="1"
                max="3"
                step="1"
                value={difficulty}
                onChange={(e) => {
                  setDifficulty(Number(e.target.value));
                  soundFX.playClick();
                }}
                className="w-full h-3 bg-game-bg rounded-lg appearance-none cursor-pointer accent-game-yellow border border-game-border focus:outline-none"
              />

              {/* 3 Interactive Notches */}
              <div className="grid grid-cols-3 text-center text-xs font-heading uppercase italic tracking-wider mt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDifficulty(1);
                    soundFX.playClick();
                  }}
                  className={`text-left transition-all ${
                    difficulty === 1
                      ? "text-emerald-400 font-black scale-105"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  ● 1. RECRUIT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDifficulty(2);
                    soundFX.playClick();
                  }}
                  className={`text-center transition-all ${
                    difficulty === 2
                      ? "text-cyan-400 font-black scale-105"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  ● 2. VETERAN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDifficulty(3);
                    soundFX.playClick();
                  }}
                  className={`text-right transition-all ${
                    difficulty === 3
                      ? "text-amber-400 font-black scale-105"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  ● 3. LEGEND
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 font-medium">
              💡 {currentDiffMeta.description}
            </p>
          </div>

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

      {/* Battle Archive & Combat Log */}
      {battleLog.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-game-border pb-3">
            <div className="flex items-center gap-2 text-white font-heading text-2xl uppercase tracking-wider italic">
              <History className="w-6 h-6 text-game-yellow" />
              COMBAT ARCHIVE &amp; BATTLE LOG
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {battleLog.length} {battleLog.length === 1 ? "MISSION LOGGED" : "MISSIONS LOGGED"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {battleLog.map((battle) => {
              const isPerfect = battle.score === battle.nQuestions;
              const isVictory = battle.score >= Math.ceil(battle.nQuestions * 0.7);
              const diffMeta = getDifficultyMeta(battle.difficulty || 2);

              const formattedDate = battle.finishedAt
                ? new Date(battle.finishedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Recent";

              return (
                <div
                  key={battle.attemptId}
                  className={`bg-game-surface border-2 ${
                    isPerfect
                      ? "border-game-yellow/70 shadow-glow-yellow"
                      : isVictory
                      ? "border-game-green/50"
                      : "border-game-border"
                  } rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:-translate-y-0.5 transition-all`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${diffMeta.tagColor}`}
                        >
                          {diffMeta.tagLabel}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formattedDate}
                        </span>
                      </div>
                      <h3 className="font-heading text-xl text-white uppercase italic line-clamp-1">
                        {battle.topicName}
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 text-sm font-heading font-black text-game-yellow">
                        <Trophy className="w-4 h-4 text-game-yellow" />
                        <span>
                          {battle.score} / {battle.nQuestions}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-game-blue uppercase tracking-wider">
                        +{battle.totalXpEarned} XP
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-game-border/60">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isPerfect
                          ? "text-game-yellow"
                          : isVictory
                          ? "text-game-green"
                          : "text-slate-300"
                      }`}
                    >
                      {isPerfect
                        ? "👑 PERFECT VICTORY"
                        : isVictory
                        ? "⚔️ MISSION CLEARED"
                        : "🛡️ MISSION COMPLETE"}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/results/${battle.attemptId}`)}
                        className="tactile-btn px-3 py-1.5 bg-game-surfaceLight border border-game-border hover:border-game-blue text-white rounded-lg font-heading text-xs uppercase tracking-wider flex items-center gap-1"
                      >
                        VIEW DEBRIEF
                      </button>
                      <button
                        onClick={() => handleEnterTopic(battle.wikiPageId, battle.topicName)}
                        className="tactile-btn px-3 py-1.5 bg-game-purple hover:bg-game-purple-dark text-white rounded-lg font-heading text-xs uppercase tracking-wider flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> REMATCH
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent Topic Archives Grid */}
      {recentTopics.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-white font-heading text-2xl uppercase tracking-wider italic">
            <BookOpen className="w-6 h-6 text-game-purple" />
            DISCOVERED HISTORICAL TOPICS
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentTopics.map((topic, idx) => {
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
                      CHRONO ARCHIVE #{topic.id.slice(-4)}
                    </div>
                    <h3 className="font-heading text-xl text-white uppercase italic line-clamp-1 mb-2">
                      {topic.name}
                    </h3>
                  </div>
                  <div className="mt-4 pt-3 border-t border-game-border flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">
                      Instant Replay
                    </span>
                    <button
                      onClick={() => handleEnterTopic(topic.wikiPageId, topic.name)}
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
