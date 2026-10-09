"use strict";

const STORAGE_KEY = "school-festival-sales-v1";
const UNDO_STORAGE_KEY = `${STORAGE_KEY}-last-action`;
const STORAGE_VERSION = 1;
const STARTER_PRODUCTS = [
  { id: "takoyaki", name: "たこ焼き", price: 500, quantity: 0, emoji: "🐙" },
  { id: "yakisoba", name: "焼きそば", price: 600, quantity: 0, emoji: "🍜" },
  { id: "ramune", name: "ラムネ", price: 200, quantity: 0, emoji: "🥤" }
];

const productList = document.querySelector("#product-list");
const totalSales = document.querySelector("#total-sales");
const totalQuantity = document.querySelector("#total-quantity");
const menuCount = document.querySelector("#menu-count");
const addProductForm = document.querySelector("#add-product-form");
const nameInput = document.querySelector("#product-name");
const priceInput = document.querySelector("#product-price");
const formError = document.querySelector("#form-error");
const resetButton = document.querySelector("#reset-button");
const undoButton = document.querySelector("#undo-button");
const storageStatus = document.querySelector("#storage-status");

function getStorage() {
  try {
    const availableStorage = window.localStorage;
    const testKey = `${STORAGE_KEY}-availability-check`;
    availableStorage.setItem(testKey, "ok");
    availableStorage.removeItem(testKey);
    storageStatus.textContent = "このブラウザーに保存中";
    return availableStorage;
  } catch (error) {
    console.error("ブラウザーのローカルストレージを利用できません。", error);
    return null;
  }
}

const storage = getStorage();

function loadSavedState() {
  if (storage === null) {
    storageStatus.textContent = "保存できません（ブラウザーの設定を確認）";
    storageStatus.classList.add("is-unavailable");
    return { products: STARTER_PRODUCTS.map((product) => ({ ...product })), lastAction: null };
  }

  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved === null) {
      return { products: STARTER_PRODUCTS.map((product) => ({ ...product })), lastAction: null };
    }

    const data = JSON.parse(saved);
    if (Array.isArray(data)) {
      if (!data.every(isValidProduct)) {
        throw new Error("保存された商品データの形式が正しくありません。");
      }
      const savedAction = storage.getItem(UNDO_STORAGE_KEY);
      const lastAction = savedAction === null ? null : JSON.parse(savedAction);
      return { products: data, lastAction: isValidAction(lastAction, data) ? lastAction : null };
    }

    if (
      data.version !== STORAGE_VERSION
      || !Array.isArray(data.products)
      || !data.products.every(isValidProduct)
      || !isValidAction(data.lastAction, data.products)
    ) {
      throw new Error("保存された売上データの形式またはバージョンが正しくありません。");
    }
    return { products: data.products, lastAction: data.lastAction };
  } catch (error) {
    console.error("売上データを読み込めませんでした。", error);
    formError.textContent = "保存データを読み込めませんでした。ブラウザーの保存領域を確認してください。";
    return { products: STARTER_PRODUCTS.map((product) => ({ ...product })), lastAction: null };
  }
}

function isValidProduct(product) {
  return product !== null
    && typeof product.id === "string"
    && typeof product.name === "string"
    && Number.isSafeInteger(product.price)
    && product.price > 0
    && Number.isSafeInteger(product.quantity)
    && product.quantity >= 0
    && typeof product.emoji === "string";
}

function isValidAction(action, savedProducts) {
  if (action === null) {
    return true;
  }
  const product = savedProducts.find((item) => item.id === action.id);
  return product !== undefined
    && (action.amount === 1 || action.amount === -1)
    && (action.amount !== 1 || product.quantity > 0);
}

const savedState = loadSavedState();
let products = savedState.products;
let lastAction = savedState.lastAction;
let editingProductId = null;

function formatYen(amount) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function saveProducts() {
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      products,
      lastAction
    }));
    storageStatus.textContent = "このブラウザーに保存中";
    storageStatus.classList.remove("is-unavailable");
  } catch (error) {
    console.error("売上データを保存できませんでした。", error);
    storageStatus.textContent = "保存できません（ブラウザーの設定・空き容量を確認）";
    storageStatus.classList.add("is-unavailable");
    formError.textContent = "データを保存できませんでした。ブラウザーの設定や保存領域の空き容量を確認してください。";
  }
}

