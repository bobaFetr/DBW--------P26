import { Suspense } from "react";
import NewsBrowser from "../../components/NewsBrowser";
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
      <Suspense fallback={<p className="content-empty-state">Loading news...</p>}>
        <NewsBrowser emptyMessage="No news posts have been published yet." />
      </Suspense>
    </>
  );
}
