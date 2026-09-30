"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { soundFX } from "@/lib/audio";

interface AnswerFeedback {
  isCorrect: boolean;
  isSkipped: boolean;
  correctIdx: number;
  explanation: string;
}

export default function QuizRunnerPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;

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
        // 1. Fetch sanitized questions
        const quizRes = await fetch(`/api/quiz/${contentId}`);
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
  }, [contentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-game-blue animate-spin" />
        <div className="font-heading text-2xl text-white uppercase italic tracking-wider">
          PREPARING BATTLE QUESTIONS...
        </div>
      </div>
    );
  }

  if (error || !session || !attemptId) {
    return (
      <div className="max-w-md mx-auto mt-12 p-8 bg-game-surface border-2 border-game-red rounded-2xl text-center">
        <h2 className="font-heading text-2xl text-game-red uppercase italic mb-2">
          MISSION ABORTED
        </h2>
        <p className="text-slate-300 font-semibold mb-6">
          {error || "Unable to start quiz session."}
        </p>
        <button
          onClick={() => router.push("/")}
          className="tactile-btn px-6 py-3 bg-game-surfaceLight border border-game-border hover:border-white text-white rounded-xl font-heading uppercase"
        >
          Return to Mission Control
        </button>
      </div>
    );
  }

  const currentQ: PublicQuizQuestion = session.questions[currentIndex];
  const isLastQuestion = currentIndex === session.questions.length - 1;

  const handleSelectOption = async (chosenIdx: number | null) => {
    if (selectedIdx !== null || isSubmitting) return;

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
        body: JSON.stringify({ questionId: currentQ.id }),
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
      <div className="flex items-center justify-between bg-game-surface border-2 border-game-border px-6 py-4 rounded-2xl">
        <div>
          <div className="text-[11px] font-bold text-game-blue uppercase tracking-widest">
            {session.topicTitle}
          </div>
          <div className="font-heading text-xl text-white uppercase italic">
            QUESTION {currentIndex + 1} OF {session.totalQuestions}
          </div>
        </div>

        <div className="flex items-center gap-4">
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
      <div className="w-full bg-game-surface h-2.5 rounded-full overflow-hidden border border-game-border p-0.5">
        <div
          className="bg-gradient-to-r from-game-purple via-game-blue to-game-yellow h-full rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / session.totalQuestions) * 100}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="bg-game-surface border-2 border-game-border rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
        <h2 className="font-heading text-2xl sm:text-3xl text-white tracking-wide leading-snug">
          {currentQ.stem}
        </h2>

        {/* 4 Multiple Choice Options */}
        <div className="grid grid-cols-1 gap-3.5">
          {currentQ.options.map((opt, idx) => {
            let btnStyle = "bg-game-surfaceLight border-game-border text-slate-200 hover:border-game-blue hover:text-white";
            let badgeStyle = "bg-game-surface text-slate-400 border-game-border";

            if (feedback) {
              if (idx === feedback.correctIdx) {
                // Correct answer lights up green
                btnStyle = "bg-game-green/20 border-game-green text-green-200 shadow-glow-green";
                badgeStyle = "bg-game-green text-game-bg border-game-green font-black";
              } else if (idx === selectedIdx && !feedback.isCorrect) {
                // Wrong chosen answer lights up red
                btnStyle = "bg-game-red/20 border-game-red text-red-200";
                badgeStyle = "bg-game-red text-white border-game-red font-black";
              } else {
                btnStyle = "bg-game-surfaceLight/50 border-game-border/50 text-slate-500 opacity-60";
              }
            }

            return (
              <button
                key={idx}
                disabled={feedback !== null || isSubmitting}
                onClick={() => handleSelectOption(idx)}
                className={`tactile-btn text-left p-4 sm:p-5 rounded-2xl border-2 flex items-center gap-4 transition-all ${btnStyle}`}
              >
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center font-heading text-lg shrink-0 ${badgeStyle}`}
                >
                  {optionLabels[idx]}
                </div>
                <span className="text-base sm:text-lg font-semibold flex-1">
                  {opt}
                </span>
                {feedback && idx === feedback.correctIdx && (
                  <CheckCircle2 className="w-6 h-6 text-game-green shrink-0" />
                )}
                {feedback && idx === selectedIdx && !feedback.isCorrect && (
                  <XCircle className="w-6 h-6 text-game-red shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* "I Don't Know" Button */}
        {!feedback && (
          <div className="pt-2 flex justify-center">
            <button
              disabled={isSubmitting}
              onClick={() => handleSelectOption(null)}
              className="px-6 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 text-sm font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-game-surfaceLight transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              I don&apos;t know yet (Skip for 0 XP)
            </button>
          </div>
        )}

        {/* Instant Pedagogical Feedback Reveal */}
        {feedback && (
          <div
            className={`p-6 rounded-2xl border-2 animate-in fade-in space-y-3 ${
              feedback.isCorrect
                ? "bg-game-green/10 border-game-green/50 text-green-200"
                : feedback.isSkipped
                ? "bg-slate-800/40 border-slate-700 text-slate-300"
                : "bg-game-red/10 border-game-red/50 text-red-200"
            }`}
          >
            <div className="flex items-center gap-2 font-heading text-xl uppercase italic">
              {feedback.isCorrect ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-game-green" />
                  VICTORY! +10 XP
                </>
              ) : feedback.isSkipped ? (
                <>
                  <HelpCircle className="w-6 h-6 text-slate-400" />
                  LEARN THIS ARCHIVE CARD
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-game-red" />
                  MISSED! LEARN THIS CARD
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
