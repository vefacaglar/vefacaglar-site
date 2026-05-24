import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = cookies().get("session_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const API_URL = process.env.API_URL || "http://localhost:3001";

  try {
    const formData = await req.formData();

    // Forward the request to the Fastify API
    const apiRes = await fetch(`${API_URL}/api/uploads/image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const body = await apiRes.text();
    return new NextResponse(body, {
      status: apiRes.status,
      headers: {
        "Content-Type": apiRes.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error(`Next.js image upload forwarding error (target: ${API_URL}/api/uploads/image):`, error);
    return NextResponse.json(
      { message: `Server connection error (tried connecting to ${API_URL}).` },
      { status: 500 }
    );
  }
}
