import { GoogleGenAI, Type } from "@google/genai";
import { PICOData, KeywordSuggestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

// Use Gemini 3.1 Pro for complex reasoning tasks
const PRO_MODEL = "gemini-3.1-pro-preview";
const FLASH_MODEL = "gemini-3.1-flash-lite";

export async function generatePICOFromScenario(scenario: string): Promise<PICOData> {
  const prompt = `
    As an expert evidence-based nursing (EBN) consultant, perform a deep analysis of the following clinical scenario to extract precise PICO components.
    
    Guidelines:
    - P: Specificity matters (Age, condition, setting).
    - I: Identify the primary intervention or diagnostic tool.
    - C: If not stated, infer the "Standard of Care" or "Usual Practice".
    - O: Focus on measurable clinical outcomes (e.g., mortality, cost, quality of life).
    
    Scientific accuracy and professional terminology are mandatory.
    
    Scenario: ${scenario}
    
    P (Population): Who are the patients or what is the problem?
    I (Intervention): What is the main intervention or treatment being considered?
    C (Comparison): Is there an alternative treatment or control group?
    O (Outcome): What is the clinical result or effect you want to measure?
    
    Return the result as a JSON object with keys: p, i, c, o.
  `;

  const response = await ai.models.generateContent({
    model: PRO_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          p: { type: Type.STRING },
          i: { type: Type.STRING },
          c: { type: Type.STRING },
          o: { type: Type.STRING },
        },
        required: ["p", "i", "c", "o"],
      },
    },
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse PICO from scenario", e);
    return { p: "", i: "", c: "", o: "" };
  }
}

export async function expandKeywords(pico: PICOData): Promise<KeywordSuggestion[]> {
  const prompt = `
    As a Senior Medical Librarian and Clinical Infromaticist, refine and expand the following PICO components into a high-sensitivity search strategy.
    
    Guidelines:
    1. Identify exact MeSH (Medical Subject Headings) terms.
    2. Provide specialized clinical synonyms, abbreviations (e.g., 'RN', 'ICU'), and variants.
    3. Optimization: Ensure terms cover both high sensitivity (relevant results) and specificity (precision).
    4. Compliance: Terminology must strictly adhere to NLM/PubMed and Cochrane Library standards.
    
    P (Population): ${pico.p}
    I (Intervention): ${pico.i}
    C (Comparison): ${pico.c}
    O (Outcome): ${pico.o}
    
    Return a JSON array of 4 objects corresponding to P, I, C, and O.
  `;

  const response = await ai.models.generateContent({
    model: PRO_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            original: { type: Type.STRING },
            synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
            meshTerms: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["original", "synonyms", "meshTerms"],
        }
      },
    },
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
}

export async function summarizeArticle(title: string, abstract: string): Promise<string> {
  const prompt = `
    As a professional evidence-based practice (EBP) nursing consultant, provide a structured summary of the following medical literature abstract.
    
    Structure your response exactly with these headers in Traditional Chinese:
    ### 🔬 研究設計 (Study Design)
    (Describe context, methods, and design)
    
    ### 🔑 核心發現 (Key Findings)
    (List major results and data points)
    
    ### 🏥 臨床應用 (Clinical Implications)
    (How to apply this in practice or policy)

    Title: ${title}
    Abstract: ${abstract}
  `;

  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: prompt,
    config: {
      systemInstruction: "You are a professional evidence-based practice nursing consultant. Always provide structured, high-quality clinical summaries.",
    }
  });

  return response.text || "無法生成摘要。";
}

export async function verifyArticle(title: string, doi: string): Promise<boolean> {
  const prompt = `
    Check if the following paper metadata is likely authentic or a hallucination.
    Provide a simple "true" for real or "false" for suspicious.
    
    Title: ${title}
    DOI: ${doi}
  `;

  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.BOOLEAN }
    }
  });

  return response.text === "true";
}
