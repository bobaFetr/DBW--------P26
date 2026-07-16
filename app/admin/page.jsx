import { notFound } from "next/navigation";

export const metadata = {
  title: "Page Not Found",
  description: "The requested Paralyze page could not be found."
};

export default function AdminPage() {
  notFound();
}
