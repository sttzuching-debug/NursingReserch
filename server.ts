import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

async function startServer() {
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // Proxy to PubMed API
  // ... (API routes same as before) ...
  app.get("/api/search", async (req, res) => {
    try {
      const { q, retmax = 10 } = req.query;
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q as string)}&retmax=${retmax}&retmode=json`;
      
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      const ids = searchData.esearchresult.idlist;

      if (!ids || ids.length === 0) {
        return res.json({ results: [] });
      }

      // Fetch summaries for these IDs
      const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
      const summaryRes = await fetch(summaryUrl);
      const summaryData = await summaryRes.json();

      const results = ids.map((id: string) => {
        const item = summaryData.result[id];
        // Extract DOI
        const doi = item.articleids?.find((aid: any) => aid.idtype === "doi")?.value || "";
        return {
          id,
          title: item.title,
          authors: item.authors?.map((a: any) => a.name).join(", "),
          source: item.source,
          pubdate: item.pubdate,
          doi,
          url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${id}/`
        };
      });

      res.json({ results });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Failed to search PubMed" });
    }
  });

  // Fetch full details / abstract for a specific ID
  app.get("/api/details/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const detailUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${id}&retmode=text&rettype=abstract`;
      const detailRes = await fetch(detailUrl);
      const abstract = await detailRes.text();
      res.json({ abstract });
    } catch (error) {
      console.error("Details error:", error);
      res.status(500).json({ error: "Failed to fetch details" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Only listen if not on Vercel (where it's treated as a serverless function)
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
