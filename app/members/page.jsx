import ContentCardGrid from "../../components/ContentCardGrid";
import PageIntro from "../../components/PageIntro";

export const metadata = {
  title: "Members",
  description: "Paralyze members page for lineup roles, profiles, and band introductions."
};

export default function MembersPage() {
  return (
    <>
      <PageIntro title="Members">
        Roles in the band.
      </PageIntro>
      <ContentCardGrid contentType="members" emptyMessage="No members have been published yet." />
    </>
  );
}
