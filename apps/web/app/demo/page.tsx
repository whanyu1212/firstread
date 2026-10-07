import Link from "next/link";
import { DemoClient } from "@/components/DemoClient";
import { DemoNotice } from "@/components/DemoNotice";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Demo · FirstRead" };

export default function Demo() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1>
            <Logo size="lg" />
          </h1>
          <p className="mt-2 max-w-[62ch] text-muted">
            A companion agent with a second reader on every turn. FirstRead checks each message while the companion
            writes, and each reply before it's shown.
          </p>
        </div>
        <Link href="/deck/1" className="mt-2 shrink-0 text-sm text-accent hover:underline">
          The talk
        </Link>
      </header>
      <DemoNotice />
      <DemoClient />
    </main>
  );
}
