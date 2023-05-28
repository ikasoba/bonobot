import { Client } from "discord.js";
import { FeedQueueItem } from "./index.js";
import { Config } from "../config/config.js";
import { FeedReader, FeedUpdateListener } from "../rss/index.js";

export class FeedClient {
  private feedQueue: Map<`${string}:${string}`, FeedQueueItem[]> = new Map();
  private currentDaemonId: [null | NodeJS.Timeout, null | NodeJS.Timeout] = [
    null,
    null,
  ];

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

      self.currentDaemonId[0] = setTimeout(f, self.config.feedInterval);
    })();

    /** フィードに送信 */
    await (async function f() {
      console.info("post new rss item.");
      await self.onTick();

      self.currentDaemonId[1] = setTimeout(f, self.config.feedSendInterval);
    })();
  }

  stop() {
    this.currentDaemonId.forEach((x) => x && clearTimeout(x));
  }

  onUpdate: FeedUpdateListener = async (feed, info, updates) => {
    let queue = this.feedQueue.get(`${info.destChannelId}:${info.guildId}`);
    if (queue == null) {
      queue = [];
      this.feedQueue.set(`${info.destChannelId}:${info.guildId}`, queue);
    }

    console.log(info, updates);

    queue.unshift(
      ...updates.map((item) => ({
        feed: feed,
        info: info,
        item: item,
      }))
    );

    console.info("appended feed queue");

    queue = queue.sort(() => 0.5 - Math.random()).splice(-15);

    this.feedQueue.set(`${info.destChannelId}:${info.guildId}`, queue);
  };

  onTick = async () => {
    for (let [_, queue] of this.feedQueue.entries()) {
      console.log(queue);
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
