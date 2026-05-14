import './index.css';
import { games } from './data/games.js';
import { defaultHotkeys } from './config/hotkeys.js';

const content = document.getElementById('content');
const footer = document.getElementById('footer');

let currentScreen = 'games';
let selectedGuide = null;

let rebinding = false;
let rebindingAction = null;
let rebindError = null;

const forbiddenKeys = [
  'Escape',
  'Enter',
  'Backspace',
  'Tab',
  ' '
];

let selectedIndex = 0;
let selectedGame = null;
let selectedMap = null;

let imageViewerOpen = false;
let imageViewerSrc = null;
let compactMode = false;

const completed = {};

const savedHotkeys = localStorage.getItem('zombies-hotkeys');

const hotkeys = savedHotkeys
  ? {
      ...defaultHotkeys,
      ...JSON.parse(savedHotkeys)
    }
  : { ...defaultHotkeys };

saveHotkeys();

function normalizeKey(key) {
  if (key === 'ArrowUp') return 'Up';
  if (key === 'ArrowDown') return 'Down';
  if (key === 'ArrowLeft') return 'Left';
  if (key === 'ArrowRight') return 'Right';

  return key;
}

function saveHotkeys() {
  localStorage.setItem(
    'zombies-hotkeys',
    JSON.stringify(hotkeys)
  );
}

function toggleCompactMode() {
  compactMode = !compactMode;
  render();
}

function getItems() {
  if (currentScreen === 'games') {
    return [
      ...games,
      {
        id: 'settings',
        name: 'Configuración',
        type: 'settings'
      }
    ];
  }

  if (currentScreen === 'maps') {
    const maps = selectedGame.maps || [];

    const relics =
      selectedGame.relics?.length > 0
        ? [
            {
              id: 'relics',
              name: 'Reliquias',
              type: 'relics'
            }
          ]
        : [];

    return [...maps, ...relics];
  }

  if (currentScreen === 'guides') {
    return selectedMap.guides || [];
  }

  if (currentScreen === 'steps') {
    return selectedGuide.steps || [];
  }

  if (currentScreen === 'relics') {
    return selectedGame.relics || [];
  }

  if (currentScreen === 'settings') {
    return [
      {
        label: 'Paso anterior',
        key: 'previous'
      },
      {
        label: 'Paso siguiente',
        key: 'complete'
      },
      {
        label: 'Abrir / cerrar imagen',
        key: 'zoomImage'
      },
      {
        label: 'Salir guía',
        key: 'exit'
      },
      {
        label: 'Ocultar HUD',
        key: 'toggleHud'
      },
      {
        label: 'Restaurar teclas por defecto',
        key: 'resetHotkeys',
        type: 'reset-hotkeys'
      }
    ];
  }

  return [];
}

function getProgressKey() {
  if (currentScreen === 'steps') {
    return `guide-${selectedMap.id}-${selectedGuide.id}`;
  }

  if (currentScreen === 'relics') {
    return `relics-${selectedGame.id}`;
  }

  return null;
}

function getCurrentStepIndex() {
  const key = getProgressKey();

  if (!key) return 0;

  return completed[key]?.length || 0;
}

function getProgress() {
  const items = getItems();

  if (currentScreen !== 'steps' && currentScreen !== 'relics') {
    return null;
  }

  const current = getCurrentStepIndex();

  const percent =
    items.length === 0
      ? 0
      : Math.round((current / items.length) * 100);

  return {
    current,
    total: items.length,
    percent
  };
}

function getCurrentRecipeItem() {
  if (
    currentScreen !== 'steps' &&
    currentScreen !== 'relics'
  ) {
    return null;
  }

  const items = getItems();
  const index = getCurrentStepIndex();

  return items[index] || null;
}

function openCurrentImage() {
  const item = getCurrentRecipeItem();

  if (!item?.image) return;

  imageViewerOpen = true;
  imageViewerSrc = item.image;

  render();
}

function closeImageViewer() {
  imageViewerOpen = false;
  imageViewerSrc = null;

  render();
}

function toggleCurrentImage() {
  if (imageViewerOpen) {
    closeImageViewer();
    return;
  }

  openCurrentImage();
}

function menuUp() {
  if (
    currentScreen !== 'games' &&
    currentScreen !== 'maps' &&
    currentScreen !== 'guides' &&
    currentScreen !== 'settings'
  ) {
    return;
  }

  selectedIndex = Math.max(selectedIndex - 1, 0);
  render();
}

function menuDown() {
  if (
    currentScreen !== 'games' &&
    currentScreen !== 'maps' &&
    currentScreen !== 'guides' &&
    currentScreen !== 'settings'
  ) {
    return;
  }

  const items = getItems();

  selectedIndex = Math.min(
    selectedIndex + 1,
    items.length - 1
  );

  render();
}

function renderProgress() {
  const progress = getProgress();

  if (!progress) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'progress-wrapper';

  wrapper.innerHTML = `
    <div class="progress-info">
      <span>Progreso</span>
      <span>${progress.percent}%</span>
    </div>

    <div class="progress-bar">
      <div
        class="progress-fill"
        style="width: ${progress.percent}%"
      ></div>
    </div>

    <div class="progress-count">
      ${progress.current} / ${progress.total} completado
    </div>
  `;

  content.appendChild(wrapper);
}

