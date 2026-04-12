export type DesignAssetSurface =
  | "feeds-workflow"
  | "home-hero"
  | "home-primary"
  | "home-support"
  | "social-sitewide"
  | "social-docs";

export type DesignAssetUsage = "decorative" | "informative";

export type DesignAssetProvenance = {
  model: string;
  seed: number | null;
  promptSummary: string;
  postProcessed: boolean;
};

export type DesignAsset = {
  publicPath: `/visuals/${string}.png`;
  surface: DesignAssetSurface;
  usage: DesignAssetUsage;
  width: number;
  height: number;
  aspectRatio: `${number}/${number}`;
  provenance: DesignAssetProvenance;
};

function createDesignAsset(asset: DesignAsset): DesignAsset {
  return asset;
}

export const DESIGN_ASSETS = {
  feeds: {
    startHereOnboarding: createDesignAsset({
      publicPath: "/visuals/feeds/start-here-onboarding.png",
      surface: "feeds-workflow",
      usage: "decorative",
      width: 1024,
      height: 1024,
      aspectRatio: "1/1",
      provenance: {
        model: "z_image_turbo_1.0_q8p.ckpt",
        seed: null,
        promptSummary: "Narrative source discovery transitioning into recent article scanning.",
        postProcessed: false,
      },
    }),
    modesComparison: createDesignAsset({
      publicPath: "/visuals/feeds/modes-comparison.png",
      surface: "feeds-workflow",
      usage: "decorative",
      width: 1152,
      height: 768,
      aspectRatio: "3/2",
      provenance: {
        model: "flux_1_schnell_q8p.ckpt",
        seed: 52032,
        promptSummary: "Split catalog-versus-network composition for the unified feeds workspace.",
        postProcessed: false,
      },
    }),
    noResults: createDesignAsset({
      publicPath: "/visuals/feeds/no-results.png",
      surface: "feeds-workflow",
      usage: "decorative",
      width: 1280,
      height: 768,
      aspectRatio: "5/3",
      provenance: {
        model: "z_image_turbo_1.0_q8p.ckpt",
        seed: 73017,
        promptSummary: "Empty-state illustration encouraging a broader feed slice and query reset.",
        postProcessed: false,
      },
    }),
  },
  home: {
    heroWorkflow: createDesignAsset({
      publicPath: "/visuals/home/hero-workflow.png",
      surface: "home-hero",
      usage: "decorative",
      width: 1536,
      height: 960,
      aspectRatio: "8/5",
      provenance: {
        model: "flux_1_schnell_q8p.ckpt",
        seed: 52045,
        promptSummary: "Three-stage workflow plate for discover, scan, and read.",
        postProcessed: false,
      },
    }),
    primarySurfaces: createDesignAsset({
      publicPath: "/visuals/home/primary-surfaces.png",
      surface: "home-primary",
      usage: "decorative",
      width: 1536,
      height: 960,
      aspectRatio: "8/5",
      provenance: {
        model: "flux_1_schnell_q8p.ckpt",
        seed: 52041,
        promptSummary: "Coordinated product surface plate for the homepage workflow section.",
        postProcessed: false,
      },
    }),
    supportSurfaces: createDesignAsset({
      publicPath: "/visuals/home/support-surfaces.png",
      surface: "home-support",
      usage: "decorative",
      width: 1536,
      height: 960,
      aspectRatio: "8/5",
      provenance: {
        model: "flux_1_schnell_q8p.ckpt",
        seed: 52042,
        promptSummary: "Support-tools plate representing downloads, docs, and machine-facing outputs.",
        postProcessed: false,
      },
    }),
  },
  social: {
    sitewidePlate: createDesignAsset({
      publicPath: "/visuals/social/sitewide-plate.png",
      surface: "social-sitewide",
      usage: "decorative",
      width: 1216,
      height: 640,
      aspectRatio: "19/10",
      provenance: {
        model: "flux_1_schnell_q8p.ckpt",
        seed: 52043,
        promptSummary: "Wide sitewide social background plate with central negative space.",
        postProcessed: false,
      },
    }),
    docsPlate: createDesignAsset({
      publicPath: "/visuals/social/docs-plate.png",
      surface: "social-docs",
      usage: "decorative",
      width: 1216,
      height: 640,
      aspectRatio: "19/10",
      provenance: {
        model: "flux_1_schnell_q8p.ckpt",
        seed: 52044,
        promptSummary: "Documentation-focused social background plate with left-side negative space.",
        postProcessed: false,
      },
    }),
  },
} as const;

export function getDesignAssetUrl(asset: DesignAsset, baseUrl: string): string {
  return new URL(asset.publicPath, baseUrl).toString();
}
