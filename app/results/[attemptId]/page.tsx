"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Trophy,
  Award,
  Zap,
  Flame,
  BookOpen,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { soundFX } from "@/lib/audio";

interface FinalResults {
  attemptId: string;
  score: number;
  totalQuestions: number;
  xpEarned: {
    baseXp: number;
    perfectBonus: number;
    firstTimeBonus: number;
    totalXp: number;
  };
  lessonText: string;
  sourceUrl: string;
  topicTitle: string;
  followups: string[];
  reviewQuestions: Array<{
    questionId: string;
    stem: string;
    options: string[];
    chosenIdx: number | null;
    correctIdx: number;
    isCorrect: boolean;
    explanation: string;
  }>;
  playerState: {
    totalXp: number;
    level: number;
    currentLevelXp: number;
    nextLevelXp: number;
    progressPercent: number;
    streakDays: number;
  };
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.attemptId as string;

  const [data, setData] = useState<FinalResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function finalize() {
      try {
        setLoading(true);
        const res = await fetch(`/api/attempt/${attemptId}/finish`, {
          method: "POST",
        });

        if (!res.ok) {
          throw new Error("Failed to finalize attempt results");
        }

        const json = await res.json();
        setData(json);
        soundFX.playVictory();
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    if (attemptId) {
      finalize();
    }
  }, [attemptId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-game-yellow animate-spin" />
        <div className="font-heading text-2xl text-white uppercase italic tracking-wider">
          CALCULATING BATTLE XP & REWARDS...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto mt-12 p-8 bg-game-surface border-2 border-game-red rounded-2xl text-center">
        <h2 className="font-heading text-2xl text-game-red uppercase italic mb-2">
          ERROR LOADING RESULTS
        </h2>
        <p className="text-slate-300 font-semibold mb-6">
          {error || "Unable to display results."}
        </p>
        <button
          onClick={() => router.push("/")}
          className="tactile-btn px-6 py-3 bg-game-surfaceLight border border-game-border text-white rounded-xl font-heading uppercase"
        >
          Return to Mission Control
        </button>
      </div>
    );
  }

  const isPerfect = data.score === data.totalQuestions;

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      {/* Victory Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c183b] via-game-surface to-[#0e172e] border-2 border-game-yellow/60 p-8 sm:p-12 text-center shadow-glow-yellow">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-game-yellow/20 border border-game-yellow/50 text-game-yellow font-heading text-sm uppercase tracking-widest mb-4">
          <Trophy className="w-4 h-4" />
          {isPerfect ? "PERFECT VICTORY ROYALE!" : "MISSION ACCOMPLISHED!"}
        </div>

        <h1 className="font-heading text-4xl sm:text-6xl text-white uppercase italic tracking-wider mb-2">
          {data.topicTitle}
        </h1>
        <div className="text-slate-300 text-lg font-semibold mb-8">
          FINAL SCORE: <span className="text-game-yellow font-heading text-2xl">{data.score}</span> / {data.totalQuestions}
        </div>

        {/* XP Gains Grid */}
        <div className="max-w-xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 bg-game-surface/80 border border-game-border p-4 rounded-2xl">
          <div className="p-3 bg-game-surfaceLight rounded-xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base XP</div>
            <div className="font-heading text-xl text-white">+{data.xpEarned.baseXp}</div>
          </div>
          <div className="p-3 bg-game-surfaceLight rounded-xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Victory Bonus</div>
            <div className="font-heading text-xl text-game-yellow">+{data.xpEarned.perfectBonus}</div>
          </div>
          <div className="p-3 bg-game-surfaceLight rounded-xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Discovery</div>
            <div className="font-heading text-xl text-game-blue">+{data.xpEarned.firstTimeBonus}</div>
          </div>
          <div className="p-3 bg-gradient-to-br from-game-purple to-game-blue rounded-xl text-white">
            <div className="text-[10px] font-bold uppercase tracking-widest">Total XP</div>
            <div className="font-heading text-xl">+{data.xpEarned.totalXp}</div>
          </div>
        </div>
      </section>

      {/* Lesson Brief Section */}
      <section className="bg-game-surface border-2 border-game-border rounded-3xl p-6 sm:p-10 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-game-border pb-4">
          <div className="flex items-center gap-2 font-heading text-2xl text-white uppercase italic">
            <BookOpen className="w-6 h-6 text-game-blue" />
            HISTORICAL INTELLIGENCE BRIEF
          </div>
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-game-blue hover:underline flex items-center gap-1 uppercase tracking-wider"
          >
            Wikipedia Source <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        <div className="text-slate-200 text-base sm:text-lg leading-relaxed whitespace-pre-line font-normal">
          {data.lessonText}
        </div>
      </section>

      {/* Review & "Learn This" Cards */}
      <section className="space-y-4">
        <div className="font-heading text-2xl text-white uppercase italic">
          BATTLE QUESTIONS REVIEW
        </div>
        <div className="grid grid-cols-1 gap-4">
          {data.reviewQuestions.map((q, idx) => (
            <div
              key={q.questionId}
              className={`p-5 rounded-2xl border-2 flex flex-col gap-3 ${
                q.isCorrect
                  ? "bg-game-surface/80 border-game-green/40"
                  : "bg-game-surface/80 border-game-red/40"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 font-heading text-lg text-white">
                  {q.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-game-green shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-game-red shrink-0" />
                  )}
                  <span>Q{idx + 1}: {q.stem}</span>
                </div>
                <div
                  className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                    q.isCorrect ? "bg-game-green/20 text-game-green" : "bg-game-red/20 text-game-red"
                  }`}
                >
                  {q.isCorrect ? "CORRECT (+10 XP)" : "LEARN THIS"}
                </div>
              </div>

              <div className="text-sm font-semibold text-slate-300">
                Correct Answer:{" "}
                <span className="text-white font-bold">{q.options[q.correctIdx]}</span>
              </div>

              <p className="text-xs sm:text-sm text-slate-400 border-t border-game-border/60 pt-2">
                💡 {q.explanation}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Follow-up Topic Missions */}
      {data.followups && data.followups.length > 0 && (
        <section className="bg-game-surface border-2 border-game-border rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="font-heading text-xl text-white uppercase italic">
            EXPLORE RELATED HISTORICAL MISSIONS
          </div>
          <div className="flex flex-wrap gap-3">
            {data.followups.map((topic, i) => (
              <button
                key={i}
                onClick={() => router.push(`/?q=${encodeURIComponent(topic)}`)}
                className="tactile-btn px-5 py-2.5 rounded-xl bg-game-surfaceLight border-2 border-game-purple/50 hover:border-game-blue text-white font-heading text-sm uppercase tracking-wider flex items-center gap-2"
              >
                {topic} <ArrowRight className="w-4 h-4 text-game-blue" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Return Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
        <button
          onClick={() => router.push("/")}
          className="tactile-btn gamer-cut px-8 py-4 bg-gradient-to-r from-game-purple to-game-blue text-white font-heading text-xl uppercase tracking-wider flex items-center justify-center gap-2 shadow-glow-purple"
        >
          <RotateCcw className="w-5 h-5" />
          START NEW BATTLE
        </button>
      </div>
    </div>
  );
}
