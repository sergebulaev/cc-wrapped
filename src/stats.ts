import type { WrappedStats, ModelStats, ProviderStats, WeekdayActivity, ProjectStats } from "./types";
import { collectStatsCache, collectHistory, collectProjects } from "./collector";
import { getModelDisplayName } from "./models";

export async function calculateStats(year: number): Promise<WrappedStats> {
  const [statsCache, history, projects] = await Promise.all([
    collectStatsCache(),
    collectHistory(year),
    collectProjects(year),
  ]);

  // Build daily activity map from stats cache or history
  const dailyActivity = new Map<string, number>();
  const weekdayCounts: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0];

  if (statsCache?.dailyActivity) {
    for (const day of statsCache.dailyActivity) {
      if (day.date.startsWith(String(year))) {
        dailyActivity.set(day.date, day.messageCount);

        // Calculate weekday
        const date = new Date(day.date);
        weekdayCounts[date.getDay()] += day.messageCount;
      }
    }
  }

  // If no stats cache, build from history
  if (dailyActivity.size === 0 && history.length > 0) {
    for (const entry of history) {
      const date = new Date(entry.timestamp);
      const dateKey = formatDateKey(date);
      dailyActivity.set(dateKey, (dailyActivity.get(dateKey) || 0) + 1);
      weekdayCounts[date.getDay()]++;
    }
  }

  // Calculate first session date
  let firstSessionDate: Date;
  let daysSinceFirstSession: number;

  if (statsCache?.firstSessionDate) {
    firstSessionDate = new Date(statsCache.firstSessionDate);
    daysSinceFirstSession = Math.floor((Date.now() - firstSessionDate.getTime()) / (1000 * 60 * 60 * 24));
  } else if (history.length > 0) {
    const firstTimestamp = Math.min(...history.map((h) => h.timestamp));
    firstSessionDate = new Date(firstTimestamp);
    daysSinceFirstSession = Math.floor((Date.now() - firstTimestamp) / (1000 * 60 * 60 * 24));
  } else {
    firstSessionDate = new Date();
    daysSinceFirstSession = 0;
  }

  // Calculate totals from stats cache
  let totalSessions = 0;
  let totalMessages = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let totalCost = 0;

  if (statsCache) {
    // Sum up daily activity for the year
    for (const day of statsCache.dailyActivity) {
      if (day.date.startsWith(String(year))) {
        totalMessages += day.messageCount;
        totalSessions += day.sessionCount;
      }
    }

    // Sum up model usage
    for (const [, usage] of Object.entries(statsCache.modelUsage)) {
      totalInputTokens += usage.inputTokens || 0;
      totalOutputTokens += usage.outputTokens || 0;
      totalCacheReadTokens += usage.cacheReadInputTokens || 0;
      totalCacheWriteTokens += usage.cacheCreationInputTokens || 0;
      totalCost += usage.costUSD || 0;
    }
  }

  // If no stats cache, estimate from history
  if (totalMessages === 0 && history.length > 0) {
    totalMessages = history.length * 20; // Rough estimate
    const uniqueSessions = new Set(history.map((h) => h.sessionId));
    totalSessions = uniqueSessions.size;
  }

  const totalTokens = totalInputTokens + totalOutputTokens;
  const totalPrompts = history.length;
  const totalProjects = projects.length;

  // Build model stats
  const modelCounts = new Map<string, number>();

  if (statsCache?.modelUsage) {
    for (const [modelId, usage] of Object.entries(statsCache.modelUsage)) {
      // Use output tokens as the count metric
      modelCounts.set(modelId, usage.outputTokens || 0);
    }
  }

  const totalModelCount = Array.from(modelCounts.values()).reduce((a, b) => a + b, 0);

  const topModels: ModelStats[] = Array.from(modelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({
      id,
      name: getModelDisplayName(id),
      providerId: "anthropic",
      count,
      percentage: totalModelCount > 0 ? Math.round((count / totalModelCount) * 100) : 0,
    }));

  // For Claude Code, provider is always Anthropic
  const topProviders: ProviderStats[] = [
    {
      id: "anthropic",
      name: "Anthropic",
      count: totalMessages,
      percentage: 100,
    },
  ];

  // Build project stats
  const projectCounts = new Map<string, number>();
  for (const entry of history) {
    const projectName = entry.project.split("/").pop() || entry.project;
    projectCounts.set(projectName, (projectCounts.get(projectName) || 0) + 1);
  }

  const topProjectsList: ProjectStats[] = Array.from(projectCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, promptCount]) => ({
      name,
      promptCount,
      percentage: totalPrompts > 0 ? Math.round((promptCount / totalPrompts) * 100) : 0,
    }));

  // Calculate streaks
  const { maxStreak, currentStreak, maxStreakDays } = calculateStreaks(dailyActivity, year);

  // Find most active day
  const mostActiveDay = findMostActiveDay(dailyActivity);

  // Build weekday activity
  const weekdayActivity = buildWeekdayActivity(weekdayCounts);

  // Get longest session info
  const longestSession = statsCache?.longestSession
    ? {
        duration: statsCache.longestSession.duration,
        messageCount: statsCache.longestSession.messageCount,
      }
    : null;

  return {
    year,
    firstSessionDate,
    daysSinceFirstSession,
    totalSessions,
    totalMessages,
    totalProjects,
    totalPrompts,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    totalCacheReadTokens,
    totalCacheWriteTokens,
    totalCost,
    hasCostData: totalCost > 0,
    topModels,
    topProviders,
    maxStreak,
    currentStreak,
    maxStreakDays,
    dailyActivity,
    mostActiveDay,
    weekdayActivity,
    topProjects: topProjectsList,
    longestSession,
  };
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateStreaks(
  dailyActivity: Map<string, number>,
  year: number
): { maxStreak: number; currentStreak: number; maxStreakDays: Set<string> } {
  const activeDates = Array.from(dailyActivity.keys())
    .filter((date) => date.startsWith(String(year)))
    .sort();

  if (activeDates.length === 0) {
    return { maxStreak: 0, currentStreak: 0, maxStreakDays: new Set() };
  }

  let maxStreak = 1;
  let tempStreak = 1;
  let tempStreakStart = 0;
  let maxStreakStart = 0;
  let maxStreakEnd = 0;

  for (let i = 1; i < activeDates.length; i++) {
    const prevDate = new Date(activeDates[i - 1]);
    const currDate = new Date(activeDates[i]);

    const diffTime = currDate.getTime() - prevDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak++;
      if (tempStreak > maxStreak) {
        maxStreak = tempStreak;
        maxStreakStart = tempStreakStart;
        maxStreakEnd = i;
      }
    } else {
      tempStreak = 1;
      tempStreakStart = i;
    }
  }

  const maxStreakDays = new Set<string>();
  for (let i = maxStreakStart; i <= maxStreakEnd; i++) {
    maxStreakDays.add(activeDates[i]);
  }

  const today = formatDateKey(new Date());
  const yesterday = formatDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const currentStreak = dailyActivity.has(today)
    ? countStreakBackwards(dailyActivity, new Date())
    : dailyActivity.has(yesterday)
    ? countStreakBackwards(dailyActivity, new Date(Date.now() - 24 * 60 * 60 * 1000))
    : 0;

  return { maxStreak, currentStreak, maxStreakDays };
}

