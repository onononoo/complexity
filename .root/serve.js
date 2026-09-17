"use strict";
/* tiny static file server for working on complexity locally.

   usage: node .root/serve.js [port]
   then open http://localhost:8123/ (or the port u gave it).

   it serve the folder above .root, so it work no matter where u run it from. */

const http = require("http");
const fs = require("fs");
const path = require("path");

const site_root = path.resolve(__dirname, "..");
const port = parseInt(process.argv[2], 10) || parseInt(process.env.port, 10) || 8123;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(req.url.split("?")[0]);
  } catch (_) {
    res.writeHead(400);
    res.end("bad request");
    return;
  }
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(site_root, path.normalize(rel));
  const inside = path.relative(site_root, file);
  // dont let requests escape the project folder or read the dot folders.
  if (inside.startsWith("..") || path.isAbsolute(inside) || inside.split(path.sep).some(seg => seg === ".root" || seg === ".git")) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  });
}).listen(port, () => {
  console.log(`serving ${site_root} on http://localhost:${port}/`);
});
