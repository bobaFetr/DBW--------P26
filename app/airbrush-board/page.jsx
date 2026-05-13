import PageIntro from "../../components/PageIntro";
import AirbrushBoard from "./AirbrushBoard";

export const metadata = {
  title: "Air Brush Board",
  description:
    "Prototype virtual air brush painting board for sketching ideas directly in the browser."
};

export default function AirbrushBoardPage() {
  return (
    <>
      <PageIntro title="Virtual Air Brush Board">
        A prototype painting board for quick spray-style sketches. No account or backend
        is required.
      </PageIntro>
      <AirbrushBoard />
    </>
  );
}
