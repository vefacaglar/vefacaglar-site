import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = cookies().get("session_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const API_URL = process.env.API_URL || "http://localhost:3001";

  try {
    // Read the raw request body as an ArrayBuffer.
    // This is 100% compatible with Vercel's serverless environment and avoids stream duplex crashes.
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ message: "No file content provided." }, { status: 400 });
    }

    // Forward the raw buffer to the Fastify backend API
    const apiRes = await fetch(`${API_URL}/api/uploads/image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": req.headers.get("Content-Type") || "multipart/form-data",
      },
      body: buffer,
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
