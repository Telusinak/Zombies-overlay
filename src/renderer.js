import './index.css';
import { games } from './data/games.js';
import { defaultHotkeys } from './config/hotkeys.js';

// ===============================
// DOM
// ===============================

const content = document.getElementById('content');
const footer = document.getElementById('footer');

// ===============================
// STATE
// ===============================

let currentScreen = 'games';

let selectedIndex = 0;
let selectedGame = null;
let selectedMap = null;
let selectedGuide = null;

let rebinding = false;
let rebindingAction = null;
let rebindError = null;

let imageViewerOpen = false;
let imageViewerImages = [];
let imageViewerIndex = 0;

const completed = {};

const forbiddenKeys = [
  'Escape',
  'Enter',
  'Backspace',
  'Tab',
  ' '
];

// ===============================
// HOTKEYS
// ===============================

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

function syncHotkeysWithMain() {
  Object.entries(hotkeys).forEach(([action, key]) => {
    window.electronAPI.updateHotkey(action, key);
  });
}

// ===============================
// DATA / ITEMS
// ===============================

function getItems() {
  if (currentScreen === 'games') {
    return [
      ...games,
      {
        id: 'settings',
        name: 'Configuración',
        type: 'settings',
        fixedBottom: true
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

function isRecipeScreen() {
  return currentScreen === 'steps' || currentScreen === 'relics';
}

function isMenuScreen() {
  return (
    currentScreen === 'games' ||
    currentScreen === 'maps' ||
    currentScreen === 'guides' ||
    currentScreen === 'settings'
  );
}

// ===============================
// PROGRESS
// ===============================

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
  if (!isRecipeScreen()) return null;

  const items = getItems();
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

function backRecipeStep() {
  const key = getProgressKey();

  if (key && completed[key]?.length > 0) {
    completed[key].pop();
  }

  render();
}

function resetCurrentRecipe() {
  const key = getProgressKey();

  if (key) {
    completed[key] = [];
  }
}

// ===============================
// IMAGE VIEWER
// ===============================

function getCurrentRecipeItem() {
  if (!isRecipeScreen()) return null;

  const items = getItems();
  const index = getCurrentStepIndex();

  return items[index] || null;
}

function getItemImages(item) {
  if (item?.images?.length) {
    return item.images;
  }

  if (item?.image) {
    return [item.image];
  }

  return [];
}

function openCurrentImage() {
  const item = getCurrentRecipeItem();
  const images = getItemImages(item);

  if (!images.length) return;

  imageViewerOpen = true;
  imageViewerImages = images;
  imageViewerIndex = 0;

  render();
}

function closeImageViewer() {
  imageViewerOpen = false;
  imageViewerImages = [];
  imageViewerIndex = 0;

  render();
}

function toggleCurrentImage() {
  if (imageViewerOpen) {
    closeImageViewer();
    return;
  }

  openCurrentImage();
}

function nextViewerImage() {
  if (!imageViewerOpen) return;

  imageViewerIndex = Math.min(
    imageViewerIndex + 1,
    imageViewerImages.length - 1
  );

  render();
}

function previousViewerImage() {
  if (!imageViewerOpen) return;

  imageViewerIndex = Math.max(
    imageViewerIndex - 1,
    0
  );

  render();
}

// ===============================
// NAVIGATION
// ===============================

function menuUp() {
  if (!isMenuScreen()) return;

  selectedIndex = Math.max(selectedIndex - 1, 0);

  render();
}

function menuDown() {
  if (!isMenuScreen()) return;

  const items = getItems();

  selectedIndex = Math.min(
    selectedIndex + 1,
    items.length - 1
  );

  render();
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
    syncHotkeysWithMain();

    render();
    return;
  }

  if (currentScreen === 'games') {
    selectedGame = selected;
    selectedIndex = 0;
    currentScreen = 'maps';
  }

  else if (currentScreen === 'settings') {
    rebinding = true;
    rebindingAction = selected.key;
    rebindError = null;

    window.electronAPI.setRebinding(true);

    render();
    return;
  }

  else if (currentScreen === 'maps') {
    if (selected.type === 'relics') {
      currentScreen = 'relics';
    } else {
      selectedMap = selected;
      currentScreen = 'guides';
    }

    selectedIndex = 0;
  }

  else if (currentScreen === 'guides') {
    selectedGuide = selected;
    selectedIndex = 0;
    currentScreen = 'steps';
  }

  else if (isRecipeScreen()) {
    advanceRecipe();
    return;
  }

  render();
}

function exitMenu() {
  if (isRecipeScreen()) {
    resetCurrentRecipe();
  }

  if (currentScreen === 'steps') {
    currentScreen = 'guides';
  }

  else if (currentScreen === 'relics') {
    currentScreen = 'maps';
  }

  else if (currentScreen === 'guides') {
    currentScreen = 'maps';
  }

  else if (currentScreen === 'maps') {
    currentScreen = 'games';
  }

  else if (currentScreen === 'settings') {
    currentScreen = 'games';
  }

  render();
}

// ===============================
// RENDER HELPERS
// ===============================

function getScreenTitle() {
  if (currentScreen === 'games') return 'Juegos';
  if (currentScreen === 'settings') return 'Configuración';
  if (currentScreen === 'maps') return selectedGame.name;
  if (currentScreen === 'guides') return selectedMap.name;
  if (currentScreen === 'steps') return selectedGuide.name;
  if (currentScreen === 'relics') return 'Reliquias';

  return '';
}

function renderFooter() {
  if (isRecipeScreen()) {
    footer.innerHTML = `
      <span>${hotkeys.previous} Paso anterior</span>
      <span>${hotkeys.complete} Paso siguiente</span>
      <span>${hotkeys.exit} Salir</span>
      <span>${hotkeys.zoomImage} Imagen</span>
      <span>${hotkeys.toggleHud} Ocultar HUD</span>
    `;

    return;
  }

  footer.innerHTML = `
    <span>↑ ↓ Navegar</span>
    <span>Enter Seleccionar</span>
    <span>Esc Menú anterior</span>
    <span>${hotkeys.toggleHud} Ocultar / Mostrar</span>
  `;
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

function renderImageViewer() {
  const src = imageViewerImages[imageViewerIndex];

  content.innerHTML = `
    <div class="image-viewer">
      <img src="${src}" />

      <div class="description">
        ${hotkeys.zoomImage} cerrar imagen
        ${
          imageViewerImages.length > 1
            ? ` | ↑ anterior | ↓ siguiente | ${imageViewerIndex + 1}/${imageViewerImages.length}`
            : ''
        }
      </div>
    </div>
  `;
}

function renderRebindingBox() {
  if (!rebinding) return;

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

function renderErrorBox() {
  if (!rebindError) return;

  const error = document.createElement('div');
  error.className = 'menu-item error-box';
  error.textContent = rebindError;

  content.appendChild(error);
}

function renderCompletedBox() {
  const progress = getProgress();

  if (
    !progress ||
    progress.total === 0 ||
    progress.current < progress.total
  ) {
    return;
  }

  const completedBox = document.createElement('div');
  completedBox.className = 'completed-box';

  completedBox.innerHTML = `
    <strong>Guía completada</strong>
    <span>Presioná ${hotkeys.exit} para salir</span>
  `;

  content.appendChild(completedBox);
}

function renderSectionTitle(item, previousItem) {
  if (
    !isRecipeScreen() ||
    !item.section ||
    item.section === previousItem?.section
  ) {
    return;
  }

  const sectionTitle = document.createElement('div');

  const sectionClass = item.section
    .toLowerCase()
    .replace(/\s+/g, '-');

  sectionTitle.className =
    `section-title section-${sectionClass}`;

  sectionTitle.textContent = item.section;

  content.appendChild(sectionTitle);
}

function renderMenuItem(item, index, recipeMode, currentRecipeIndex) {
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

  const showThumbnail =
    currentScreen === 'relics' &&
    item.image;

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

      ${
        showThumbnail
          ? `
            <img
              class="relic-thumbnail"
              src="${item.image}"
            />
          `
          : ''
      }

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
      currentStep
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
            item.images?.length
              ? `
                <div class="guide-gallery">
                  ${item.images
                    .map(
                      (img) => `
                        <img
                          class="guide-image"
                          src="${img}"
                        />
                      `
                    )
                    .join('')}
                </div>
              `
              : item.image && currentScreen !== 'relics'
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
}

function renderSettingsButton(items) {
  if (currentScreen !== 'games') return;

  const settingsIndex = items.findIndex(
    (item) => item.type === 'settings'
  );

  const settingsButton = document.createElement('div');

  settingsButton.className = 'settings-button';

  if (selectedIndex === settingsIndex) {
    settingsButton.classList.add('selected');
  }

  settingsButton.innerHTML = '<span>⚙ CONFIGURACIÓN</span>';

  settingsButton.onclick = () => {
    currentScreen = 'settings';
    selectedIndex = 0;

    render();
  };

  content.appendChild(settingsButton);
}

// ===============================
// RENDER
// ===============================

function render() {
  const items = getItems();

  renderFooter();

  content.innerHTML = '';

  if (imageViewerOpen && imageViewerImages.length) {
    renderImageViewer();
    return;
  }

  const title = document.createElement('h2');
  title.textContent = getScreenTitle();
  content.appendChild(title);

  renderRebindingBox();
  renderErrorBox();
  renderProgress();
  renderCompletedBox();

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'menu-item';
    empty.textContent = 'No hay contenido';
    content.appendChild(empty);
    return;
  }

  const recipeMode = isRecipeScreen();
  const currentRecipeIndex = getCurrentStepIndex();

  let startIndex = 0;
  let visibleItems = items;

  if (recipeMode) {
    startIndex = Math.max(
      0,
      currentRecipeIndex - 2
    );

    visibleItems = items.slice(
      startIndex,
      startIndex + 6
    );
  }

  visibleItems.forEach((item, visibleIndex) => {
    if (item.fixedBottom) return;

    const index = recipeMode
      ? startIndex + visibleIndex
      : visibleIndex;

    const previousItem = items[index - 1];

    renderSectionTitle(item, previousItem);
    renderMenuItem(
      item,
      index,
      recipeMode,
      currentRecipeIndex
    );
  });

  renderSettingsButton(items);

  const currentElement =
    content.querySelector('.menu-item.selected');

  if (currentElement) {
    currentElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}

// ===============================
// REBINDING
// ===============================

function handleRebinding(pressedKey) {
  if (forbiddenKeys.includes(pressedKey)) {
    rebindError = 'Esa tecla está reservada y no se puede usar.';
    render();
    return;
  }

  const alreadyUsed = Object.entries(hotkeys).find(
    ([action, key]) =>
      action !== rebindingAction &&
      key === pressedKey
  );

  if (alreadyUsed) {
    rebindError = 'Esa tecla ya está asignada a otra acción.';
    render();
    return;
  }

  hotkeys[rebindingAction] = pressedKey;

  saveHotkeys();

  window.electronAPI.updateHotkey(
    rebindingAction,
    pressedKey
  );

  window.electronAPI.setRebinding(false);

  rebindError = null;
  rebinding = false;
  rebindingAction = null;

  render();
}

// ===============================
// INPUT HANDLERS
// ===============================

function handleLocalKeydown(event) {
  const pressedKey = normalizeKey(event.key);

  if (imageViewerOpen) {
    event.preventDefault();

    if (pressedKey === hotkeys.zoomImage) {
      toggleCurrentImage();
      return;
    }

    if (pressedKey === 'Down') {
      nextViewerImage();
      return;
    }

    if (pressedKey === 'Up') {
      previousViewerImage();
      return;
    }

    return;
  }

  if (rebinding) {
    event.preventDefault();
    handleRebinding(pressedKey);
    return;
  }

  if (isRecipeScreen()) {
    if (pressedKey === hotkeys.complete) {
      advanceRecipe();
      return;
    }

    if (pressedKey === hotkeys.previous) {
      backRecipeStep();
      return;
    }
  }

  if (isMenuScreen()) {
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
    backRecipeStep();
    return;
  }

  if (
    pressedKey === hotkeys.exit ||
    pressedKey === 'Escape'
  ) {
    exitMenu();
    return;
  }

  if (pressedKey === hotkeys.zoomImage) {
    toggleCurrentImage();
  }
}

function handleGuideAction(action) {
  if (imageViewerOpen) {
    if (action === 'zoomImage') {
      toggleCurrentImage();
      return;
    }

    if (action === 'menuDown') {
      nextViewerImage();
      return;
    }

    if (action === 'menuUp') {
      previousViewerImage();
      return;
    }

    return;
  }

  if (action === 'enter') {
    enter();
    return;
  }

  if (action === 'escape') {
    exitMenu();
    return;
  }

  if (action === 'menuUp') {
    if (isRecipeScreen()) {
      backRecipeStep();
    } else {
      menuUp();
    }

    return;
  }

  if (action === 'menuDown') {
    if (isRecipeScreen()) {
      advanceRecipe();
    } else {
      menuDown();
    }

    return;
  }

  if (action === 'exit') {
    exitMenu();
    return;
  }

  if (action === 'zoomImage') {
    toggleCurrentImage();
  }
}

function handleHudVisibility(value) {
  const hud = document.getElementById('hud');

  if (value === 'show') {
    hud.classList.remove('hud-hidden');
    hud.classList.add('hud-visible');
  }

  if (value === 'hide') {
    hud.classList.remove('hud-visible');
    hud.classList.add('hud-hidden');
  }
}

// ===============================
// INIT
// ===============================

document.addEventListener(
  'keydown',
  handleLocalKeydown
);

window.electronAPI.onGuideAction(
  handleGuideAction
);

window.electronAPI.onHudVisibility(
  handleHudVisibility
);

syncHotkeysWithMain();

render();