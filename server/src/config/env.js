const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

module.exports = {
  port: process.env.PORT || 3001,
  auth0: {
    audience: process.env.AUTH0_AUDIENCE,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  uploadsDir: path.resolve(__dirname, "../../uploads"),
};
