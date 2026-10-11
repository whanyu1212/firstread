import { DemoClient } from "@/components/DemoClient";
import { Glow } from "@/components/Glow";

export const metadata = { title: "Demo · FirstRead" };

/**
 * One screen: normally only the conversation scrolls. When the controls and notice leave it less
 * than its minimum height (a phone in landscape, high zoom, the key form open), the page scrolls
 * instead, so nothing is cut off.
 */
export default function Demo() {
  return (
    <div className="relative isolate h-dvh overflow-x-hidden overflow-y-auto">
      <Glow />
      <main className="mx-auto flex min-h-full h-full max-w-7xl flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4">
        {/* With a key on the server, visitors can type without their own (HY-153). */}
        <DemoClient serverKey={Boolean(process.env.OPENAI_API_KEY)} />
      </main>
    </div>
  );
}
