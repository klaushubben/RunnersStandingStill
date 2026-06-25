const rows = [
  { value: "byte-mask-dither-levels", label: "byte mask dither levels" },
  { value: "ordered-dither-levels", label: "ordered dither levels" },
  { value: "byte-mask-dither", label: "byte mask dither" },
  { value: "byte-mask", label: "byte mask" },
];

const columns = [
  { value: "2", label: "2 levels" },
  { value: "4", label: "4 levels" },
  { value: "8", label: "8 levels" },
];

const storageKey = "runners-standing-still-weight-lab-likes";
const controls = Array.from(document.querySelectorAll("[data-control]"));
const matrix = document.querySelector("[data-matrix]");
const renderButton = document.querySelector("[data-render]");
const saveButton = document.querySelector("[data-save]");
const likeCount = document.querySelector("[data-like-count]");
const hashInput = document.querySelector("[data-control='hash']");
const randomHashButton = document.querySelector("[data-random-hash]");

let likedItems = loadLikedItems();
let expandedCell = null;

renderButton.addEventListener("click", renderMatrix);
saveButton.addEventListener("click", saveLikedItems);
randomHashButton.addEventListener("click", () => {
  hashInput.value = randomHash();
  renderMatrix();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && expandedCell) collapseCell(expandedCell);
});
controls.forEach((control) => {
  control.addEventListener("change", renderMatrix);
});

renderMatrix();

function renderMatrix() {
  const settings = readSettings();
  const fragment = document.createDocumentFragment();

  expandedCell = null;
  document.body.classList.remove("has-expanded-cell");

  fragment.append(cell("axis-cell", "decompose / levels"));
  columns.forEach((column) => {
    fragment.append(cell("column-header", column.label));
  });

  rows.forEach((row, rowIndex) => {
    fragment.append(cell("row-header", row.label));

    columns.forEach((column, columnIndex) => {
      const renderCell = document.createElement("div");
      const frame = document.createElement("iframe");
      const label = document.createElement("div");
      const mode = document.createElement("p");
      const levels = document.createElement("p");
      const cellSettings = {
        ...settings,
        tokenId: String(1 + rowIndex * columns.length + columnIndex),
        decomposeMode: row.value,
        compositeLevels: column.value,
      };
      const key = combinationKey(cellSettings);
      const url = renderUrl(cellSettings);

      renderCell.className = "render-cell";
      renderCell.dataset.key = key;
      frame.loading = "lazy";
      frame.title = `${row.label}, ${column.label}`;
      frame.src = url;

      label.className = "cell-label";
      mode.textContent = row.value;
      levels.textContent = `${column.value} levels`;
      label.append(mode, levels);
      renderCell.append(frame, label, renderCellActions({
        cell: renderCell,
        key,
        label: `${row.label} / ${column.label}`,
        settings: cellSettings,
        url,
      }));
      fragment.append(renderCell);
    });
  });

  matrix.replaceChildren(fragment);
  updateLikeCount();
}

function renderCellActions({ cell, key, label, settings, url }) {
  const actions = document.createElement("div");
  const likeButton = document.createElement("button");
  const expandButton = document.createElement("button");

  actions.className = "cell-actions";

  likeButton.type = "button";
  likeButton.className = "cell-action";
  likeButton.textContent = likedItems[key] ? "Liked" : "Like";
  likeButton.classList.toggle("is-liked", Boolean(likedItems[key]));
  likeButton.addEventListener("click", () => {
    toggleLike({ key, label, settings, url, button: likeButton });
  });

  expandButton.type = "button";
  expandButton.className = "cell-action";
  expandButton.textContent = "Expand";
  expandButton.addEventListener("click", () => {
    if (cell.classList.contains("is-expanded")) {
      collapseCell(cell);
      return;
    }
    expandCell(cell);
  });

  actions.append(likeButton, expandButton);
  return actions;
}

function readSettings() {
  return controls.reduce((settings, control) => {
    if (control.value !== "") settings[control.dataset.control] = control.value;
    return settings;
  }, {});
}

function renderUrl(settings) {
  const params = new URLSearchParams();
  Object.entries(settings).forEach(([key, value]) => {
    params.set(key, value);
  });
  return `./render.html?${params.toString()}`;
}

function toggleLike({ key, label, settings, url, button }) {
  if (likedItems[key]) {
    delete likedItems[key];
  } else {
    likedItems[key] = {
      label,
      renderUrl: url,
      settings,
      likedAt: new Date().toISOString(),
    };
  }
  persistLikedItems();
  button.textContent = likedItems[key] ? "Liked" : "Like";
  button.classList.toggle("is-liked", Boolean(likedItems[key]));
  updateLikeCount();
}

function expandCell(cell) {
  if (expandedCell && expandedCell !== cell) collapseCell(expandedCell);
  expandedCell = cell;
  cell.classList.add("is-expanded");
  document.body.classList.add("has-expanded-cell");
  const expandButton = cell.querySelector(".cell-action:last-child");
  if (expandButton) expandButton.textContent = "Close";
}

function collapseCell(cell) {
  cell.classList.remove("is-expanded");
  const expandButton = cell.querySelector(".cell-action:last-child");
  if (expandButton) expandButton.textContent = "Expand";
  if (expandedCell === cell) expandedCell = null;
  document.body.classList.remove("has-expanded-cell");
}

function saveLikedItems() {
  const liked = Object.values(likedItems);
  const payload = {
    project: "runners-standing-still",
    savedAt: new Date().toISOString(),
    matrix: {
      rows: rows.map((row) => row.value),
      columns: columns.map((column) => column.value),
    },
    count: liked.length,
    liked,
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json",
  });
  const link = document.createElement("a");
  const stamp = payload.savedAt.replace(/[:.]/g, "-");
  link.href = URL.createObjectURL(blob);
  link.download = `runners-standing-still-weight-likes-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function updateLikeCount() {
  const count = Object.keys(likedItems).length;
  likeCount.textContent = `${count} liked`;
}

function combinationKey(settings) {
  const params = new URLSearchParams();
  Object.keys(settings).sort().forEach((key) => {
    params.set(key, settings[key]);
  });
  return params.toString();
}

function loadLikedItems() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function persistLikedItems() {
  localStorage.setItem(storageKey, JSON.stringify(likedItems));
}

function randomHash() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function cell(className, text) {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  return element;
}
