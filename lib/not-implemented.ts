/** 아직 구현하지 않은 계산식. 구현 전에 호출되면 바로 드러나도록 던진다. */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`미구현: ${what} (docs/calc-rules.md 참고)`);
    this.name = "NotImplementedError";
  }
}

export function notImplemented(what: string): never {
  throw new NotImplementedError(what);
}
