"use client";

import { useState } from "react";
import type { DiagnosisResult } from "@/types";
import { diagnose } from "@/lib/api";
import SearchForm from "@/components/diagnosis/SearchForm";
import DiagnosisResultComponent from "@/components/diagnosis/DiagnosisResult";
import Disclaimer from "@/components/diagnosis/Disclaimer";
import DisclosurePanel from "@/components/chat/DisclosurePanel";
import ChatPanel from "@/components/chat/ChatPanel";

type AppState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: DiagnosisResult }
  | { status: "error"; message: string };

export default function HomePage() {
  const [state, setState] = useState<AppState>({ status: "idle" });

  async function handleSubmit(ticker: string) {
    setState({ status: "loading" });
    try {
      const result = await diagnose(ticker);
      setState({ status: "success", result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다";
      setState({ status: "error", message });
    }
  }

  const isLoading = state.status === "loading";

  return (
    <div className="min-h-screen flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">🌊</span>
          <span className="font-bold text-slate-800 text-base">Tide Line</span>
          <span className="text-xs text-slate-400 ml-1">하락 추세 정밀 진단</span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        {/* 검색 섹션 */}
        <section>
          <h1 className="text-lg font-bold text-slate-800 mb-1">하락 추세 정밀 진단</h1>
          <p className="text-sm text-slate-500 mb-4">
            종목 코드를 입력하면 7개 지표로 하락 추세 여부와 페이크 가능성을 자동 진단합니다
          </p>
          <SearchForm onSubmit={handleSubmit} isLoading={isLoading} />
        </section>

        {/* 로딩 상태 */}
        {state.status === "loading" && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
            <p className="text-sm text-slate-500">데이터 분석 중입니다…</p>
            <p className="text-xs text-slate-400">최대 15초 소요될 수 있습니다</p>
          </div>
        )}

        {/* 에러 상태 */}
        {state.status === "error" && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-5 flex gap-3 items-start"
          >
            <span className="text-xl shrink-0" aria-hidden="true">❌</span>
            <div>
              <p className="font-semibold text-red-700 text-sm">진단 실패</p>
              <p className="text-sm text-red-600 mt-1">{state.message}</p>
              <button
                onClick={() => setState({ status: "idle" })}
                className="mt-3 text-xs text-red-500 underline"
              >
                다시 시도
              </button>
            </div>
          </div>
        )}

        {/* 진단 결과 + 공시 + 채팅 */}
        {state.status === "success" && (
          <>
            <DiagnosisResultComponent result={state.result} />

            <DisclosurePanel
              ticker={state.result.ticker}
            />

            <ChatPanel
              result={state.result}
            />
          </>
        )}
      </main>

      <Disclaimer />
    </div>
  );
}
