import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LookupRequest = {
  patientId?: string;
};

export async function POST(req: NextRequest) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const body = (await req.json()) as LookupRequest;

    const patientId = String(body.patientId || "")
      .replace(/\s+/g, "")
      .trim();

    if (!patientId) {
      return NextResponse.json(
        {
          found: false,
          error: "National ID or passport number is required.",
        },
        { status: 400 }
      );
    }

    const careScriberBaseUrl = String(
      process.env.CARESCRIBER_API_URL || ""
    )
      .trim()
      .replace(/\/+$/, "");

    if (!careScriberBaseUrl) {
      console.error(
        "SYMPTOMAI PATIENT LOOKUP: CARESCRIBER_API_URL is missing."
      );

      return NextResponse.json(
        {
          found: false,
          error: "The live patient lookup service is not configured.",
        },
        { status: 500 }
      );
    }

    if (
      careScriberBaseUrl.includes("localhost") ||
      careScriberBaseUrl.includes("127.0.0.1")
    ) {
      console.error(
        "SYMPTOMAI PATIENT LOOKUP: Localhost URL blocked in production."
      );

      return NextResponse.json(
        {
          found: false,
          error: "The patient lookup service has an invalid production URL.",
        },
        { status: 500 }
      );
    }

    const controller = new AbortController();

    timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    const targetUrl =
      `${careScriberBaseUrl}/api/patient-lookup`;

    console.log("SYMPTOMAI PATIENT LOOKUP:", {
      targetUrl,
      patientIdLength: patientId.length,
    });

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        patientId,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const responseText = await response.text();

    let data: any = null;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      console.error(
        "SYMPTOMAI PATIENT LOOKUP: Invalid API response:",
        {
          status: response.status,
          responseText,
        }
      );

      return NextResponse.json(
        {
          found: false,
          error:
            "The patient service returned an unreadable response.",
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error(
        "SYMPTOMAI PATIENT LOOKUP: CareScriber API error:",
        {
          status: response.status,
          data,
        }
      );

      return NextResponse.json(
        {
          found: false,
          error:
            data?.error ||
            data?.message ||
            "The patient search could not be completed.",
        },
        {
          status:
            response.status >= 400 && response.status <= 599
              ? response.status
              : 502,
        }
      );
    }

    return NextResponse.json(
      {
        found: Boolean(data?.found),
        patient: data?.patient || null,
        message:
          data?.message ||
          (data?.found
            ? "Existing patient found."
            : "No existing patient was found."),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: unknown) {
    const isTimeout =
      error instanceof Error &&
      error.name === "AbortError";

    const message = isTimeout
      ? "The live patient search took too long. Please try again."
      : error instanceof Error
        ? error.message
        : "Unexpected patient lookup error.";

    console.error(
      "SYMPTOMAI PATIENT LOOKUP ERROR:",
      error
    );

    return NextResponse.json(
      {
        found: false,
        error: message,
      },
      { status: isTimeout ? 504 : 500 }
    );
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
