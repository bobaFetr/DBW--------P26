import PageIntro from "../../components/PageIntro";
import AirbrushBoard from "./AirbrushBoard";

export const metadata = {
  title: "Airbrush Board",
  description:
    "Prototype virtual air brush painting board for sketching ideas directly in the browser."
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