function render() {
  productList.replaceChildren();

  for (const product of products) {
    const card = document.createElement("article");
    card.className = "product-card";

    const info = document.createElement("div");
    info.className = "product-info";

    const emoji = document.createElement("span");
    emoji.className = "product-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = product.emoji;

    const description = document.createElement("div");
    description.className = "product-description";
    let editor = null;

    if (editingProductId === product.id) {
      editor = document.createElement("form");
      editor.className = "product-edit-form";
      editor.setAttribute("aria-label", `${product.name}の商品情報を編集`);

      const editFields = document.createElement("div");
      editFields.className = "product-edit-fields";

      const editNameLabel = document.createElement("label");
      editNameLabel.className = "field";
      editNameLabel.textContent = "商品名";
      const editNameInput = document.createElement("input");
      editNameInput.className = "edit-name-input";
      editNameInput.type = "text";
      editNameInput.maxLength = 30;
      editNameInput.required = true;
      editNameInput.value = product.name;
      editNameLabel.append(editNameInput);

      const editPriceLabel = document.createElement("label");
      editPriceLabel.className = "field";
      editPriceLabel.textContent = "価格";
      const editPriceInput = document.createElement("input");
      editPriceInput.className = "edit-price-input";
      editPriceInput.type = "number";
      editPriceInput.min = "1";
      editPriceInput.max = "999999";
      editPriceInput.step = "1";
      editPriceInput.required = true;
      editPriceInput.value = String(product.price);
      editPriceLabel.append(editPriceInput);
      editFields.append(editNameLabel, editPriceLabel);

      const editNote = document.createElement("p");
      editNote.className = "edit-note";
      editNote.textContent = "価格を変更すると、この商品の合計売上も新しい価格で再計算されます。";

      const editError = document.createElement("p");
      editError.className = "edit-error";
      editError.setAttribute("role", "alert");

      const editActions = document.createElement("div");
      editActions.className = "edit-actions";
      const cancelButton = document.createElement("button");
      cancelButton.className = "cancel-edit-button";
      cancelButton.type = "button";
      cancelButton.textContent = "キャンセル";
      cancelButton.addEventListener("click", () => {
        editingProductId = null;
        render();
      });

      const saveButton = document.createElement("button");
      saveButton.className = "save-edit-button";
      saveButton.type = "submit";
      saveButton.textContent = "変更を保存";
      editActions.append(cancelButton, saveButton);

      editor.append(editFields, editNote, editError, editActions);
      editor.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = editNameInput.value.trim();
        const price = Number(editPriceInput.value);
        if (!name || !Number.isSafeInteger(price) || price < 1 || price > 999999) {
          editError.textContent = "商品名と、1円以上999,999円以下の価格を入力してください。";
          return;
        }
        product.name = name;
        product.price = price;
        editingProductId = null;
        formError.textContent = "";
        saveProducts();
        render();
      });
    } else {
      const name = document.createElement("h3");
      name.className = "product-name";
      name.textContent = product.name;

      const detail = document.createElement("div");
      detail.className = "product-detail";
      detail.append(document.createTextNode(`${formatYen(product.price)} / 個`));

      const subtotal = document.createElement("strong");
      subtotal.textContent = formatYen(product.price * product.quantity);
      detail.append(subtotal);
      description.append(name, detail);
    }
    info.append(emoji, description);

    const actions = document.createElement("div");
    actions.className = "product-actions";

    const quantityControl = document.createElement("div");
    quantityControl.className = "quantity-control";

    const minusButton = document.createElement("button");
    minusButton.className = "minus-button";
    minusButton.type = "button";
    minusButton.textContent = "−";
    minusButton.disabled = product.quantity === 0;
    minusButton.setAttribute("aria-label", `${product.name}の販売数を1個減らす`);
    minusButton.addEventListener("click", () => changeQuantity(product.id, -1));

    const quantity = document.createElement("span");
    quantity.className = "quantity-number";
    quantity.setAttribute("aria-label", "販売数");
    quantity.textContent = product.quantity.toLocaleString("ja-JP");

    const unit = document.createElement("span");
    unit.textContent = "個";
    quantityControl.append(minusButton, quantity, unit);

    const sellButton = document.createElement("button");
    sellButton.className = "sell-button";
    sellButton.type = "button";
    sellButton.textContent = "＋ 販売";
    sellButton.setAttribute("aria-label", `${product.name}を1個販売`);
    sellButton.addEventListener("click", () => changeQuantity(product.id, 1));

    const editButton = document.createElement("button");
    editButton.className = "edit-product-button";
    editButton.type = "button";
    editButton.textContent = "編集";
    editButton.setAttribute("aria-label", `${product.name}の商品情報を編集`);
    editButton.addEventListener("click", () => {
      editingProductId = product.id;
      render();
      productList.querySelector(".edit-name-input").focus();
    });

    actions.append(editButton, quantityControl, sellButton);
    card.append(info, actions);
    if (editor !== null) {
      card.classList.add("is-editing");
      card.append(editor);
    }
    productList.append(card);
  }

  const sales = products.reduce((sum, product) => sum + product.price * product.quantity, 0);
  const quantity = products.reduce((sum, product) => sum + product.quantity, 0);
  totalSales.textContent = formatYen(sales);
  totalQuantity.innerHTML = `${quantity.toLocaleString("ja-JP")}<span class="value-unit">個</span>`;
  menuCount.textContent = `${products.length}品`;
  undoButton.disabled = lastAction === null;
}

function changeQuantity(id, amount) {
  const product = products.find((item) => item.id === id);
  if (!product || product.quantity + amount < 0) {
    return;
  }
  product.quantity += amount;
  lastAction = { id, amount };
  saveProducts();
  render();
}

undoButton.addEventListener("click", () => {
  if (lastAction === null) {
    return;
  }
  const product = products.find((item) => item.id === lastAction.id);
  if (!product || product.quantity - lastAction.amount < 0) {
    formError.textContent = "直前の操作を取り消せませんでした。";
    return;
  }
  product.quantity -= lastAction.amount;
  lastAction = null;
  formError.textContent = "";
  saveProducts();
  render();
});

addProductForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formError.textContent = "";

  const name = nameInput.value.trim();
  const price = Number(priceInput.value);
  if (!name || !Number.isSafeInteger(price) || price < 1 || price > 999999) {
    formError.textContent = "商品名と、1円以上999,999円以下の価格を入力してください。";
    return;
  }

  products.push({
    id: globalThis.crypto.randomUUID(),
    name,
    price,
    quantity: 0,
    emoji: "🍡"
  });
  saveProducts();
  render();
  addProductForm.reset();
  nameInput.focus();
});

resetButton.addEventListener("click", () => {
  if (!products.some((product) => product.quantity > 0)) {
    return;
  }
  if (!window.confirm("すべての商品の販売数と売上をリセットします。よろしいですか？")) {
    return;
  }
  products = products.map((product) => ({ ...product, quantity: 0 }));
  lastAction = null;
  formError.textContent = "";
  saveProducts();
  render();
});

render();