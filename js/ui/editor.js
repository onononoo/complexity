"use strict";
/* source editor: a transparent textarea over a <pre> that shows error marks,
   plus a line-number gutter. */

const src_el = document.getElementById("src");
const hl_el = document.getElementById("hl");
const gutter_el = document.getElementById("gutter");

function highlight(src, error) {
  const has_span = error && error.pos != null;
  let html;
  if (has_span) {
    const a = Math.min(error.pos, src.length);
    const b = Math.min(src.length, a + Math.max(1, error.len));
    html = esc(src.slice(0, a)) + "<mark>" + (b > a ? esc(src.slice(a, b)) : " ") + "</mark>" + esc(src.slice(b));
  } else {
    html = esc(src);
  }
  hl_el.innerHTML = html + "\n ";

  const lines = src.split("\n").length;
  const err_line = has_span ? line_col(src, Math.min(error.pos, src.length)).line : -1;
  let g = "";
  for (let i = 1; i <= lines; i++) g += (i === err_line ? `<b>${i}</b>` : i) + "\n";
  gutter_el.innerHTML = g + " ";
  sync_scroll();
}

function sync_scroll() {
  hl_el.scrollTop = src_el.scrollTop;
  hl_el.scrollLeft = src_el.scrollLeft;
  gutter_el.scrollTop = src_el.scrollTop;
}

src_el.addEventListener("scroll", sync_scroll);
