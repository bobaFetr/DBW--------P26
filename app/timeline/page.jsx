import PageIntro from "../../components/PageIntro";
import Timeline from "../../components/Timeline";

export const metadata = {
  title: "Timeline",
  description:
    "Paralyze project timeline with major milestones, demo releases, and live moments."
};

export default function TimelinePage() {
  return (
    <>
      <PageIntro title="Timeline">
        This page tracks the events of ParalyZe's history.
      </PageIntro>
      <Timeline />
    </>
  );
}
