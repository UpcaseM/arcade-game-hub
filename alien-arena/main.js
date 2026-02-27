import { AlienArenaGame } from "./js/game.js";

function boot() {
  const root = document.getElementById("alienArenaApp");

  if (!root) {
    throw new Error("Alien Arena root element not found.");
  }

  const app = new AlienArenaGame(root);
  app.init();
}

window.addEventListener("DOMContentLoaded", boot);
