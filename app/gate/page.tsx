"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, ShieldAlert, Sparkles, ArrowRight, Loader2, Lock } from "lucide-react";

function GateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Access denied: Invalid passcode");
      }

      // Success, route to target
      router.push(from);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-game-surface border-2 border-game-purple/50 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-game-purple/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-game-purple/20 border-2 border-game-purple flex items-center justify-center shadow-glow-purple">
            <Lock className="w-8 h-8 text-game-yellow" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-game-purple/20 border border-game-purple/40 text-game-purple-light text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-game-yellow" />
            Security Clearance Required
          </div>

          <h1 className="font-heading text-3xl sm:text-4xl text-white uppercase italic tracking-wider">
            CHRONO VAULT
          </h1>

          <p className="text-slate-300 text-sm font-medium">
            Enter your guardian passcode to unlock the History Quest simulation arena.
          </p>

          <form onSubmit={handleSubmit} className="w-full space-y-4 pt-2">
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter access code..."
                autoFocus
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-game-bg border-2 border-game-border focus:border-game-yellow text-white placeholder-slate-500 font-semibold tracking-widest focus:outline-none transition-colors text-center text-lg"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-game-red/20 border border-game-red/60 text-red-300 text-xs font-semibold flex items-center gap-2 justify-center">
                <ShieldAlert className="w-4 h-4 shrink-0 text-game-red" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !passcode.trim()}
              className="tactile-btn gamer-cut w-full py-3.5 bg-gradient-to-r from-game-yellow via-amber-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-game-bg font-heading text-lg font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-yellow"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  AUTHENTICATING...
                </>
              ) : (
                <>
                  UNLOCK ARENA <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="text-[11px] text-slate-400 uppercase tracking-widest pt-2">
            Default Passcode: <span className="text-game-yellow font-mono">history123</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-game-yellow animate-spin" />
        </div>
      }
    >
      <GateForm />
    </Suspense>
  );
}
