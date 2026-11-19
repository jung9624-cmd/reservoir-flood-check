// 용어 도움말: 한 줄 정의 + 근거 기준 문서. 화면의 (?) 단추가 쓴다. 원문을 아직 확인하지 못한 근거는 "확인 필요"로 적는다(docs/calc-rules.md 7절).
export interface Term {
  term: string;
  definition: string;
  basis: string;
}

export const GLOSSARY = {
  cn3: {
    term: "CN-Ⅲ",
    definition: "선행토양함수조건 Ⅲ(습윤)의 유출곡선지수. 클수록 같은 비에서 유효우량이 많다. CN-Ⅲ = 23·CNⅡ / (10 + 0.13·CNⅡ), 초기손실 Ia = 0.2S.",
    basis: "환경부 홍수량 산정 표준지침(2019), NRCS-CN 방법",
  },
  tc: {
    term: "Tc (도달시간)",
    definition: "유역에서 가장 먼 곳의 빗물이 저수지에 닿기까지 걸리는 시간. Clark 단위도의 시간-면적 곡선을 정한다. 반올림하지 않고 쓴다.",
    basis: "환경부 홍수량 산정 표준지침(2019), Clark 단위도",
  },
  k: {
    term: "K (저류상수)",
    definition: "Clark 단위도에서 유역이 물을 잠시 담아 두는 효과를 나타내는 선형저수지 상수. 클수록 첨두유량이 낮고 늦어진다.",
    basis: "환경부 홍수량 산정 표준지침(2019), Clark 단위도",
  },
  huff: {
    term: "Huff 3분위",
    definition: "지속기간을 네 등분했을 때 셋째 구간에 비가 가장 많이 오는 시간분포. 총강우를 10분 간격으로 나눌 때 쓴다(K-HAS 누가곡선).",
    basis: "환경부 홍수량 산정 표준지침(2019), K-HAS 내장 분포",
  },
  conversion: {
    term: "환산계수",
    definition: "정시 기준(고정시간) 연최대 강우를 임의 시각 기준 연최대로 바꾸는 계수. Y = 0.1346·X^−1.417 + 1.0014 (X: 지속기간, 시간).",
    basis: "권이저수지 세부설계 보고서(2023) 표 3.10의 K-HAS 적용식 (지침 원문 확인 필요)",
  },
  critical: {
    term: "임계지속기간",
    definition: "지속기간 10개(60~1440분)로 홍수추적을 했을 때 최고수위가 가장 높게 나온 지속기간. 판정은 이 지속기간의 최고수위로 한다.",
    basis: "한국농어촌공사 가이드라인(2019) 적용 기준 (보고서는 홍수량 최대 기준을 함께 씀, calc-rules 7-9)",
  },
  factor: {
    term: "할증 1.2",
    definition: "필댐은 월류에 약하므로 설계홍수량(유입 수문곡선 전체)에 1.2를 곱한다. 콘크리트댐은 곱하지 않는다.",
    basis: "농업생산기반시설 설계기준(2018), 권이 보고서 3.3.2",
  },
  freeboard: {
    term: "여유고",
    definition: "제정표고 − 최고수위. 필댐·수문 없음 기준 2.0 m 이상이면 적합, 미만이면 부적합으로 표시한다.",
    basis: "농업생산기반시설 설계기준(2018) (기준값 원문 확인 필요, calc-rules 7-7)",
  },
  crest: {
    term: "물넘이 마루표고",
    definition: "물넘이(여수로) 월류부 꼭대기 표고. 수위가 이보다 높아지면 방류가 시작된다. 자연월류식은 보통 만수위와 같다.",
    basis: "농업생산기반시설 설계기준(2018)",
  },
  damCrest: {
    term: "제정표고",
    definition: "제체(둑) 꼭대기 표고. 여유고 판정의 기준이 된다. 자갈 포장 등 덧쌓은 높이를 넣었는지 확인한다.",
    basis: "농업생산기반시설 설계기준(2018)",
  },
} satisfies Record<string, Term>;

export type GlossaryKey = keyof typeof GLOSSARY;
