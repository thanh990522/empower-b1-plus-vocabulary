import course from "./data.js";

const STORAGE_KEY = "empower-b1-plus-progress-v1";
const CAMBRIDGE_AUDIO_BASE = "https://dictionary.cambridge.org/media/english/us_pron/";
const MATCH_SIZE = 6;

const els = {
  unitSelect: document.querySelector("#unit-select"),
  searchInput: document.querySelector("#search-input"),
  clearSearch: document.querySelector("#clear-search"),
  searchField: document.querySelector(".search-field"),
  sectionTabs: document.querySelector("#section-tabs"),
  modeTabs: [...document.querySelectorAll(".mode-tab")],
  modeContent: document.querySelector("#mode-content"),
  unitKicker: document.querySelector("#unit-kicker"),
  unitTitle: document.querySelector("#unit-title"),
  unitSubtitle: document.querySelector("#unit-subtitle"),
  unitBadges: document.querySelector("#unit-badges"),
  sectionTitle: document.querySelector("#section-title"),
  sectionSource: document.querySelector("#section-source"),
  progressLabel: document.querySelector("#progress-label"),
  progressBar: document.querySelector("#progress-bar"),
  progressDetail: document.querySelector("#progress-detail"),
  toast: document.querySelector("#toast"),
};

const state = {
  unitIndex: unitIndexFromHash(),
  sectionIndex: 0,
  mode: "learn",
  query: "",
  learned: loadLearned(),
  flashOrder: [],
  flashIndex: 0,
  flashFlipped: false,
  matchRound: null,
  matchFirst: null,
  matchLocked: false,
  activeAudio: null,
  toastTimer: null,
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function unitIndexFromHash() {
  const match = window.location.hash.match(/unit-(\d+)/);
  const number = Number(match?.[1] || 1);
  const index = course.units.findIndex((unit) => unit.number === number);
  return index < 0 ? 0 : index;
}

function loadLearned() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

function saveLearned() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.learned]));
}

function currentUnit() { return course.units[state.unitIndex]; }
function currentSection() { return currentUnit().sections[state.sectionIndex]; }
function wordKey(word, section = currentSection(), unit = currentUnit()) { return `${unit.id}:${section.id}:${word.word.toLowerCase()}`; }

function unitWords(unit = currentUnit()) {
  return unit.sections.flatMap((section) => section.words.map((word) => ({ ...word, sectionId: section.id, sectionLabel: section.label, sectionSource: section.source })));
}

function sectionWords() {
  if (!state.query) return currentSection().words;
  const query = state.query.toLocaleLowerCase("vi");
  return unitWords().filter((word) => [word.word, word.meaning, word.ipa, word.type, word.level, word.sectionLabel].some((value) => value.toLocaleLowerCase("vi").includes(query)));
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  state.toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function renderStats() {
  document.querySelector("#top-entry-count").textContent = course.stats.entries.toLocaleString("vi-VN");
  document.querySelector("#top-reading-count").textContent = course.stats.reading.toLocaleString("vi-VN");
  document.querySelector("#hero-advanced-count").textContent = course.stats.advanced.toLocaleString("vi-VN");
}

function renderUnitSelector() {
  els.unitSelect.innerHTML = course.units.map((unit) => {
    const count = unit.sections.reduce((sum, section) => sum + section.words.length, 0);
    return `<option value="${unit.id}" ${unit.id === currentUnit().id ? "selected" : ""}>Unit ${unit.number} · ${escapeHtml(unit.title)} (${count})</option>`;
  }).join("");
}

function renderUnitIntro() {
  const unit = currentUnit();
  const words = unitWords(unit);
  const reading = words.filter((word) => word.sectionLabel.startsWith("Reading")).length;
  const advanced = words.filter((word) => word.level !== "B1+").length;
  els.unitKicker.textContent = `UNIT ${unit.number}`;
  els.unitTitle.textContent = unit.title;
  els.unitSubtitle.textContent = unit.subtitle;
  els.unitBadges.innerHTML = `<span>${words.length} mục từ</span><span>${reading} từ Reading</span><span>${advanced} từ B2–C1</span>`;
  document.title = `Unit ${unit.number}: ${unit.title} | Empower Second Edition B1+`;
}

function renderProgress() {
  const unit = currentUnit();
  const words = unitWords(unit);
  const learned = words.filter((word) => {
    const section = unit.sections.find((item) => item.id === word.sectionId);
    return state.learned.has(wordKey(word, section, unit));
  }).length;
  const percent = words.length ? Math.round(learned / words.length * 100) : 0;
  els.progressLabel.textContent = `${percent}%`;
  els.progressBar.style.width = `${percent}%`;
  els.progressDetail.textContent = `${learned} / ${words.length} từ đã thuộc`;
}

function renderSectionTabs() {
  const unit = currentUnit();
  els.sectionTabs.innerHTML = unit.sections.map((section, index) => {
    const learned = section.words.filter((word) => state.learned.has(wordKey(word, section, unit))).length;
    return `<button type="button" class="section-tab ${index === state.sectionIndex ? "active" : ""}" data-section="${index}" data-color="${section.color}" role="tab" aria-selected="${index === state.sectionIndex}">
      <span class="tab-top"><span class="tab-icon">${section.icon}</span><span class="tab-count">${learned}/${section.words.length}</span></span>
      <strong>${escapeHtml(section.label)}</strong>
    </button>`;
  }).join("");
}

function renderSectionHeader() {
  if (state.query) {
    els.sectionTitle.textContent = `Kết quả tìm kiếm “${state.query}”`;
    els.sectionSource.textContent = `Tìm trong toàn bộ Unit ${currentUnit().number}`;
    return;
  }
  els.sectionTitle.textContent = currentSection().label;
  els.sectionSource.textContent = currentSection().source;
}

function renderModeTabs() {
  els.modeTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === state.mode);
    tab.setAttribute("aria-selected", tab.dataset.mode === state.mode ? "true" : "false");
  });
}

