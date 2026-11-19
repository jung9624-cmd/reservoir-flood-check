"use client";

// 서버 렌더와 첫 화면이 어긋나지 않게, 브라우저 저장소는 하이드레이션 뒤에만 읽는다
import { useSyncExternalStore } from "react";

const noop = () => () => {};
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
