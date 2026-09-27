import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameDashboard } from "@/components/GameDashboard";
import { getGame } from "@/lib/games";

export async function generateMetadata({ params }: PageProps<"/games/[slug]">): Promise<Metadata> {
  const game = getGame((await params).slug);
  return { title: game ? `${game.name} · Comet Tracker` : "Comet Tracker" };
}

export default async function GamePage({ params }: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  if (!getGame(slug)) notFound();
  return <GameDashboard slug={slug} />;
}
