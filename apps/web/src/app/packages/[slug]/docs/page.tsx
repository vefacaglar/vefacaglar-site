import { notFound, redirect } from "next/navigation";
import { getPackage } from "../../../../lib/data";


export default async function PackageDocsPage({
  params,
}: {
  params: { slug: string };
}) {
  const pkg = await getPackage(params.slug);
  if (!pkg) notFound();

  if (pkg.docs && !pkg.docs.startsWith("http") && !pkg.docs.includes("/")) {
    const hasDoc = pkg.docsList.some((doc: { slug: string }) => doc.slug === pkg.docs);
    if (hasDoc) {
      redirect(`/packages/${pkg.slug}/docs/${pkg.docs}`);
    }
  }

  if (pkg.docsList.length > 0) {
    const sortedDocs = [...pkg.docsList].sort((a, b) => a.displayOrder - b.displayOrder);
    const firstDoc = sortedDocs[0];
    redirect(`/packages/${pkg.slug}/docs/${firstDoc.slug}`);
  }

  redirect(`/packages/${pkg.slug}`);
}
