import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekStart, clearProposed } = body;

    if (!weekStart) {
      return NextResponse.json(
        { error: "weekStart is required" },
        { status: 400 }
      );
    }

    // Build command
    const scriptPath = path.join(process.cwd(), "scripts", "assign_secretaries.py");
    const args = [`--week`, weekStart];
    if (clearProposed) args.push("--clear-proposed");

    const command = `python "${scriptPath}" ${args.join(" ")}`;

    // Execute the Python solver
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 120_000, // 2 minute timeout
      env: { ...process.env },
    });

    // Parse the output for status information
    const lines = stdout.split("\n");
    const statusLine = lines.find((l: string) => l.includes("OPTIMAL") || l.includes("FEASIBLE") || l.includes("INFEASIBLE"));

    return NextResponse.json({
      success: true,
      message: statusLine ?? "Solver terminé",
      stdout: stdout.slice(-1000), // Last 1000 chars
      stderr: stderr ? stderr.slice(-500) : null,
    });
  } catch (error) {
    console.error("Solver error:", error);

    const errMsg =
      error instanceof Error ? error.message : "Unknown solver error";

    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
