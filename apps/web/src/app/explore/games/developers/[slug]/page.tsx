import GameCompanyPage, { gameCompanyMetadata } from "../../GameCompanyPage";
import { gameCompanyPageNumber } from "../../../../../lib/gameCompanies";

interface DeveloperPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata(props: DeveloperPageProps) {
  const [{ slug }, searchParams] = await Promise.all([props.params, props.searchParams]);
  return gameCompanyMetadata("developer", slug, gameCompanyPageNumber(searchParams.page));
}

export default async function DeveloperPage(props: DeveloperPageProps) {
  const [{ slug }, searchParams] = await Promise.all([props.params, props.searchParams]);
  return <GameCompanyPage role="developer" slug={slug} page={gameCompanyPageNumber(searchParams.page)} />;
}
