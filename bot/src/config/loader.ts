import ms from "ms";
import { Config, isConfig } from "./config.js";
import fs from "fs/promises";

export async function loadConfig(path: string) {
  const state: { error?: Error } = {};
  let raw: string;
  console.info("lead configures")
  try {
    raw = await fs.readFile(path, "utf-8")
    console.info("success config loading")
    console.log(raw)
  } catch (e) {
    console.error(e)
    const config: Config = {
      feedInterval: ms("15m"),
      feedSendInterval: ms("3m"),
    };

    raw = JSON.stringify(config, null, "  ");
    await fs.writeFile(path, raw, "utf-8");
  }
  const value = JSON.parse(raw);

  if (isConfig(value, state)) {
    return { error: false as const, result: value };
  }

  return { error: true as const, result: state };
}

export async function reloadConfig(obj: any, path: string) {
  const res = await loadConfig(path);

  if (res.error) {
    res.result;
    process.exit(1);
  }

  Object.assign(obj, res.result);
}
