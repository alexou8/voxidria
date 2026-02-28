import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App";
import "./index.css";

// Strip any protocol prefix — Auth0Provider expects a bare domain (e.g. "alexou.ca.auth0.com")
const rawDomain = import.meta.env.VITE_AUTH0_DOMAIN || "";
const domain = rawDomain.replace(/^https?:\/\//, "");
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Auth0Provider
        domain={domain || "YOUR_AUTH0_DOMAIN"}
        clientId={clientId || "YOUR_AUTH0_CLIENT_ID"}
        authorizationParams={{
          redirect_uri: window.location.origin,
          audience: audience || "voxidria",
        }}
      >
        <App />
      </Auth0Provider>
    </BrowserRouter>
  </React.StrictMode>
);
