import ApiCardGrid from "../../components/ApiCardGrid";
import PageIntro from "../../components/PageIntro";

export const metadata = {
  title: "Members",
  description: "Paralyze members page for lineup roles, profiles, and band introductions."
};

export default function MembersPage() {
  return (
    <>
      <PageIntro title="Members">
        This page is ready for the full lineup, roles, and short individual
        introductions.
      </PageIntro>
      <ApiCardGrid contentType="members" emptyMessage="No members have been published yet." />
    </>
  );
}
