import { Client } from "discord.js";
import { FeedQueueItem } from "./index.js";
import { Config } from "../config/config.js";
import { FeedReader, FeedUpdateListener } from "../rss/index.js";

export class FeedClient {
  private feedQueue: Map<string, FeedQueueItem[]> = new Map();

  constructor(
    private sendFeedQueueItem: (queueItem: FeedQueueItem) => Promise<void>,
    private config: Config,
    private feedReader: FeedReader
  ) {
    feedReader.listeners.add(this.onUpdate);
  }

  async start() {
    const self = this;

    /** フィードを取得 */
    await (async function f() {
      console.info("fetch rss feeds.");
      await self.feedReader.check();

      setTimeout(f, self.config.feedInterval);
    })();

    /** フィードに送信 */
    await (async function f() {
      console.info("post new rss item.");
      await self.onTick();

      setTimeout(f, self.config.feedSendInterval);
    })();
  }

  onUpdate: FeedUpdateListener = async (feed, info, updates) => {
    let queue = this.feedQueue.get(info.guildId);
    if (queue == null) {
      queue = [];
      this.feedQueue.set(info.guildId, queue);
    }

    queue.push(
      ...updates.map((item) => ({
        feed: feed,
        info: info,
        item: item,
      }))
    );

    queue = queue.splice(0, -15).sort(() => 0.5 - Math.random());

    this.feedQueue.set(info.guildId, queue);
  };

  onTick = async () => {
    for (let [_, queue] of this.feedQueue.entries()) {
      const queueItem = queue.pop();
      if (queueItem == null) continue;

      this.sendFeedQueueItem(queueItem);
    }
  };

  check = async () => {
    await this.feedReader.check();
    await this.onTick();
  };
}
