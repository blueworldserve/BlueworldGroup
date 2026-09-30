/**
 * Works out how a hero slide's `videoUrl` should be played.
 *  - "file":      a direct mp4/webm/mov link, a Cloudinary video, or an uploaded video -> <video>
 *  - "youtube":   watch / youtu.be / shorts / live / embed links -> autoplaying background iframe
 *  - "instagram": post / reel / tv links -> click-to-play embed (Instagram has no autoplay embed)
 */
export type VideoSource =
  | { kind: "file"; src: string }
  | { kind: "youtube"; id: string }
  | { kind: "instagram"; embedUrl: string };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const IG_CODE = /^[A-Za-z0-9_-]+$/;

export function parseVideoUrl(raw: string | null | undefined): VideoSource | null {
  const value = raw?.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^www\.|^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  // ---- YouTube ----
  if (host === "youtu.be") {
    const id = parts[0] ?? "";
    return YT_ID.test(id) ? { kind: "youtube", id } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id =
      url.searchParams.get("v") ??
      (["embed", "shorts", "live", "v"].includes(parts[0] ?? "") ? parts[1] : undefined) ??
      "";
    return YT_ID.test(id) ? { kind: "youtube", id } : null;
  }

  // ---- Instagram: /p/CODE, /reel/CODE, /tv/CODE, and the /username/reel/CODE form ----
  if (host === "instagram.com" || host === "instagr.am") {
    if (parts[0] === "share") return null; // share links can't be embedded; the real post link is needed
    const i = parts.findIndex((p) => ["p", "reel", "reels", "tv"].includes(p));
    const code = i >= 0 ? parts[i + 1] : undefined;
    if (code && IG_CODE.test(code)) {
      const type = parts[i] === "reels" ? "reel" : parts[i];
      return { kind: "instagram", embedUrl: `https://www.instagram.com/${type}/${code}/embed/` };
    }
    return null;
  }

  // ---- Cloudinary: only VIDEO assets (an image link pasted here shouldn't be played as video) ----
  if (host.endsWith("cloudinary.com")) {
    return url.pathname.includes("/video/") ? { kind: "file", src: value } : null;
  }

  // ---- Any other direct video file ----
  if (/\.(mp4|webm|mov|m4v)$/i.test(url.pathname)) return { kind: "file", src: value };

  return null;
}

export function youtubeBackgroundUrl(id: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    loop: "1",
    playlist: id, // required for loop to work
    playsinline: "1",
    modestbranding: "1",
    rel: "0",
    disablekb: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}