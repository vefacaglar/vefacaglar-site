"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, POST_LOGOUT_COOKIE, safeReturnPath } from "../../lib/logout";

/** Signs out from the library and lands back on it rather than the dashboard login. */
export async function librarySignOutAction(formData: FormData) {
  const returnTo = safeReturnPath(formData.get("returnTo")?.toString(), "/explore");
  const providerLogoutUrl = await endSession();

  if (providerLogoutUrl) {
    const cookieStore = await cookies();
    cookieStore.set(POST_LOGOUT_COOKIE, returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/",
    });
    redirect(providerLogoutUrl);
  }

  redirect(returnTo);
}
