'use strict';

(async function () {

  /* ── Load data ── */
  const gridEl   = document.getElementById('grid');
  const emptyTpl = document.getElementById('empty-template');

  let DATA;
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
  } catch (err) {
    showEmpty(gridEl, `Failed to load data: ${err.message}`);
    return;
  }

  /* ── Constants ── */
  const TAB_LABELS = Object.freeze({
    all: 'All',
    ds: 'Data Structures',
    sorting: 'Sorting',
    searching: 'Searching',
    graph: 'Graph',
    tree: 'Tree',
    dp: 'Dynamic Programming',
    other: 'Other',
  });

  const DEBOUNCE_MS = 150;
  const LEETCODE_URL = 'https://leetcode.com/search/?q=';

  /* ── State ── */
  let activeTab = 'all';
  let openCardId = null;

  /* ── DOM refs ── */
  const tabsEl     = document.getElementById('tabs');
  const searchEl   = document.getElementById('search');
  const themeBtn   = document.getElementById('theme-toggle');

  /* ── Theme Management ── */
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  applyTheme(currentTheme);

  themeBtn.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(currentTheme);
    localStorage.setItem('theme', currentTheme);
  });

  /* ── Template refs ── */
  const cardTpl = document.getElementById('card-template');
  const opTpl   = document.getElementById('op-template');
  const useTpl  = document.getElementById('use-template');

  /* ── Helpers ── */
  function showEmpty(container, msg) {
    const frag = emptyTpl.content.cloneNode(true);
    frag.querySelector('.empty').textContent = msg;
    container.appendChild(frag);
  }

  function extractTopic(useCase) {
    return useCase.split('—')[0].split('(')[0].trim();
  }

  function openLeetCode(topic) {
    window.open(LEETCODE_URL + encodeURIComponent(topic), '_blank', 'noopener,noreferrer');
  }

  /* ── Build tabs ── */
  const tabFragment = document.createDocumentFragment();
  for (const [key, label] of Object.entries(TAB_LABELS)) {
    const btn = document.createElement('button');
    btn.className = key === 'all' ? 'tab active' : 'tab';
    btn.textContent = label;
    btn.dataset.tab = key;
    btn.setAttribute('aria-pressed', String(key === 'all'));
    tabFragment.appendChild(btn);
  }
  tabsEl.appendChild(tabFragment);

  /* ── Tab click ── */
  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn || btn.dataset.tab === activeTab) return;

    activeTab = btn.dataset.tab;
    for (const b of tabsEl.children) {
      const isActive = b === btn;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-pressed', String(isActive));
    }
    syncURL();
    render();
  });

  /* ── Search ── */
  let debounceTimer = null;
  searchEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      syncURL();
      render();
    }, DEBOUNCE_MS);
  });

  /* ── Grid click delegation ── */
  gridEl.addEventListener('click', (e) => {
    const useTag = e.target.closest('.use-tag');
    if (useTag) {
      e.stopPropagation();
      openLeetCode(useTag.dataset.topic);
      return;
    }

    const askBtn = e.target.closest('.ask-btn');
    if (askBtn) {
      e.stopPropagation();
      openLeetCode(askBtn.dataset.title);
      return;
    }

    const card = e.target.closest('article.card');
    if (!card || window.getSelection().toString()) return;
    toggleCard(card);
  });

  /* ── Grid keyboard support ── */
  gridEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('article.card');
    if (!card) return;
    e.preventDefault();
    toggleCard(card);
  });

  /* ── Accordion toggle ── */
  function toggleCard(card) {
    const id = card.dataset.id;

    if (openCardId === id) {
      /* Close current card */
      card.classList.remove('open');
      card.setAttribute('aria-expanded', 'false');
      openCardId = null;
    } else {
      /* Close previous card if any */
      if (openCardId) {
        const prev = gridEl.querySelector(`[data-id="${openCardId}"]`);
        if (prev) {
          prev.classList.remove('open');
          prev.setAttribute('aria-expanded', 'false');
        }
      }
      /* Open new card */
      card.classList.add('open');
      card.setAttribute('aria-expanded', 'true');
      openCardId = id;
    }
  }

  /* ── URL state ── */
  function syncURL() {
    const params = new URLSearchParams();
    if (activeTab !== 'all') params.set('tab', activeTab);
    if (searchEl.value) params.set('q', searchEl.value);
    const qs = params.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  function restoreURL() {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const q = params.get('q');

    if (tab && tab in TAB_LABELS) {
      activeTab = tab;
      for (const b of tabsEl.children) {
        const isActive = b.dataset.tab === tab;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', String(isActive));
      }
    }

    if (q) searchEl.value = q;
  }

  /* ── Filter data ── */
  function getFilteredItems() {
    const q = searchEl.value.toLowerCase();
    let items = DATA;

    if (activeTab !== 'all') {
      items = items.filter(d => d.cat === activeTab);
    }

    if (q) {
      items = items.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.desc.toLowerCase().includes(q) ||
        d.uses.some(u => u.toLowerCase().includes(q))
      );
    }

    return { items, query: q };
  }

  /* ── Build a single card ── */
  function buildCard(d) {
    const frag = cardTpl.content.cloneNode(true);
    const card = frag.querySelector('.card');
    const isOpen = openCardId === d.id;

    card.dataset.id = d.id;
    card.setAttribute('aria-expanded', String(isOpen));
    card.setAttribute('aria-label', d.title);
    if (isOpen) card.classList.add('open');

    const badge = card.querySelector('.badge');
    badge.classList.add(d.badge);
    badge.textContent = d.label;

    card.querySelector('.card-title').textContent = d.title;
    card.querySelector('.desc').textContent = d.desc;

    /* Operations */
    const opsEl = card.querySelector('.ops');
    for (const [key, value] of d.ops) {
      const opFrag = opTpl.content.cloneNode(true);
      opFrag.querySelector('.op-name').textContent = key;
      opFrag.querySelector('.op-tc').textContent = value;
      opsEl.appendChild(opFrag);
    }

    /* Use cases */
    const usesEl = card.querySelector('.uses-grid');
    for (const use of d.uses) {
      const useFrag = useTpl.content.cloneNode(true);
      const li = useFrag.querySelector('.use-tag');
      li.textContent = use;
      li.dataset.topic = extractTopic(use);
      usesEl.appendChild(useFrag);
    }

    card.querySelector('.ask-btn').dataset.title = d.title;

    return frag;
  }

  /* ── Render ── */
  function render() {
    const { items, query } = getFilteredItems();

    openCardId = null;
    gridEl.textContent = '';

    if (!items.length) {
      const catName = TAB_LABELS[activeTab];
      const msg = query
        ? `No results matching "${query}" in ${catName}`
        : `No topics in ${catName}`;
      showEmpty(gridEl, msg);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of items) {
      fragment.appendChild(buildCard(item));
    }
    gridEl.appendChild(fragment);
  }

  /* ── Init ── */
  restoreURL();
  render();

})();
