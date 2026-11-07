import GameCompanyPage, { gameCompanyMetadata } from "../../GameCompanyPage";
import { gameCompanyPageNumber } from "../../../../lib/gameCompanies";

interface PublisherPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata(props: PublisherPageProps) {
  const [{ slug }, searchParams] = await Promise.all([props.params, props.searchParams]);
  return gameCompanyMetadata("publisher", slug, gameCompanyPageNumber(searchParams.page));
}

export default async function PublisherPage(props: PublisherPageProps) {
  const [{ slug }, searchParams] = await Promise.all([props.params, props.searchParams]);
  return <GameCompanyPage role="publisher" slug={slug} page={gameCompanyPageNumber(searchParams.page)} />;
}
