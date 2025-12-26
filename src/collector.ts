// Data collector - reads Claude Code storage and returns raw data

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ClaudeCodeStats, SessionMessage, HistoryEntry } from "./types";

// Support both old and new Claude Code data locations
const CLAUDE_DATA_PATHS = [
  join(homedir(), ".claude"),           // Old default
  join(homedir(), ".config", "claude"), // New default (since late 2025)
];

async function getValidClaudePaths(): Promise<string[]> {
  const validPaths: string[] = [];
  for (const path of CLAUDE_DATA_PATHS) {
    try {
      await readdir(path);
      validPaths.push(path);
    } catch {
      // Path doesn't exist, skip
    }
  }
  return validPaths;
}

export async function checkClaudeCodeDataExists(): Promise<boolean> {
  const paths = await getValidClaudePaths();
  return paths.length > 0;
}

export async function getClaudeDataPath(): Promise<string> {
  const paths = await getValidClaudePaths();
  return paths[0] || CLAUDE_DATA_PATHS[0];
}

export async function getAllClaudeDataPaths(): Promise<string[]> {
  return getValidClaudePaths();
}

// Read the stats-cache.json file which contains pre-computed stats
// Merges data from all valid Claude data directories
export async function collectStatsCache(): Promise<ClaudeCodeStats | null> {
  const paths = await getValidClaudePaths();
  let mergedStats: ClaudeCodeStats | null = null;

  for (const basePath of paths) {
    const statsPath = join(basePath, "stats-cache.json");
    try {
      const content = await Bun.file(statsPath).json() as ClaudeCodeStats;
      if (!mergedStats) {
        mergedStats = content;
      } else {
        // Merge daily activity
        const activityMap = new Map<string, { messageCount: number; sessionCount: number; toolCallCount: number }>();
        for (const day of mergedStats.dailyActivity) {
          activityMap.set(day.date, { messageCount: day.messageCount, sessionCount: day.sessionCount, toolCallCount: day.toolCallCount });
        }
        for (const day of content.dailyActivity) {
          const existing = activityMap.get(day.date);
          if (existing) {
            existing.messageCount += day.messageCount;
            existing.sessionCount += day.sessionCount;
            existing.toolCallCount += day.toolCallCount;
          } else {
            activityMap.set(day.date, { messageCount: day.messageCount, sessionCount: day.sessionCount, toolCallCount: day.toolCallCount });
          }
        }
        mergedStats.dailyActivity = Array.from(activityMap.entries()).map(([date, data]) => ({ date, ...data }));

        // Merge model usage
        for (const [modelId, usage] of Object.entries(content.modelUsage)) {
          if (mergedStats.modelUsage[modelId]) {
            mergedStats.modelUsage[modelId].inputTokens += usage.inputTokens || 0;
            mergedStats.modelUsage[modelId].outputTokens += usage.outputTokens || 0;
            mergedStats.modelUsage[modelId].cacheReadInputTokens += usage.cacheReadInputTokens || 0;
            mergedStats.modelUsage[modelId].cacheCreationInputTokens += usage.cacheCreationInputTokens || 0;
            mergedStats.modelUsage[modelId].costUSD += usage.costUSD || 0;
          } else {
            mergedStats.modelUsage[modelId] = { ...usage };
          }
        }

        // Merge totals
        mergedStats.totalSessions += content.totalSessions;
        mergedStats.totalMessages += content.totalMessages;

        // Use earliest first session date
        if (content.firstSessionDate < mergedStats.firstSessionDate) {
          mergedStats.firstSessionDate = content.firstSessionDate;
        }
      }
    } catch {
      // Skip if file doesn't exist or is invalid
    }
  }

  return mergedStats;
}

// Read history.jsonl for prompt/project data from all Claude directories
export async function collectHistory(year?: number): Promise<HistoryEntry[]> {
  const paths = await getValidClaudePaths();
  const allEntries: HistoryEntry[] = [];

  for (const basePath of paths) {
    const historyPath = join(basePath, "history.jsonl");
    try {
      const content = await readFile(historyPath, "utf-8");
      const lines = content.trim().split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const entry = JSON.parse(line) as HistoryEntry;

          // Filter by year if specified
          if (year) {
            const entryDate = new Date(entry.timestamp);
            if (entryDate.getFullYear() !== year) continue;
          }

          allEntries.push(entry);
        } catch {
          // Skip invalid JSON lines
        }
      }
    } catch {
      // Skip if file doesn't exist
    }
  }

  return allEntries;
}

