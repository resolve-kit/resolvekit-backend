import { NextResponse } from "next/server";

export function detail(status: number, message: string): NextResponse {
  return NextResponse.json({ detail: message }, { status });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}
