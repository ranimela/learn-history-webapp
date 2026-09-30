"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Flame, Award, ShieldAlert, Volume2, VolumeX } from "lucide-react";
import { soundFX } from "@/lib/audio";

interface LearnerData {
  totalXp: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  streakDays: number;
}

export const Navbar = () => {
  const [data, setData] = useState<LearnerData | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(soundFX.isMuted());
  }, []);

  const handleToggleSound = () => {
    const isNowSoundEnabled = soundFX.toggleMute();
    setMuted(!isNowSoundEnabled);
    if (isNowSoundEnabled) {
      soundFX.playClick();
    }
  };

  const fetchHUD = async () => {
    try {
      const res = await fetch("/api/learner");
      if (res.ok) {
        const json = await res.json();
        setData(json.learner);
      }
    } catch (err) {
      console.error("Failed to load HUD data:", err);
    }
  };

  useEffect(() => {
    fetchHUD();
    const interval = setInterval(fetchHUD, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-game-surface/90 backdrop-blur-md border-b-2 border-game-border shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 bg-gradient-to-tr from-game-purple via-game-blue to-game-yellow rounded-xl p-0.5 shadow-glow-purple group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-game-bg rounded-[10px] flex items-center justify-center font-heading text-2xl text-game-yellow italic">
              HQ
            </div>
          </div>
          <div>
            <div className="font-heading tracking-wider uppercase text-2xl text-white flex items-center gap-1.5 italic">
              HISTORY <span className="text-game-blue">QUEST</span>
            </div>
            <div className="text-xs text-slate-400 font-semibold tracking-widest uppercase">
              BATTLE ARENA v0.1
            </div>
          </div>
        </Link>

        {/* Fortnite-Inspired Player HUD */}
        {data && (
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Streak Counter */}
            <div className="flex items-center gap-2 bg-game-surfaceLight border border-amber-500/40 px-3.5 py-1.5 rounded-lg shadow-sm">
              <Flame className="w-5 h-5 text-amber-400 fill-amber-400 animate-bounce" />
              <div className="text-right">
                <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Streak
                </div>
                <div className="font-heading text-base text-white tracking-wide leading-none">
                  {data.streakDays} {data.streakDays === 1 ? "DAY" : "DAYS"}
                </div>
              </div>
            </div>

            {/* Level & XP Bar */}
            <div className="flex items-center gap-3">
              <div className="gamer-tag bg-gradient-to-r from-game-yellow to-amber-500 text-game-bg px-3.5 py-1 rounded font-heading text-lg font-black tracking-wider uppercase shadow-tactile">
                <div className="gamer-tag-inner flex items-center gap-1">
                  <Award className="w-4 h-4" />
                  LVL {data.level}
                </div>
              </div>

              <div className="w-32 sm:w-44 hidden sm:block">
                <div className="flex justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  <span className="flex items-center gap-0.5 text-game-blue">
                    <Zap className="w-3 h-3 fill-game-blue" /> XP
                  </span>
                  <span>
                    {data.currentLevelXp} / {data.nextLevelXp}
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-game-border p-0.5">
                  <div
                    className="bg-gradient-to-r from-game-purple to-game-blue h-full rounded-full transition-all duration-500 shadow-glow-blue"
                    style={{ width: `${data.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Sound FX Toggle */}
        <button
          onClick={handleToggleSound}
          title={muted ? "Unmute Sound Effects" : "Mute Sound Effects"}
          className="p-2.5 rounded-xl bg-game-surfaceLight border border-game-border hover:border-game-purple text-slate-300 hover:text-white transition-colors flex items-center justify-center shadow-sm"
          aria-label={muted ? "Unmute Sound Effects" : "Mute Sound Effects"}
        >
          {muted ? (
            <VolumeX className="w-5 h-5 text-slate-500" />
          ) : (
            <Volume2 className="w-5 h-5 text-game-yellow" />
          )}
        </button>
      </div>
    </header>
  );
};
