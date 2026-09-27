import { redirect } from "next/navigation";
import { DEFAULT_GAME } from "@/lib/games";

export default function Home() {
  redirect(`/games/${DEFAULT_GAME}`);
}
