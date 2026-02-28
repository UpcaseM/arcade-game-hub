export type UpgradeVisual = {
  iconKey: string;
  tint: number;
  cardBg: number;
  cardStroke: number;
  chipLabel: string;
};

const DEFAULT_VISUAL: UpgradeVisual = {
  iconKey: "icon_up_default",
  tint: 0xc7e9ff,
  cardBg: 0x1a315f,
  cardStroke: 0xa7c8ff,
  chipLabel: "GENERAL"
};

const UPGRADE_VISUALS: Record<string, UpgradeVisual> = {
  up_pierce_rounds: {
    iconKey: "icon_up_pierce_rounds",
    tint: 0xdbeeff,
    cardBg: 0x1b3054,
    cardStroke: 0xc3dcff,
    chipLabel: "PIERCE"
  },
  up_warhead: {
    iconKey: "icon_up_warhead",
    tint: 0xffbe94,
    cardBg: 0x3a2432,
    cardStroke: 0xffc1a0,
    chipLabel: "BLAST"
  },
  up_arc_chain: {
    iconKey: "icon_up_arc_chain",
    tint: 0xcfb7ff,
    cardBg: 0x2f2552,
    cardStroke: 0xd8bfff,
    chipLabel: "ARC"
  },
  up_guidance: {
    iconKey: "icon_up_guidance",
    tint: 0xa9ddff,
    cardBg: 0x1d3455,
    cardStroke: 0xb6e4ff,
    chipLabel: "GUIDED"
  },
  up_overdrive: {
    iconKey: "icon_up_overdrive",
    tint: 0xffdf9c,
    cardBg: 0x3c3220,
    cardStroke: 0xffe1a2,
    chipLabel: "HEAT"
  },
  up_phase_barrier: {
    iconKey: "icon_up_phase_barrier",
    tint: 0x95f5ff,
    cardBg: 0x15394e,
    cardStroke: 0x9cf6ff,
    chipLabel: "SHIELD"
  },
  up_close_quarters: {
    iconKey: "icon_up_close_quarters",
    tint: 0xffb1a0,
    cardBg: 0x442930,
    cardStroke: 0xffb8aa,
    chipLabel: "BRAWL"
  },
  up_overcharge_core: {
    iconKey: "icon_up_overcharge_core",
    tint: 0xfff1b7,
    cardBg: 0x3c3522,
    cardStroke: 0xfff0b0,
    chipLabel: "CORE"
  },
  up_missile_pod: {
    iconKey: "icon_up_missile_pod",
    tint: 0xffce9f,
    cardBg: 0x392a22,
    cardStroke: 0xffcda3,
    chipLabel: "POD"
  },
  up_super_weapon: {
    iconKey: "icon_up_super_weapon",
    tint: 0xffefab,
    cardBg: 0x42351f,
    cardStroke: 0xffefb4,
    chipLabel: "SUPER"
  }
};

export function getUpgradeVisual(upgradeId: string): UpgradeVisual {
  if (UPGRADE_VISUALS[upgradeId]) {
    return UPGRADE_VISUALS[upgradeId];
  }

  if (upgradeId.startsWith("up_damage")) {
    return {
      iconKey: "icon_up_warhead",
      tint: 0xffc09f,
      cardBg: 0x392636,
      cardStroke: 0xffc2a4,
      chipLabel: "DMG"
    };
  }

  if (upgradeId.startsWith("up_rate")) {
    return {
      iconKey: "icon_up_overdrive",
      tint: 0xffdfa5,
      cardBg: 0x3b2f1f,
      cardStroke: 0xffe0a4,
      chipLabel: "RATE"
    };
  }

  if (upgradeId.startsWith("up_crit")) {
    return {
      iconKey: "icon_up_arc_chain",
      tint: 0xe5c9ff,
      cardBg: 0x322655,
      cardStroke: 0xe4c6ff,
      chipLabel: "CRIT"
    };
  }

  if (upgradeId === "up_hp" || upgradeId === "up_lifesteal") {
    return {
      iconKey: "icon_up_phase_barrier",
      tint: 0xa4f6ff,
      cardBg: 0x1a3c4f,
      cardStroke: 0xa8f6ff,
      chipLabel: "SURVIVE"
    };
  }

  if (upgradeId === "up_speed" || upgradeId === "up_pickup" || upgradeId === "up_bullet_speed") {
    return {
      iconKey: "icon_up_guidance",
      tint: 0xbce7ff,
      cardBg: 0x1d3654,
      cardStroke: 0xc1eaff,
      chipLabel: "MOBILITY"
    };
  }

  return DEFAULT_VISUAL;
}
