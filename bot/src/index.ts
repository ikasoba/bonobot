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
    res.result;
    process.exit(1);
  }

  return res.result;
})();

const client = new Client({
  intents: ["GuildMessages", "GuildEmojisAndStickers", "Guilds", "GuildBans"],
});

const feedReaderStore = new TempStore(
  await JSONProvider.create(".tempstore.json")
);

const feedReader: FeedReader = new FeedReader(
  feedReaderStore as any as TempStore<FeedInfo[]>
);

const banSyncBotStore = new TempStore(
  await JSONProvider.create(".banSyncStore.json")
) as TempStore<string[]>;

console.log("A-", banSyncBotStore);

const bonoBot = new BonoBot(
  client,
  config,
  feedReader,
  ".config.json",
  banSyncBotStore
);

const token = await (async (): Promise<string> => {
  try {
    return await fs.readFile("TOKEN.txt", "utf8");
  } catch (_) {
    const tmp = process.env.TOKEN;
    if (tmp == null || tmp == "") {
      ("環境変数 TOKEN を読み込みましたがトークンが空でした。");
      process.exit(1);
    }
    return tmp;
  }
})();

bonoBot.start(token);
