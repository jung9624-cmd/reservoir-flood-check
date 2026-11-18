import { Suspense } from "react";
import { SpecPanel } from "@/components/spec-panel";
import { InputForm } from "@/components/input-form";
import { VerdictPanel } from "@/components/verdict-panel";
import { DamSection } from "@/components/dam-section";
import { FloodChart } from "@/components/flood-chart";
import { DurationTable } from "@/components/duration-table";
import { ScenarioCompare } from "@/components/scenario-compare";
import { ValidationTable } from "@/components/validation-table";

// 저수지 상세(표준코드) — 빈 화면 (내용은 아직 구현하지 않았다)
export default function ReservoirPage({ params }: PageProps<"/r/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-6">
      <Suspense fallback={<h1 className="text-xl font-semibold">저수지</h1>}>
        <Title params={params} />
      </Suspense>
      <SpecPanel />
      <InputForm />
      <VerdictPanel />
      <DamSection />
      <FloodChart />
      <DurationTable />
      <ScenarioCompare />
      <ValidationTable />
    </main>
  );
}

async function Title({ params }: { params: PageProps<"/r/[code]">["params"] }) {
  const { code } = await params;
  return <h1 className="text-xl font-semibold">저수지 {code}</h1>;
}
