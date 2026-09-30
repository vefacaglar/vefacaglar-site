import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Post-logout landing URL registered with the identity provider. */
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/dashboard/login", request.url));
}
