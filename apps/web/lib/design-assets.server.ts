import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { DesignAsset } from "@/lib/design-assets";

export async function getEmbeddedDesignAssetDataUrl(asset: DesignAsset): Promise<string> {
  const assetPath = join(process.cwd(), "public", asset.publicPath.slice(1));
  const buffer = await readFile(assetPath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
