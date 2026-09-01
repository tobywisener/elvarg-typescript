const { FriendsChatManager } = require("../../src/main/typescript/elvarg/game/content/FriendsChatManager");

module.exports = {
  name: "FriendsList",
  register(api) {
    api.onPlayerLogin(({ player }) => {
      FriendsChatManager.onLogin(player);
    });

    api.onPlayerLogout(({ player }) => {
      FriendsChatManager.onLogout(player);
    });

    api.onSocialPacket((event) => {
      const { player, packet } = event;
      if (packet.type === "friends_chat_action") {
        FriendsChatManager.handleAction(player, packet.action);
      } else if (packet.type === "private_message") {
        FriendsChatManager.handlePrivateMessage(player, packet.recipient, packet.text);
      } else if (packet.type === "chat_filter") {
        FriendsChatManager.setChatFilters(player, packet.publicMode, packet.privateMode, packet.tradeMode);
      } else {
        FriendsChatManager.handleChat(player, packet.text);
      }
      event.handled = true;
    });

    api.onInterfaceActionClick((event) => {
      if (FriendsChatManager.handleWidgetAction(
        event.player,
        event.groupId ?? -1,
        event.childId ?? -1,
        event.option,
        event.opId ?? event.action,
      )) {
        event.handled = true;
      }
    });
  },
};
