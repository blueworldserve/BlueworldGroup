import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { ENDPOINTS, fetchAuthedBlob } from "@/lib/api";

type State =
  | { kind: "loading" }
  | { kind: "pdf"; url: string }
  | { kind: "docx"; html: string }
  | { kind: "message"; text: string };

/**
 * Shows a resume on screen so HR doesn't have to download it first.
 *  - PDF: the browser's own viewer.
 *  - DOCX: converted in the browser and shown inside a locked-down frame (no scripts can run in it).
 *  - Old .doc: browsers can't show these, so we say so and point at Download.
 */
export function ResumePreview({ applicationId, filename }: { applicationId: string; filename: string | null }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!filename) {
      setState({ kind: "message", text: "No resume was attached to this application." });
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    const ext = filename.toLowerCase().split(".").pop();

    (async () => {
      try {
        if (ext === "doc") {
          setState({ kind: "message", text: "Older Word files (.doc) can't be previewed in the browser. Use Download to open it." });
          return;
        }
        const blob = await fetchAuthedBlob(`${ENDPOINTS.adminApplications}/${applicationId}/resume?view=1`);
        if (cancelled) return;
        if (ext === "pdf") {
          objectUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
          setState({ kind: "pdf", url: objectUrl });
        } else {
          const { renderAsync } = await import("docx-preview");
          // Render off-screen, then show the result in a sandboxed frame so nothing inside the
          // document can ever run code in the CMS. Images are inlined so the frame can show them.
          const holder = document.createElement("div");
          holder.style.cssText = "position:fixed;left:-10000px;top:0;width:900px";
          document.body.appendChild(holder);
          try {
            await renderAsync(blob, holder, holder, { inWrapper: true, useBase64URL: true, breakPages: true });
            if (!cancelled) setState({ kind: "docx", html: holder.innerHTML });
          } finally {
            holder.remove();
          }
        }
      } catch {
        if (!cancelled) setState({ kind: "message", text: "We couldn't show a preview of this file. Use Download to open it." });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [applicationId, filename]);

  if (state.kind === "loading") {
    return (
      <div className="grid h-full min-h-[320px] place-items-center text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading resume…
        </span>
      </div>
    );
  }
  if (state.kind === "message") {
    return (
      <div className="grid h-full min-h-[320px] place-items-center p-6 text-center">
        <div className="max-w-xs">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{state.text}</p>
        </div>
      </div>
    );
  }
  if (state.kind === "pdf") {
    return <iframe src={state.url} title="Resume" className="h-full min-h-[60vh] w-full rounded-lg border border-border bg-white" />;
  }
  return (
    <iframe
      title="Resume"
      sandbox=""
      srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#e5e7eb}.docx-wrapper{padding:12px!important}</style></head><body>${state.html}</body></html>`}
      className="h-full min-h-[60vh] w-full rounded-lg border border-border bg-white"
    />
  );
}