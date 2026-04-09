import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { applyUserIdentityBinding, resolveUserIdentity } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const resolvedIdentity = resolveUserIdentity(request);
  const response = NextResponse.json({
    user_id: resolvedIdentity.identity.user_id,
    source: resolvedIdentity.identity.source,
  });

  applyUserIdentityBinding(response, resolvedIdentity);
  return response;
};

export const GET = withRouteTelemetry("identity.bootstrap", GETHandler);
