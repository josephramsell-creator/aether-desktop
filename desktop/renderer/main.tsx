import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { StudioApp } from "@/components/studio/StudioApp";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@/styles.css";

const root = document.getElementById("app");
if (!root) throw new Error("Aether desktop shell is missing #app.");

createRoot(root).render(
  <StrictMode>
    <StudioApp />
    <Toaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: "#1c1a17",
          border: "1px solid #2a2722",
          color: "#f3eee4",
        },
      }}
    />
  </StrictMode>,
);
