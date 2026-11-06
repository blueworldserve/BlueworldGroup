/**
 * Manual image-replacement layer.
 *
 * Every placeholder image on the site resolves through this map. To swap an
 * image WITHOUT the backend running, drop a new file into `src/assets/` and
 * point the matching key below at it — nothing else needs to change.
 */
import heroFactory from "@/assets/hero-factory.png";
import heroBeauty from "@/assets/hero-beauty.jpg";
import heroProducts from "@/assets/hero-products.png";
import unitVivon from "@/assets/unit-vivon.jpg";
import unitBlueCrystal from "@/assets/unit-bluecrystal.jpg";
import unitBlowRight from "@/assets/unit-blowright.jpg";
import unitBlueFragrance from "@/assets/unit-bluefragrance.jpg";
import unitBlueWorld from "@/assets/unit-blueworld.jpg";
import vivonFace from "@/assets/vivon-face.jpg";
import vivonBody from "@/assets/vivon-body.jpg";
import vivonChildren from "@/assets/vivon-children.jpg";
import aboutStory from "@/assets/about-story.jpg";
import blogIngredients from "@/assets/blog-ingredients.png";
import blogExport from "@/assets/blog-export.jpg";
import blogQuality from "@/assets/blog-quality.jpg";
import team1 from "@/assets/team-1.jpg";
import team2 from "@/assets/team-2.jpg";
import team3 from "@/assets/team-3.jpg";
import team4 from "@/assets/team-4.jpg";

export const LOCAL_IMAGES = {
  "hero.factory": heroFactory,
  "hero.beauty": heroBeauty,
  "hero.products": heroProducts,
  "unit.vivon": unitVivon,
  "unit.bluecrystal": unitBlueCrystal,
  "unit.blow-right": unitBlowRight,
  "unit.bluefragrance": unitBlueFragrance,
  "unit.blueworld-cosmetics": unitBlueWorld,
  "vivon.face": vivonFace,
  "vivon.body": vivonBody,
  "vivon.children": vivonChildren,
  "about.story": aboutStory,
  "blog.ingredients": blogIngredients,
  "blog.export": blogExport,
  "blog.quality": blogQuality,
  "team.1": team1,
  "team.2": team2,
  "team.3": team3,
  "team.4": team4,
} as const;

export type LocalImageKey = keyof typeof LOCAL_IMAGES;

/** Resolves a CMS image value: a local key, or a remote URL from the backend. */
export function resolveImage(value: string, width = 1600): string {
  if (value in LOCAL_IMAGES) return LOCAL_IMAGES[value as LocalImageKey];
  // A bare file name (no scheme, no slash) is a typo-style value such as "vivon-face-hero.jpg".
  // Browsers would look for it under the current page (/business/...) and 404, so map it to the
  // matching local key ("vivon.face") when there is one, and otherwise anchor it to the site root.
  if (value && !/^(https?:)?\/\//.test(value) && !value.startsWith("/") && !value.startsWith("data:") && !value.startsWith("blob:")) {
    const key = value.replace(/\.[a-z0-9]+$/i, "").replace(/-hero$/i, "").replace(/-/g, ".");
    if (key in LOCAL_IMAGES) return LOCAL_IMAGES[key as LocalImageKey];
    return `/${value}`;
  }
  return optimizeCloudinary(value, width);
}

/** Cloudinary: ask for auto format (WebP/AVIF), auto quality and a capped width. Other URLs pass through. */
function optimizeCloudinary(url: string, width: number): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (/\/upload\/[^/]*(f_auto|q_auto|w_\d+)/.test(url)) return url; // already transformed
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}
