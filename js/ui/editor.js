"use strict";
/* Source editor: a transparent textarea over a <pre> that shows error marks,
   plus a line-number gutter. */

const srcEl = document.getElementById("src");
const hlEl = document.getElementById("hl");
const gutterEl = document.getElementById("gutter");

function highlight(src, error) {
  const hasSpan = error && error.pos != null;
  let html;
  if (hasSpan) {
    const a = Math.min(error.pos, src.length);
    const b = Math.min(src.length, a + Math.max(1, error.len));
    html = esc(src.slice(0, a)) + "<mark>" + (b > a ? esc(src.slice(a, b)) : " ") + "</mark>" + esc(src.slice(b));
  } else {
    html = esc(src);
  }
  hlEl.innerHTML = html + "\n ";

  const lines = src.split("\n").length;
  const errLine = hasSpan ? lineCol(src, Math.min(error.pos, src.length)).line : -1;
  let g = "";
  for (let i = 1; i <= lines; i++) g += (i === errLine ? `<b>${i}</b>` : i) + "\n";
  gutterEl.innerHTML = g + " ";
  syncScroll();
}

function syncScroll() {
  hlEl.scrollTop = srcEl.scrollTop;
  hlEl.scrollLeft = srcEl.scrollLeft;
  gutterEl.scrollTop = srcEl.scrollTop;
}

srcEl.addEventListener("scroll", syncScroll);
