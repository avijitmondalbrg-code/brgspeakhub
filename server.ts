import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getApp } from "firebase-admin/app";
import fs from "fs";

// Initialize Firebase Admin with our applet configurations
const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

admin.initializeApp({
  projectId: firebaseConfig.projectId,
});
const db = getFirestore(getApp(), firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Admin authentication token (stateless for simplicity)
  const ADMIN_TOKEN = "admin-session-token-9830447176";

  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "9830447176") {
      res.json({
        success: true,
        token: ADMIN_TOKEN,
        user: {
          email: "admin@brgspeakhub.com",
          displayName: "System Administrator",
          uid: "admin-system-uid"
        }
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid admin credentials." });
    }
  });

  // Admin authorize middleware
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${ADMIN_TOKEN}`) {
      next();
    } else {
      res.status(403).json({ success: false, message: "Unauthorized. Admin access required." });
    }
  };

  // Get all therapy plans
  app.get("/api/admin/plans", requireAdmin, async (req, res) => {
    try {
      const snapshot = await db.collection("therapyPlans").get();
      const plans: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Format timestamps to ISO strings
        const createdAt = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null;
        const updatedAt = data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt) : null;
        plans.push({
          id: doc.id,
          ...data,
          createdAt,
          updatedAt
        });
      });
      
      // Sort plans in-memory (descending by createdAt or date)
      plans.sort((a, b) => {
        const dateA = a.createdAt || a.date || "";
        const dateB = b.createdAt || b.date || "";
        return dateB.localeCompare(dateA);
      });

      res.json({ success: true, plans });
    } catch (error: any) {
      console.error("Failed to fetch admin plans:", error);
      let friendlyMessage = error.message;
      if (error.message && (error.message.includes("PERMISSION_DENIED") || error.code === 7)) {
        friendlyMessage = "GCP Service Account lacks IAM cross-project permissions to access database 'ai-studio-b65bcc54-5bc5-490f-b5a1-3fdede15e319'. Please use your Google Sign-In account (avijitmondal.brg@gmail.com) directly on the client to securely fetch and manage clinical database records.";
      }
      res.status(500).json({ success: false, message: friendlyMessage });
    }
  });

  // Delete a therapy plan
  app.delete("/api/admin/plans/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection("therapyPlans").doc(id).delete();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete admin plan:", error);
      let friendlyMessage = error.message;
      if (error.message && (error.message.includes("PERMISSION_DENIED") || error.code === 7)) {
        friendlyMessage = "GCP Service Account lacks IAM cross-project permissions to access database 'ai-studio-b65bcc54-5bc5-490f-b5a1-3fdede15e319'. Please use your Google Sign-In account (avijitmondal.brg@gmail.com) directly on the client to securely delete clinical database records.";
      }
      res.status(500).json({ success: false, message: friendlyMessage });
    }
  });

  // Update a therapy plan
  app.put("/api/admin/plans/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      const payload = {
        ...data,
        updatedAt: FieldValue.serverTimestamp()
      };
      
      if (payload.createdAt) {
        payload.createdAt = new Date(payload.createdAt);
      }

      await db.collection("therapyPlans").doc(id).set(payload, { merge: true });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to update admin plan:", error);
      let friendlyMessage = error.message;
      if (error.message && (error.message.includes("PERMISSION_DENIED") || error.code === 7)) {
        friendlyMessage = "GCP Service Account lacks IAM cross-project permissions to access database 'ai-studio-b65bcc54-5bc5-490f-b5a1-3fdede15e319'. Please use your Google Sign-In account (avijitmondal.brg@gmail.com) directly on the client to securely update clinical database records.";
      }
      res.status(500).json({ success: false, message: friendlyMessage });
    }
  });

  // Support client-side routing for /report and /report?id=...
  app.get("/report", (req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
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
