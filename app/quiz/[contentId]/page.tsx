"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PublicQuizSession, PublicQuizQuestion } from "@/lib/schemas";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Flag,
  ArrowRight,
  Loader2,
  Award,
  Zap,
  Shield,
} from "lucide-react";
import { soundFX } from "@/lib/audio";

interface AnswerFeedback {
  isCorrect: boolean;
  isSkipped: boolean;
  correctIdx: number;
  explanation: string;
}

function QuizRunnerContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const contentId = params.contentId as string;
  const difficultyParam = searchParams.get("difficulty") || "2";
  const difficultyLevel = Math.min(3, Math.max(1, parseInt(difficultyParam, 10) || 2));

  const [session, setSession] = useState<PublicQuizSession | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Runner state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [isFlagged, setIsFlagged] = useState(false);

  useEffect(() => {
    async function initQuiz() {
      try {
        setLoading(true);
        // 1. Fetch sanitized questions with difficulty preference
        const quizRes = await fetch(`/api/quiz/${contentId}?difficulty=${difficultyLevel}`);
        if (!quizRes.ok) {
          const errData = await quizRes.json();
          throw new Error(errData.error || "Failed to load quiz questions");
        }
        const sessionData: PublicQuizSession = await quizRes.json();
        setSession(sessionData);

        // 2. Initialize attempt
        const attRes = await fetch("/api/attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentId,
            nQuestions: sessionData.questions.length,
            difficulty: difficultyLevel,
          }),
        });

        if (!attRes.ok) {
          throw new Error("Failed to initialize attempt session");
        }
        const attData = await attRes.json();
        setAttemptId(attData.attemptId);
        setQuestionStartTime(Date.now());
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }

    if (contentId) {
      initQuiz();
    }
  }, [contentId, difficultyLevel]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-game-blue animate-spin" />
        <div className="font-heading text-2xl text-white uppercase italic tracking-wider">
          LOADING BATTLE MISSION...
        </div>
      </div>
    );
  }

  if (error || !session || session.questions.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-12 p-8 bg-game-surface border-2 border-game-red rounded-2xl text-center">
        <h2 className="font-heading text-2xl text-game-red uppercase italic mb-2">
          MISSION UNAVAILABLE
        </h2>
        <p className="text-slate-300 font-semibold mb-6">
          {error || "Unable to load mission challenges."}
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

  const currentQ = session.questions[currentIndex];
  const progressPercent = ((currentIndex + 1) / session.totalQuestions) * 100;
  const isLastQuestion = currentIndex === session.totalQuestions - 1;

  const difficultyMeta =
    difficultyLevel === 1
      ? { label: "RECRUIT", color: "border-emerald-500/50 text-emerald-400 bg-emerald-500/15" }
      : difficultyLevel === 3
      ? { label: "LEGEND", color: "border-amber-500/50 text-amber-400 bg-amber-500/15 shadow-glow-yellow" }
      : { label: "VETERAN", color: "border-cyan-500/50 text-cyan-400 bg-cyan-500/15" };

  const handleSelectOption = async (chosenIdx: number | null) => {
    if (isSubmitting || feedback !== null || !attemptId) return;

    soundFX.playClick();
    setSelectedIdx(chosenIdx);
    setIsSubmitting(true);
    const timeSpentMs = Date.now() - questionStartTime;

    try {
      const res = await fetch(`/api/attempt/${attemptId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQ.id,
          chosenIdx,
          timeMs: timeSpentMs,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit answer");

      const data = await res.json();
      setFeedback({
        isCorrect: data.isCorrect,
        isSkipped: data.isSkipped,
        correctIdx: data.correctIdx,
        explanation: data.explanation,
      });

      if (data.isCorrect) {
        setCurrentScore((s) => s + 1);
        soundFX.playCorrect();
      } else {
        soundFX.playIncorrect();
      }
    } catch (err: any) {
      console.error("Submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    soundFX.playClick();
    if (isLastQuestion) {
      router.push(`/results/${attemptId}`);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedIdx(null);
      setFeedback(null);
      setIsFlagged(false);
      setQuestionStartTime(Date.now());
    }
  };

  const handleFlagQuestion = async () => {
    if (isFlagged) return;
    try {
      await fetch("/api/question/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQ.id,
          reason: "User flagged for review",
        }),
      });
      setIsFlagged(true);
    } catch (err) {
      console.error("Flag error:", err);
    }
  };

  const optionLabels = ["A", "B", "C", "D"];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top HUD Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-game-surface border-2 border-game-border px-6 py-4 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-game-blue uppercase tracking-widest">
              {session.topicTitle}
            </span>
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${difficultyMeta.color}`}
            >
              {difficultyMeta.label}
            </span>
          </div>
          <div className="font-heading text-xl text-white uppercase italic">
            QUESTION {currentIndex + 1} OF {session.totalQuestions}
          </div>
        </div>

        <div className="flex items-center gap-4 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-game-surfaceLight border border-game-border text-game-yellow font-heading text-base">
            <Award className="w-4 h-4" />
            SCORE: {currentScore}
          </div>
          <button
            onClick={handleFlagQuestion}
            title="Flag question if broken or inaccurate"
            className={`p-2 rounded-lg border transition-colors ${
              isFlagged
                ? "bg-game-red/20 border-game-red text-game-red"
                : "bg-game-surfaceLight border-game-border text-slate-400 hover:text-white"
            }`}
          >
            <Flag className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-game-surfaceLight h-2.5 rounded-full overflow-hidden border border-game-border">
        <div
          className="bg-gradient-to-r from-game-purple via-game-blue to-game-yellow h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="bg-game-surface border-2 border-game-border rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
        <h2 className="font-heading text-2xl sm:text-3xl text-white uppercase italic leading-tight tracking-wide">
          {currentQ.stem}
        </h2>

        {/* Options Grid */}
        <div className="grid grid-cols-1 gap-3.5">
          {currentQ.options.map((optText, optIdx) => {
            let optionStyles =
              "bg-game-surfaceLight border-game-border hover:border-game-blue text-slate-200";

            if (feedback !== null) {
              if (optIdx === feedback.correctIdx) {
                // Correct Answer
                optionStyles =
                  "bg-game-green/20 border-game-green text-green-200 shadow-glow-green";
              } else if (optIdx === selectedIdx && !feedback.isCorrect) {
                // Chosen Wrong Answer
                optionStyles =
                  "bg-game-red/20 border-game-red text-red-200 shadow-glow-red animate-shake";
              } else {
                optionStyles =
                  "bg-game-surfaceLight/40 border-game-border/40 text-slate-500 opacity-60";
              }
            } else if (selectedIdx === optIdx) {
              optionStyles = "bg-game-blue/20 border-game-blue text-white";
            }

            return (
              <button
                key={optIdx}
                disabled={feedback !== null || isSubmitting}
                onClick={() => handleSelectOption(optIdx)}
                className={`tactile-btn w-full p-4 sm:p-5 rounded-2xl border-2 flex items-center gap-4 text-left transition-all ${optionStyles}`}
              >
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center font-heading text-lg font-bold shrink-0 ${
                    feedback !== null && optIdx === feedback.correctIdx
                      ? "bg-game-green text-white border-game-green"
                      : feedback !== null && optIdx === selectedIdx && !feedback.isCorrect
                      ? "bg-game-red text-white border-game-red"
                      : "bg-game-bg border-game-border text-slate-400"
                  }`}
                >
                  {feedback !== null && optIdx === feedback.correctIdx ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : feedback !== null && optIdx === selectedIdx && !feedback.isCorrect ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    optionLabels[optIdx]
                  )}
                </div>
                <div className="font-semibold text-base sm:text-lg flex-1">
                  {optText}
                </div>
              </button>
            );
          })}
        </div>

        {/* Skip Button (I Don't Know) */}
        {feedback === null && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => handleSelectOption(null)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <HelpCircle className="w-4 h-4" /> I Don&apos;t Know (Reveal Answer)
            </button>
          </div>
        )}

        {/* Instant Feedback Drawer */}
        {feedback !== null && (
          <div
            className={`p-6 rounded-2xl border-2 space-y-3 animate-in fade-in ${
              feedback.isCorrect
                ? "bg-game-green/10 border-game-green text-green-100"
                : "bg-game-surfaceLight border-game-border text-slate-100"
            }`}
          >
            <div className="flex items-center gap-2 font-heading text-xl uppercase tracking-wider italic">
              {feedback.isCorrect ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-game-green" />
                  <span>DIRECT HIT! +10 XP</span>
                </>
              ) : feedback.isSkipped ? (
                <>
                  <HelpCircle className="w-6 h-6 text-game-yellow" />
                  <span>MISSION INTEL REVEALED</span>
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-game-red" />
                  <span>TARGET MISSED — STUDY THE RECORD</span>
                </>
              )}
            </div>
            <p className="text-sm sm:text-base font-medium text-slate-200 leading-relaxed">
              {feedback.explanation}
            </p>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleNext}
                className="tactile-btn gamer-cut px-8 py-3.5 bg-gradient-to-r from-game-purple to-game-blue hover:from-purple-500 hover:to-cyan-400 text-white font-heading text-lg uppercase tracking-wider flex items-center gap-2 shadow-glow-blue"
              >
                {isLastQuestion ? "VIEW MISSION RESULTS" : "NEXT QUESTION"}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuizRunnerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="w-12 h-12 text-game-blue animate-spin" />
        </div>
      }
    >
      <QuizRunnerContent />
    </Suspense>
  );
}
