/**
 * Email digests API
 *
 * GET /api/digests - Get user's digest subscription
 * POST /api/digests - Create/update digest subscription
 * DELETE /api/digests - Unsubscribe from digests
 */

import { NextRequest, NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import {
  applyUserIdentityBinding,
  isValidUserId,
  resolveUserIdentity,
  validateTrustedUserOwnership,
} from "@/lib/user-auth";
import { fetchBackend, formatBackendErrorResponse, getBackendErrorStatus } from "@/lib/backend";

export const dynamic = "force-dynamic";

const DEFAULT_SCHEDULE_CRONS: Record<string, string> = {
  daily: "0 9 * * *",
  weekly: "0 9 * * 1",
};

function validateTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function validateCronField(field: string, min: number, max: number): boolean {
  const values = field.split(",");
  return values.every((value) => {
    if (value === "*") {
      return true;
    }

    const match = value.match(/^(\*|\d+)(?:-(\d+))?(?:\/(\d+))?$/);
    if (!match) {
      return false;
    }

    const [, rawStart, rawEnd, rawStep] = match;
    const start = rawStart === "*" ? min : Number(rawStart);
    const end = rawEnd ? Number(rawEnd) : start;
    const step = rawStep ? Number(rawStep) : null;

    if (rawStart === "*" && rawEnd) {
      return false;
    }

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < min ||
      end > max ||
      start > end
    ) {
      return false;
    }

    if (step !== null && (!Number.isInteger(step) || step <= 0)) {
      return false;
    }

    return true;
  });
}

function validateCronExpression(cron: string): boolean {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    return false;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  return (
    validateCronField(minute, 0, 59) &&
    validateCronField(hour, 0, 23) &&
    validateCronField(dayOfMonth, 1, 31) &&
    validateCronField(month, 1, 12) &&
    validateCronField(dayOfWeek, 0, 7)
  );
}

function resolveScheduleCron(scheduleType: string, scheduleCron?: string): string | null {
  if (scheduleType === "custom") {
    return scheduleCron ?? null;
  }

  return scheduleCron || DEFAULT_SCHEDULE_CRONS[scheduleType] || null;
}

const GETHandler = async (request: NextRequest) => {
  const requestedUserId = request.nextUrl.searchParams.get("user_id");
  if (requestedUserId && !isValidUserId(requestedUserId)) {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  const resolvedIdentity = resolveUserIdentity(request, requestedUserId);
  const { identity } = resolvedIdentity;

  if (requestedUserId && !validateTrustedUserOwnership(requestedUserId, identity)) {
    return NextResponse.json({ error: "user_id does not match request identity" }, { status: 403 });
  }

  try {
    const data = await fetchBackend("/storage/digests", {
      method: "GET",
      params: {
        user_id: identity.user_id,
      },
    });

    const response = NextResponse.json({
      user_id: identity.user_id,
      digests: data,
    });
    applyUserIdentityBinding(response, resolvedIdentity);
    return response;
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

const POSTHandler = async (request: NextRequest) => {
  try {
    const body = (await request.json()) as {
      user_id?: string;
      email?: string;
      schedule_type?: string;
      schedule_cron?: string;
      timezone?: string;
    };
    if (body.user_id && !isValidUserId(body.user_id)) {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    const resolvedIdentity = resolveUserIdentity(request, body.user_id ?? null);
    const { identity } = resolvedIdentity;
    const { email, schedule_type, schedule_cron, timezone } = body;

    if (body.user_id && identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    if (body.user_id && !validateUserOwnership(body.user_id, identity)) {
      return NextResponse.json(
        { error: "user_id does not match request identity" },
        { status: 403 },
      );
    }

    if (identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    const validScheduleTypes = ["daily", "weekly", "custom"];

    if (!email || !schedule_type) {
      return NextResponse.json(
        { error: "Missing required fields: email, schedule_type" },
        { status: 400 },
      );
    }

    if (!validScheduleTypes.includes(schedule_type)) {
      return NextResponse.json(
        { error: `Invalid schedule_type. Must be one of: ${validScheduleTypes.join(", ")}` },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const resolvedScheduleCron = resolveScheduleCron(schedule_type, schedule_cron);
    if (!resolvedScheduleCron) {
      return NextResponse.json(
        { error: "schedule_cron is required for custom schedules" },
        { status: 400 },
      );
    }

    if (!validateCronExpression(resolvedScheduleCron)) {
      return NextResponse.json({ error: "Invalid schedule_cron" }, { status: 400 });
    }

    const normalizedTimezone = timezone || "UTC";
    if (!validateTimezone(normalizedTimezone)) {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }

    const data = await fetchBackend("/storage/digests", {
      method: "POST",
      body: {
        user_id: identity.user_id,
        email,
        schedule_type,
        schedule_cron: resolvedScheduleCron,
        timezone: normalizedTimezone,
      },
    });

    const response = NextResponse.json({
      success: true,
      digest: data,
    });
    applyUserIdentityBinding(response, resolvedIdentity);
    return response;
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

const DELETEHandler = async (request: NextRequest) => {
  const requestedUserId = request.nextUrl.searchParams.get("user_id");
  if (requestedUserId && !isValidUserId(requestedUserId)) {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  const resolvedIdentity = resolveUserIdentity(request, requestedUserId);
  const { identity } = resolvedIdentity;

  if (requestedUserId && !validateTrustedUserOwnership(requestedUserId, identity)) {
    return NextResponse.json({ error: "user_id does not match request identity" }, { status: 403 });
  }

  try {
    await fetchBackend("/storage/digests", {
      method: "DELETE",
      params: {
        user_id: identity.user_id,
      },
    });

    const response = NextResponse.json({
      success: true,
      user_id: identity.user_id,
    });
    applyUserIdentityBinding(response, resolvedIdentity);
    return response;
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

export const GET = withRouteTelemetry("digests.list", GETHandler, {
  backendTarget: "python-backend",
});
export const POST = withRouteTelemetry("digests.create", POSTHandler, {
  backendTarget: "python-backend",
});
export const DELETE = withRouteTelemetry("digests.delete", DELETEHandler, {
  backendTarget: "python-backend",
});
