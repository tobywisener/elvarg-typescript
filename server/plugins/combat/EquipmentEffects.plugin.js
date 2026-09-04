const registerDharoksArmourEffects = require("./effects/DharoksArmour");
const registerObsidianEffects = require("./effects/ObsidianArmour");

module.exports = {
  name: "EquipmentEffects",
  register(api) {
    registerDharoksArmourEffects(api);
    registerObsidianEffects(api);
  },
};
