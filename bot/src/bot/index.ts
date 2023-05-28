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
  Channel,
  APIEmbed,
  JSONEncodable,
} from "discord.js";
import { Config } from "../config/config.js";
import ms from "ms";
import { FeedClient } from "./feedclient.js";
import fs from "fs/promises";

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

    console.info("bot started.");

    await this.feedClient.start();
  }

  async sendFeedQueueItem(queueItem: FeedQueueItem) {
    const guild = await this.client.guilds.fetch(queueItem.info.guildId);
    const channel = await guild.channels.fetch(queueItem.info.destChannelId);

    if (channel == null || !channel.isTextBased()) {
      return;
    }

    queueItem.item;

    const url = new URL(queueItem.item.link!);
    url.hostname;

    let image = queueItem.feed.image;
    let video = undefined;

    if (url.hostname.match(/^(www\.)?youtube\.com$/)) {
      const id = url.searchParams.get("v")!;

      image = {
        url: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
      };
    }

    console.info("sending");

    await channel.send({
      embeds: [
        {
          ...(video ? { video } : { image }),
          title: "🔗" + queueItem.feed.title,
          description: `[${
            queueItem.item.title && kawaiiSlice(queueItem.item.title, 0, 150)
          }](${url})`,
          url: queueItem.item.link,
          timestamp:
            queueItem.item.pubDate && new Date(queueItem.item.pubDate).toJSON(),
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
  async setConfig(
    interaction: ChatInputCommandInteraction,
    name: keyof Config,
    value: string
  ) {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.memberPermissions?.has("Administrator")) return;

    if (name == "feedInterval" || name == "feedSendInterval") {
      this.config[name] = ms(value);
      try {
        await fs.writeFile(
          this.configPath,
          JSON.stringify(this.config, null, "  "),
          "utf-8"
        );
        await interaction.editReply("✅ 設定値はちゃんと設定できました。");
        return;
      } catch (e) {
        console.error(e);
      }
    }

    await interaction.editReply(
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
  async getConfig(
    interaction: ChatInputCommandInteraction,
    name: keyof Config
  ) {
    await interaction.deferReply({ ephemeral: true });
    this;
    if (!interaction.memberPermissions?.has("Administrator")) return;

    if (name == "feedInterval" || name == "feedSendInterval") {
      await interaction.editReply(ms(this.config[name]));
      return;
    }

    await interaction.editReply(
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
    await interaction.deferReply({ ephemeral: true });
    const channel = channelId
      ? await interaction.guild?.channels.fetch(channelId)
      : interaction.channel;

    if (channel == null || !channel.isTextBased()) {
      await interaction.editReply("👺 チャンネルIDが不正です。");
      return;
    }

    const message = await channel.messages.fetch(messageId);
    if (message == null) {
      await interaction.editReply("👺 メッセージIDが不正です。");
      return;
    }

    await interaction.editReply(
      "```\n" + message.content.replaceAll("`", "\\`") + "\n```"
    );
  }

  @SlashCommand("set-rss-feed", "RSSフィードを追加します", [
    {
      name: "feed-url",
      description: "RSSフィードのURL",
      type: CmdOptionType.String,
      required: true,
    },
    {
      name: "feed-name",
      description: "RSSフィードの名前",
      type: CmdOptionType.String,
      required: true,
    },
    {
      name: "feed-dest",
      description: "RSSフィードの宛先",
      type: CmdOptionType.Channel,
      required: false,
    },
  ])
  async setRssFeed(
    interaction: ChatInputCommandInteraction,
    url: string,
    name: string,
    dest?: Channel
  ) {
    if (!interaction.memberPermissions?.has("Administrator")) return;
    await interaction.deferReply({ ephemeral: true });

    this.feedReader.set(
      interaction.guildId!,
      dest?.id ?? interaction.channelId,
      name,
      url
    );

    await interaction.editReply("✅ 正常に設定を変更できました。");

    await this.feedClient.stop();
    await this.feedClient.start();
  }

  @SlashCommand("get-all-rss-feed", "RSSフィードを表示します", [])
  async getAllRssFeed(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const feedinfos = await this.feedReader.getAll(interaction.guildId!);

    if (feedinfos.length == 0) {
      await interaction.editReply("フィードが空っぽです。");
      return;
    }

    await interaction.editReply({
      embeds: feedinfos.map((info) => ({
        title: info.name,
        timestamp: info.createdAt.toJSON(),
        fields: [
          {
            name: "宛先",
            value: "<#" + info.destChannelId + ">",
          },
          {
            name: "フィードURL",
            value: info.url,
          },
        ],
      })),
    });
  }

  @SlashCommand("delete-rss-feed", "RSSフィードを削除します", [
    {
      name: "feed-name",
      description: "RSSフィードの名前",
      type: CmdOptionType.String,
      required: true,
    },
  ])
  async deleteRssFeed(interaction: ChatInputCommandInteraction, name: string) {
    await interaction.deferReply({ ephemeral: true });

    this.feedReader.delete(interaction.guildId!, name);

    await interaction.editReply("✅ 正常に設定を削除できました。");
  }

  @SlashCommand("urokosay", "👺 < 判断が遅い", [
    {
      type: CmdOptionType.String,
      name: "serif",
      description: "セリフ",
      required: false,
    },
  ])
  async urokosay(interaction: ChatInputCommandInteraction, serif?: string) {
    await interaction.deferReply();
    serif ??= "判断が遅い";
    await interaction.editReply(`👺 < ${serif}`);
  }

  @SlashCommand("cowsay", "(oo)", [
    {
      type: CmdOptionType.String,
      name: "serif",
      description: "セリフ",
      required: true,
    },
  ])
  async cowsay(interaction: ChatInputCommandInteraction, serif: string) {
    await interaction.deferReply();
    let balloon =
      " " +
      "-".repeat(serif?.length) +
      "\n<" +
      serif +
      ">\n" +
      "-".repeat(serif?.length);
    let asciiart = (
      "¥  ^__^\n" +
      " ¥ (oo)¥_______\n" +
      "   (__)¥       )¥/¥\n" +
      "       ||----¥ |\n" +
      "       ||     ||"
    ).replaceAll("¥", "\\");
    const maxLineSize =
      asciiart.split("\n").sort((a, b) => b.length - a.length)[0]?.length ?? 1;
    await interaction.editReply(
      "```\n" +
        (
          balloon +
          "\n" +
          asciiart.replaceAll(
            "\n",
            "\n" + " ".repeat(serif.length / 2 + maxLineSize / 2)
          )
        ).replaceAll("`", "\\`") +
        "\n```"
    );
  }

  @SlashCommand("get-emoji-id", "絵文字のIDを取得します", [
    {
      type: CmdOptionType.String,
      name: "emoji",
      description: "絵文字",
      required: true,
    },
  ])
  async getEmojiId(interaction: ChatInputCommandInteraction, emoji: string) {
    await interaction.deferReply({ ephemeral: true });
    await interaction.reply("````\n" + emoji + "```");
  }
}
