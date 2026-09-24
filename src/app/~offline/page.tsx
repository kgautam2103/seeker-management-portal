export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="text-sm text-zinc-600">
        This page isn&apos;t available without a connection. Anything you saved while offline is kept on this device and
        syncs automatically when you&apos;re back online.
      </p>
    </main>
  );
}
