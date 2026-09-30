import { describe, it, expect } from "vitest";
import {
  gradeSingleAnswer,
  calculateAttemptXp,
  computeLevelInfo,
  calculateStreakUpdate,
} from "../lib/grading";

describe("Grading Module", () => {
  describe("gradeSingleAnswer", () => {
    it("correctly identifies a right answer", () => {
      const res = gradeSingleAnswer({ chosenIdx: 2, correctIdx: 2 });
      expect(res.isCorrect).toBe(true);
      expect(res.isSkipped).toBe(false);
      expect(res.points).toBe(10);
    });

    it("correctly identifies a wrong answer", () => {
      const res = gradeSingleAnswer({ chosenIdx: 1, correctIdx: 2 });
      expect(res.isCorrect).toBe(false);
      expect(res.isSkipped).toBe(false);
      expect(res.points).toBe(0);
    });

    it("handles 'I don't know' (null) as skipped without penalty", () => {
      const res = gradeSingleAnswer({ chosenIdx: null, correctIdx: 2 });
      expect(res.isCorrect).toBe(false);
      expect(res.isSkipped).toBe(true);
      expect(res.points).toBe(0);
    });
  });

  describe("calculateAttemptXp", () => {
    it("calculates standard XP with no bonuses", () => {
      const xp = calculateAttemptXp({
        score: 7,
        totalQuestions: 10,
        isFirstTimeTopic: false,
      });
      expect(xp.baseXp).toBe(70);
      expect(xp.perfectBonus).toBe(0);
      expect(xp.firstTimeBonus).toBe(0);
      expect(xp.totalXp).toBe(70);
    });

    it("awards perfect bonus on 10/10", () => {
      const xp = calculateAttemptXp({
        score: 10,
        totalQuestions: 10,
        isFirstTimeTopic: false,
      });
      expect(xp.baseXp).toBe(100);
      expect(xp.perfectBonus).toBe(50);
      expect(xp.totalXp).toBe(150);
    });

    it("awards first-time topic bonus and perfect bonus together", () => {
      const xp = calculateAttemptXp({
        score: 10,
        totalQuestions: 10,
        isFirstTimeTopic: true,
      });
      expect(xp.baseXp).toBe(100);
      expect(xp.perfectBonus).toBe(50);
      expect(xp.firstTimeBonus).toBe(20);
      expect(xp.totalXp).toBe(170);
    });
  });

  describe("computeLevelInfo", () => {
    it("returns level 1 for 0 XP", () => {
      const level = computeLevelInfo(0);
      expect(level.level).toBe(1);
      expect(level.currentLevelXp).toBe(0);
      expect(level.nextLevelXp).toBe(100);
      expect(level.progressPercent).toBe(0);
    });

    it("returns level 2 after exceeding 100 XP", () => {
      const level = computeLevelInfo(150);
      expect(level.level).toBe(2);
      expect(level.currentLevelXp).toBe(50);
      expect(level.nextLevelXp).toBe(200);
      expect(level.progressPercent).toBe(25);
    });
  });

  describe("calculateStreakUpdate", () => {
    it("initializes streak to 1 if no prior active date", () => {
      const res = calculateStreakUpdate(null, new Date("2026-09-30"));
      expect(res.streakDays).toBe(1);
      expect(res.lastActiveDate).toBe("2026-09-30");
    });
  });
});