function advancedClass(level) {
  return level === "B1+" ? "" : "advanced";
}

function sourceShort(source) {
  return source.replace(/ \(SB /, " · SB ").replace(/\)$/, "");
}

function renderLearn() {
  const words = sectionWords();
  if (!words.length) {
    els.modeContent.innerHTML = `<div class="empty-state"><b>⌕</b><h4>Không tìm thấy mục phù hợp</h4><p>Hãy thử một từ khóa ngắn hơn.</p></div>`;
    return;
  }

  const note = state.query
    ? `<div class="result-note"><span>Tìm thấy <strong>${words.length}</strong> mục trong Unit ${currentUnit().number}</span><button type="button" data-action="clear-search">Xóa tìm kiếm</button></div>`
    : `<div class="result-note"><span><strong>${words.length}</strong> mục · Nhấn 🔊 để nghe và ✓ để đánh dấu đã thuộc</span><span>${escapeHtml(currentSection().source)}</span></div>`;

  els.modeContent.innerHTML = `${note}<div class="table-scroll"><table class="vocab-table">
    <thead><tr><th>No.</th><th>English word / phrase</th><th>IPA (US)</th><th>Type & level</th><th>Vietnamese meaning</th><th>Actions</th></tr></thead>
    <tbody>${words.map((word, index) => {
      const section = state.query ? currentUnit().sections.find((item) => item.id === word.sectionId) : currentSection();
      const learned = state.learned.has(wordKey(word, section));
      return `<tr>
        <td>${index + 1}</td>
        <td class="word-cell"><strong>${escapeHtml(word.word)}</strong><small>${escapeHtml(word.band)}</small></td>
        <td><span class="ipa">${escapeHtml(word.ipa)}</span></td>
        <td><span class="type-label">${escapeHtml(word.type)}</span><span class="level ${advancedClass(word.level)}">${escapeHtml(word.level)}</span></td>
        <td><span class="meaning">${escapeHtml(word.meaning)}</span><small class="source-mini">${escapeHtml(sourceShort(word.sectionSource || word.source))}</small></td>
        <td><div class="actions"><button class="icon-btn" type="button" data-action="audio" data-word="${escapeHtml(word.word)}" aria-label="Nghe ${escapeHtml(word.word)}">🔊</button><button class="icon-btn ${learned ? "learned" : ""}" type="button" data-action="learn" data-key="${escapeHtml(wordKey(word, section))}" aria-label="Đánh dấu đã thuộc">✓</button></div></td>
      </tr>`;
    }).join("")}</tbody>
  </table></div>`;
}

function resetFlashDeck() {
  state.flashOrder = shuffle(currentSection().words.map((_, index) => index));
  state.flashIndex = 0;
  state.flashFlipped = false;
}

function flashWord() {
  if (!state.flashOrder.length) resetFlashDeck();
  return currentSection().words[state.flashOrder[state.flashIndex]];
}

