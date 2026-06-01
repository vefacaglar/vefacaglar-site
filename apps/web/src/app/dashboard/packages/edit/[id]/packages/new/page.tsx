import { redirect } from "next/navigation";

interface LegacyNewPackagePageProps {
  params: {
    id: string;
  };
}

export default function LegacyNewPackagePage({ params }: LegacyNewPackagePageProps) {
  redirect(`/dashboard/package/new?groupId=${params.id}`);
}
