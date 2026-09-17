import { NextResponse } from "next/server";
import { updateScore, deleteScore, getScoreById } from "@/lib/golf/scores-server";
import { updateScoreSchema } from "@/lib/golf/scores";
import { AuthenticationRequiredError, AuthorizationError } from "@/lib/auth/authorization";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const score = await getScoreById(id);
    return NextResponse.json(score);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Authorization required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Score not found" }, { status: 404 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateScoreSchema.parse({ ...body, id });
    const score = await updateScore(validated);
    return NextResponse.json(score);
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
    return NextResponse.json({ error: "Failed to update score" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteScore(id);
    return NextResponse.json({ success: true });
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
    return NextResponse.json({ error: "Failed to delete score" }, { status: 500 });
  }
}
