import { notFound, permanentRedirect } from "next/navigation";
import { getPackage } from "../../../../lib/data";
import { resolvePackageDocsHref } from "../../../../lib/packageSeo";

export default async function PackageDocsPage(
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  const pkg = await getPackage(params.slug);
  if (!pkg) notFound();

  const docsTarget = resolvePackageDocsHref(pkg);
  if (docsTarget) {
    permanentRedirect(docsTarget.href);
  }

  permanentRedirect(`/packages/${pkg.slug}`);
}
