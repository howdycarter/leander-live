import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

function MissingConfig() {
  return (
    <div className="page">
      <header className="site-header">
        <div className="site-header-inner">
          <a className="brand" href="#top" aria-label="Leander Live home">
            <img src="/brand/logo-mark.png" alt="Leander Live logo" />
            <span>
              <span className="wordmark">Leander Live</span>
              <span className="tagline">Events. People. A Stronger Leander.</span>
            </span>
          </a>
        </div>
      </header>
      <section className="section">
        <div className="form-card">
          <h3>Backend not connected yet</h3>
          <p className="section-lead">
            <code>VITE_CONVEX_URL</code> is not set. Run{" "}
            <code>npx convex dev</code> once, then restart the dev server.
          </p>
        </div>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {convexUrl ? (
      <ConvexAuthProvider client={new ConvexReactClient(convexUrl)}>
        <App />
      </ConvexAuthProvider>
    ) : (
      <MissingConfig />
    )}
  </React.StrictMode>,
);