function renderFooter() {
  if (
    currentScreen === 'steps' ||
    currentScreen === 'relics'
  ) {
    footer.innerHTML = `
      <span>${hotkeys.previous} Paso anterior</span>
      <span>${hotkeys.complete} Paso siguiente</span>
      <span>${hotkeys.exit} Salir</span>
      <span>${hotkeys.zoomImage} Imagen</span>
      <span>${hotkeys.toggleHud} Ocultar HUD</span>
    `;
  } else {
    footer.innerHTML = `
      <span>↑ ↓ Navegar</span>
      <span>Enter Seleccionar</span>
      <span>Esc Menú anterior</span>
      <span>${hotkeys.toggleHud} Ocultar / Mostrar</span>
    `;
  }
}

function render() {
  const items = getItems();

  renderFooter();

  content.innerHTML = '';

  if (imageViewerOpen && imageViewerSrc) {
    content.innerHTML = `
      <div class="image-viewer">
        <img src="${imageViewerSrc}" />
        <div class="description">
          ${hotkeys.zoomImage} para cerrar imagen
        </div>
      </div>
    `;

    return;
  }

  const title = document.createElement('h2');

  switch (currentScreen) {
    case 'games':
      title.textContent = 'Juegos';
      break;
    case 'settings':
      title.textContent = 'Configuración';
      break;
    case 'maps':
      title.textContent = selectedGame.name;
      break;
    case 'guides':
      title.textContent = selectedMap.name;
      break;
    case 'steps':
      title.textContent = selectedGuide.name;
      break;
    case 'relics':
      title.textContent = 'Reliquias';
      break;
  }

  content.appendChild(title);

  if (rebinding) {
    const waiting = document.createElement('div');
    waiting.className = 'menu-item selected';

    waiting.innerHTML = `
      <div class="item-title">
        Esperando tecla...
      </div>

      <div class="description">
        Presioná una tecla libre. No se permiten teclas reservadas.
      </div>
    `;

    content.appendChild(waiting);
  }

  if (rebindError) {
    const error = document.createElement('div');
    error.className = 'menu-item error-box';
    error.textContent = rebindError;
    content.appendChild(error);
  }

  renderProgress();

  const progress = getProgress();

  if (
    progress &&
    progress.total > 0 &&
    progress.current >= progress.total
  ) {
    const completedBox = document.createElement('div');
    completedBox.className = 'completed-box';

    completedBox.innerHTML = `
      <strong>Guía completada</strong>
      <span>Presioná ${hotkeys.exit} para salir</span>
    `;

    content.appendChild(completedBox);
  }

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'menu-item';
    empty.textContent = 'No hay contenido';
    content.appendChild(empty);
    return;
  }

  const recipeMode =
    currentScreen === 'steps' ||
    currentScreen === 'relics';

  const currentRecipeIndex = getCurrentStepIndex();

  items.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'menu-item';

    const completedStep =
      recipeMode &&
      index < currentRecipeIndex;

    const currentStep =
      recipeMode
        ? index === currentRecipeIndex
        : index === selectedIndex;

    if (completedStep) {
      div.classList.add('done');
    }

    if (currentStep) {
      div.classList.add('selected');
    }

    const itemTitle =
      item.label ||
      item.name ||
      item.title;

    const hotkeyText =
      item.key && item.type !== 'reset-hotkeys'
        ? hotkeys[item.key]
        : '';

    div.innerHTML = `
      <div class="item-row">
        <span class="check">
          ${
            recipeMode
              ? completedStep
                ? '✓'
                : currentStep
                ? '➜'
                : '○'
              : currentStep
              ? '➜'
              : ''
          }
        </span>

        <span class="item-title">
          ${itemTitle}
        </span>

        ${
          hotkeyText
            ? `
              <span class="hotkey-value">
                ${hotkeyText}
              </span>
            `
            : ''
        }
      </div>

      ${
        currentStep && !compactMode
          ? `
            ${
              item.description
                ? `
                  <div class="description">
                    ${item.description}
                  </div>
                `
                : ''
            }

            ${
              item.image
                ? `
                  <div class="image-wrap">
                    <img
                      class="guide-image"
                      src="${item.image}"
                    />
                  </div>
                `
                : ''
            }
          `
          : ''
      }
    `;

    content.appendChild(div);
  });

  const currentElement = content.querySelector('.menu-item.selected');

  if (currentElement) {
    currentElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}

