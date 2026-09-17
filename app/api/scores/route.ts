import { NextResponse } from "next/server";
import { getLatestScores, createScore } from "@/lib/golf/scores-server";
import { createScoreSchema } from "@/lib/golf/scores";
import { AuthenticationRequiredError, AuthorizationError } from "@/lib/auth/authorization";

export async function GET() {
  try {
    const scores = await getLatestScores();
    return NextResponse.json(scores);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Authorization required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch scores" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createScoreSchema.parse(body);
    const score = await createScore(validated);
    return NextResponse.json(score, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Authorization required" }, { status: 403 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create score" }, { status: 500 });
  }
}
