import { ClientEvent, DiscordBot, SlashCommand } from "@ikasoba000/distroub";
import { TempStore } from "@ikasoba000/tempstore";
import { FeedInfo, FeedReader, FeedUpdateListener } from "../rss/index.js";
import { Item as FeedItem, Output as FeedOutput } from "rss-parser";
import { kawaiiSlice } from "../util/kawaiiSlice.js";
import {
  ApplicationCommandOptionType as CmdOptionType,
  Client,
  CommandInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import { Config } from "../config/config.js";
import ms from "ms";
import { FeedClient } from "./feedclient.js";

export const configChoice = [
  {
    name: "RSSフィードを検索する間隔",
    value: "feedInterval" satisfies keyof Config,
  },
  {
    name: "RSSフィードから得たニュースを送信する間隔",
    value: "feedSendInterval" satisfies keyof Config,
  },
];

export interface FeedQueueItem {
  feed: FeedOutput<{ [k: string]: any }>;
  info: FeedInfo;
  item: FeedItem;
}

export class BonoBot extends DiscordBot {
  private feedClient;

  constructor(
    client: Client,
    private config: Config,
    private feedReader: FeedReader,
    private configPath: string
  ) {
    super(client);

    this.feedClient = new FeedClient(
      (...a) => this.sendFeedQueueItem(...a),
      this.config,
      this.feedReader
    );
  }

  async start(token: string) {
    await this.client.login(token);

    console.log("bot started.");

    await this.feedClient.start();
  }

  async sendFeedQueueItem(queueItem: FeedQueueItem) {
    const guild = await this.client.guilds.fetch(queueItem.info.guildId);
    const channel = await guild.channels.fetch(queueItem.info.destChannelId);

    if (channel == null || !channel.isTextBased()) {
      return;
    }

    await channel.send({
      embeds: [
        {
          author: {
            name: queueItem.info.name ?? queueItem.feed.title ?? "RSSフィード",
            url:
              queueItem.item.link ?? queueItem.info.url ?? queueItem.feed.link,
          },

          thumbnail: queueItem.feed.image && {
            url: queueItem.feed.image.url,
          },

          title: queueItem.feed.title,

          description:
            queueItem.item.content &&
            kawaiiSlice(queueItem.item.content, 0, 150),

          url: queueItem.item.link,
        },
      ],
    });
  }

  @SlashCommand("set-config", "設定を変更します。", [
    {
      name: "name",
      description: "設定の名前",
      required: true,
      type: CmdOptionType.String,
      choices: configChoice,
    },
    {
      name: "value",
      description: "設定に付与する値",
      type: CmdOptionType.String,
      required: true,
    },
  ])
  setConfig(
    interaction: ChatInputCommandInteraction,
    name: keyof Config,
    value: string
  ) {
    if (!interaction.memberPermissions?.has("Administrator")) return;

    if (name == "feedInterval" || name == "feedSendInterval") {
      this.config[name] = ms(value);
    }

    interaction.reply("設定値はちゃんと設定できました。");

    interaction.reply(
      "👺 何かエラーが起きたかも知れないけど、その原因は不明です。"
    );
  }

  @SlashCommand("get-config", "設定を表示します。", [
    {
      name: "name",
      description: "設定の名前",
      required: true,
      type: CmdOptionType.String,
      choices: configChoice,
    },
  ])
  getConfig(interaction: ChatInputCommandInteraction, name: keyof Config) {
    if (!interaction.memberPermissions?.has("Administrator")) return;

    if (name == "feedInterval" || name == "feedSendInterval") {
      interaction.reply(ms(this.config[name]));
    }

    interaction.reply(
      "👺 何かエラーが起きたかも知れないけど、その原因は不明です。"
    );
  }

  @SlashCommand("view-message-source", "メッセージのソースを表示します", [
    {
      name: "message_id",
      description: "メッセージのID",
      required: true,
      type: CmdOptionType.String,
    },
    {
      name: "channel_id",
      description: "チャンネルのID",
      required: false,
      type: CmdOptionType.String,
    },
  ])
  async viewMessageSource(
    interaction: ChatInputCommandInteraction,
    messageId: string,
    channelId?: string
  ) {
    const channel = channelId
      ? await interaction.guild?.channels.fetch(channelId)
      : interaction.channel;

    if (channel == null || !channel.isTextBased()) {
      interaction.reply("チャンネルIDが不正です。");
      return;
    }

    const message = await channel.messages.fetch(messageId);
    if (message == null) {
      interaction.reply("メッセージIDが不正です。");
      return;
    }

    interaction.reply(
      "```\n" + message.content.replaceAll("`", "\\`") + "\n```"
    );
  }
}
