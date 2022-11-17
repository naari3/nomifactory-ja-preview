import * as fs from "fs/promises";
import { parse, toHTML } from "minecraft-motd-util";

export async function nomifactoryJaParse(data: string) {
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
  const converted = motd.replace(/<nl>/g, "%n").replace(/<(.)\1>/g, "§$1");
  const result = parse(converted);
  return toHTML(result).replace("%n", "<br>");
}
