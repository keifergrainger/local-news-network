"use client";

import { useEffect } from "react";

/* why: some content arrives mojibaked (UTF-8 bytes read as Latin-1).
   We fix the most common sequences globally, once after hydration. */
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/â€”/g, "—"], // em dash
  [/â€“/g, "–"], // en dash
  [/â€¢/g, "•"], // bullet
  [/Â·/g, "·"], // middle dot
  [/Â/g, ""], // stray "Â"
];

export default function EncodingFix() {
  useEffect(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as Text);

    for (const t of nodes) {
      const v = t.nodeValue || "";
      let out = v;
      for (const [re, rep] of REPLACEMENTS) out = out.replace(re, rep);
      if (out !== v) t.nodeValue = out;
    }
  }, []);

  return null;
}
