import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = cookies().get("session_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const API_URL = process.env.API_URL || "http://localhost:3001";

  try {
    if (!req.body) {
      return NextResponse.json({ message: "No file body provided." }, { status: 400 });
    }

    // Stream the raw body directly to the Fastify backend API.
    // This avoids parsing the multipart form data in Next.js, preventing memory/CPU overhead
    // and bypassing any Next.js Serverless body-parsing bugs.
    const apiRes = await fetch(`${API_URL}/api/uploads/image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": req.headers.get("Content-Type") || "multipart/form-data",
      },
      body: req.body,
      // @ts-ignore - duplex is required in Node's fetch implementation when passing a stream body
      duplex: "half",
    });

    const body = await apiRes.text();
    return new NextResponse(body, {
      status: apiRes.status,
      headers: {
        "Content-Type": apiRes.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error(`Next.js image upload proxy error (target: ${API_URL}/api/uploads/image):`, error);
    return NextResponse.json(
      { message: `Server connection error (tried connecting to ${API_URL}).` },
      { status: 500 }
    );
  }
}
