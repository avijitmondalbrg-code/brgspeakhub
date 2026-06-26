import express from "express";
import path from "path";
import fs from "fs";
import https from "https";
import { createServer as createViteServer } from "vite";

// Read Firebase configurations dynamically
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (err) {
  console.error("Failed to read firebase-applet-config.json in server.ts:", err);
}

const projectId = firebaseConfig.projectId || "";
const databaseId = firebaseConfig.firestoreDatabaseId || "";

/**
 * Checks Firestore REST API to verify if the document exists in therapyPlans collection
 */
function checkFirestoreDocument(reportId: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!projectId || !databaseId) {
      console.error("Missing Firestore project ID or database ID configuration. Cannot verify document.");
      resolve(false);
      return;
    }

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/therapyPlans/${reportId}`;
    console.log(`Backend checking Firestore for report ID: ${reportId}`);

    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            if (parsed && parsed.name) {
              console.log(`Backend confirmed report ID ${reportId} exists in Firestore.`);
              resolve(true);
            } else {
              console.log(`Backend: Report ID ${reportId} returned 200 but response structure was invalid.`);
              resolve(false);
            }
          } catch (e) {
            console.log(`Backend: Report ID ${reportId} exists but JSON parsing failed:`, e);
            resolve(true); // Treat as exists if status was 200
          }
        } else {
          console.log(`Backend: Report ID ${reportId} does not exist in Firestore (HTTP Status ${res.statusCode}).`);
          resolve(false);
        }
      });
    }).on("error", (err) => {
      console.error(`Backend: Error fetching Firestore document for ID ${reportId}:`, err);
      resolve(false);
    });
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Support client-side routing for /report and /report?id=...
  app.get("/report", async (req, res, next) => {
    const reportId = req.query.id as string | undefined;
    console.log("Report ID:", reportId);

    if (!reportId) {
      console.warn("Report ID is missing from request. Returning 404.");
      res.status(404).send("Report Not Found / রিপোর্ট আইডি অনুপস্থিত।");
      return;
    }

    // Direct, unauthenticated verification of Firestore document existence
    const exists = await checkFirestoreDocument(reportId);

    if (!exists) {
      res.status(404).send("Report Not Found / রিপোর্টটি খুঁজে পাওয়া যায়নি বা মুছে ফেলা হয়েছে।");
      return;
    }

    // If document is found, serve the client SPA to render the report correctly
    if (process.env.NODE_ENV !== "production") {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      req.url = "/" + urlObj.search;
      next();
    } else {
      const distPath = path.join(process.cwd(), "dist");
      res.sendFile(path.join(distPath, "index.html"));
    }
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite live middleware.");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode with static build assets.");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical error starting Express server:", err);
  process.exit(1);
});
