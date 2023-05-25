import Parser, { Item as FeedItem, Output } from "rss-parser";
import { TempStore } from "@ikasoba000/tempstore";

export interface FeedInfo {
  url: string;
  name: string;
  destChannelId: string;
  guildId: string;
  createdAt: Date;
  lastDate?: Date;
}

export type FeedUpdateListener = (
  feed: Output<{ [k: string]: any }>,
  feedInfo: FeedInfo,
  items: FeedItem[]
) => void;

export class FeedReader {
  private parser = new Parser();
  readonly listeners = new Set<FeedUpdateListener>();

  constructor(private tempstore: TempStore<FeedInfo[]>) {}

  /**
   * 登録されてるRSSフィードをすべて取得する
   */
  async getAll(guildId: string) {
    let value = await this.tempstore.get(guildId);

    if (value == null) {
      value = [];
      await this.tempstore.set(guildId, value);
    }

    return value;
  }

  /**
   * RSSフィードを登録する
   */
  async set(
    guildId: string,
    destChannelId: string,
    name: string,
    url: string,
    lastdate?: Date
  ) {
    let value = await this.tempstore.get(guildId);

    if (value == null) {
      value = [];
      await this.tempstore.set(guildId, value);
    }

    for (const item of value) {
      if (item.name == name) {
        item.url = url;
        item.lastDate = lastdate;

        await this.tempstore.set(guildId, value);
        return;
      }
    }

    value.push({
      name,
      url,
      lastDate: lastdate,
      createdAt: new Date(),
      destChannelId,
      guildId,
    });

    await this.tempstore.set(guildId, value);
  }

  /**
   * 登録されてるRSSフィードを消す
   */
  async delete(guildId: string, name: string) {
    let value = await this.tempstore.get(guildId);

    if (value == null) {
      value = [];
      await this.tempstore.set(guildId, value);
    }

    for (let i = 0; i < value.length; i++) {
      const item = value[i];

      if (item.name == name) {
        value.splice(i, 1);

        await this.tempstore.set(guildId, value);
        return;
      }
    }
  }

  /**
   * 登録されてるRSSフィードから新しいデータを取得し、onUpdateを呼び出す
   */
  async check() {
    const cache: Map<string, Output<{ [k: string]: any }>> = new Map();

    for (const [guildId, value] of await this.tempstore.entries()) {
      for (const item of value) {
        let feed: Output<{ [k: string]: any }>;

        if (!cache.has(item.url)) {
          const feed = await this.parser.parseURL(item.url);
          cache.set(new URL(item.url).toString(), feed);
        }

        feed = cache.get(item.url)!;

        const updates = feed.items.filter((feedItem) => {
          const createdAt = feedItem.isoDate
            ? new Date(feedItem.isoDate)
            : new Date();

          // if (item.lastDate && createdAt.getTime() < item.lastDate.getTime()) {
          //   return false;
          // }

          return true;
        });

        item.lastDate = new Date();

        for (const onUpdate of this.listeners) {
          await onUpdate(feed, item, updates);
        }
      }

      this.tempstore.set(guildId, value);
    }
  }
}
