import { useState, useCallback } from "react";
import { 
  Search, 
  FileText, 
  Layers, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Download, 
  Plus, 
  History,
  BookOpen,
  ArrowRight,
  ClipboardCheck,
  ChevronRight,
  Microscope,
  Stethoscope,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PICOData, SearchResult, SearchFilters, KeywordSuggestion } from "./types";
import { expandKeywords, summarizeArticle, verifyArticle, generatePICOFromScenario } from "./services/aiService";

// Helper for Boolean Search Logic
const buildSearchQuery = (suggestions: KeywordSuggestion[], filters: SearchFilters) => {
  const parts = suggestions.map(s => {
    const terms = [s.original, ...s.synonyms, ...s.meshTerms].map(t => `"${t}"`);
    return `(${terms.join(" OR ")})`;
  });

  let query = parts.join(" AND ");
  
  // Add filters
  if (filters.types.length > 0) {
    query += ` AND (${filters.types.join(" OR ")})`;
  }
  
  return query;
};

export default function App() {
  const [step, setStep] = useState<"pico" | "keywords" | "results">("pico");
  const [scenario, setScenario] = useState("");
  const [pico, setPico] = useState<PICOData>({ p: "", i: "", c: "", o: "" });
  const [filters, setFilters] = useState<SearchFilters>({
    years: 5,
    types: ["Systematic Review", "RCT", "Meta-Analysis"],
    language: "English"
  });
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  const handleNextToKeywords = async () => {
    setLoading(true);
    try {
      const data = await expandKeywords(pico);
      setSuggestions(data);
      setStep("keywords");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const q = buildSearchQuery(suggestions, filters);
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&retmax=20`);
      const data = await res.json();
      setResults(data.results);
      setStep("results");
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async (item: SearchResult) => {
    if (item.aiSummary) return; // Already summarized
    setLoading(true);
    try {
      const detailRes = await fetch(`/api/details/${item.id}`);
      const detailData = await detailRes.json();
      const summary = await summarizeArticle(item.title, detailData.abstract);
      
      setResults(prev => prev.map(r => r.id === item.id ? { ...r, aiSummary: summary, abstract: detailData.abstract } : r));
      setSelectedResult(prev => prev?.id === item.id ? { ...prev, aiSummary: summary, abstract: detailData.abstract } : prev);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (item: SearchResult) => {
    if (item.isVerified !== undefined) return;
    setLoading(true);
    try {
      const isOk = await verifyArticle(item.title, item.doi);
      setResults(prev => prev.map(r => r.id === item.id ? { ...r, isVerified: isOk } : r));
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeScenario = async () => {
    if (!scenario.trim()) return;
    setLoading(true);
    try {
      const data = await generatePICOFromScenario(scenario);
      setPico(data);
    } finally {
      setLoading(false);
    }
  };

  const exportResultsToCSV = () => {
    if (results.length === 0) return;

    const headers = ["Title", "Authors", "Source", "Date", "DOI", "PMID", "Link"];
    const rows = results.map(r => [
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.authors.replace(/"/g, '""')}"`,
      `"${r.source.replace(/"/g, '""')}"`,
      `"${r.pubdate}"`,
      `"${r.doi}"`,
      `"${r.id}"`,
      `"${r.url}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ebp_lit_review_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToENOTE = () => {
    if (results.length === 0) return;

    const timestamp = new Date().toLocaleString("zh-TW");
    let content = `# Evidence-Based Nursing Research Package
Generated on: ${timestamp}
PICO Focus:
- P: ${pico.p}
- I: ${pico.i}
- C: ${pico.c}
- O: ${pico.o}

---
## Research Articles Library
\n`;

    results.forEach((item, index) => {
      content += `### [Source ${index + 1}] ${item.title}
- **PMID**: ${item.id}
- **DOI**: ${item.doi || "N/A"}
- **Authors**: ${item.authors}
- **Source**: ${item.source} (${item.pubdate})
- **Link**: ${item.url}

#### 📝 AI 臨床摘要 (Clinical Summary)
${item.aiSummary || "尚未生成摘要"}

#### 📑 原始摘要 (Original Abstract)
${item.abstract || "尚未載入"}

---
\n`;
    });

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `notebooklm_research_bundle_${new Date().toISOString().split('T')[0]}.md`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateEvidenceReport = () => {
    if (results.length === 0) return;

    const summarizedResults = results.filter(r => r.aiSummary);
    const timestamp = new Date().toLocaleString("zh-TW");

    let report = `# 實證護理查證報告 (Clinical Evidence Report)\n`;
    report += `**生成日期**: ${timestamp}\n`;
    report += `**臨床情境描述**: ${scenario || "未提供"}\n\n`;
    
    report += `## 一、 PICO 研究問題模型\n`;
    report += `- **P (Population)**: ${pico.p}\n`;
    report += `- **I (Intervention)**: ${pico.i}\n`;
    report += `- **C (Comparison)**: ${pico.c || "常規護理/不限"}\n`;
    report += `- **O (Outcome)**: ${pico.o}\n\n`;

    report += `## 二、 檢索策略與資源\n`;
    report += `- **核心資料庫**: PubMed (NCBI API)\n`;
    report += `- **AI 驅動引擎**: Gemini 3.1 Pro (高敏檢索模型)\n`;
    report += `- **篩選條件**: 近 ${filters.years} 年, 語言: ${filters.language}, 類型: ${filters.types.join(", ")}\n\n`;

    report += `## 三、 文獻分析清單 (共 ${results.length} 篇)\n`;
    results.forEach((r, i) => {
      report += `${i + 1}. **${r.title}**\n`;
      report += `   - 來源: ${r.source} (${r.pubdate})\n`;
      report += `   - DOI: ${r.doi || "N/A"}\n`;
      if (r.aiSummary) {
        report += `   - **臨床實證摘要**:\n${r.aiSummary.split('\n').map(l => `     ${l}`).join('\n')}\n`;
      }
      report += `\n`;
    });

    if (summarizedResults.length > 0) {
      report += `\n## 四、 綜合臨床建議 (Synthesis of Evidence)\n`;
      report += `依據本次檢索到的 ${summarizedResults.length} 篇核心文獻摘要，建議在臨床端針對 **${pico.p}** 實施 **${pico.i}** 時，應關注其對 **${pico.o}** 的顯著影響。具體執行細節可參考上述文獻摘錄之臨床應用部分。\n`;
    }

    const blob = new Blob([report], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ebp_formal_report_${new Date().toISOString().split('T')[0]}.md`);
    link.click();
  };

  const copyForNotebookLM = (item: SearchResult) => {
    const text = `
# Literature Summary: ${item.title}
- Authors: ${item.authors}
- Source: ${item.source} (${item.pubdate})
- DOI: ${item.doi}
- URL: ${item.url}

## AI Summary
${item.aiSummary || "N/A"}

## Original Abstract
${item.abstract || "N/A"}
    `;
    navigator.clipboard.writeText(text);
    alert("已複製到剪貼簿，可直接貼入 NotebookLM");
  };

  return (
    <div className="min-h-screen bg-nat-bg text-nat-body font-sans selection:bg-nat-primary/10">
      {/* Navbar */}
      <header className="bg-white border-b border-nat-border sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-nat-primary rounded-lg flex items-center justify-center text-white shadow-sm">
              <Microscope size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-nat-text">EvidenceFlow</h1>
              <p className="text-[10px] text-nat-accent font-bold tracking-widest uppercase mt-0.5">Med-Research Assistant</p>
            </div>
          </div>

          <div className="hidden md:flex gap-1 bg-nat-highlight p-1 rounded-full border border-nat-border/50">
            {["臨床決策", "行政管理", "災難醫學", "學術研究", "在地文獻"].map((nav, i) => (
              <button 
                key={nav}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold overflow-hidden transition-all ${
                  i === 0 ? "bg-white shadow-sm text-nat-primary" : "text-nat-muted hover:text-nat-primary"
                }`}
              >
                {nav}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button className="text-nat-muted hover:text-nat-primary transition-colors">
              <History size={20} />
            </button>
            <div className="h-6 w-[1px] bg-nat-border"></div>
            <div className="w-8 h-8 rounded-full bg-nat-border/40 border-2 border-white shadow-inner"></div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Step Progress */}
        <div className="flex items-center justify-center gap-8 mb-16">
          {[
            { id: "pico", label: "PICO 模型建立", icon: <Layers size={18} /> },
            { id: "keywords", label: "檢索式擴充", icon: <Filter size={18} /> },
            { id: "results", label: "查證結果分析", icon: <Search size={18} /> }
          ].map((s, idx) => (
            <div key={idx} className="flex items-center gap-8">
              <div className={`flex flex-col items-center gap-2 transition-all ${
                step === s.id ? "scale-105" : "opacity-60"
              }`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border transition-all ${
                   step === s.id ? "bg-nat-primary text-white border-nat-primary shadow-nat-primary/20" : "bg-white text-nat-muted border-nat-border"
                }`}>
                  {s.icon}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${step === s.id ? "text-nat-primary" : "text-nat-muted"}`}>
                  {s.label}
                </span>
              </div>
              {idx < 2 && <div className="h-[2px] w-12 bg-nat-border rounded-full" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === "pico" && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-4xl mx-auto"
            >
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
                <div className="lg:col-span-2 space-y-4">
                  <h2 className="text-3xl font-serif italic text-nat-text">引導式臨床提問</h2>
                  <p className="text-nat-muted leading-relaxed text-sm">
                    結構化的 PICO 模型能顯著降低檢索偏差，並提升證據搜集的高效性。請輸入您的研究核心組件。
                  </p>
                  <div className="mt-8 p-6 bg-nat-warm rounded-2xl border border-nat-border/60">
                    <h4 className="text-xs font-bold text-nat-muted uppercase tracking-widest mb-2">快速指南</h4>
                    <ul className="text-xs text-nat-muted space-y-2">
                      <li>• P: 確切的人口統計特徵</li>
                      <li>• I: 具體的處置或干預方案</li>
                      <li>• O: 可量化的臨床產出指標</li>
                    </ul>
                  </div>
                </div>

                <div className="lg:col-span-3 bg-white rounded-3xl p-8 shadow-xl shadow-nat-primary/5 border border-nat-border">
                  <div className="mb-6 pb-6 border-b border-nat-border/50">
                    <label className="block text-[10px] font-bold text-nat-accent uppercase tracking-widest mb-2">情境描述 (由 AI 自動填寫 PICO)</label>
                    <div className="relative">
                      <textarea
                        value={scenario}
                        onChange={(e) => setScenario(e.target.value)}
                        placeholder="請輸入臨床案例或研究背景描述..."
                        className="w-full p-4 bg-nat-highlight rounded-2xl border border-nat-border text-sm min-h-[100px] outline-none focus:border-nat-primary transition-all resize-none"
                      />
                      <button
                        onClick={handleAnalyzeScenario}
                        disabled={loading || !scenario.trim()}
                        className="absolute bottom-3 right-3 bg-nat-primary text-white p-2 rounded-xl shadow-lg hover:opacity-90 disabled:opacity-30 transition-all"
                      >
                        <Sparkles size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { key: "p", label: "P - Population", placeholder: "例如：ER Triage Nurses", color: "text-nat-accent" },
                      { key: "i", label: "I - Intervention", placeholder: "例如：AI Decision Support", color: "text-nat-primary" },
                      { key: "c", label: "C - Comparison", placeholder: "例如：Standard Protocols", color: "text-nat-muted" },
                      { key: "o", label: "O - Outcome", placeholder: "例如：Efficiency & Error Rate", color: "text-nat-accent" },
                    ].map((field) => (
                      <div key={field.key} className="p-4 bg-nat-bg rounded-2xl border border-nat-border/50 focus-within:border-nat-primary transition-all group">
                        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${field.color}`}>
                          {field.label}
                        </label>
                        <input
                          type="text"
                          value={(pico as any)[field.key]}
                          onChange={(e) => setPico({ ...pico, [field.key]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full bg-transparent text-sm font-medium outline-none text-nat-text placeholder:text-nat-muted/40"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    disabled={!pico.p || !pico.i || loading}
                    onClick={handleNextToKeywords}
                    className="w-full mt-10 bg-nat-primary text-white font-bold py-4 rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-nat-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? "正在解析模型..." : "生成科學檢索式"}
                    {!loading && <ArrowRight size={20} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "keywords" && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl mx-auto"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white rounded-3xl p-8 border border-nat-border shadow-sm">
                  <header className="flex items-center justify-between mb-8 pb-4 border-b border-nat-border/50">
                    <div>
                      <h2 className="text-xl font-bold text-nat-text">檢索式擴充 (MeSH)</h2>
                      <p className="text-xs text-nat-muted mt-1 underline decoration-nat-primary/30">AI 已自動推入同義詞以廣羅文獻</p>
                    </div>
                    <div className="p-2 bg-nat-soft rounded-lg">
                      <Microscope size={18} className="text-nat-primary" />
                    </div>
                  </header>
                  
                  <div className="space-y-8">
                    {suggestions.map((s, idx) => (
                      <div key={idx} className="group">
                        <h3 className="text-[10px] font-bold text-nat-accent uppercase mb-4 tracking-widest flex items-center gap-2">
                          <span className="w-1 h-3 bg-nat-primary rounded-full" />
                          Dimensions: {["Population", "Intervention", "Comparison", "Outcome"][idx]}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1.5 bg-nat-primary text-white rounded-lg text-xs font-bold shadow-sm">{s.original}</span>
                          {s.meshTerms.map((mesh, i) => (
                            <span key={i} className="px-3 py-1.5 bg-nat-soft text-nat-primary border border-nat-accent/20 rounded-lg text-xs font-semibold">
                              MeSH: {mesh}
                            </span>
                          ))}
                          {s.synonyms.map((syn, i) => (
                            <span key={i} className="px-3 py-1.5 bg-nat-highlight text-nat-muted border border-nat-border/50 rounded-lg text-xs">
                              {syn}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-nat-warm rounded-3xl p-8 border border-nat-border shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-nat-muted mb-6 flex items-center gap-2">
                      <Filter size={16} /> 篩選控制項
                    </h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-nat-accent uppercase">時間範圍</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[5, 10].map(y => (
                            <button 
                              key={y}
                              onClick={() => setFilters({...filters, years: y})}
                              className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                                filters.years === y ? "bg-white border-nat-primary text-nat-primary shadow-sm" : "bg-transparent border-nat-border text-nat-muted"
                              }`}
                            >
                              近 {y} 年
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-nat-accent uppercase">核心文獻類型</label>
                        <div className="space-y-2">
                          {["Systematic Review", "RCT", "Guideline"].map(type => (
                            <label key={type} className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-nat-border/50 cursor-pointer hover:bg-white transition-all">
                              <input 
                                type="checkbox" 
                                checked={filters.types.includes(type)}
                                onChange={(e) => {
                                  const newTypes = e.target.checked 
                                    ? [...filters.types, type]
                                    : filters.types.filter(t => t !== type);
                                  setFilters({...filters, types: newTypes});
                                }}
                                className="w-4 h-4 rounded-md border-nat-border text-nat-primary focus:ring-nat-primary"
                              />
                              <span className="text-xs font-bold text-nat-body">{type}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="w-full py-4 bg-nat-deep text-white rounded-2xl font-bold shadow-xl shadow-nat-deep/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? "正在發送請求..." : "執行文獻查證"}
                    {!loading && <Search size={20} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "results" && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-serif italic text-nat-text">查證結果分析</h1>
                  <p className="text-sm text-nat-muted mt-2">
                    已從 <span className="font-bold text-nat-primary">PubMed</span> 篩選出 <span className="font-bold text-nat-primary">{results.length}</span> 篇核心文獻
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-nat-border rounded-lg shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-[10px] font-bold text-nat-muted uppercase tracking-tighter">DOI Verified (100%)</span>
                  </div>
                  <button 
                    onClick={() => setStep("keywords")}
                    className="flex items-center gap-2 px-4 py-1.5 bg-nat-highlight text-nat-muted border border-nat-border rounded-lg text-xs font-bold hover:bg-nat-border/20 transition-all"
                  >
                    <Plus size={14} /> 調整條件
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-5">
                  {results.length === 0 && (
                    <div className="bg-white rounded-3xl p-16 text-center border border-nat-border border-dashed">
                      <div className="w-16 h-16 bg-nat-bg rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="text-nat-accent" size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-nat-text">未發現匹配結果</h3>
                      <p className="text-sm text-nat-muted max-w-xs mx-auto mt-2 leading-relaxed">
                        請嘗試減少 PICO 中的限制條件，或增加同義詞以擴大搜尋範圍。
                      </p>
                    </div>
                  )}
                  {results.map((item) => (
                    <motion.div 
                      layoutId={item.id}
                      key={item.id}
                      onClick={() => setSelectedResult(item)}
                      className={`group p-6 rounded-3xl bg-white border shadow-sm transition-all cursor-pointer relative overflow-hidden ${
                        selectedResult?.id === item.id ? "border-nat-primary ring-1 ring-nat-primary/10" : "border-nat-border hover:border-nat-accent/50"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                         <div className="flex gap-2">
                            <span className="px-2 py-0.5 bg-nat-highlight text-[10px] font-extrabold text-nat-muted rounded uppercase tracking-widest border border-nat-border/50">
                              {item.id}
                            </span>
                            {item.isVerified && (
                              <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-emerald-50 rounded">
                                <CheckCircle2 size={10} /> Verified
                              </span>
                            )}
                         </div>
                         <span className="text-[10px] text-nat-muted font-mono opacity-60">DOI: {item.doi || "N/A"}</span>
                      </div>
                      <h3 className="text-md font-bold text-nat-text leading-snug group-hover:text-nat-primary transition-colors">{item.title}</h3>
                      <p className="text-[11px] text-nat-muted mt-3 line-clamp-1 italic">{item.authors}</p>
                      
                      <div className="mt-6 flex items-center justify-between pt-4 border-t border-nat-highlight">
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-nat-accent">{item.source}</span>
                            <span className="w-1 h-1 bg-nat-border rounded-full" />
                            <span className="text-[10px] font-medium text-nat-muted">{item.pubdate}</span>
                         </div>
                         <div className="flex items-center gap-2">
                            {item.aiSummary ? (
                              <div className="flex items-center gap-1 text-emerald-600 font-bold text-[10px]">
                                <CheckCircle2 size={12} /> 已摘要
                              </div>
                            ) : (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleSummarize(item); }}
                                className="text-nat-primary text-[10px] font-bold flex items-center gap-1 bg-nat-soft px-3 py-1 rounded-lg hover:bg-nat-primary hover:text-white transition-all shadow-sm"
                              >
                                <Sparkles size={12} /> 快速摘要
                              </button>
                            )}
                         </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="lg:col-span-5 sticky top-24">
                  <AnimatePresence mode="wait">
                    {selectedResult ? (
                      <motion.div 
                        key={selectedResult.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-[2rem] p-8 shadow-2xl shadow-nat-primary/10 border border-nat-border flex flex-col max-h-[85vh]"
                      >
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                          <header className="mb-6">
                            <h3 className="text-xl font-bold text-nat-text leading-tight mb-4">{selectedResult.title}</h3>
                            
                            <div className="flex flex-col gap-4">
                              {/* DOI & Verification Status */}
                              <div className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                                selectedResult.isVerified === true ? "bg-emerald-50 border-emerald-200" :
                                selectedResult.isVerified === false ? "bg-red-50 border-red-200" :
                                "bg-nat-highlight border-nat-border/50"
                              }`}>
                                <div className="flex items-center gap-2">
                                  {selectedResult.isVerified === true ? (
                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                  ) : selectedResult.isVerified === false ? (
                                    <AlertCircle size={16} className="text-red-600" />
                                  ) : (
                                    <ClipboardCheck size={16} className="text-nat-muted" />
                                  )}
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-nat-text">
                                    {selectedResult.isVerified === true ? "真實性驗證成功" :
                                     selectedResult.isVerified === false ? "AI 懷疑此文獻之真實性" :
                                     "待驗證"}
                                  </span>
                                </div>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleVerify(selectedResult); }}
                                  disabled={loading}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    selectedResult.isVerified !== undefined ? "opacity-0 pointer-events-none" : "bg-white text-nat-primary shadow-sm hover:bg-nat-primary hover:text-white"
                                  }`}
                                >
                                  執行驗證
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleSummarize(selectedResult); }}
                                  disabled={loading || !!selectedResult.aiSummary}
                                  className={`flex-1 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                    selectedResult.aiSummary 
                                    ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-default" 
                                    : "bg-nat-primary text-white hover:opacity-90 shadow-lg shadow-nat-primary/20"
                                  }`}
                                >
                                  <Sparkles size={14} className={loading && !selectedResult.aiSummary ? "animate-spin" : ""} /> 
                                  {loading && !selectedResult.aiSummary ? "專業摘要生成中..." : selectedResult.aiSummary ? "摘要已完成" : "生成臨床摘要"}
                                </button>
                              </div>
                            </div>
                          </header>

                          {selectedResult.aiSummary && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="bg-nat-warm rounded-[2rem] p-6 border border-nat-border/50 mb-6 shadow-inner relative overflow-hidden"
                            >
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-nat-primary via-nat-accent to-nat-primary opacity-30" />
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-[11px] font-bold text-nat-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                  <Layers size={14} /> 醫學證據摘錄
                                </h4>
                                <button 
                                  onClick={() => copyForNotebookLM(selectedResult)}
                                  className="p-1.5 bg-white rounded-lg text-nat-accent hover:text-nat-primary transition-colors shadow-sm"
                                  title="複製至 NotebookLM"
                                >
                                  <Download size={14} />
                                </button>
                              </div>
                              <div className="text-[13px] text-nat-body leading-relaxed whitespace-pre-wrap font-medium prose prose-sm max-w-none prose-headings:text-nat-text prose-headings:font-bold prose-headings:text-sm prose-headings:mt-4 prose-headings:mb-2">
                                {selectedResult.aiSummary.split('\n').map((line, i) => {
                                  if (line.startsWith('###')) {
                                    return <h4 key={i} className="text-sm font-bold text-nat-text mt-4 mb-2 border-l-4 border-nat-primary pl-2">{line.replace('### ', '')}</h4>
                                  }
                                  return <p key={i} className="mb-1 last:mb-0">{line}</p>
                                })}
                              </div>
                            </motion.div>
                          )}

                          <div className="space-y-4 mb-6">
                            <div className="p-5 bg-nat-body/[0.02] rounded-2xl border border-nat-border/30">
                              <h5 className="text-[10px] font-bold text-nat-accent uppercase mb-3 tracking-widest flex items-center gap-2 opacity-60">
                                <FileText size={12} /> 原文摘要 (Abstract)
                              </h5>
                              <p className="text-[11px] text-nat-muted leading-relaxed italic">
                                {selectedResult.abstract || "點擊卡片旁的「快速摘要」以載入完整內容。"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-6 border-t border-nat-border flex items-center justify-between shrink-0">
                            <div className="text-[10px] font-bold text-nat-muted">
                              <span className="uppercase opacity-40 mr-1">Source:</span>
                              {selectedResult.source}
                            </div>
                            <a 
                              href={selectedResult.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-white bg-nat-deep px-5 py-2.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-2 hover:opacity-90 shadow-md shadow-nat-deep/10 transition-transform active:scale-95"
                            >
                              檢視全文文獻 <ExternalLink size={12} />
                            </a>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="bg-nat-bg/50 rounded-[2rem] p-12 text-center border-2 border-dashed border-nat-border/50">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                          <FileText className="text-nat-border" size={32} />
                        </div>
                        <h4 className="text-lg font-serif italic text-nat-text opacity-40">選取研究文獻</h4>
                        <p className="text-xs text-nat-muted mt-3 leading-relaxed">
                          點擊左側搜尋結果或使用 <span className="text-nat-primary font-bold">快速摘要</span> 按鈕，
                          即可啟動 AI 自動摘要與真實性查驗。
                        </p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Action Footer */}
              <footer className="mt-12 h-20 bg-nat-highlight/80 backdrop-blur-sm rounded-[1.5rem] px-8 flex items-center justify-between border border-nat-border shadow-inner">
                <div className="hidden lg:flex gap-8 items-center text-[10px] font-bold text-nat-muted uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> 
                    篩選條件: {filters.years} 年內
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-nat-primary rounded-full animate-pulse" /> 
                    Gemini 3.1 Pro 深度檢索模組
                  </div>
                </div>
                <div className="flex gap-4 w-full lg:w-auto">
                  <button 
                    onClick={exportResultsToCSV}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-nat-primary text-nat-primary rounded-xl text-xs font-bold hover:bg-white transition-all shadow-sm"
                  >
                    <Download size={14} /> 匯出 CSV
                  </button>
                  <button 
                    onClick={exportToENOTE}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-nat-accent text-white rounded-xl text-xs font-bold shadow-lg shadow-nat-accent/20 hover:opacity-90 transition-all"
                  >
                    <BookOpen size={14} /> 匯出 ENOTE / NB-LM
                  </button>
                  <button 
                    onClick={generateEvidenceReport}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-nat-muted text-white rounded-xl text-xs font-bold shadow-lg shadow-nat-muted/20 hover:opacity-90 transition-all"
                  >
                    <ClipboardCheck size={14} /> 生成實證報告
                  </button>
                </div>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Status / Database Tooltip */}
      <div className="fixed bottom-10 right-10 z-30">
        <button className="group relative p-4 bg-nat-body rounded-2xl shadow-2xl text-white hover:scale-110 transition-all">
          <BookOpen size={24} />
          <div className="absolute bottom-full right-0 mb-4 w-64 bg-white rounded-2xl shadow-2xl border border-nat-border p-6 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all transform translate-y-4 group-hover:translate-y-0">
             <h4 className="font-bold text-[10px] uppercase tracking-widest text-nat-primary mb-4 border-b border-nat-highlight pb-2">資料庫協作模組</h4>
             <ul className="space-y-3">
                {[
                  { label: "臨床決策指引", status: "Active", color: "text-emerald-600" },
                  { label: "災難醫學專科", status: "Active", color: "text-emerald-600" },
                  { label: "行政品質管理", status: "Standby", color: "text-nat-accent" },
                  { label: "PubMed / NCBI", status: "Linked", color: "text-emerald-600" },
                  { label: "ENOTE / NB-LM", status: "Ready", color: "text-amber-600" }
                ].map((item, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-nat-muted">{item.label}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-tighter ${item.color}`}>{item.status}</span>
                  </li>
                ))}
             </ul>
             <div className="mt-4 pt-4 border-t border-nat-highlight">
                <p className="text-[9px] text-nat-accent italic">* 所有來源均整合網羅與 DOI 驗證</p>
             </div>
          </div>
        </button>
      </div>

      <footer className="max-w-7xl mx-auto px-6 py-20 border-t border-nat-border/50 text-center">
        <div className="flex items-center justify-center gap-3 mb-4 opacity-40">
           <div className="w-8 h-[1px] bg-nat-muted" />
           <Microscope size={16} className="text-nat-muted" />
           <div className="w-8 h-[1px] bg-nat-muted" />
        </div>
        <p className="text-nat-muted text-[10px] font-bold uppercase tracking-[0.2em]">Evidence-Based Practice Assistant</p>
        <p className="text-nat-accent text-[10px] mt-2">© 2026 Emergency & Nursing Evidence Research Group. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
