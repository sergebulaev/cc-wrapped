#!/usr/bin/env bun

import * as p from "@clack/prompts";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { checkClaudeCodeDataExists, getClaudeDataPath } from "./collector";
import { calculateStats } from "./stats";
import { generateImage } from "./image/generator";
import { displayInTerminal, getTerminalName } from "./terminal/display";
import { copyImageToClipboard } from "./clipboard";
import { isWrappedAvailable } from "./utils/dates";
import { formatNumber } from "./utils/format";
import type { WrappedStats } from "./types";

const VERSION = "1.0.0";

function printHelp() {
  console.log(`
cc-wrapped v${VERSION}

Generate your Claude Code year in review stats card.

USAGE:
  cc-wrapped [OPTIONS]

OPTIONS:
  --year <YYYY>    Generate wrapped for a specific year (default: current year)
  --help, -h       Show this help message
  --version, -v    Show version number

EXAMPLES:
  cc-wrapped              # Generate current year wrapped
  cc-wrapped --year 2025  # Generate 2025 wrapped
`);
}

async function main() {
  // Parse command line arguments
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      year: { type: "string", short: "y" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (values.version) {
    console.log(`cc-wrapped v${VERSION}`);
    process.exit(0);
  }

  p.intro("claude code wrapped");

  const requestedYear = values.year ? parseInt(values.year, 10) : new Date().getFullYear();

  const availability = isWrappedAvailable(requestedYear);
  if (!availability.available) {
    if (Array.isArray(availability.message)) {
      availability.message.forEach((line) => p.log.warn(line));
    } else {
      p.log.warn(availability.message || "Wrapped not available yet.");
    }
    p.cancel();
    process.exit(0);
  }

  const dataExists = await checkClaudeCodeDataExists();
  if (!dataExists) {
    const dataPath = await getClaudeDataPath();
    p.cancel(`Claude Code data not found in ${dataPath}\n\nMake sure you have used Claude Code at least once.`);
    process.exit(0);
  }

  const spinner = p.spinner();
  spinner.start("Scanning your Claude Code history...");

  let stats;
  try {
    stats = await calculateStats(requestedYear);
  } catch (error) {
    spinner.stop("Failed to collect stats");
    p.cancel(`Error: ${error}`);
    process.exit(1);
  }

  if (stats.totalSessions === 0 && stats.totalPrompts === 0) {
    spinner.stop("No data found");
    p.cancel(`No Claude Code activity found for ${requestedYear}`);
    process.exit(0);
  }

  spinner.stop("Found your stats!");

  // Display summary
  const summaryLines = [
    `Sessions:      ${formatNumber(stats.totalSessions)}`,
    `Messages:      ${formatNumber(stats.totalMessages)}`,
    `Prompts:       ${formatNumber(stats.totalPrompts)}`,
    `Total Tokens:  ${formatNumber(stats.totalTokens)}`,
    `Projects:      ${formatNumber(stats.totalProjects)}`,
    `Streak:        ${stats.maxStreak} days`,
    stats.mostActiveDay && `Most Active:   ${stats.mostActiveDay.formattedDate}`,
  ];

  p.note(summaryLines.filter(Boolean).join("\n"), `Your ${requestedYear} in Claude Code`);

  // Generate image
  spinner.start("Generating your wrapped image...");

  let image: { fullSize: Buffer; displaySize: Buffer };
  try {
    image = await generateImage(stats);
  } catch (error) {
    spinner.stop("Failed to generate image");
    p.cancel(`Error generating image: ${error}`);
    process.exit(1);
  }

  spinner.stop("Image generated!");

  const displayed = await displayInTerminal(image.displaySize);
  if (!displayed) {
    p.log.info(`Terminal (${getTerminalName()}) doesn't support inline images`);
  }

  const filename = `cc-wrapped-${requestedYear}.png`;
  const { success, error } = await copyImageToClipboard(image.fullSize, filename);

  if (success) {
    p.log.success("Automatically copied image to clipboard!");
  } else {
    p.log.warn(`Clipboard unavailable: ${error}`);
    p.log.info("You can save the image to disk instead.");
  }

  const defaultPath = join(process.env.HOME || "~", filename);

  const shouldSave = await p.confirm({
    message: `Save image to ~/${filename}?`,
    initialValue: true,
  });

  if (p.isCancel(shouldSave)) {
    p.outro("Cancelled");
    process.exit(0);
  }

  if (shouldSave) {
    try {
      await Bun.write(defaultPath, image.fullSize);
      p.log.success(`Saved to ${defaultPath}`);
    } catch (error) {
      p.log.error(`Failed to save: ${error}`);
    }
  }

  // Upload option
  const shouldUpload = await p.confirm({
    message: "Upload image to get a shareable link?",
    initialValue: true,
  });

  let uploadedUrl: string | null = null;

  if (!p.isCancel(shouldUpload) && shouldUpload) {
    const uploadSpinner = p.spinner();
    uploadSpinner.start("Uploading image...");

    try {
      uploadedUrl = await uploadImage(image.fullSize);
      uploadSpinner.stop("Image uploaded!");
      p.log.success(`Link: ${uploadedUrl}`);
    } catch (error) {
      uploadSpinner.stop("Upload failed");
      p.log.warn(`Could not upload: ${error}`);
    }
  }

  const shouldShare = await p.confirm({
    message: "Share on X (Twitter)?",
    initialValue: true,
  });

  if (!p.isCancel(shouldShare) && shouldShare) {
    const tweetUrl = generateTweetUrl(stats, uploadedUrl);
    const opened = await openUrl(tweetUrl);
    if (opened) {
      p.log.success("Opened X in your browser.");
    } else {
      p.log.warn("Couldn't open browser. Copy this URL:");
      p.log.info(tweetUrl);
    }
  }

  p.outro("Share your wrapped!");
  process.exit(0);
}

function generateTweetUrl(stats: WrappedStats, imageUrl?: string | null): string {
  const lines = [
    `my ${stats.year} claude code wrapped:`,
    ``,
    `${formatNumber(stats.totalSessions)} sessions`,
    `${formatNumber(stats.totalMessages)} messages`,
    `${formatNumber(stats.totalTokens)} tokens`,
    `${stats.maxStreak} day streak`,
    ``,
    `get yours: npx cc-wrapped`,
  ];

  if (imageUrl) {
    lines.push(``, imageUrl);
  }

  const url = new URL("https://x.com/intent/tweet");
  url.searchParams.set("text", lines.join("\n"));
  return url.toString();
}

async function uploadImage(imageBuffer: Buffer): Promise<string> {
  // Using catbox.moe - free, no compression, no account needed
  const formData = new FormData();
  formData.append("reqtype", "fileupload");
  formData.append("fileToUpload", new Blob([imageBuffer], { type: "image/png" }), "cc-wrapped.png");

  const response = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  const url = await response.text();

  if (!url.startsWith("https://")) {
    throw new Error(`Invalid response: ${url}`);
  }

  return url.trim();
}

async function openUrl(url: string): Promise<boolean> {
  const platform = process.platform;
  let command: string;

  if (platform === "darwin") {
    command = "open";
  } else if (platform === "win32") {
    command = "start";
  } else {
    command = "xdg-open";
  }

  try {
    const proc = Bun.spawn([command, url], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
