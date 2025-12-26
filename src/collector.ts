// Data collector - reads Claude Code storage and returns raw data

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ClaudeCodeStats, SessionMessage, HistoryEntry } from "./types";

const CLAUDE_DATA_PATH = join(homedir(), ".claude");

export async function checkClaudeCodeDataExists(): Promise<boolean> {
  try {
    await readdir(CLAUDE_DATA_PATH);
    return true;
  } catch {
    return false;
  }
}

export async function getClaudeDataPath(): Promise<string> {
  return CLAUDE_DATA_PATH;
}

// Read the stats-cache.json file which contains pre-computed stats
export async function collectStatsCache(): Promise<ClaudeCodeStats | null> {
  const statsPath = join(CLAUDE_DATA_PATH, "stats-cache.json");

  try {
    const content = await Bun.file(statsPath).json();
    return content as ClaudeCodeStats;
  } catch {
    return null;
  }
}

// Read history.jsonl for prompt/project data
export async function collectHistory(year?: number): Promise<HistoryEntry[]> {
  const historyPath = join(CLAUDE_DATA_PATH, "history.jsonl");

  try {
    const content = await readFile(historyPath, "utf-8");
    const lines = content.trim().split("\n");

    const entries: HistoryEntry[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line) as HistoryEntry;

        // Filter by year if specified
        if (year) {
          const entryDate = new Date(entry.timestamp);
          if (entryDate.getFullYear() !== year) continue;
        }

        entries.push(entry);
      } catch {
        // Skip invalid JSON lines
      }
    }

    return entries;
  } catch {
    return [];
  }
}

// Collect all session messages from project directories
export async function collectSessionMessages(year?: number): Promise<SessionMessage[]> {
  const projectsPath = join(CLAUDE_DATA_PATH, "projects");

  try {
    const projectDirs = await readdir(projectsPath);
    const allMessages: SessionMessage[] = [];

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

    return allMessages;
  } catch {
    return [];
  }
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

// Find the oldest session timestamp by scanning session files
export async function findOldestLocalSessionTimestamp(): Promise<string | null> {
  const projectsPath = join(CLAUDE_DATA_PATH, "projects");

  try {
    const projectDirs = await readdir(projectsPath);
    let oldestTimestamp: string | null = null;

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

    return oldestTimestamp;
  } catch {
    return null;
  }
}
