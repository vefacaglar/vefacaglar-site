import { redirect } from "next/navigation";

interface LegacyNewPackagePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function LegacyNewPackagePage(props: LegacyNewPackagePageProps) {
  const params = await props.params;
  redirect(`/dashboard/package/new?groupId=${params.id}`);
}
