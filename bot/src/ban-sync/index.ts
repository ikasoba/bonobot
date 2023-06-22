import { ClientEvent, DiscordBot, SlashCommand } from "@ikasoba000/distroub";
import { TempStore } from "@ikasoba000/tempstore";
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  Client,
  Guild,
  GuildBan,
} from "discord.js";

export class BanSyncBot extends DiscordBot {
  constructor(client: Client, private store: TempStore<string[]>) {
    super(client);
  }

  @ClientEvent("guildBanAdd")
  async onGuildBanAdd(ban: GuildBan) {
    const listeners = await this.store.get(ban.guild.id);
    if (listeners == null) return;

    for (const guildId of listeners) {
      const guild = await this.client.guilds.fetch(guildId);
      await guild.bans.create(ban.user.id, { reason: ban.reason ?? undefined });
    }
  }

  @ClientEvent("guildBanRemove")
  async onGuildBanRemove(ban: GuildBan) {
    const listeners = await this.store.get(ban.guild.id);
    if (listeners == null) return;

    for (const guildId of listeners) {
      const guild = await this.client.guilds.fetch(guildId);
      await guild.bans.remove(ban.user.id);
    }
  }

  @SlashCommand("add-ban-link", "他のサーバーとBANを同期します", [
    {
      type: ApplicationCommandOptionType.String,
      description: "サーバーID",
      name: "serverId",
      required: true,
    },
  ])
  async addLink(interaction: ChatInputCommandInteraction, serverId: string) {
    await interaction.deferReply({ ephemeral: true });

    let listeners = await this.store.get(serverId);
    if (listeners == null) {
      listeners = [];
      this.store.set(serverId, listeners);
    }

    if (!(interaction.guildId && interaction.guild)) {
      await interaction.editReply("👺 想定外のエラーが発生しました。");
      return;
    }

    if (listeners.indexOf(serverId) < 0) {
      try {
        const guild = await this.client.guilds.fetch(serverId);
        listeners.push(interaction.guildId);
        await this.store.set(serverId, listeners);

        const bans = [...(await guild.bans.fetch())];
        let i = 0;

        // banしたユーザーの同期
        for (const [_, ban] of bans) {
          await interaction.guild.bans.create(ban.user.id, {
            reason: ban.reason ?? undefined,
          });
          i++;

          //prettier-ignore
          await interaction.editReply(
              `bannning ${i}/${bans.length}\n`
            + "```\n"
            + `id: ${ban.user.tag}`
            + "```"
          );
        }

        await interaction.editReply("✅ 設定できました。");
      } catch (e) {
        await interaction.editReply(
          "👺 そのサーバーにはこのBOTは参加していません。"
        );
      }
    } else {
      await interaction.editReply("👺 すでにそのサーバーは追加済みです。");
    }
  }

  @SlashCommand("remove-ban-link", "他のサーバーとBANを同期を解除します", [
    {
      type: ApplicationCommandOptionType.String,
      description: "サーバーID",
      name: "serverId",
      required: true,
    },
  ])
  async removeLink(interaction: ChatInputCommandInteraction, serverId: string) {
    await interaction.deferReply({ ephemeral: true });

    let listeners = await this.store.get(serverId);
    if (listeners == null) {
      listeners = [];
      this.store.set(serverId, listeners);
    }

    if (interaction.guildId == null) {
      await interaction.editReply("👺 想定外のエラーが発生しました。");
      return;
    }

    if (listeners.indexOf(serverId) >= 0) {
      listeners.splice(listeners.indexOf(serverId), 1);
      await this.store.set(serverId, listeners);

      await interaction.editReply("✅ 設定できました。");
    } else {
      await interaction.editReply("👺 すでにそのサーバーは解除済みか、です。");
    }
  }
}
