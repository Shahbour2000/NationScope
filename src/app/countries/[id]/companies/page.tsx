import { redirect } from "next/navigation";

/** Companies of one country: the main Companies page already filters by country and is the single, polished view. */
export default async function CountryCompanies({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/companies?country=${encodeURIComponent(id)}`);
}
