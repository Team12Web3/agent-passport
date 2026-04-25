import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const json = NextResponse.json;

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function validationError(z: ZodError) {
  return NextResponse.json(
    { error: "validation", details: z.flatten() },
    { status: 400 },
  );
}

export function provisioningFailed(step: "wallet" | "funding" | "mint") {
  return NextResponse.json(
    { error: "provisioning_failed", step },
    { status: 502 },
  );
}

/** bigint → string for safe JSON serialization. */
export function bigify<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  ) as T;
}
