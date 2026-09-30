export interface GradeAnswerInput {
  chosenIdx: number | null; // null = "I don't know"
  correctIdx: number;
}

export interface GradeAnswerResult {
  isCorrect: boolean;
  isSkipped: boolean;
  points: number; // 10 for correct, 0 for wrong/skipped
}

export interface CalculateAttemptXpInput {
  score: number;
  totalQuestions: number;
  isFirstTimeTopic: boolean;
}

export interface AttemptXpBreakdown {
  baseXp: number;
  perfectBonus: number;
  firstTimeBonus: number;
  totalXp: number;
}

export interface LevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
}

/**
 * Grade a single question deterministically.
 * An answer of "I don't know" (null) scores 0 points, but is marked as skipped rather than penalized.
 */
export function gradeSingleAnswer(input: GradeAnswerInput): GradeAnswerResult {
  if (input.chosenIdx === null) {
    return {
      isCorrect: false,
      isSkipped: true,
      points: 0,
    };
  }

  const isCorrect = input.chosenIdx === input.correctIdx;
  return {
    isCorrect,
    isSkipped: false,
    points: isCorrect ? 10 : 0,
  };
}

/**
 * Calculate XP breakdown for an attempt.
 * Formula: xp = (correct * 10) + perfectBonus(50 if 10/10) + firstTimeTopicBonus(20)
 */
export function calculateAttemptXp(input: CalculateAttemptXpInput): AttemptXpBreakdown {
  const baseXp = input.score * 10;
  const perfectBonus = input.score === input.totalQuestions && input.totalQuestions > 0 ? 50 : 0;
  const firstTimeBonus = input.isFirstTimeTopic ? 20 : 0;
  const totalXp = baseXp + perfectBonus + firstTimeBonus;

  return {
    baseXp,
    perfectBonus,
    firstTimeBonus,
    totalXp,
  };
}

/**
 * Compute the player's level and tier progress from cumulative XP.
 * Each level requires: level * 100 XP.
 * Level 1: 0 - 99 XP
 * Level 2: 100 - 299 XP (+200)
 * Level 3: 300 - 599 XP (+300)
 */
export function computeLevelInfo(totalXp: number): LevelInfo {
  let level = 1;
  let accumulated = 0;

  while (true) {
    const xpNeededForThisLevel = level * 100;
    if (totalXp < accumulated + xpNeededForThisLevel) {
      const currentLevelXp = totalXp - accumulated;
      const progressPercent = Math.min(100, Math.floor((currentLevelXp / xpNeededForThisLevel) * 100));
      return {
        level,
        currentLevelXp,
        nextLevelXp: xpNeededForThisLevel,
        progressPercent,
      };
    }
    accumulated += xpNeededForThisLevel;
    level++;
  }
}

/**
 * Calculate streak update given the last active ISO date.
 */
export function calculateStreakUpdate(lastActiveDate: string | null | undefined, now: Date = new Date()): { streakDays: number; lastActiveDate: string } {
  const todayStr = now.toISOString().split("T")[0];

  if (!lastActiveDate) {
    return { streakDays: 1, lastActiveDate: todayStr };
  }

  const lastDate = new Date(lastActiveDate);
  const nowDate = new Date(todayStr);
  const diffDays = Math.round((nowDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Already played today, preserve current streak
    return { streakDays: 1, lastActiveDate: todayStr };
  } else if (diffDays === 1) {
    // Consecutive day, increment
    return { streakDays: 2, lastActiveDate: todayStr };
  } else {
    // Streak broken, reset to 1
    return { streakDays: 1, lastActiveDate: todayStr };
  }
}
