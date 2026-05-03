"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { searchStocks, type StockItem } from "@/lib/api";

interface SearchFormProps {
  onSubmit: (ticker: string) => void;
  isLoading: boolean;
}

const DEBOUNCE_MS = 200;

export default function SearchForm({ onSubmit, isLoading }: SearchFormProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFetching, setIsFetching] = useState(false);
  const [serverLoaded, setServerLoaded] = useState(false);
  // 최종 선택된 종목 (ticker 코드)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 선택된 항목이 화면 내에 보이도록 스크롤
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    setIsFetching(true);
    try {
      const { loaded, results } = await searchStocks(q);
      setServerLoaded(loaded);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsFetching(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setSelectedTicker(null); // 타이핑 시 선택 초기화

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), DEBOUNCE_MS);
  }

  function selectStock(stock: StockItem) {
    setQuery(stock.display);          // 입력창에 "삼성전자(005930)" 표시
    setSelectedTicker(stock.ticker);  // 실제 제출할 ticker 저장
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          selectStock(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
      selectStock(suggestions[activeIndex]);
      return;
    }

    const ticker = selectedTicker ?? (query.trim().match(/^\d{6}$/) ? query.trim() : null);
    if (!ticker) return;
    onSubmit(ticker);
  }

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!inputRef.current?.parentElement?.contains(target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const canSubmit = !isLoading && (
    selectedTicker !== null || /^\d{6}$/.test(query.trim())
  );

  // 힌트 메시지 결정 (사용자가 타이핑한 경우에만 표시, 선택 완료 후에는 숨김)
  const hasTyped = query.trim().length > 0 && selectedTicker === null;
  const hint = hasTyped && !serverLoaded
    ? "종목 목록 로딩 중…"
    : hasTyped && !isFetching && suggestions.length === 0 && !isOpen
    ? "검색 결과가 없습니다"
    : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="search-form flex flex-col gap-2"
      aria-label="종목 진단 검색"
    >
      <div className="search-form__row flex gap-2">
        {/* 검색 입력 + 드롭다운 */}
        <div className="search-form__input-wrapper flex-1 relative">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setIsOpen(true)}
              placeholder="종목명 또는 코드 (예: 삼성전자, 005930)"
              disabled={isLoading}
              aria-label="종목 검색"
              aria-autocomplete="list"
              aria-expanded={isOpen}
              aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
              className={[
                "search-form__input w-full h-12 pl-4 pr-10 rounded-xl border text-base",
                "focus:outline-none focus:ring-2 focus:ring-blue-500",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "placeholder:text-slate-400 bg-white",
                selectedTicker ? "border-blue-400 text-blue-700 font-medium" : "border-slate-300",
              ].join(" ")}
            />

            {/* 오른쪽 아이콘 */}
            <span className="search-form__input-icon absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {isFetching ? (
                <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : selectedTicker ? (
                <svg className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              )}
            </span>
          </div>

          {/* 자동완성 드롭다운 */}
          {isOpen && suggestions.length > 0 && (
            <ul
              ref={listRef}
              role="listbox"
              aria-label="종목 검색 결과"
              className="search-form__dropdown absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto"
            >
              {suggestions.map((stock, idx) => (
                <li
                  key={stock.ticker}
                  id={`suggestion-${idx}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  onPointerDown={(e) => {
                    e.preventDefault(); // blur 방지
                    selectStock(stock);
                  }}
                  className={[
                    "search-form__dropdown-option flex items-center justify-between px-4 py-2.5 cursor-pointer select-none",
                    "transition-colors text-sm",
                    idx === activeIndex
                      ? "search-form__dropdown-option--active bg-blue-50 text-blue-800"
                      : "hover:bg-slate-50 text-slate-800",
                    idx < suggestions.length - 1 ? "border-b border-slate-100" : "",
                  ].join(" ")}
                >
                  <span className="font-medium">{stock.name}</span>
                  <span className="font-mono text-xs text-slate-400 ml-3 shrink-0">
                    {stock.ticker}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* 힌트 메시지 */}
          {hint && !isOpen && (
            <p className="search-form__hint absolute left-0 top-full mt-1 text-xs text-slate-400 pl-1">
              {hint}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={[
            "search-form__submit h-12 px-6 rounded-xl font-semibold text-sm transition-all shrink-0",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "bg-blue-600 text-white hover:bg-blue-700 active:scale-95",
            isLoading ? "cursor-wait" : "",
          ].join(" ")}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              분석 중
            </span>
          ) : "진단하기"}
        </button>
      </div>
    </form>
  );
}
