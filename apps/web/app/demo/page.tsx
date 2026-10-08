import { DemoClient } from "@/components/DemoClient";
import { Glow } from "@/components/Glow";

export const metadata = { title: "Demo · FirstRead" };

/** One screen: the page itself never scrolls, only the conversation does. */
export default function Demo() {
  return (
    <div className="relative isolate h-dvh overflow-hidden">
      <Glow />
      <main className="mx-auto flex h-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <DemoClient />
      </main>
    </div>
  );
}
