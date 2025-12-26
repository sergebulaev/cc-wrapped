// Remote data collector - fetches Claude Code data from remote hosts via SSH

import type { ClaudeCodeStats, HistoryEntry } from "./types";

export interface RemoteData {
  host: string;
  statsCache: ClaudeCodeStats | null;
  history: HistoryEntry[];
  projects: string[];
  oldestSessionTimestamp: string | null;
  sessionDailyActivity: Map<string, { messageCount: number; sessionCount: number }>;
}

async function execSSH(host: string, command: string): Promise<string> {
  const proc = Bun.spawn(["ssh", "-o", "ConnectTimeout=10", "-o", "BatchMode=yes", host, command], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`SSH failed: ${stderr || `exit code ${exitCode}`}`);
  }

  return stdout;
}

async function collectRemoteStatsCache(host: string): Promise<ClaudeCodeStats | null> {
  try {
    const output = await execSSH(host, "cat ~/.claude/stats-cache.json 2>/dev/null || echo '{}'");
    const parsed = JSON.parse(output);
    // Check if it's empty object (file didn't exist)
    if (!parsed.version) return null;
    return parsed as ClaudeCodeStats;
  } catch {
    return null;
  }
}

async function collectRemoteHistory(host: string, year?: number): Promise<HistoryEntry[]> {
  try {
    const output = await execSSH(host, "cat ~/.claude/history.jsonl 2>/dev/null || echo ''");
    if (!output.trim()) return [];

    const lines = output.trim().split("\n");
    const entries: HistoryEntry[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as HistoryEntry;
        if (year) {
          const entryDate = new Date(entry.timestamp);
          if (entryDate.getFullYear() !== year) continue;
        }
        entries.push(entry);
      } catch {
        // Skip invalid lines
      }
    }

    return entries;
  } catch {
    return [];
  }
}

async function findOldestSessionTimestamp(host: string): Promise<string | null> {
  try {
    // Search session files for the oldest timestamp
    const output = await execSSH(
      host,
      "grep -r '\"timestamp\"' ~/.claude/projects/ 2>/dev/null | grep -oE '\"timestamp\":\"[^\"]+\"' | sed 's/\"timestamp\":\"//' | sed 's/\"//' | sort | head -1"
    );
    const timestamp = output.trim();
    if (timestamp && timestamp.match(/^\d{4}-\d{2}-\d{2}/)) {
      return timestamp;
    }
    return null;
  } catch {
    return null;
  }
}

async function collectDailyActivityFromSessions(host: string, year?: number): Promise<Map<string, { messageCount: number; sessionCount: number }>> {
  const dailyActivity = new Map<string, { messageCount: number; sessionCount: number }>();

  try {
    // Extract all timestamps from user/assistant messages in session files
    // Use -E for extended regex (ERE) which doesn't need escaping for |
    const yearFilter = year ? `grep '${year}-' |` : "";
    const output = await execSSH(
      host,
      `grep -rEh '"type":"(user|assistant)"' ~/.claude/projects/ 2>/dev/null | grep -oE '"timestamp":"[^"]+"' | sed 's/"timestamp":"//' | sed 's/"//' | cut -c1-10 | ${yearFilter} sort | uniq -c`
    );

    if (!output.trim()) return dailyActivity;

    // Parse output: each line is "  count date"
    const lines = output.trim().split("\n");
    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\s+(\d{4}-\d{2}-\d{2})$/);
      if (match) {
        const count = parseInt(match[1], 10);
        const date = match[2];
        dailyActivity.set(date, { messageCount: count, sessionCount: 1 });
      }
    }

    return dailyActivity;
  } catch {
    return dailyActivity;
  }
}

function extractProjects(history: HistoryEntry[]): string[] {
  const projects = new Set<string>();

  for (const entry of history) {
    if (entry.project) {
      const projectName = entry.project.split("/").pop() || entry.project;
      projects.add(projectName);
    }
  }

  return Array.from(projects);
}

async function collectFromRemoteHost(host: string, year?: number): Promise<RemoteData> {
  // Run sequentially to avoid overwhelming SSH
  const statsCache = await collectRemoteStatsCache(host);
  const history = await collectRemoteHistory(host, year);
  const projects = extractProjects(history); // Derive from history, no extra SSH call
  const oldestSessionTimestamp = await findOldestSessionTimestamp(host);
  const sessionDailyActivity = await collectDailyActivityFromSessions(host, year);

  return {
    host,
    statsCache,
    history,
    projects,
    oldestSessionTimestamp,
    sessionDailyActivity,
  };
}

export async function collectFromAllRemoteHosts(
  hosts: string[],
  year?: number,
  onProgress?: (host: string, status: "start" | "done" | "error") => void
): Promise<RemoteData[]> {
  const results: RemoteData[] = [];

  for (const host of hosts) {
    onProgress?.(host, "start");
    try {
      const data = await collectFromRemoteHost(host, year);
      results.push(data);
      onProgress?.(host, "done");
    } catch (error) {
      onProgress?.(host, "error");
      // Continue with other hosts
    }
  }

  return results;
}
