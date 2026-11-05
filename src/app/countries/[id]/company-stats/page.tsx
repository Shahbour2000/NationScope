import { redirect } from "next/navigation";

/** Company statistics of one country: reuse the Company statistics page with its country scope applied. */
export default async function CountryCompanyStats({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/company-stats?country=${encodeURIComponent(id)}`);
}
