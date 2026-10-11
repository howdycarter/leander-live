import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import { GuidePage } from "./GuidePage";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {convexUrl && import.meta.env.VITE_ENABLE_FULL_APP === "true" ? (
      <ConvexProvider client={new ConvexReactClient(convexUrl)}>
        <App />
      </ConvexProvider>
    ) : (
      <GuidePage path={window.location.pathname} />
    )}
  </React.StrictMode>,
);