function enter() {
  const items = getItems();
  const selected = items[selectedIndex];

  if (!selected) return;

  if (selected.type === 'settings') {
    currentScreen = 'settings';
    selectedIndex = 0;
    render();
    return;
  }

  if (selected.type === 'reset-hotkeys') {
    Object.assign(hotkeys, defaultHotkeys);

    saveHotkeys();

    Object.entries(hotkeys).forEach(([action, key]) => {
      window.electronAPI.updateHotkey(action, key);
    });

    render();
    return;
  }

  if (currentScreen === 'games') {
    selectedGame = selected;
    selectedIndex = 0;
    currentScreen = 'maps';
  } else if (currentScreen === 'settings') {
    rebinding = true;
    rebindingAction = selected.key;
    rebindError = null;
    render();
    return;
  } else if (currentScreen === 'maps') {
    if (selected.type === 'relics') {
      currentScreen = 'relics';
    } else {
      selectedMap = selected;
      currentScreen = 'guides';
    }

    selectedIndex = 0;
  } else if (currentScreen === 'guides') {
    selectedGuide = selected;
    currentScreen = 'steps';
    selectedIndex = 0;
  } else if (
    currentScreen === 'steps' ||
    currentScreen === 'relics'
  ) {
    advanceRecipe();
    return;
  }

  render();
}

function advanceRecipe() {
  const key = getProgressKey();

  if (!key) return;

  if (!completed[key]) {
    completed[key] = [];
  }

  const items = getItems();

  if (completed[key].length >= items.length) {
    return;
  }

  const nextItem = items[completed[key].length];

  completed[key].push(
    nextItem.id ||
      nextItem.name ||
      nextItem.title
  );

  render();
}

function back() {
  const key = getProgressKey();

  if (key && completed[key]?.length > 0) {
    completed[key].pop();
  }

  render();
}

function exitRecipeMenu() {
  const key = getProgressKey();

  if (key) {
    completed[key] = [];
  }

  if (currentScreen === 'steps') {
    currentScreen = 'guides';
  } else if (currentScreen === 'relics') {
    currentScreen = 'maps';
  } else if (currentScreen === 'guides') {
    currentScreen = 'maps';
  } else if (currentScreen === 'maps') {
    currentScreen = 'games';
  } else if (currentScreen === 'settings') {
    currentScreen = 'games';
  }

  render();
}

document.addEventListener('keydown', (event) => {
  const pressedKey = normalizeKey(event.key);

  if (imageViewerOpen) {
    if (pressedKey === hotkeys.zoomImage) {
      toggleCurrentImage();
    }

    return;
  }

  if (rebinding) {
    event.preventDefault();

    const newKey = normalizeKey(event.key);

    if (forbiddenKeys.includes(newKey)) {
      rebindError = 'Esa tecla está reservada y no se puede usar.';
      render();
      return;
    }

    const alreadyUsed = Object.entries(hotkeys).find(
      ([action, key]) =>
        action !== rebindingAction &&
        key === newKey
    );

    if (alreadyUsed) {
      rebindError = 'Esa tecla ya está asignada a otra acción.';
      render();
      return;
    }

    hotkeys[rebindingAction] = newKey;

    saveHotkeys();

    window.electronAPI.updateHotkey(
      rebindingAction,
      newKey
    );

    rebindError = null;
    rebinding = false;
    rebindingAction = null;

    render();
    return;
  }

  if (
    currentScreen === 'steps' ||
    currentScreen === 'relics'
  ) {
    if (pressedKey === hotkeys.complete) {
      advanceRecipe();
      return;
    }

    if (pressedKey === hotkeys.previous) {
      back();
      return;
    }
  }

  if (
    currentScreen === 'games' ||
    currentScreen === 'maps' ||
    currentScreen === 'guides' ||
    currentScreen === 'settings'
  ) {
    if (pressedKey === 'Down') {
      menuDown();
      return;
    }

    if (pressedKey === 'Up') {
      menuUp();
      return;
    }
  }

  if (
    pressedKey === hotkeys.complete ||
    pressedKey === 'Enter' ||
    pressedKey === ' '
  ) {
    event.preventDefault();
    enter();
    return;
  }

  if (
    pressedKey === hotkeys.previous ||
    pressedKey === 'Backspace'
  ) {
    back();
    return;
  }

  if (
    pressedKey === hotkeys.exit ||
    pressedKey === 'Escape'
  ) {
    exitRecipeMenu();
    return;
  }

  if (pressedKey === 'Tab') {
    event.preventDefault();
    toggleCompactMode();
    return;
  }

  if (pressedKey === hotkeys.zoomImage) {
    toggleCurrentImage();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.altKey) {
    window.electronAPI.setClickThrough(false);
  }
});

window.addEventListener('keyup', () => {
  window.electronAPI.setClickThrough(true);
});

window.electronAPI.onGuideAction((action) => {
  if (action === 'menuUp') {
    if (
      currentScreen === 'steps' ||
      currentScreen === 'relics'
    ) {
      back();
    } else {
      menuUp();
    }
  }

  if (action === 'menuDown') {
    if (
      currentScreen === 'steps' ||
      currentScreen === 'relics'
    ) {
      advanceRecipe();
    } else {
      menuDown();
    }
  }

  if (action === 'complete') {
    enter();
  }

  if (action === 'previous') {
    back();
  }

  if (action === 'exit') {
    exitRecipeMenu();
  }

  if (action === 'zoomImage') {
    toggleCurrentImage();
  }
});

Object.entries(hotkeys).forEach(([action, key]) => {
  window.electronAPI.updateHotkey(action, key);
});

render();