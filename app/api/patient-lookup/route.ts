import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LookupBody = {
  patientId?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LookupBody;

    const patientId = String(body.patientId || "")
      .replace(/\s+/g, "")
      .trim();

    if (!patientId) {
      return NextResponse.json(
        {
          found: false,
          error: "Patient ID is required.",
        },
        { status: 400 }
      );
    }

    const careScriberUrl =
      process.env.CARESCRIBER_API_URL?.trim().replace(/\/+$/, "");

    if (!careScriberUrl) {
      console.error(
        "SYMPTOMAI LOOKUP: CARESCRIBER_API_URL is not configured."
      );

      return NextResponse.json(
        {
          found: false,
          error: "The patient search service is not configured.",
        },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(
        `${careScriberUrl}/api/patient-lookup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            patientId,
          }),
          signal: controller.signal,
          cache: "no-store",
        }
      );

      const responseText = await response.text();

      let data: any = null;

      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch {
        console.error(
          "SYMPTOMAI LOOKUP: Invalid CareScriber response:",
          responseText
        );

        return NextResponse.json(
          {
            found: false,
            error: "The patient service returned an invalid response.",
          },
          { status: 502 }
        );
      }

      if (!response.ok) {
        console.error("SYMPTOMAI LOOKUP: CareScriber lookup failed:", {
          status: response.status,
          data,
        });

        return NextResponse.json(
          {
            found: false,
            error:
              data?.error ||
              "The patient could not be searched at this time.",
          },
          { status: response.status }
        );
      }

      return NextResponse.json({
        found: Boolean(data?.found),
        patient: data?.patient || null,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "The patient search service timed out."
          : error.message
        : "Unexpected patient lookup error.";

    console.error("SYMPTOMAI PATIENT LOOKUP ERROR:", error);

    return NextResponse.json(
      {
        found: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
