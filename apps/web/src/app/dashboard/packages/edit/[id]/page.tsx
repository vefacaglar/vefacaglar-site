import { redirect } from "next/navigation";

interface LegacyEditPackagePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function LegacyEditPackagePage(props: LegacyEditPackagePageProps) {
  const params = await props.params;
  redirect(`/dashboard/package-groups/${params.id}`);
}
