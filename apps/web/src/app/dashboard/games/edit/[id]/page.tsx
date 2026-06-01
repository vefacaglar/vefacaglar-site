import React from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { httpClient } from "../../../../../lib/httpClient";
import GameEditForm from "../../GameEditForm";
import type { Game } from "../../GamesDashboardClient";

export const dynamic = "force-dynamic";

export default async function EditGame({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { returnUrl?: string };
}) {
  const token = cookies().get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  let game: Game | null = null;
  try {
    const res = await httpClient.get(`/api/catalog/games/${params.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      game = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch game for edit:", error);
  }

  if (!game) {
    notFound();
  }

  return <GameEditForm game={game} returnUrl={searchParams.returnUrl || "/dashboard/games"} />;
}
