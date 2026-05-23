import { redirect } from "next/navigation";

export default async function LegacyVariantRoutePage() {
  redirect("/products");
}
