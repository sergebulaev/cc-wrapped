// Dark theme template matching ccusage design
import type { WrappedStats } from "../types";
import { formatNumber, formatDuration } from "../utils/format";

// Design tokens for dark theme
const colors = {
  background: "#1e1e1e",
  text: {
    primary: "#e0e0e0",
    muted: "#888888",
    accent: "#e07850",
  },
  heatmap: {
    empty: "#2a2a2a",
    level1: "#3d2a2a",
    level2: "#5c3d3d",
    level3: "#7a4f4f",
    level4: "#e07850",
  },
};

const MONTHS = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_DISPLAY = ["", "Mon", "", "Wed", "", "Fri", ""];

interface DarkTemplateProps {
  stats: WrappedStats;
}

export function DarkTemplate({ stats }: DarkTemplateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 1000,
        height: 520,
        padding: "40px 50px",
        backgroundColor: colors.background,
        fontFamily: "IBM Plex Mono, monospace",
        color: colors.text.primary,
      }}
    >
      {/* Heatmap Section */}
      <WeekdayHeatmap dailyActivity={stats.dailyActivity} year={stats.year} />

      {/* Legend */}
      <HeatmapLegend />

      {/* Stats Grid */}
      <StatsGrid stats={stats} />

      {/* Fun Fact */}
      <FunFact stats={stats} />

      {/* Footer */}
      <Footer stats={stats} />
    </div>
  );
}