// Collect all session messages from project directories (all Claude paths)
export async function collectSessionMessages(year?: number): Promise<SessionMessage[]> {
  const paths = await getValidClaudePaths();
  const allMessages: SessionMessage[] = [];

  for (const basePath of paths) {
    const projectsPath = join(basePath, "projects");

    try {
      const projectDirs = await readdir(projectsPath);

      for (const projectDir of projectDirs) {
        const projectPath = join(projectsPath, projectDir);

        try {
          const files = await readdir(projectPath);
          const jsonlFiles = files.filter((f) => f.endsWith(".jsonl") && !f.startsWith("agent-"));

          for (const jsonlFile of jsonlFiles) {
            const filePath = join(projectPath, jsonlFile);

            try {
              const content = await readFile(filePath, "utf-8");
              const lines = content.trim().split("\n");

              for (const line of lines) {
                if (!line.trim()) continue;

                try {
                  const message = JSON.parse(line);

                  // Only process assistant messages with usage data
                  if (message.type === "assistant" && message.message?.usage) {
                    const timestamp = new Date(message.timestamp);

                    // Filter by year if specified
                    if (year && timestamp.getFullYear() !== year) continue;

                    allMessages.push({
                      type: message.type,
                      sessionId: message.sessionId,
                      timestamp: message.timestamp,
                      model: message.message?.model,
                      usage: message.message?.usage,
                    });
                  }
                } catch {
                  // Skip invalid JSON lines
                }
              }
            } catch {
              // Skip unreadable files
            }
          }
        } catch {
          // Skip unreadable directories
        }
      }
    } catch {
      // Skip if projects directory doesn't exist
    }
  }

  return allMessages;
}

// Get unique projects from history
export async function collectProjects(year?: number): Promise<string[]> {
  const history = await collectHistory(year);
  const projects = new Set<string>();

  for (const entry of history) {
    if (entry.project) {
      // Extract project name from path
      const projectName = entry.project.split("/").pop() || entry.project;
      projects.add(projectName);
    }
  }

  return Array.from(projects);
}

// Build daily activity from session files (for data not in stats-cache)
export async function collectDailyActivityFromSessions(year?: number): Promise<Map<string, { messageCount: number; sessionCount: number }>> {
  const paths = await getValidClaudePaths();
  const dailyActivity = new Map<string, { messageCount: number; sessionCount: number }>();
  const sessionsPerDay = new Map<string, Set<string>>();

  for (const basePath of paths) {
    const projectsPath = join(basePath, "projects");

    try {
      const projectDirs = await readdir(projectsPath);

      for (const projectDir of projectDirs) {
        const projectPath = join(projectsPath, projectDir);

        try {
          const files = await readdir(projectPath);
          const jsonlFiles = files.filter((f) => f.endsWith(".jsonl") && !f.startsWith("agent-"));

          for (const jsonlFile of jsonlFiles) {
            const filePath = join(projectPath, jsonlFile);
            const sessionId = jsonlFile.replace(".jsonl", "");

            try {
              const content = await readFile(filePath, "utf-8");
              const lines = content.trim().split("\n");

              for (const line of lines) {
                if (!line.trim()) continue;

                try {
                  const data = JSON.parse(line);
                  if (!data.timestamp) continue;

                  const timestamp = new Date(data.timestamp);
                  if (year && timestamp.getFullYear() !== year) continue;

                  const dateKey = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(timestamp.getDate()).padStart(2, "0")}`;

                  // Count messages (both user and assistant)
                  if (data.type === "user" || data.type === "assistant") {
                    const existing = dailyActivity.get(dateKey) || { messageCount: 0, sessionCount: 0 };
                    existing.messageCount++;
                    dailyActivity.set(dateKey, existing);

                    // Track unique sessions per day
                    if (!sessionsPerDay.has(dateKey)) {
                      sessionsPerDay.set(dateKey, new Set());
                    }
                    sessionsPerDay.get(dateKey)!.add(sessionId);
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            } catch {
              // Skip unreadable files
            }
          }
        } catch {
          // Skip unreadable directories
        }
      }
    } catch {
      // Skip if projects directory doesn't exist
    }
  }

  // Update session counts
  for (const [dateKey, sessions] of sessionsPerDay.entries()) {
    const existing = dailyActivity.get(dateKey);
    if (existing) {
      existing.sessionCount = sessions.size;
    }
  }

  return dailyActivity;
}

// Find the oldest session timestamp by scanning session files (all Claude paths)
export async function findOldestLocalSessionTimestamp(): Promise<string | null> {
  const paths = await getValidClaudePaths();
  let oldestTimestamp: string | null = null;

  for (const basePath of paths) {
    const projectsPath = join(basePath, "projects");

    try {
      const projectDirs = await readdir(projectsPath);

      for (const projectDir of projectDirs) {
        const projectPath = join(projectsPath, projectDir);

        try {
          const files = await readdir(projectPath);
          const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

          for (const jsonlFile of jsonlFiles) {
            const filePath = join(projectPath, jsonlFile);

            try {
              const content = await readFile(filePath, "utf-8");
              const lines = content.split("\n").slice(0, 10); // Check first 10 lines

              for (const line of lines) {
                if (!line.trim()) continue;

                try {
                  const data = JSON.parse(line);
                  if (data.timestamp && typeof data.timestamp === "string") {
                    if (!oldestTimestamp || data.timestamp < oldestTimestamp) {
                      oldestTimestamp = data.timestamp;
                    }
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            } catch {
              // Skip unreadable files
            }
          }
        } catch {
          // Skip unreadable directories
        }
      }
    } catch {
      // Skip if projects directory doesn't exist
    }
  }

  return oldestTimestamp;
}
