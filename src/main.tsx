import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

function MissingConfig() {
  return (
    <div className="page">
      <header className="hero">
        <h1>Leander Live</h1>
        <p>What's happening in Leander, TX.</p>
      </header>
      <main className="feed">
        <div className="card">
          <h2>Backend not connected yet</h2>
          <p>
            <code>VITE_CONVEX_URL</code> is not set. Run{" "}
            <code>npx convex dev</code> once, then restart the dev server.
          </p>
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {convexUrl ? (
      <ConvexProvider client={new ConvexReactClient(convexUrl)}>
        <App />
      </ConvexProvider>
    ) : (
      <MissingConfig />
    )}
  </React.StrictMode>,
);
