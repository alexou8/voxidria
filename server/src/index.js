const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const config = require("./config/env");

const healthRoutes = require("./routes/health");
const voiceRoutes = require("./routes/voice");

const app = express();

// Security and logging
app.use(helmet());
app.use(morgan("dev"));

// CORS — allow the Vite dev server and production origins
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);

app.use(express.json());

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/voice", voiceRoutes);

// Serve the built client in production
const clientBuild = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientBuild));
app.get("*", (_req, res, next) => {
  if (_req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientBuild, "index.html"));
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({ error: "Invalid or missing token" });
  }
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`Voxidria server listening on port ${config.port}`);
});
