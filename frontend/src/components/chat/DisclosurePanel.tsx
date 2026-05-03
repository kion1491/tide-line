"use client";

import { useState, useEffect } from "react";
import type { Disclosure } from "@/types";
import { getDisclosures } from "@/lib/api";

interface DisclosurePanelProps {
  ticker: string;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `~${Math.round(n / 1000)}k 토큰`;
  return `~${n} 토큰`;
}

export default function DisclosurePanel({ ticker }: DisclosurePanelProps) {
  const [rows, setRows] = useState<Disclosure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setRows([]);

    getDisclosures(ticker, 60)
      .then(setRows)
      .catch((err) => {
        const message = err instanceof Error ? err.message : "공시 목록 조회 실패";
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }, [ticker]);

  return (
    <section className="disclosure-panel rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="disclosure-panel__header px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <span className="text-base" aria-hidden="true">📋</span>
        <h2 className="disclosure-panel__title font-semibold text-slate-800 text-sm">최근 공시 (60일)</h2>
      </div>

      {isLoading && (
        <div className="disclosure-panel__loading flex items-center justify-center py-10 gap-2 text-slate-400 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          공시 목록 불러오는 중…
        </div>
      )}

      {error && (
        <p className="disclosure-panel__error px-5 py-4 text-sm text-red-500">{error}</p>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <p className="disclosure-panel__empty px-5 py-4 text-sm text-slate-400">최근 60일간 공시가 없습니다.</p>
      )}

      {!isLoading && rows.length > 0 && (
        <ul className="disclosure-panel__list divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.rcept_no} className="disclosure-panel__item px-5 py-3">
              <div className="disclosure-panel__item-inner flex items-start gap-3">
                <div className="disclosure-panel__item-body flex-1 min-w-0">
                  <p className="disclosure-panel__item-date text-xs text-slate-400 mb-0.5">{row.date}</p>
                  <p className="disclosure-panel__item-title text-sm text-slate-700 leading-snug">{row.title}</p>
                  <p className="disclosure-panel__item-tokens text-xs text-slate-400 mt-0.5">{formatTokens(row.est_tokens)}</p>
                </div>

                <div className="disclosure-panel__item-link shrink-0 pt-0.5">
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:text-blue-500 transition-colors"
                    aria-label="DART 원문 열기"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
