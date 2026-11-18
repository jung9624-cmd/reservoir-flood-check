import { ReservoirMap } from "@/components/reservoir-map";
import { ReservoirTable } from "@/components/reservoir-table";

// 전국 목록·지도 — 빈 화면 (내용은 아직 구현하지 않았다)
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">전국 농업용 저수지 치수안정성 평가</h1>
      <ReservoirMap />
      <ReservoirTable />
    </main>
  );
}
