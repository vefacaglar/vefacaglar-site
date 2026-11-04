"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { httpClient } from "../../../lib/httpClient";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary } from "../../../dictionaries";
import { PROFILE_VISIBILITY_PATH } from "../../../lib/profileLibrary";

export type VisibilityResult = { isProfilePublic: boolean; error?: undefined } | { error: string };

/** Make the signed-in user's library profile public or private. */
export async function saveProfileVisibility(isProfilePublic: boolean): Promise<VisibilityResult> {
  const dict = getDictionary(await getActiveLanguage());
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return { error: dict.session_expired };

  try {
    const res = await httpClient.put(
      PROFILE_VISIBILITY_PATH,
      { isProfilePublic },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 401) return { error: dict.session_expired };
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.message || dict.settings_save_failed };
    }
    const data = (await res.json().catch(() => ({}))) as { isProfilePublic?: boolean };
    revalidatePath("/profile", "layout");
    return { isProfilePublic: data.isProfilePublic ?? isProfilePublic };
  } catch (error) {
    console.error(`Profile visibility update failed (PUT ${PROFILE_VISIBILITY_PATH}):`, error);
    return { error: dict.settings_save_failed };
  }
}
