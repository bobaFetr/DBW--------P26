import AdminDashboard from "../../components/AdminDashboard";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Admin",
  description: "Paralyze admin dashboard for site content management."
};

export default function AdminPage() {
  if (process.env.ENABLE_LOCAL_ADMIN !== "true") {
    notFound();
  }

  return <AdminDashboard />;
}