function renderFlashcards() {
  if (state.query) {
    clearSearch(false);
    renderSectionHeader();
  }
  const word = flashWord();
  const learned = state.learned.has(wordKey(word));
  els.modeContent.innerHTML = `<div class="flash-wrap">
    <div class="flash-meta"><span>Thẻ ${state.flashIndex + 1} / ${state.flashOrder.length}</span><span>${escapeHtml(currentSection().label)}</span></div>
    <button class="flashcard ${state.flashFlipped ? "flipped" : ""}" type="button" data-action="flip" aria-label="Lật thẻ">
      <span class="flash-inner">
        <span class="flash-face flash-front"><span class="flash-level">${escapeHtml(word.level)} · ${escapeHtml(word.type)}</span><strong class="flash-word">${escapeHtml(word.word)}</strong><span class="flash-ipa">${escapeHtml(word.ipa)}</span><small class="flash-hint">Chạm để xem nghĩa tiếng Việt</small></span>
        <span class="flash-face flash-back"><span>${word.icon}</span><strong class="flash-meaning">${escapeHtml(word.meaning)}</strong><span class="flash-source">${escapeHtml(sourceShort(word.source))}</span></span>
      </span>
    </button>
    <div class="flash-controls">
      <button type="button" data-action="flash-prev">← Trước</button>
      <button type="button" data-action="audio" data-word="${escapeHtml(word.word)}">🔊 Nghe</button>
      <button type="button" class="${learned ? "primary" : ""}" data-action="learn" data-key="${escapeHtml(wordKey(word))}">${learned ? "✓ Đã thuộc" : "Đánh dấu đã thuộc"}</button>
      <button type="button" data-action="flash-next">Tiếp →</button>
      <button type="button" data-action="flash-shuffle">↻ Trộn thẻ</button>
    </div>
  </div>`;
}

function newMatchRound() {
  const selected = shuffle(currentSection().words).slice(0, Math.min(MATCH_SIZE, currentSection().words.length));
  const cards = shuffle(selected.flatMap((word, index) => [
    { id: index, side: "en", text: word.word },
    { id: index, side: "vi", text: word.meaning },
  ]));
  state.matchRound = { cards, matched: new Set() };
  state.matchFirst = null;
  state.matchLocked = false;
}

function renderMatching() {
  if (state.query) {
    clearSearch(false);
    renderSectionHeader();
  }
  if (!state.matchRound) newMatchRound();
  const complete = state.matchRound.matched.size === Math.min(MATCH_SIZE, currentSection().words.length);
  els.modeContent.innerHTML = `<div class="match-wrap">
    <div class="match-head"><p>Ghép từ/cụm từ tiếng Anh với nghĩa tiếng Việt tương ứng.</p><button type="button" data-action="match-new">↻ Vòng mới</button></div>
    <div class="match-grid">${state.matchRound.cards.map((card, index) => {
      const matched = state.matchRound.matched.has(card.id);
      return `<button type="button" class="match-card ${matched ? "matched" : ""}" data-action="match" data-card="${index}" ${matched ? "disabled" : ""}>${escapeHtml(card.text)}</button>`;
    }).join("")}${complete ? `<div class="match-complete"><strong>Hoàn thành!</strong><p>Bạn đã ghép đúng ${state.matchRound.matched.size} cặp.</p></div>` : ""}</div>
  </div>`;
}

function renderMode() {
  if (state.mode === "flashcards") renderFlashcards();
  else if (state.mode === "matching") renderMatching();
  else renderLearn();
}

function renderAll() {
  renderUnitSelector();
  renderUnitIntro();
  renderProgress();
  renderSectionTabs();
  renderSectionHeader();
  renderModeTabs();
  renderMode();
}

function setUnit(unitId) {
  const index = course.units.findIndex((unit) => unit.id === unitId);
  if (index < 0) return;
  state.unitIndex = index;
  state.sectionIndex = 0;
  state.query = "";
  state.mode = "learn";
  state.flashOrder = [];
  state.matchRound = null;
  els.searchInput.value = "";
  els.searchField.classList.remove("has-value");
  window.history.replaceState(null, "", `#${unitId}`);
  renderAll();
}

function setSection(index) {
  if (!currentUnit().sections[index]) return;
  state.sectionIndex = index;
  state.query = "";
  state.flashOrder = [];
  state.matchRound = null;
  els.searchInput.value = "";
  els.searchField.classList.remove("has-value");
  renderAll();
}

function clearSearch(render = true) {
  state.query = "";
  els.searchInput.value = "";
  els.searchField.classList.remove("has-value");
  if (render) {
    renderSectionHeader();
    renderMode();
  }
}

