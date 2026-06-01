import { redirect } from "next/navigation";

interface LegacyEditPackagePageProps {
  params: {
    packageId: string;
  };
}

export default function LegacyEditPackagePage({ params }: LegacyEditPackagePageProps) {
  redirect(`/dashboard/package/${params.packageId}`);
}
