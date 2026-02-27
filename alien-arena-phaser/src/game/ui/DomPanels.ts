import {
  EVENT_COMMAND_CLOSE_CRAFT,
  EVENT_COMMAND_CLOSE_INVENTORY,
  EVENT_COMMAND_CRAFT,
  EVENT_COMMAND_DETACH_ATTACHMENT,
  EVENT_COMMAND_EQUIP_ATTACHMENT,
  EVENT_COMMAND_EQUIP_WEAPON,
  EVENT_CRAFT_REFRESH,
  EVENT_INVENTORY_REFRESH,
  EVENT_TOAST
} from "../events";

type InventoryPayload = {
  visible: boolean;
  credits: number;
  materialsText: string;
  weapons: Array<{
    instanceId: string;
    title: string;
    details: string;
    equipped: boolean;
  }>;
  attachments: Array<{
    itemId: string;
    title: string;
    details: string;
    equippedToCurrent: boolean;
  }>;
};

type CraftPayload = {
  visible: boolean;
  recipes: Array<{
    id: string;
    name: string;
    description: string;
    canCraft: boolean;
  }>;
};

export class DomPanels {
  private readonly root: HTMLDivElement;
  private readonly inventoryPanel: HTMLElement;
  private readonly craftPanel: HTMLElement;
  private readonly toastRack: HTMLDivElement;

  constructor(private readonly events: Phaser.Events.EventEmitter) {
    this.root = document.createElement("div");
    this.root.className = "dom-panels";

    this.inventoryPanel = document.createElement("section");
    this.inventoryPanel.className = "dom-panel hidden";

    this.craftPanel = document.createElement("section");
    this.craftPanel.className = "dom-panel hidden";

    this.toastRack = document.createElement("div");
    this.toastRack.className = "dom-toast-rack";

    this.root.append(this.inventoryPanel, this.craftPanel, this.toastRack);
    document.body.appendChild(this.root);

    this.events.on(EVENT_INVENTORY_REFRESH, this.renderInventory, this);
    this.events.on(EVENT_CRAFT_REFRESH, this.renderCraft, this);
    this.events.on(EVENT_TOAST, this.toast, this);
  }

  destroy(): void {
    this.events.off(EVENT_INVENTORY_REFRESH, this.renderInventory, this);
    this.events.off(EVENT_CRAFT_REFRESH, this.renderCraft, this);
    this.events.off(EVENT_TOAST, this.toast, this);
    this.root.remove();
  }

  private renderInventory = (payload: InventoryPayload): void => {
    this.inventoryPanel.classList.toggle("hidden", !payload.visible);

    if (!payload.visible) {
      return;
    }

    this.inventoryPanel.innerHTML = "";

    const head = document.createElement("div");
    head.className = "dom-panel-head";
    head.innerHTML = `<h3>Inventory</h3><button type=\"button\" data-close-inv>Close</button>`;

    const credits = document.createElement("p");
    credits.className = "dom-muted";
    credits.textContent = `Credits: ${payload.credits}`;

    const materials = document.createElement("p");
    materials.className = "dom-muted";
    materials.textContent = payload.materialsText;

    const weaponsWrap = document.createElement("div");
    weaponsWrap.className = "dom-list-wrap";
    weaponsWrap.innerHTML = "<h4>Weapons</h4>";
    const weaponsList = document.createElement("ul");

    for (let index = 0; index < payload.weapons.length; index += 1) {
      const weapon = payload.weapons[index];
      const li = document.createElement("li");
      li.innerHTML = `<strong>${weapon.title}</strong><p>${weapon.details}</p>`;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = weapon.equipped ? "Equipped" : "Equip";
      btn.disabled = weapon.equipped;
      btn.dataset.weaponId = weapon.instanceId;
      btn.dataset.action = "equip-weapon";
      li.appendChild(btn);

      weaponsList.appendChild(li);
    }

    weaponsWrap.appendChild(weaponsList);

    const attachmentWrap = document.createElement("div");
    attachmentWrap.className = "dom-list-wrap";
    attachmentWrap.innerHTML = "<h4>Attachments</h4>";
    const attachmentList = document.createElement("ul");

    for (let index = 0; index < payload.attachments.length; index += 1) {
      const item = payload.attachments[index];
      const li = document.createElement("li");
      li.innerHTML = `<strong>${item.title}</strong><p>${item.details}</p>`;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = item.equippedToCurrent ? "Detach" : "Equip to Current";
      btn.dataset.itemId = item.itemId;
      btn.dataset.action = item.equippedToCurrent ? "detach-attachment" : "equip-attachment";
      li.appendChild(btn);

      attachmentList.appendChild(li);
    }

    attachmentWrap.appendChild(attachmentList);

    this.inventoryPanel.append(head, credits, materials, weaponsWrap, attachmentWrap);

    this.inventoryPanel.onclick = event => {
      const target = event.target as HTMLElement;

      if (!target || target.tagName !== "BUTTON") {
        return;
      }

      if (target.dataset.closeInv !== undefined) {
        this.events.emit(EVENT_COMMAND_CLOSE_INVENTORY);
        return;
      }

      if (target.dataset.action === "equip-weapon" && target.dataset.weaponId) {
        this.events.emit(EVENT_COMMAND_EQUIP_WEAPON, target.dataset.weaponId);
        return;
      }

      if (target.dataset.action === "equip-attachment" && target.dataset.itemId) {
        this.events.emit(EVENT_COMMAND_EQUIP_ATTACHMENT, target.dataset.itemId);
        return;
      }

      if (target.dataset.action === "detach-attachment" && target.dataset.itemId) {
        this.events.emit(EVENT_COMMAND_DETACH_ATTACHMENT, target.dataset.itemId);
      }
    };
  };

  private renderCraft = (payload: CraftPayload): void => {
    this.craftPanel.classList.toggle("hidden", !payload.visible);

    if (!payload.visible) {
      return;
    }

    this.craftPanel.innerHTML = "";

    const head = document.createElement("div");
    head.className = "dom-panel-head";
    head.innerHTML = `<h3>Crafting</h3><button type=\"button\" data-close-craft>Close</button>`;

    const list = document.createElement("ul");
    list.className = "dom-list";

    for (let index = 0; index < payload.recipes.length; index += 1) {
      const recipe = payload.recipes[index];
      const li = document.createElement("li");
      li.innerHTML = `<strong>${recipe.name}</strong><p>${recipe.description}</p>`;

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = recipe.canCraft ? "Craft" : "Missing Materials";
      button.disabled = !recipe.canCraft;
      button.dataset.recipeId = recipe.id;
      button.dataset.action = "craft";
      li.appendChild(button);

      list.appendChild(li);
    }

    this.craftPanel.append(head, list);

    this.craftPanel.onclick = event => {
      const target = event.target as HTMLElement;

      if (!target || target.tagName !== "BUTTON") {
        return;
      }

      if (target.dataset.closeCraft !== undefined) {
        this.events.emit(EVENT_COMMAND_CLOSE_CRAFT);
        return;
      }

      if (target.dataset.action === "craft" && target.dataset.recipeId) {
        this.events.emit(EVENT_COMMAND_CRAFT, target.dataset.recipeId);
      }
    };
  };

  private toast = (message: string): void => {
    const card = document.createElement("div");
    card.className = "dom-toast";
    card.textContent = message;
    this.toastRack.appendChild(card);

    window.setTimeout(() => {
      card.remove();
    }, 2400);
  };
}
