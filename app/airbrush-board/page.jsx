import PageIntro from "../../components/PageIntro";
import AirbrushBoard from "./AirbrushBoard";

export const metadata = {
  title: "Airbrush Board",
  description:
    "Virtual air brush painting board."
};

export default function AirbrushBoardPage() {
  return (
    <>
      <PageIntro title="Virtual Airbrush Board">
        A prototype painting board for quick spray-style sketches. No account or backend
        is required.
      </PageIntro>
      <AirbrushBoard />
    </>
  );
}
