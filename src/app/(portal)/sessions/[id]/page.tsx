import { notFound } from "next/navigation";
import { z } from "zod";
import { getRoster } from "@/modules/attendance/queries";
import { RosterLoader } from "./roster-loader";

export const metadata = { title: "Roster" };

export default async function RosterPage(props: PageProps<"/sessions/[id]">) {
  const { id } = await props.params;
  if (!z.guid().safeParse(id).success) notFound();
  const roster = await getRoster(id);
  if (!roster) notFound();
  return <RosterLoader initial={roster} />;
}
