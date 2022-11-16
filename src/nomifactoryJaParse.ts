import * as fs from "fs/promises";
import { parse, toHTML } from "minecraft-motd-util";

export async function nomifactoryJaParse(path: string) {
  const data = await fs.readFile(path, "utf-8");
  const kvs = data
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .filter((line) => line !== "");
  const results = kvs.map((kv) => {
    const [key, value] = kv.split("=");
    return [key, parseMotd(value)] as [string, string];
  });
  return new Map(results);
}

function parseMotd(motd: string) {
  const converted = motd.replace(/<nl>/g, "%n").replace(/<(.).>/g, "§$1");
  const result = parse(converted);
  return toHTML(result).replace("%n", "<br>");
}
