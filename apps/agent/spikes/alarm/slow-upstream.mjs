import { createServer } from "node:http";

createServer((request, response) => {
  const ms = Number(new URL(request.url, "http://x").searchParams.get("ms") ?? 1000);
  setTimeout(() => response.end(`waited ${ms}ms\n`), ms);
}).listen(8803, "127.0.0.1");
