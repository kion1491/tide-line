export default function Disclaimer() {
  return (
    <footer className="disclaimer mt-8 mb-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
      <p className="disclaimer__text text-xs text-slate-400 leading-relaxed text-center">
        본 도구는 보조 판단 도구이며, 투자 자문이 아닙니다.
        매매 결정과 결과의 책임은 사용자 본인에게 있습니다.
        <br />
        본 도구는 KRX 정규장 마감 후 데이터 기준이며, 18세 이상 사용을 권장합니다.
      </p>
    </footer>
  );
}
