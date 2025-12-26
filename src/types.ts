// Types for Claude Code Wrapped

// Claude Code stats-cache.json structure
export interface ClaudeCodeStats {
  version: number;
  lastComputedDate: string;
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, ModelUsage>;
  totalSessions: number;
  totalMessages: number;
  longestSession: LongestSession;
  firstSessionDate: string;
  hourCounts: Record<string, number>;
}

export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
}

export interface LongestSession {
  sessionId: string;
  duration: number;
  messageCount: number;
  timestamp: string;
}

// History entry from history.jsonl
export interface HistoryEntry {
  display: string;
  pastedContents: Record<string, unknown>;
  timestamp: number;
  project: string;
  sessionId: string;
}

// Session message from project JSONL files
export interface SessionMessage {
  type: string;
  sessionId: string;
  timestamp: string;
  model?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

// Computed stats for the wrapped image
export interface ModelStats {
  id: string;
  name: string;
  providerId: string;
  count: number;
  percentage: number;
}

export interface ProviderStats {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

export interface WrappedStats {
  year: number;

  // Time-based
  firstSessionDate: Date;
  daysSinceFirstSession: number;

  // Counts
  totalSessions: number;
  totalMessages: number;
  totalProjects: number;
  totalPrompts: number;

  // Tokens
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;

  // Cost (from Claude API)
  totalCost: number;
  hasCostData: boolean;

  // Models (sorted by usage)
  topModels: ModelStats[];

  // Providers (sorted by usage) - for Claude Code this will always be Anthropic
  topProviders: ProviderStats[];

  // Streak
  maxStreak: number;
  currentStreak: number;
  maxStreakDays: Set<string>;

  // Activity heatmap (for the year)
  dailyActivity: Map<string, number>;

  // Most active day
  mostActiveDay: {
    date: string;
    count: number;
    formattedDate: string;
  } | null;

  // Weekday activity distribution (0=Sunday, 6=Saturday)
  weekdayActivity: WeekdayActivity;

  // Top projects
  topProjects: ProjectStats[];

  // Longest session
  longestSession: {
    duration: number;
    messageCount: number;
  } | null;
}

export interface WeekdayActivity {
  counts: [number, number, number, number, number, number, number];
  mostActiveDay: number;
  mostActiveDayName: string;
  maxCount: number;
}

export interface ProjectStats {
  name: string;
  promptCount: number;
  percentage: number;
}

export interface CliArgs {
  year?: number;
  help?: boolean;
}
