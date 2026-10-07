import Link from "next/link";
import { Logo } from "@/components/Logo";

const LINKS = [
  { href: "/deck/1", title: "Deck", body: "Why Jev fits the pain point, and how we got here." },
  { href: "/demo", title: "Demo", body: "Chat with the companion and watch FirstRead check every turn." },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
      <h1>
        <Logo size="lg" />
      </h1>
      <p className="mt-3 text-lg text-muted">A safety layer that reads every turn of a mental health companion.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-xl border border-line bg-canvas p-6 hover:border-muted">
            <h2 className="text-xl font-semibold tracking-tight">{l.title}</h2>
            <p className="mt-2 text-muted">{l.body}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
