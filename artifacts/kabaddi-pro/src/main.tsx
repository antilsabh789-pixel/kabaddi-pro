import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installApiFetchInterceptor } from "./lib/apiBase";

installApiFetchInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
