import { render } from "preact";
import { App } from "./app";
import { initAuth } from "./state/auth-actions";
import "./style.css";

initAuth();
render(<App />, document.getElementById("app")!);
