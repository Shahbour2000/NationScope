import { redirect } from "next/navigation";

/** The rankings index has no list of its own; send visitors to the default board. */
export default function RankingsIndex() {
  redirect("/rankings/playerDamage");
}
