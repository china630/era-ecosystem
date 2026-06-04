import Link from "next/link";
import { notFound } from "next/navigation";
import { PatientContraindicationsPanel } from "@/components/PatientContraindicationsPanel";
import { prisma } from "@/lib/prisma";

export default async function PatientCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await prisma.patientRef.findUnique({ where: { id } });
  if (!patient) notFound();

  return (
    <main className="mx-auto max-w-lg p-6 space-y-6">
      <Link href="/sanatorium" className="text-sm text-blue-600 hover:underline">
        ← Sanatorium
      </Link>
      <header>
        <h1 className="text-xl font-semibold">{patient.fullName ?? patient.refCode}</h1>
        <p className="text-sm text-slate-500">{patient.refCode}</p>
      </header>
      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">
          Contraindications (body map)
        </h2>
        <PatientContraindicationsPanel patientRefId={patient.id} />
      </section>
    </main>
  );
}
