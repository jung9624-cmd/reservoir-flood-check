"use client";

// ③ 입력 6가지 (CLAUDE.md 4절, design/wireframe.md ③). 칸마다 단위와 "입력" 배지, 잘못된 값은 칸 옆에 이유.
// 마루표고 기본값 = 만수위. 설계 내용적표는 선택(엑셀 두 열 붙여넣기).
import { useId } from "react";
import { emptyOutlet, type DraftField, type InputDraft, type OutletDraft } from "@/lib/draft";
import { cn2ToCn3 } from "@/lib/runoff";
import type { GlossaryKey } from "@/lib/glossary";
import { Help } from "./help";
import { SPEC_CURVE_NOTE } from "@/lib/reliability";
import { auto, INPUT, SourceBadge } from "./source-badge";

type Errors = Partial<Record<DraftField, string>>;

function Field(props: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  hint?: React.ReactNode;
  defaulted?: string; // 비어 있을 때 쓰는 자동값의 출처
  required?: boolean;
  help?: GlossaryKey;
}) {
  const id = useId();
  const { label, unit, value, onChange, error, placeholder, hint, defaulted, required, help } = props;
  const isDefault = !value.trim() && defaulted;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5">
        <label htmlFor={id} className="text-[13px] text-ink">
          {label}
          {required && <span className="sr-only"> (필수)</span>}
        </label>
        {help && <Help k={help} />}
        <SourceBadge source={isDefault ? auto(defaulted!) : INPUT} />
      </div>
      <div className={`flex h-10 items-center gap-1.5 rounded-md border px-2.5 focus-within:outline-2 focus-within:outline-ink ${error ? "border-2 border-ink" : "border-line"}`}>
        <input
          id={id}
          inputMode="decimal"
          className="num w-full min-w-0 bg-transparent text-right text-[15px] text-ink outline-none placeholder:text-sub"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        {unit && <span className="shrink-0 text-[13px] text-sub">{unit}</span>}
      </div>
      {error && <p id={`${id}-err`} className="mt-1 text-[13px] text-ink"><span aria-hidden="true">⚠ </span>{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-sub">{hint}</p>}
    </div>
  );
}

export function InputForm(props: {
  draft: InputDraft;
  onChange: (d: InputDraft) => void;
  errors: Errors;
  fullLevelElM: number | null;
  storageRows: number;
  onLoadReport?: () => void;
}) {
  const { draft: d, onChange, errors, fullLevelElM, storageRows, onLoadReport } = props;
  const set = <K extends keyof InputDraft>(k: K, v: InputDraft[K]) => onChange({ ...d, [k]: v });
  const setOutlet = (i: number, o: Partial<OutletDraft>) => set("extraOutlets", d.extraOutlets.map((x, j) => (j === i ? { ...x, ...o } : x)));
  const cn = Number(d.cnValue);

  return (
    <section aria-labelledby="input-title" className="border-t border-line py-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="input-title" className="text-[13px] font-medium text-sub">③ 입력 (6가지)</h2>
        {onLoadReport && (
          <button type="button" onClick={onLoadReport} className="no-print h-9 rounded-md border border-line px-3 text-sm text-ink hover:bg-[#f6f8fa]">
            보고서 값 불러오기 (권이 세부설계 2023)
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="1 물넘이 폭" unit="m" required value={d.spillwayWidthM} onChange={(v) => set("spillwayWidthM", v)} error={errors.spillwayWidthM} />
        <Field
          label="2 물넘이 마루표고"
          help="crest"
          unit="EL.m"
          value={d.spillwayCrestElM}
          onChange={(v) => set("spillwayCrestElM", v)}
          error={errors.spillwayCrestElM}
          placeholder={fullLevelElM?.toFixed(2)}
          defaulted="만수위"
          hint="비우면 만수위 (자연월류식)"
        />
        <Field label="2 물넘이 유량계수 C" value={d.spillwayCoefficient} onChange={(v) => set("spillwayCoefficient", v)} error={errors.spillwayCoefficient} placeholder="2.0" defaulted="기본값 2.0" />
        <Field label="4 제정표고" help="damCrest" unit="EL.m" required value={d.damCrestElM} onChange={(v) => set("damCrestElM", v)} error={errors.damCrestElM} />
        <div className="min-w-0">
          <Field
            label={`5 CN-${d.cnAmc === "III" ? "Ⅲ" : "Ⅱ"}`}
            help="cn3"
            required
            value={d.cnValue}
            onChange={(v) => set("cnValue", v)}
            error={errors.cnValue}
            hint={d.cnAmc === "II" && Number.isFinite(cn) && cn > 0 ? <>→ CN-Ⅲ {cn2ToCn3(cn).toFixed(2)} (계산)</> : "30~100"}
          />
          <fieldset className="mt-1 flex gap-3 text-xs text-ink">
            <legend className="sr-only">CN 조건</legend>
            {(["III", "II"] as const).map((a) => (
              <label key={a} className="flex items-center gap-1">
                <input type="radio" name="amc" checked={d.cnAmc === a} onChange={() => set("cnAmc", a)} />
                AMC-{a === "III" ? "Ⅲ" : "Ⅱ"}
              </label>
            ))}
          </fieldset>
        </div>
        <fieldset className="min-w-0">
          <legend className="mb-1 text-[13px] text-ink">6 Tc·K 방식</legend>
          <div className="flex h-10 overflow-hidden rounded-md border border-line text-[13px]">
            {([["direct", "직접 입력"], ["seokyeong", "서경대 공식"]] as const).map(([v, t]) => (
              <label key={v} className={`flex flex-1 cursor-pointer items-center justify-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${d.tcKMethod === v ? "bg-ink text-white" : "text-ink"}`}>
                <input type="radio" className="sr-only" name="tck" checked={d.tcKMethod === v} onChange={() => set("tcKMethod", v)} />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {d.tcKMethod === "direct" ? (
          <>
            <Field label="6 Tc 도달시간" help="tc" unit="hr" required value={d.tcHr} onChange={(v) => set("tcHr", v)} error={errors.tcHr} />
            <Field label="6 K 저류상수" help="k" unit="hr" required value={d.kHr} onChange={(v) => set("kHr", v)} error={errors.kHr} />
          </>
        ) : (
          <>
            <Field label="6 유로연장 L" unit="km" required value={d.channelLengthKm} onChange={(v) => set("channelLengthKm", v)} error={errors.channelLengthKm} />
            <Field label="6 최원점 표고 H" unit="EL.m" required value={d.farthestPointElM} onChange={(v) => set("farthestPointElM", v)} error={errors.farthestPointElM} hint="Tc = 0.214·L·H^−0.144 (H 정의 확인 필요)" />
          </>
        )}
        <div className="sm:col-span-2 lg:col-span-4">
          <div className="mb-1 flex items-center gap-1.5 text-[13px] text-ink">3 추가 방류시설 <span className="text-xs text-sub">(선택)</span></div>
          {d.extraOutlets.length === 0 && <p className="text-sm text-sub">없음</p>}
          {d.extraOutlets.map((o, i) => (
            <div key={i} className="mb-2 flex flex-wrap items-end gap-2">
              <label className="text-xs text-sub">이름<input className="mt-0.5 block h-9 w-24 rounded-md border border-line px-2 text-sm text-ink" value={o.name} onChange={(e) => setOutlet(i, { name: e.target.value })} /></label>
              <label className="text-xs text-sub">폭 m<input inputMode="decimal" className="num mt-0.5 block h-9 w-20 rounded-md border border-line px-2 text-right text-sm text-ink" value={o.widthM} onChange={(e) => setOutlet(i, { widthM: e.target.value })} /></label>
              <label className="text-xs text-sub">마루·바닥 EL.m<input inputMode="decimal" className="num mt-0.5 block h-9 w-24 rounded-md border border-line px-2 text-right text-sm text-ink" value={o.crestElM} onChange={(e) => setOutlet(i, { crestElM: e.target.value })} /></label>
              <label className="text-xs text-sub">C<input inputMode="decimal" placeholder="2.0" className="num mt-0.5 block h-9 w-16 rounded-md border border-line px-2 text-right text-sm text-ink" value={o.coefficient} onChange={(e) => setOutlet(i, { coefficient: e.target.value })} /></label>
              <label className="flex h-9 items-center gap-1 text-sm text-ink"><input type="checkbox" checked={o.open} onChange={(e) => setOutlet(i, { open: e.target.checked })} />열림</label>
              <SourceBadge source={INPUT} className="mb-2.5" />
              <button type="button" className="h-9 rounded-md border border-line px-2 text-sm text-ink" onClick={() => set("extraOutlets", d.extraOutlets.filter((_, j) => j !== i))}>삭제</button>
              {errors[`outlet${i}`] && <p className="w-full text-[13px] text-ink">⚠ {errors[`outlet${i}`]}</p>}
            </div>
          ))}
          <button type="button" className="text-sm text-water hover:underline" onClick={() => set("extraOutlets", [...d.extraOutlets, emptyOutlet()])}>+ 방류시설 추가</button>
        </div>
      </div>

      <details className="mt-4 rounded-md border border-line px-4 py-3" open={!!d.storageTableText}>
        <summary className="cursor-pointer text-[13px] text-ink">
          선택 · 설계 내용적표 {storageRows > 0 ? <><b className="num">{storageRows}행</b> <SourceBadge source={INPUT} /></> : <span className="text-sub">— 없음: 제원으로 만든 {SPEC_CURVE_NOTE} 사용</span>}
        </summary>
        <label className="mt-2 block text-xs text-sub">
          엑셀에서 두 열(표고 EL.m, 저수량 m³)을 복사해 붙여넣으세요. 머리글 한 줄은 건너뜁니다.
          <textarea
            className="num mt-1 block h-40 w-full rounded-md border border-line p-2 font-mono text-[13px] text-ink"
            value={d.storageTableText}
            onChange={(e) => set("storageTableText", e.target.value)}
            placeholder={"표고\t저수량\n154.0\t0\n155.0\t9203"}
            aria-invalid={!!errors.storageTableText}
          />
        </label>
        {errors.storageTableText && <p className="mt-1 text-[13px] text-ink">⚠ {errors.storageTableText}</p>}
      </details>
    </section>
  );
}
