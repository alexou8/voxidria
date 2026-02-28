import { Auth0Provider } from "@auth0/auth0-react";
import { useRouter } from "next/router";

export default function App({ Component, pageProps }) {
  const router = useRouter();

  return (
    <Auth0Provider
      domain="alexou.ca.auth0.com"
      clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || "YOUR_CLIENT_ID"}
      authorizationParams={{ redirect_uri: typeof window !== "undefined" ? window.location.origin : "" }}
      onRedirectCallback={(appState) => router.push(appState?.returnTo || "/dashboard")}
    >
      <Component {...pageProps} />
    </Auth0Provider>
  );
}








