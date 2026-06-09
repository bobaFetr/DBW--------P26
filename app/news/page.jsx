import ApiCardGrid from "../../components/ApiCardGrid";
import PageIntro from "../../components/PageIntro";

export const metadata = {
  title: "News",
  description: "Paralyze news, updates, announcements, and release countdowns."
};

export default function NewsPage() {
  return (
    <>
      <PageIntro title="News">
        Use this page for updates, announcements, and release countdowns.
      </PageIntro>
      <ApiCardGrid contentType="news" emptyMessage="No news posts have been published yet." />
    </>
  );
}
