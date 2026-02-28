const { auth } = require("express-oauth2-jwt-bearer");
const config = require("../config/env");

let _verifier = null;

function checkJwt(req, res, next) {
  if (!config.auth0.issuerBaseURL) {
    return res
      .status(500)
      .json({ error: "Server misconfiguration: AUTH0_ISSUER_BASE_URL is not set" });
  }
  if (!_verifier) {
    _verifier = auth({
      audience: config.auth0.audience,
      issuerBaseURL: config.auth0.issuerBaseURL,
    });
  }
  return _verifier(req, res, next);
}

module.exports = { checkJwt };
