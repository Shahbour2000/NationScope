import { redirect } from "next/navigation";

/** Removed tab: its content lives on the Government tab. Kept so old links keep working. */
export default async function Moved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/countries/${encodeURIComponent(id)}/government`);
}
