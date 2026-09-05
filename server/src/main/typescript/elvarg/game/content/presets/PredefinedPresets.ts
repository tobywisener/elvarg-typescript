import { Presetable } from "./Presetable";
import { Item } from "../../model/Item";
import { MagicSpellbook } from "../../model/MagicSpellbook";
import { ItemIdentifiers } from "../../../util/ItemIdentifiers";

const ICE_BARRAGE_SPELL_ID = 12891;

export class PredefinedPresets {
    public static readonly ATT_60_ZERKER_94: Presetable = new Presetable ("60Att. Zerker", [
            new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_ATTACK_4_), new Item(ItemIdentifiers.SUPER_STRENGTH_4_),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RING_OF_RECOIL),
            new Item(ItemIdentifiers.DEATH_RUNE, 1000), new Item(ItemIdentifiers.EARTH_RUNE, 1000), new Item(ItemIdentifiers.ASTRAL_RUNE, 1000), new Item(ItemIdentifiers.SHARK),
        ],
            [
                new Item(ItemIdentifiers.WARRIOR_HELM),
                new Item(ItemIdentifiers.STRENGTH_CAPE_T_),
                new Item(ItemIdentifiers.DRAGON_SCIMITAR),
                new Item(ItemIdentifiers.AMULET_OF_GLORY),
                new Item(ItemIdentifiers.RUNE_PLATEBODY),
                new Item(ItemIdentifiers.RUNE_DEFENDER),
                new Item(ItemIdentifiers.RUNE_PLATELEGS),
                new Item(ItemIdentifiers.BARROWS_GLOVES),
                new Item(ItemIdentifiers.RUNE_BOOTS),
                new Item(ItemIdentifiers.RING_OF_RECOIL),
                null,
            ],
            /* atk, def, str, hp, range, pray, mage */
            [60, 45, 99, 95, 99, 52, 94],
            MagicSpellbook.LUNAR,
            true
    );    


    public static ATT_70_ZERKER_97: Presetable = new Presetable ("70Att. Zerker", [
        new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_ATTACK_4_), new Item(ItemIdentifiers.SUPER_STRENGTH_4_),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RING_OF_RECOIL),
        new Item(ItemIdentifiers.DEATH_RUNE, 1000), new Item(ItemIdentifiers.EARTH_RUNE, 1000), new Item(ItemIdentifiers.ASTRAL_RUNE, 1000), new Item(ItemIdentifiers.SHARK),
    ],
        [    
            new Item(ItemIdentifiers.WARRIOR_HELM),
            new Item(ItemIdentifiers.STRENGTH_CAPE_T_),
            new Item(ItemIdentifiers.ABYSSAL_WHIP),
            new Item(ItemIdentifiers.AMULET_OF_GLORY),
            new Item(ItemIdentifiers.RUNE_PLATEBODY),
            new Item(ItemIdentifiers.RUNE_DEFENDER),
            new Item(ItemIdentifiers.RUNE_PLATELEGS),
            new Item(ItemIdentifiers.BARROWS_GLOVES),
            new Item(ItemIdentifiers.RUNE_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            null,
        ],
    /* atk, def, str, hp, range, pray, mage */
    [70, 45, 99, 95, 99, 52, 94],
    MagicSpellbook.LUNAR,
    true
    );

    public static DDS_PURE_M_73: Presetable = new Presetable("DDS Pure (M)", [
        new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_STRENGTH_4_),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SUPER_ATTACK_4_),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SARADOMIN_BREW_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RING_OF_RECOIL), new Item(ItemIdentifiers.SHARK),
    ],
        [
            new Item(ItemIdentifiers.IRON_FULL_HELM),
            new Item(ItemIdentifiers.OBSIDIAN_CAPE),
            new Item(ItemIdentifiers.DRAGON_SCIMITAR),
            new Item(ItemIdentifiers.AMULET_OF_GLORY),
            new Item(ItemIdentifiers.IRON_PLATEBODY),
            new Item(ItemIdentifiers.BOOK_OF_DARKNESS),
            new Item(ItemIdentifiers.BLACK_DHIDE_CHAPS),
            new Item(ItemIdentifiers.MITHRIL_GLOVES),
            new Item(ItemIdentifiers.CLIMBING_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            null,
        ],
        [60, 1, 99, 85, 1, 1, 1],
        MagicSpellbook.NORMAL,
        true
    );

    public static DDS_PURE_R_73: Presetable = new Presetable("DDS Pure (R)", [
        new Item(ItemIdentifiers.RUNE_CROSSBOW), new Item(ItemIdentifiers.DRAGONSTONE_BOLTS_E_, 75), new Item(ItemIdentifiers.RANGING_POTION_4_), new Item(ItemIdentifiers.SUPER_STRENGTH_4_),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SUPER_ATTACK_4_),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SARADOMIN_BREW_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RING_OF_RECOIL), new Item(ItemIdentifiers.SHARK),
    ],
        [
            new Item(ItemIdentifiers.COIF),
            new Item(ItemIdentifiers.AVAS_ACCUMULATOR),
            new Item(ItemIdentifiers.MAGIC_SHORTBOW),
            new Item(ItemIdentifiers.AMULET_OF_GLORY),
            new Item(ItemIdentifiers.LEATHER_BODY),
            null,
            new Item(ItemIdentifiers.BLACK_DHIDE_CHAPS),
            new Item(ItemIdentifiers.MITHRIL_GLOVES),
            new Item(ItemIdentifiers.CLIMBING_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            new Item(ItemIdentifiers.RUNE_ARROW, 75),
        ],
        [50, 1, 99, 85, 99, 1, 1],
        MagicSpellbook.NORMAL,
        true
    );

    public static G_MAULER_70: Presetable = new Presetable("G Mauler (R)",  [
            new Item(ItemIdentifiers.RUNE_CROSSBOW), new Item(ItemIdentifiers.DRAGONSTONE_BOLTS_E_, 75), new Item(ItemIdentifiers.RANGING_POTION_4_), new Item(ItemIdentifiers.SUPER_STRENGTH_4_),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.GRANITE_MAUL), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SUPER_ATTACK_4_),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SARADOMIN_BREW_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RING_OF_RECOIL), new Item(ItemIdentifiers.SHARK),
        ],
            [
                new Item(ItemIdentifiers.COIF),
                new Item(ItemIdentifiers.AVAS_ACCUMULATOR),
                new Item(ItemIdentifiers.MAGIC_SHORTBOW),
                new Item(ItemIdentifiers.AMULET_OF_GLORY),
                new Item(ItemIdentifiers.LEATHER_BODY),
                null,
                new Item(ItemIdentifiers.BLACK_DHIDE_CHAPS),
                new Item(ItemIdentifiers.MITHRIL_GLOVES),
                new Item(ItemIdentifiers.CLIMBING_BOOTS),
                new Item(ItemIdentifiers.RING_OF_RECOIL),
                new Item(ItemIdentifiers.RUNE_ARROW, 75),
            ],
            /* atk, def, str, hp, range, pray, mage */
            [50, 1, 99, 85, 99, 1, 1],
            MagicSpellbook.NORMAL,
            true
    );


    public static MAIN_HYBRID_126: Presetable = new Presetable("Main Hybrid", [
        new Item(ItemIdentifiers.RUNE_PLATEBODY), new Item(ItemIdentifiers.ABYSSAL_WHIP), new Item(ItemIdentifiers.BLACK_DHIDE_BODY), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
        new Item(ItemIdentifiers.RUNE_PLATELEGS), new Item(ItemIdentifiers.RUNE_DEFENDER), new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SUPER_RESTORE_4_),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_RESTORE_4_),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_ATTACK_4_),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_STRENGTH_4_),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.DEATH_RUNE, 4000), new Item(ItemIdentifiers.WATER_RUNE, 6000), new Item(ItemIdentifiers.BLOOD_RUNE, 2000),
    ],
        [
            new Item(ItemIdentifiers.HELM_OF_NEITIZNOT),
            new Item(ItemIdentifiers.SARADOMIN_CAPE),
            new Item(ItemIdentifiers.ANCIENT_STAFF),
            new Item(ItemIdentifiers.AMULET_OF_GLORY),
            new Item(ItemIdentifiers.MYSTIC_ROBE_TOP),
            new Item(ItemIdentifiers.UNHOLY_BOOK),
            new Item(ItemIdentifiers.MYSTIC_ROBE_BOTTOM),
            new Item(ItemIdentifiers.BARROWS_GLOVES),
            new Item(ItemIdentifiers.CLIMBING_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            null,
        ],
        [99, 99, 99, 99, 99, 99, 99],
        MagicSpellbook.ANCIENT,
        true,
        ICE_BARRAGE_SPELL_ID
    );

    public static MAIN_RUNE_126: Presetable = new Presetable("Main Rune", [
        new Item(ItemIdentifiers.SUPER_STRENGTH_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SUPER_RESTORE_4_),
        new Item(ItemIdentifiers.SUPER_ATTACK_4_), new Item(ItemIdentifiers.ASTRAL_RUNE, 1000), new Item(ItemIdentifiers.EARTH_RUNE, 1000), new Item(ItemIdentifiers.DEATH_RUNE, 1000),
        new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RING_OF_RECOIL), new Item(ItemIdentifiers.SHARK),
    ],
        [
            new Item(ItemIdentifiers.HELM_OF_NEITIZNOT),
            new Item(ItemIdentifiers.FIRE_CAPE),
            new Item(ItemIdentifiers.ABYSSAL_WHIP),
            new Item(ItemIdentifiers.AMULET_OF_FURY),
            new Item(ItemIdentifiers.FIGHTER_TORSO),
            new Item(ItemIdentifiers.RUNE_DEFENDER),
            new Item(ItemIdentifiers.BANDOS_TASSETS),
            new Item(ItemIdentifiers.BARROWS_GLOVES),
            new Item(ItemIdentifiers.DRAGON_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            null,
        ],
        [99, 99, 99, 99, 99, 99, 99],
        MagicSpellbook.LUNAR,
        true
    );

    public static MAIN_MELEE_126: Presetable = new Presetable("Main Melee", [
        new Item(ItemIdentifiers.ARMADYL_GODSWORD), new Item(ItemIdentifiers.SARADOMIN_BREW_4_), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SUPER_RESTORE_4_),
        new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.ASTRAL_RUNE, 1000), new Item(ItemIdentifiers.EARTH_RUNE, 1000), new Item(ItemIdentifiers.DEATH_RUNE, 1000),
        new Item(ItemIdentifiers.SUPER_ATTACK_4_), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SUPER_STRENGTH_4_), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RING_OF_RECOIL), new Item(ItemIdentifiers.SHARK),
    ],
        [
            new Item(ItemIdentifiers.HELM_OF_NEITIZNOT),
            new Item(ItemIdentifiers.FIRE_CAPE),
            new Item(ItemIdentifiers.ABYSSAL_TENTACLE),
            new Item(ItemIdentifiers.AMULET_OF_FURY),
            new Item(ItemIdentifiers.BANDOS_CHESTPLATE),
            new Item(ItemIdentifiers.RUNE_DEFENDER),
            new Item(ItemIdentifiers.BANDOS_TASSETS),
            new Item(ItemIdentifiers.BARROWS_GLOVES),
            new Item(ItemIdentifiers.DRAGON_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            null,
        ],
        [99, 99, 99, 99, 99, 99, 99],
        MagicSpellbook.LUNAR,
        true
    );

    public static MAIN_RCB_TANK_126: Presetable = new Presetable("Main RCB Tank", [
        new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.DRAGONSTONE_BOLTS_E_, 175), new Item(ItemIdentifiers.RANGING_POTION_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
        new Item(ItemIdentifiers.RUNE_CROSSBOW), new Item(ItemIdentifiers.ASTRAL_RUNE, 1000), new Item(ItemIdentifiers.EARTH_RUNE, 1000), new Item(ItemIdentifiers.DEATH_RUNE, 1000),
        new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SUPER_ATTACK_4_), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SUPER_STRENGTH_4_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SARADOMIN_BREW_4_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RING_OF_RECOIL), new Item(ItemIdentifiers.SHARK),
    ],
        [
            new Item(ItemIdentifiers.VERACS_HELM),
            new Item(ItemIdentifiers.FIRE_CAPE),
            new Item(ItemIdentifiers.RUNE_CROSSBOW),
            new Item(ItemIdentifiers.AMULET_OF_FURY),
            new Item(ItemIdentifiers.BLACK_DHIDE_BODY),
            new Item(ItemIdentifiers.SPIRIT_SHIELD),
            new Item(ItemIdentifiers.VERACS_PLATESKIRT),
            new Item(ItemIdentifiers.BARROWS_GLOVES),
            new Item(ItemIdentifiers.DRAGON_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            new Item(ItemIdentifiers.DRAGONSTONE_BOLTS_E_, 175),
        ],
        [99, 99, 99, 99, 99, 99, 99],
        MagicSpellbook.LUNAR,
        true
    );

    public static MAIN_RCB_TANK_70: Presetable = new Presetable(
        "70 Def Tank",
        PredefinedPresets.MAIN_RCB_TANK_126.getInventory(),
        PredefinedPresets.MAIN_RCB_TANK_126.getEquipment(),
        [99, 70, 99, 99, 99, 99, 99],
        MagicSpellbook.LUNAR,
        true
    );

    public static DHAROK_126: Presetable = new Presetable("Dharok", [
        new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SUPER_RESTORE_4_),
        new Item(ItemIdentifiers.SUPER_ATTACK_4_), new Item(ItemIdentifiers.ASTRAL_RUNE, 1000), new Item(ItemIdentifiers.EARTH_RUNE, 1000), new Item(ItemIdentifiers.DEATH_RUNE, 1000),
        new Item(ItemIdentifiers.SUPER_STRENGTH_4_), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RING_OF_RECOIL), new Item(ItemIdentifiers.SHARK),
    ],
        [
            new Item(ItemIdentifiers.DHAROKS_HELM),
            new Item(ItemIdentifiers.FIRE_CAPE),
            new Item(ItemIdentifiers.DHAROKS_GREATAXE),
            new Item(ItemIdentifiers.AMULET_OF_FURY),
            new Item(ItemIdentifiers.DHAROKS_PLATEBODY),
            null,
            new Item(ItemIdentifiers.DHAROKS_PLATELEGS),
            new Item(ItemIdentifiers.BARROWS_GLOVES),
            new Item(ItemIdentifiers.DRAGON_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            null,
        ],
        [99, 99, 99, 99, 99, 99, 99],
        MagicSpellbook.LUNAR,
        true
    );

    public static MAIN_BARRAGE_126: Presetable = new Presetable("Main Barrage", [
        new Item(ItemIdentifiers.RUNE_CROSSBOW), new Item(ItemIdentifiers.DRAGONSTONE_BOLTS_E_, 150), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
        new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.WATER_RUNE, 6000), new Item(ItemIdentifiers.BLOOD_RUNE, 2000), new Item(ItemIdentifiers.DEATH_RUNE, 4000),
        new Item(ItemIdentifiers.BLACK_DHIDE_BODY), new Item(ItemIdentifiers.BLACK_DHIDE_CHAPS), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
        new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RING_OF_RECOIL), new Item(ItemIdentifiers.SHARK),
    ],
        [
            new Item(ItemIdentifiers.AHRIMS_HOOD),
            new Item(ItemIdentifiers.SARADOMIN_CAPE),
            new Item(ItemIdentifiers.ANCIENT_STAFF),
            new Item(ItemIdentifiers.AMULET_OF_FURY),
            new Item(ItemIdentifiers.AHRIMS_ROBETOP),
            new Item(ItemIdentifiers.SPIRIT_SHIELD),
            new Item(ItemIdentifiers.AHRIMS_ROBESKIRT),
            new Item(ItemIdentifiers.BARROWS_GLOVES),
            new Item(ItemIdentifiers.DRAGON_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            null,
        ],
        [99, 99, 99, 99, 99, 99, 99],
        MagicSpellbook.ANCIENT,
        true,
        ICE_BARRAGE_SPELL_ID
    );

    public static VOID_RANGER_126: Presetable = new Presetable("Void Ranger", [
        new Item(ItemIdentifiers.DARK_BOW), new Item(ItemIdentifiers.DRAGON_ARROW, 100), new Item(ItemIdentifiers.RANGING_POTION_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
        new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.ASTRAL_RUNE, 1000), new Item(ItemIdentifiers.EARTH_RUNE, 1000), new Item(ItemIdentifiers.DEATH_RUNE, 1000),
        new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SUPER_ATTACK_4_), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SUPER_STRENGTH_4_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SARADOMIN_BREW_4_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RING_OF_RECOIL), new Item(ItemIdentifiers.SHARK),
    ],
        [
            new Item(ItemIdentifiers.VOID_RANGER_HELM),
            new Item(ItemIdentifiers.AVAS_ACCUMULATOR),
            new Item(ItemIdentifiers.RUNE_CROSSBOW),
            new Item(ItemIdentifiers.AMULET_OF_FURY),
            new Item(ItemIdentifiers.ELITE_VOID_TOP),
            null,
            new Item(ItemIdentifiers.ELITE_VOID_ROBE),
            new Item(ItemIdentifiers.VOID_KNIGHT_GLOVES),
            new Item(ItemIdentifiers.DRAGON_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            new Item(ItemIdentifiers.DRAGONSTONE_BOLTS_E_, 175),
        ],
        [99, 99, 99, 99, 99, 99, 99],
        MagicSpellbook.LUNAR,
        true
    );

    public static VOID_MELEE_126: Presetable = new Presetable("Void Melee", [
        new Item(ItemIdentifiers.ARMADYL_GODSWORD), new Item(ItemIdentifiers.SARADOMIN_BREW_4_), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
        new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.ASTRAL_RUNE, 1000), new Item(ItemIdentifiers.EARTH_RUNE, 1000), new Item(ItemIdentifiers.DEATH_RUNE, 1000),
        new Item(ItemIdentifiers.SUPER_ATTACK_4_), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SUPER_STRENGTH_4_), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RING_OF_RECOIL), new Item(ItemIdentifiers.SHARK),
    ],
        [
            new Item(ItemIdentifiers.VOID_MELEE_HELM),
            new Item(ItemIdentifiers.FIRE_CAPE),
            new Item(ItemIdentifiers.ABYSSAL_TENTACLE),
            new Item(ItemIdentifiers.AMULET_OF_FURY),
            new Item(ItemIdentifiers.ELITE_VOID_TOP),
            new Item(ItemIdentifiers.DRAGON_DEFENDER),
            new Item(ItemIdentifiers.ELITE_VOID_ROBE),
            new Item(ItemIdentifiers.VOID_KNIGHT_GLOVES),
            new Item(ItemIdentifiers.DRAGON_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            null,
        ],
        [99, 99, 99, 99, 99, 99, 99],
        MagicSpellbook.LUNAR,
        true
    );

    public static KARILS_TANK_126: Presetable = new Presetable("Karils Tank", [
        new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.RANGING_POTION_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
        new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.ASTRAL_RUNE, 1000), new Item(ItemIdentifiers.EARTH_RUNE, 1000), new Item(ItemIdentifiers.DEATH_RUNE, 1000),
        new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SUPER_ATTACK_4_), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
        new Item(ItemIdentifiers.SUPER_STRENGTH_4_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SARADOMIN_BREW_4_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK),
    ],
        [
            new Item(ItemIdentifiers.KARILS_COIF),
            new Item(ItemIdentifiers.FIRE_CAPE),
            new Item(ItemIdentifiers.KARILS_CROSSBOW),
            new Item(ItemIdentifiers.AMULET_OF_FURY),
            new Item(ItemIdentifiers.KARILS_LEATHERTOP),
            null,
            new Item(ItemIdentifiers.KARILS_LEATHERSKIRT),
            new Item(ItemIdentifiers.BARROWS_GLOVES),
            new Item(ItemIdentifiers.DRAGON_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            new Item(ItemIdentifiers.BOLT_RACK, 500),
        ],
        [99, 99, 99, 99, 99, 99, 99],
        MagicSpellbook.LUNAR,
        true
    );

    public static  NH_PURE_83 = new Presetable("NH Pure",
        [
            new Item(ItemIdentifiers.RUNE_CROSSBOW), new Item(ItemIdentifiers.BLACK_DHIDE_CHAPS), new Item(ItemIdentifiers.RANGING_POTION_4_), new Item(ItemIdentifiers.SUPER_STRENGTH_4_),
            new Item(ItemIdentifiers.AVAS_ACCUMULATOR), new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SUPER_ATTACK_4_),
            new Item(ItemIdentifiers.DRAGONSTONE_BOLTS_E_, 75), new Item(ItemIdentifiers.BOOK_OF_WAR), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
            new Item(ItemIdentifiers.WATER_RUNE, 1000), new Item(ItemIdentifiers.BLOOD_RUNE, 1000), new Item(ItemIdentifiers.DEATH_RUNE, 1000), new Item(ItemIdentifiers.SHARK),
        ],
        [
            new Item(ItemIdentifiers.GREY_HAT),
            new Item(ItemIdentifiers.ZAMORAK_CAPE),
            new Item(ItemIdentifiers.MAGIC_SHORTBOW),
            new Item(ItemIdentifiers.AMULET_OF_GLORY),
            new Item(ItemIdentifiers.ZAMORAK_MONK_BOTTOM),
            null,
            new Item(ItemIdentifiers.ZAMORAK_MONK_TOP),
            new Item(ItemIdentifiers.MITHRIL_GLOVES),
            new Item(ItemIdentifiers.CLIMBING_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            new Item(ItemIdentifiers.RUNE_ARROW, 175),
        ],
        /* atk, def, str, hp, range, pray, mage */
        [60, 1, 85, 99, 99, 1, 99],
        MagicSpellbook.ANCIENT,
        true
    );

    public static OBBY_MAULER_57 = new Presetable("Obby Mauler",
        [
            new Item(ItemIdentifiers.SUPER_STRENGTH_4_), new Item(ItemIdentifiers.RANGING_POTION_4_), new Item(ItemIdentifiers.SUPER_RESTORE_4_), new Item(ItemIdentifiers.RING_OF_RECOIL),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN),
            new Item(ItemIdentifiers.TZHAAR_KET_OM), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
            new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
            new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
            new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK),
        ],
        [
            new Item(ItemIdentifiers.IRON_FULL_HELM),
            new Item(ItemIdentifiers.OBSIDIAN_CAPE),
            new Item(ItemIdentifiers.RUNE_KNIFE, 250),
            new Item(ItemIdentifiers.AMULET_OF_GLORY),
            new Item(ItemIdentifiers.IRON_PLATEBODY),
            new Item(ItemIdentifiers.UNHOLY_BOOK),
            new Item(ItemIdentifiers.BLACK_DHIDE_CHAPS),
            new Item(ItemIdentifiers.MITHRIL_GLOVES),
            new Item(ItemIdentifiers.CLIMBING_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL)
        ],
        /* atk, def, str, hp, range, pray, mage */
        [1, 1, 99, 80, 60, 31, 1],
        MagicSpellbook.NORMAL,
        true
    );

    public static MAIN_TRIBRID_126: Presetable = new Presetable("Main Tribrid",
        [
            new Item(ItemIdentifiers.AVAS_ACCUMULATOR), new Item(ItemIdentifiers.BLACK_DHIDE_BODY), new Item(ItemIdentifiers.ABYSSAL_WHIP), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
            new Item(ItemIdentifiers.RUNE_CROSSBOW), new Item(ItemIdentifiers.RUNE_PLATELEGS), new Item(ItemIdentifiers.RUNE_DEFENDER), new Item(ItemIdentifiers.SARADOMIN_BREW_4_),
            new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.COOKED_KARAMBWAN), new Item(ItemIdentifiers.DRAGON_DAGGER_P_PLUS_PLUS_), new Item(ItemIdentifiers.SUPER_RESTORE_4_),
            new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_RESTORE_4_),
            new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_STRENGTH_4_),
            new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SHARK), new Item(ItemIdentifiers.SUPER_ATTACK_4_),
            new Item(ItemIdentifiers.WATER_RUNE, 6000), new Item(ItemIdentifiers.BLOOD_RUNE, 2000), new Item(ItemIdentifiers.DEATH_RUNE, 4000), new Item(ItemIdentifiers.RANGING_POTION_4_),
        ],
        [
            new Item(ItemIdentifiers.HELM_OF_NEITIZNOT),
            new Item(ItemIdentifiers.SARADOMIN_CAPE),
            new Item(ItemIdentifiers.ANCIENT_STAFF),
            new Item(ItemIdentifiers.AMULET_OF_GLORY),
            new Item(ItemIdentifiers.MYSTIC_ROBE_TOP),
            new Item(ItemIdentifiers.SPIRIT_SHIELD),
            new Item(ItemIdentifiers.MYSTIC_ROBE_BOTTOM),
            new Item(ItemIdentifiers.BARROWS_GLOVES),
            new Item(ItemIdentifiers.CLIMBING_BOOTS),
            new Item(ItemIdentifiers.RING_OF_RECOIL),
            new Item(ItemIdentifiers.DRAGONSTONE_BOLTS_E_, 500),
        ],
        /* atk, def, str, hp, range, pray, mage */
        [99, 99, 99, 99, 99, 99, 99],
        MagicSpellbook.ANCIENT,
        true,
        ICE_BARRAGE_SPELL_ID
    );
}
