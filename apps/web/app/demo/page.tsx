import Link from "next/link";
import { CompanionChat } from "@/components/CompanionChat";

export const metadata = { title: "Demo · FirstRead" };

export default function Demo() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">FirstRead demo</h1>
        <Link href="/deck/1" className="text-sm text-muted hover:text-ink">
          Deck →
        </Link>
      </header>
      <p className="mb-6 text-muted">
        A plain companion chatbot. Next: FirstRead checks every turn here, with a live panel showing what it saw
        (HY-19).
      </p>
      <CompanionChat />
    </main>
  );
}