function countStreakBackwards(dailyActivity: Map<string, number>, startDate: Date): number {
  let streak = 1;
  let checkDate = new Date(startDate);

  while (true) {
    checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
    if (dailyActivity.has(formatDateKey(checkDate))) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function findMostActiveDay(dailyActivity: Map<string, number>): { date: string; count: number; formattedDate: string } | null {
  if (dailyActivity.size === 0) {
    return null;
  }

  let maxDate = "";
  let maxCount = 0;

  for (const [date, count] of dailyActivity.entries()) {
    if (count > maxCount) {
      maxCount = count;
      maxDate = date;
    }
  }

  if (!maxDate) {
    return null;
  }

  const [year, month, day] = maxDate.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formattedDate = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;

  return {
    date: maxDate,
    count: maxCount,
    formattedDate,
  };
}

function buildWeekdayActivity(counts: [number, number, number, number, number, number, number]): WeekdayActivity {
  const WEEKDAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  let mostActiveDay = 0;
  let maxCount = 0;
  for (let i = 0; i < 7; i++) {
    if (counts[i] > maxCount) {
      maxCount = counts[i];
      mostActiveDay = i;
    }
  }

  return {
    counts,
    mostActiveDay,
    mostActiveDayName: WEEKDAY_NAMES_FULL[mostActiveDay],
    maxCount,
  };
}
