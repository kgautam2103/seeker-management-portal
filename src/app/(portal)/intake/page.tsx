import Link from "next/link";
import { getIntakeOptions } from "@/modules/seekers/queries";
import { IntakeFormLoader } from "./intake-form-loader";

export const metadata = { title: "Add a seeker" };

export default async function IntakePage() {
  const options = await getIntakeOptions();

  if (options.centers.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
        <h1 className="text-lg font-semibold">Add a seeker</h1>
        <p className="mt-2">
          You aren&apos;t assigned to a center yet, so there is nowhere to add seekers. Ask the steward to assign you.
        </p>
        <Link href="/dashboard" className="mt-3 inline-block text-indigo-700 underline">
          Back to dashboard
        </Link>
      </section>
    );
  }

  return <IntakeFormLoader options={options} />;
}
