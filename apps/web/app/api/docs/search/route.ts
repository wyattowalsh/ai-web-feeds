import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";
import { withRouteTelemetry } from "@/lib/telemetry-route";

const search = createFromSource(source);

export const dynamic = "force-dynamic";

export const GET = withRouteTelemetry("docs.search", search.GET);
