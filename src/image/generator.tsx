import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import { WrappedTemplate } from "./template";
import { DarkTemplate } from "./template-dark";
import type { WrappedStats } from "../types";
import { loadFonts } from "./fonts";
import { layout } from "./design-tokens";

export type TemplateStyle = "default" | "dark";

export interface GeneratedImage {
  /** Full resolution PNG buffer for saving/clipboard */
  fullSize: Buffer;
  /** Scaled PNG buffer for terminal display (80% of full size) */
  displaySize: Buffer;
}

export async function generateImage(stats: WrappedStats, style: TemplateStyle = "default"): Promise<GeneratedImage> {
  await initWasm(Bun.file(resvgWasm).arrayBuffer());

  const Template = style === "dark" ? DarkTemplate : WrappedTemplate;
  const width = style === "dark" ? 1000 : layout.canvas.width;
  const height = style === "dark" ? 520 : layout.canvas.height;

  const svg = await satori(<Template stats={stats} />, {
    width,
    height,
    fonts: await loadFonts(),
  });

  const [fullSize, displaySize] = [1, 0.75].map((v) => {
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "zoom",
        value: v,
      },
    });
    return Buffer.from(resvg.render().asPng());
  });

  return { fullSize, displaySize };
}