function toggleLearned(key) {
  if (state.learned.has(key)) state.learned.delete(key);
  else state.learned.add(key);
  saveLearned();
  renderProgress();
  renderSectionTabs();
  renderMode();
}

function speechFallback(text) {
  if (!("speechSynthesis" in window)) {
    showToast("Trình duyệt này chưa hỗ trợ phát âm.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace("...", ""));
  utterance.lang = "en-US";
  utterance.rate = .82;
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find((voice) => voice.lang === "en-US") || voices.find((voice) => voice.lang.startsWith("en")) || null;
  window.speechSynthesis.speak(utterance);
}

function cambridgeAudioUrl(word) {
  const filename = word.toLowerCase().replaceAll("&", "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const letters = filename.replaceAll("_", "");
  return `${CAMBRIDGE_AUDIO_BASE}${letters.slice(0, 1)}/${letters.slice(0, 3)}/${letters.slice(0, 5)}/${filename}.mp3`;
}

function playAudio(word, button) {
  state.activeAudio?.pause();
  window.speechSynthesis?.cancel();
  document.querySelectorAll(".icon-btn.playing").forEach((item) => item.classList.remove("playing"));
  button?.classList.add("playing");

  if (word.trim().split(/\s+/).length > 1 || /[.’?]/.test(word)) {
    button?.classList.remove("playing");
    speechFallback(word);
    return;
  }

  const audio = new Audio(cambridgeAudioUrl(word));
  state.activeAudio = audio;
  const finish = () => { button?.classList.remove("playing"); state.activeAudio = null; };
  audio.addEventListener("ended", finish, { once: true });
  audio.addEventListener("error", () => { finish(); speechFallback(word); }, { once: true });
  audio.play().catch(() => { finish(); speechFallback(word); });
}

function moveFlash(direction) {
  state.flashIndex = (state.flashIndex + direction + state.flashOrder.length) % state.flashOrder.length;
  state.flashFlipped = false;
  renderFlashcards();
}

function handleMatch(button) {
  if (state.matchLocked) return;
  const index = Number(button.dataset.card);
  const card = state.matchRound.cards[index];
  if (!state.matchFirst) {
    state.matchFirst = { index, card, button };
    button.classList.add("selected");
    return;
  }
  if (state.matchFirst.index === index) {
    button.classList.remove("selected");
    state.matchFirst = null;
    return;
  }
  const first = state.matchFirst;
  if (first.card.id === card.id && first.card.side !== card.side) {
    state.matchRound.matched.add(card.id);
    state.matchFirst = null;
    showToast("Chính xác!");
    renderMatching();
    return;
  }
  state.matchLocked = true;
  first.button.classList.remove("selected");
  first.button.classList.add("wrong");
  button.classList.add("wrong");
  window.setTimeout(() => {
    state.matchFirst = null;
    state.matchLocked = false;
    renderMatching();
  }, 480);
}

els.unitSelect.addEventListener("change", (event) => setUnit(event.target.value));
els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  state.mode = "learn";
  els.searchField.classList.toggle("has-value", Boolean(state.query));
  renderSectionHeader();
  renderModeTabs();
  renderMode();
});
els.clearSearch.addEventListener("click", () => clearSearch());
els.sectionTabs.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-section]");
  if (tab) setSection(Number(tab.dataset.section));
});
els.modeTabs.forEach((tab) => tab.addEventListener("click", () => {
  state.mode = tab.dataset.mode;
  state.flashOrder = state.mode === "flashcards" ? [] : state.flashOrder;
  state.matchRound = state.mode === "matching" ? null : state.matchRound;
  renderSectionHeader();
  renderModeTabs();
  renderMode();
}));
els.modeContent.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action } = button.dataset;
  if (action === "audio") playAudio(button.dataset.word, button);
  else if (action === "learn") toggleLearned(button.dataset.key);
  else if (action === "clear-search") clearSearch();
  else if (action === "flip") { state.flashFlipped = !state.flashFlipped; button.classList.toggle("flipped", state.flashFlipped); }
  else if (action === "flash-prev") moveFlash(-1);
  else if (action === "flash-next") moveFlash(1);
  else if (action === "flash-shuffle") { resetFlashDeck(); renderFlashcards(); }
  else if (action === "match-new") { newMatchRound(); renderMatching(); }
  else if (action === "match") handleMatch(button);
});

window.addEventListener("hashchange", () => {
  const index = unitIndexFromHash();
  if (index !== state.unitIndex) setUnit(course.units[index].id);
});

renderStats();
renderAll();
