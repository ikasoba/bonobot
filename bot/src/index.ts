import { DiscordBot, SlashCommand } from "@ikasoba000/distroub";
import { DataProvider, TempStore } from "@ikasoba000/tempstore";
import { JSONProvider } from "@ikasoba000/tempstore/JSONProvider";
import { FeedInfo, FeedReader } from "./rss/index.js";
import { Client } from "discord.js";
import { Config, isConfig } from "./config/config.js";
import { loadConfig } from "./config/loader.js";
import fs from "fs/promises";
import { BonoBot } from "./bot/index.js";

const config: Config = await (async () => {
  const res = await loadConfig(".config.json");

  if (res.error) {
    console.log(res.result);
    process.exit(1);
  }

  return res.result;
})();

const client = new Client({
  intents: ["GuildMessages", "GuildEmojisAndStickers", "Guilds"],
});

const tempstore = new TempStore(await JSONProvider.create(".tempstore.json"));

const feedReader: FeedReader = new FeedReader(
  tempstore as any as TempStore<FeedInfo[]>
);

const bonoBot = new BonoBot(client, config, feedReader, ".tempstore.json");

const token = await (async (): Promise<string> => {
  try {
    return await fs.readFile("TOKEN.txt", "utf8");
  } catch (_) {
    const tmp = process.env.TOKEN;
    if (tmp == null || tmp == "") {
      console.log("環境変数 TOKEN を読み込みましたがトークンが空でした。");
      process.exit(1);
    }
    return tmp;
  }
})();

bonoBot.start(token);