function WeekdayHeatmap({ dailyActivity, year }: { dailyActivity: Map<string, number>; year: number }) {
  const weeks = generateWeeksData(year);
  const maxCount = Math.max(...Array.from(dailyActivity.values()), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
      {/* Month labels */}
      <div style={{ display: "flex", flexDirection: "row", marginLeft: 50, marginBottom: 8 }}>
        {MONTHS.map((month, i) => (
          <div
            key={`${month}-${i}`}
            style={{
              width: 62,
              fontSize: 14,
              color: colors.text.primary,
              fontWeight: 500,
            }}
          >
            {month}
          </div>
        ))}
      </div>

      {/* Weekday rows */}
      {WEEKDAYS.map((day, dayIndex) => (
        <div key={dayIndex} style={{ display: "flex", flexDirection: "row", alignItems: "center", height: 15 }}>
          <div
            style={{
              width: 45,
              fontSize: 13,
              color: colors.text.primary,
              fontWeight: 500,
            }}
          >
            {WEEKDAYS_DISPLAY[dayIndex]}
          </div>
          <div style={{ display: "flex", flexDirection: "row", gap: 2 }}>
            {weeks.map((week, weekIndex) => {
              const dateStr = week[dayIndex];
              const count = dateStr ? dailyActivity.get(dateStr) || 0 : 0;
              const level = getIntensityLevel(count, maxCount);

              return (
                <div
                  key={weekIndex}
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 2,
                    backgroundColor: dateStr ? getHeatmapColor(level) : "transparent",
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 25,
        marginLeft: 50,
      }}
    >
      <span style={{ fontSize: 14, color: colors.text.primary }}>Less</span>
      {[0, 1, 2, 3, 4].map((level) => (
        <div
          key={level}
          style={{
            width: 14,
            height: 14,
            borderRadius: 2,
            backgroundColor: getHeatmapColor(level as 0 | 1 | 2 | 3 | 4),
          }}
        />
      ))}
      <span style={{ fontSize: 14, color: colors.text.primary }}>More</span>
    </div>
  );
}

function StatsGrid({ stats }: { stats: WrappedStats }) {
  const longestSessionDuration = stats.longestSession?.duration || 0;
  const formattedDuration = formatSessionDuration(longestSessionDuration);
  const peakHour = getPeakHour(stats);
  const activeDays = stats.dailyActivity.size;
  // Calculate days in the year so far (for current year) or 365 (for past years)
  const now = new Date();
  const isCurrentYear = stats.year === now.getFullYear();
  const totalDaysInPeriod = isCurrentYear
    ? Math.ceil((now.getTime() - new Date(stats.year, 0, 1).getTime()) / (1000 * 60 * 60 * 24))
    : 365;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 25,
      }}
    >
      {/* Left Column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <StatRow label="Favorite model:" value={getTopModelName(stats)} />
        <StatRow label="Sessions:" value={formatNumber(stats.totalSessions)} />
        <StatRow label="Current streak:" value={`${stats.currentStreak} days`} />
        <StatRow label="Active days:" value={`${activeDays}/${totalDaysInPeriod}`} />
      </div>

      {/* Right Column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <StatRow label="Total tokens:" value={formatTokens(stats.totalTokens)} />
        <StatRow label="Longest session:" value={formattedDuration} />
        <StatRow label="Longest streak:" value={`${stats.maxStreak} days`} />
        <StatRow label="Peak hour:" value={peakHour} />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "row", gap: 16 }}>
      <span style={{ fontSize: 16, color: colors.text.primary, minWidth: 160 }}>{label}</span>
      <span style={{ fontSize: 16, color: colors.text.accent, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function FunFact({ stats }: { stats: WrappedStats }) {
  const funFact = generateFunFact(stats);

  return (
    <div
      style={{
        display: "flex",
        fontSize: 14,
        color: colors.text.accent,
        marginBottom: 12,
      }}
    >
      {funFact}
    </div>
  );
}

function Footer({ stats }: { stats: WrappedStats }) {
  const daysSinceFirst = stats.daysSinceFirstSession || 1;

  return (
    <div
      style={{
        display: "flex",
        fontSize: 14,
        color: colors.text.muted,
      }}
    >
      Stats from the last {daysSinceFirst} days
    </div>
  );
}

// Helper functions

function generateWeeksData(year: number): (string | null)[][] {
  const weeks: (string | null)[][] = [];
  const startDate = new Date(year - 1, 11, 1); // Start from December of previous year

  // Find the first Sunday
  while (startDate.getDay() !== 0) {
    startDate.setDate(startDate.getDate() - 1);
  }

  const endDate = new Date(year, 11, 31);
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const week: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      if (currentDate <= endDate) {
        const dateStr = formatDateKey(currentDate);
        week.push(dateStr);
      } else {
        week.push(null);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getIntensityLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function getHeatmapColor(level: 0 | 1 | 2 | 3 | 4): string {
  const colorMap = {
    0: colors.heatmap.empty,
    1: colors.heatmap.level1,
    2: colors.heatmap.level2,
    3: colors.heatmap.level3,
    4: colors.heatmap.level4,
  };
  return colorMap[level];
}

function getTopModelName(stats: WrappedStats): string {
  if (stats.topModels.length === 0) return "Unknown";
  const topModel = stats.topModels[0];
  // Simplify model name
  const name = topModel.name
    .replace("Claude ", "")
    .replace(" 20250929", "")
    .replace(" 20251101", "")
    .replace(" 20250805", "");
  return name;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(1)}b`;
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}m`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }
  return String(tokens);
}

function formatSessionDuration(ms: number): string {
  if (ms === 0) return "N/A";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(" ") || "< 1m";
}

function getPeakHour(stats: WrappedStats): string {
  // For now, return a placeholder - would need hourCounts data
  return "10:00-11:00";
}

function generateFunFact(stats: WrappedStats): string {
  const tokens = stats.totalTokens;
  const sessions = stats.totalSessions;
  const longestMs = stats.longestSession?.duration || 0;

  // Various fun facts based on stats
  if (longestMs > 0) {
    const longestHours = longestMs / (1000 * 60 * 60);
    if (longestHours > 24) {
      const marathonTime = 2; // hours for half marathon
      const multiplier = Math.round(longestHours / marathonTime);
      return `Your longest session is ~${multiplier}x longer than a half marathon (average time)`;
    }
  }

  if (tokens > 1_000_000_000) {
    const books = Math.round(tokens / 500_000); // Average book ~500k tokens
    return `You've processed enough tokens to fill ${formatNumber(books)} books`;
  }

  if (sessions > 1000) {
    return `You've had more coding sessions than days in ${Math.round(sessions / 365)} years`;
  }

  if (stats.maxStreak > 30) {
    return `Your ${stats.maxStreak}-day streak is longer than most New Year's resolutions last`;
  }

  return `You've been coding with Claude for ${stats.daysSinceFirstSession} days`;
}

export default DarkTemplate;
