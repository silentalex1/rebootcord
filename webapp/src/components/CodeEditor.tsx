import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import type { Extension } from "@codemirror/state";

function extensionFor(filename: string): Extension[] {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["js", "mjs", "cjs", "jsx"].includes(ext)) return [javascript({ jsx: ext === "jsx" })];
  if (["ts", "tsx"].includes(ext)) return [javascript({ jsx: ext === "tsx", typescript: true })];
  if (ext === "py") return [python()];
  if (["html", "htm"].includes(ext)) return [html()];
  if (ext === "css") return [css()];
  if (ext === "json") return [json()];
  if (["md", "markdown"].includes(ext)) return [markdown()];
  return [];
}

export function CodeEditor({
  filename,
  value,
  onChange,
  readOnly,
}: {
  filename: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={vscodeDark}
      extensions={extensionFor(filename)}
      onChange={onChange}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
      }}
      style={{ height: "100%" }}
    />
  );
}
