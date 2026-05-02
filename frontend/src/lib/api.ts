import type { DiagnosisResult, Disclosure, DisclosureContent } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `요청 실패 (${res.status})`);
  }

  return res.json();
}

export async function diagnose(ticker: string): Promise<DiagnosisResult> {
  return request<DiagnosisResult>("/api/diagnose", {
    method: "POST",
    body: JSON.stringify({ ticker }),
  });
}

export async function getDisclosures(ticker: string, days = 30): Promise<Disclosure[]> {
  return request<Disclosure[]>(`/api/disclosures?ticker=${ticker}&days=${days}`);
}

export async function getDisclosureContent(rcept_no: string): Promise<DisclosureContent> {
  return request<DisclosureContent>(`/api/disclosure/${rcept_no}`);
}

export interface StockItem {
  ticker: string;
  name: string;
  display: string;
}

export async function searchStocks(q: string): Promise<{ loaded: boolean; results: StockItem[] }> {
  const params = new URLSearchParams({ q });
  return request<{ loaded: boolean; results: StockItem[] }>(`/api/stocks?${params}`);
}
