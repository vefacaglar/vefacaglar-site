import { redirect } from "next/navigation";
import { getActiveLanguage } from "../../lib/lang";
import { localizeHref } from "../../lib/localizeHref";
import { getLoginHref } from "../../lib/oidc";
import { getSessionUser } from "../../lib/session";
import { profilePath } from "../../lib/profileLibrary";

/** `/profile` is a shortcut: your own profile when signed in, sign-in otherwise. */
export default async function ProfileRedirect() {
  const lang = await getActiveLanguage();
  const user = await getSessionUser();
  if (!user) redirect(getLoginHref(localizeHref("/profile", lang)));
  redirect(localizeHref(profilePath(user.username), lang));
}
