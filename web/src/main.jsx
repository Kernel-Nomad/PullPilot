import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./App.jsx";
import "./index.css";
import "./i18n";

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("Nueva version disponible. Recargar?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("App lista para trabajar offline");
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
