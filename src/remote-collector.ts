// Remote data collector - fetches Claude Code data from remote hosts via SSH

import { spawn } from "node:child_process";
import type { ClaudeCodeStats, HistoryEntry } from "./types";

export interface RemoteData {
  host: string;
  statsCache: ClaudeCodeStats | null;
  history: HistoryEntry[];
  projects: string[];
}

async function execSSH(host: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ssh", ["-o", "ConnectTimeout=10", "-o", "BatchMode=yes", host, command], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`SSH failed: ${stderr || `exit code ${code}`}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

export async function collectRemoteStatsCache(host: string): Promise<ClaudeCodeStats | null> {
  try {
    const output = await execSSH(host, "cat ~/.claude/stats-cache.json 2>/dev/null");
    return JSON.parse(output) as ClaudeCodeStats;
  } catch {
    return null;
  }
}

export async function collectRemoteHistory(host: string, year?: number): Promise<HistoryEntry[]> {
  try {
    const output = await execSSH(host, "cat ~/.claude/history.jsonl 2>/dev/null");
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

export async function collectRemoteProjects(host: string, year?: number): Promise<string[]> {
  const history = await collectRemoteHistory(host, year);
  const projects = new Set<string>();

  for (const entry of history) {
    if (entry.project) {
      const projectName = entry.project.split("/").pop() || entry.project;
      projects.add(projectName);
    }
  }

  return Array.from(projects);
}

export async function collectFromRemoteHost(host: string, year?: number): Promise<RemoteData> {
  const [statsCache, history, projects] = await Promise.all([
    collectRemoteStatsCache(host),
    collectRemoteHistory(host, year),
    collectRemoteProjects(host, year),
  ]);

  return {
    host,
    statsCache,
    history,
    projects,
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
