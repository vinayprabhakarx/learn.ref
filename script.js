'use strict';

/* ── Theme Management ── */
(function() {
  const themeBtns = document.querySelectorAll('.theme-toggle-btn, #theme-toggle');
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

  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(currentTheme);
      localStorage.setItem('theme', currentTheme);
    });
  });
})();

/* ── Main Router ── */
document.addEventListener('DOMContentLoaded', async () => {
  // If we're on the homepage, there is no layout to mount
  if (document.querySelector('.hero-page')) {
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const subjectId = urlParams.get('id') || 'dsa-data-structures'; // fallback

  try {
    const res = await fetch(`${subjectId}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    
    document.title = `${json.title} - Learn App`;
    
    if (json.layout === 'grid') {
      document.getElementById('layout-grid').style.display = 'block';
      initGridLayout(json);
    } else if (json.layout === 'list') {
      document.getElementById('layout-list').style.display = 'block';
      document.getElementById('algo-subject-name').textContent = json.title.toLowerCase();
      initListLayout(json);
    }
  } catch (err) {
    console.error('Failed to load subject data:', err);
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center; color: red;">Failed to load subject data for "${subjectId}". Please check if ${subjectId}.json exists.</div>`;
  }
});


/* =======================================
   GRID LAYOUT ENGINE
   ======================================= */
function initGridLayout(config) {
  const gridEl = document.getElementById('ds-grid');
  const emptyTpl = document.getElementById('ds-empty-template');
  
  const DATA = config.items;
  const TAB_LABELS = config.tabs || { all: "All" };
  const DEBOUNCE_MS = 150;

  let activeTab = 'all';
  let openCardId = null;

  const tabsEl = document.getElementById('ds-tabs');
  const searchEl = document.getElementById('ds-search');

  const cardTpl = document.getElementById('ds-card-template');
  const opTpl = document.getElementById('ds-op-template');
  const useTpl = document.getElementById('ds-use-template');

  function showEmpty(container, msg) {
    const frag = emptyTpl.content.cloneNode(true);
    frag.querySelector('.ds-empty-msg').textContent = msg;
    container.appendChild(frag);
  }

  function extractTopic(useCase) {
    return useCase.split('—')[0].split('(')[0].trim();
  }

  /* ── Build tabs ── */
  const tabFragment = document.createDocumentFragment();
  for (const [key, label] of Object.entries(TAB_LABELS)) {
    const btn = document.createElement('button');
    btn.className = key === 'all' ? 'ds-tab btn-interactive ds-active' : 'ds-tab btn-interactive';
    btn.textContent = label;
    btn.dataset.tab = key;
    btn.setAttribute('aria-pressed', String(key === 'all'));
    tabFragment.appendChild(btn);
  }
  tabsEl.appendChild(tabFragment);

  /* ── Tab click ── */
  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.ds-tab');
    if (!btn || btn.dataset.tab === activeTab) return;

    activeTab = btn.dataset.tab;
    for (const b of tabsEl.children) {
      const isActive = b === btn;
      b.classList.toggle('ds-active', isActive);
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
    const useTag = e.target.closest('.ds-use-tag');
    if (useTag) {
      e.stopPropagation();
      openLeetCode(useTag.dataset.topic);
      return;
    }

    const practiceBtn = e.target.closest('.ds-practice-btn');
    if (practiceBtn) {
      e.stopPropagation();
      openLeetCode(practiceBtn.dataset.title);
      return;
    }

    const card = e.target.closest('article.ds-card');
    if (!card || window.getSelection().toString()) return;
    toggleCard(card);
  });

  /* ── Grid keyboard support ── */
  gridEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('article.ds-card');
    if (!card) return;
    e.preventDefault();
    toggleCard(card);
  });

  /* ── Accordion toggle ── */
  function toggleCard(card) {
    const id = card.dataset.id;
    if (openCardId === id) {
      card.classList.remove('ds-open');
      card.setAttribute('aria-expanded', 'false');
      openCardId = null;
    } else {
      if (openCardId) {
        const prev = gridEl.querySelector(`[data-id="${openCardId}"]`);
        if (prev) {
          prev.classList.remove('ds-open');
          prev.setAttribute('aria-expanded', 'false');
        }
      }
      card.classList.add('ds-open');
      card.setAttribute('aria-expanded', 'true');
      openCardId = id;
    }
  }

  /* ── URL state ── */
  function syncURL() {
    const params = new URLSearchParams(window.location.search);
    if (activeTab !== 'all') params.set('tab', activeTab);
    else params.delete('tab');
    if (searchEl.value) params.set('q', searchEl.value);
    else params.delete('q');
    
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
        b.classList.toggle('ds-active', isActive);
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
    const card = frag.querySelector('.ds-card');
    const isOpen = openCardId === d.id;

    card.dataset.id = d.id;
    card.setAttribute('aria-expanded', String(isOpen));
    card.setAttribute('aria-label', d.title);
    if (isOpen) card.classList.add('ds-open');

    const badge = card.querySelector('.ds-badge');
    badge.classList.add(d.badge);
    badge.textContent = d.label;

    card.querySelector('.ds-card-title').textContent = d.title;
    card.querySelector('.ds-desc').textContent = d.desc;

    /* Operations */
    const opsEl = card.querySelector('.ds-ops');
    for (const [key, value] of d.ops) {
      const opFrag = opTpl.content.cloneNode(true);
      opFrag.querySelector('.ds-op-name').textContent = key;
      opFrag.querySelector('.ds-op-tc').textContent = value;
      opsEl.appendChild(opFrag);
    }

    /* Use cases */
    const usesEl = card.querySelector('.ds-uses-grid');
    for (const use of d.uses) {
      const useFrag = useTpl.content.cloneNode(true);
      const li = useFrag.querySelector('.ds-use-tag');
      li.textContent = use;
      li.dataset.topic = extractTopic(use);
      usesEl.appendChild(useFrag);
    }

    card.querySelector('.ds-practice-btn').dataset.title = d.title;
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

  restoreURL();
  render();
}


/* =======================================
   LIST LAYOUT ENGINE
   ======================================= */
let LIST_DATA = [];
function initListLayout(config) {
  LIST_DATA = config.topics;

  buildNavTree(config);
  buildContent();
  buildStats();
  setupSearch();
  setupScrollSpy();
  setupScrollTop();
  setupSidebarToggle();
}

function buildNavTree(config) {
  const tree = document.getElementById('algo-nav-tree');
  const groupTpl = document.getElementById('algo-nav-group-template');
  const itemTpl = document.getElementById('algo-nav-item-template');
  const { navSections } = config;

  const fragment = document.createDocumentFragment();

  navSections.forEach(sec => {
    const groupFrag = groupTpl.content.cloneNode(true);
    const groupEl = groupFrag.querySelector('.algo-nav-group');
    groupFrag.querySelector('.algo-nav-label').textContent = sec.label;

    sec.ids.forEach(id => {
      const topic = LIST_DATA.find(t => t.id === id);
      if (!topic) return;
      
      const itemFrag = itemTpl.content.cloneNode(true);
      const link = itemFrag.querySelector('.algo-nav-item');
      link.href = `#${id}`;
      link.dataset.target = id;
      
      const dot = itemFrag.querySelector('.algo-nav-dot');
      const accentLight = topic.accent ? topic.accent.light : 'var(--color-text-tertiary)';
      const accentDark = topic.accent ? topic.accent.dark : 'var(--color-text-tertiary)';
      dot.style.setProperty('--topic-accent-light', accentLight);
      dot.style.setProperty('--topic-accent-dark', accentDark);
      
      itemFrag.querySelector('.nav-title').textContent = topic.title;

      link.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToSection(id);
      });
      groupEl.appendChild(itemFrag);
    });
    fragment.appendChild(groupFrag);
  });
  
  tree.appendChild(fragment);
}

function buildContent() {
  const container = document.getElementById('algo-topics-container');
  const topicTpl = document.getElementById('algo-topic-template');
  
  const fragment = document.createDocumentFragment();

  LIST_DATA.forEach(topic => {
    const topicFrag = topicTpl.content.cloneNode(true);
    const section = topicFrag.querySelector('.algo-topic');
    section.id = topic.id;
    section.setAttribute('aria-labelledby', `heading-${topic.id}`);

    const icon = topicFrag.querySelector('.algo-topic-icon');
    const accentLight = topic.accent ? topic.accent.light : 'var(--color-text-tertiary)';
    const accentDark = topic.accent ? topic.accent.dark : 'var(--color-text-tertiary)';
    icon.style.setProperty('--topic-accent-light', accentLight);
    icon.style.setProperty('--topic-accent-dark', accentDark);

    const titleEl = topicFrag.querySelector('.algo-topic-title');
    titleEl.id = `heading-${topic.id}`;
    titleEl.textContent = topic.title;

    const countRaw = topic.algos ? topic.algos.length : 0;
    topicFrag.querySelector('.algo-topic-count').textContent = `${countRaw} item${countRaw > 1 || countRaw === 0 ? 's' : ''}`;

    if (topic.algos) {
      topic.algos.forEach((algo, ai) => {
         section.appendChild(buildAlgoCard(algo, topic.id + '-' + ai));
      });
    }
    
    fragment.appendChild(topicFrag);
  });
  
  container.appendChild(fragment);
}

function buildAlgoCard(algo, id) {
  const cardTpl = document.getElementById('algo-card-template');
  const qTpl = document.getElementById('algo-question-template');
  const frag = cardTpl.content.cloneNode(true);
  
  const article = frag.querySelector('.algo-card');
  article.id = id;
  
  const head = frag.querySelector('.algo-card-head');
  head.setAttribute('aria-controls', `${id}-body`);
  head.addEventListener('click', () => toggleListCard(id));
  
  frag.querySelector('.algo-card-name').textContent = algo.name;
  
  if (algo.complexities) {
    frag.querySelector('.algo-badge-time').textContent = `T: ${algo.complexities.avg}`;
    frag.querySelector('.algo-badge-space').textContent = `S: ${algo.complexities.space}`;
  } else {
    frag.querySelector('.algo-card-badges').style.display = 'none';
    frag.querySelector('.algo-complexity').style.display = 'none';
  }
  
  frag.querySelector('.algo-card-body').id = `${id}-body`;
  frag.querySelector('.algo-desc').textContent = algo.desc;
  
  const stepsList = frag.querySelector('.algo-steps');
  if (algo.approach && algo.approach.length > 0) {
    algo.approach.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step;
      stepsList.appendChild(li);
    });
  } else {
    stepsList.previousElementSibling.style.display = 'none';
    stepsList.style.display = 'none';
  }
  
  if (algo.complexities) {
    frag.querySelector('.algo-tc-best').textContent = algo.complexities.best;
    frag.querySelector('.algo-tc-avg').textContent = algo.complexities.avg;
    frag.querySelector('.algo-tc-worst').textContent = algo.complexities.worst;
    frag.querySelector('.algo-tc-space').textContent = algo.complexities.space;
  }
  
  const codeBlock = frag.querySelector('.algo-code-block');
  if (algo.code) {
    codeBlock.dataset.raw = algo.code;
    codeBlock.innerHTML = renderCodeLines(algo.code);
  } else {
    codeBlock.closest('.algo-code-wrapper').previousElementSibling.style.display = 'none';
    codeBlock.closest('.algo-code-wrapper').style.display = 'none';
  }
  
  if (algo.tip) {
    frag.querySelector('.algo-tip').textContent = `💡 ${algo.tip}`;
  } else {
    frag.querySelector('.algo-tip').previousElementSibling.style.display = 'none';
    frag.querySelector('.algo-tip').style.display = 'none';
  }
  
  const qContainer = frag.querySelector('.algo-questions');
  const qCount = algo.questions ? algo.questions.length : 0;
  
  if (algo.questions && algo.questions.length > 0) {
    frag.querySelector('.algo-prob-count').textContent = qCount;
    const diffClass = { Easy: 'diff-easy', Medium: 'diff-med', Hard: 'diff-hard' };
    algo.questions.forEach(q => {
      const qFrag = qTpl.content.cloneNode(true);
      const li = qFrag.querySelector('.algo-question');
      li.addEventListener('click', () => openLeetCode(q.name));
      
      const diffEl = qFrag.querySelector('.algo-diff');
      diffEl.textContent = q.diff;
      if (diffClass[q.diff]) diffEl.classList.add(diffClass[q.diff]);
      
      qFrag.querySelector('.algo-qname').textContent = q.name;
      qFrag.querySelector('.algo-tag').textContent = q.tag;
      
      qContainer.appendChild(qFrag);
    });
  } else {
    qContainer.previousElementSibling.style.display = 'none';
    qContainer.style.display = 'none';
  }
  
  return frag;
}

/* ── LIST INTERACTIONS ── */
let openListCardId = null;

function toggleListCard(id) {
  const card = document.getElementById(id);
  if (openListCardId === id) {
    card.classList.remove('algo-open');
    card.querySelector('.algo-card-head').setAttribute('aria-expanded', 'false');
    openListCardId = null;
  } else {
    if (openListCardId) {
      const prev = document.getElementById(openListCardId);
      if (prev) {
        prev.classList.remove('algo-open');
        prev.querySelector('.algo-card-head').setAttribute('aria-expanded', 'false');
      }
    }
    card.classList.add('algo-open');
    card.querySelector('.algo-card-head').setAttribute('aria-expanded', 'true');
    openListCardId = id;
  }
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    const offset = 80;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
  document.querySelectorAll('.algo-nav-item').forEach(n => n.classList.remove('algo-active'));
  const navItem = document.querySelector(`.algo-nav-item[data-target="${id}"]`);
  if (navItem) navItem.classList.add('algo-active');

  const sectionLabel = document.getElementById('algo-current-section');
  if (sectionLabel) sectionLabel.textContent = id;
}

function setupSearch() {
  const box = document.getElementById('algo-search');
  if (!box) return;
  box.addEventListener('input', () => {
    const q = box.value.toLowerCase().trim();
    if (!q) {
      document.querySelectorAll('.algo-card').forEach(c => c.style.display = '');
      document.querySelectorAll('.algo-topic').forEach(s => s.style.display = '');
      return;
    }
    document.querySelectorAll('.algo-topic').forEach(section => {
      let visible = false;
      section.querySelectorAll('.algo-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        const show = text.includes(q);
        card.style.display = show ? '' : 'none';
        if (show) visible = true;
      });
      section.style.display = visible ? '' : 'none';
    });
  });
}

function setupScrollSpy() {
  const sections = LIST_DATA.map(t => document.getElementById(t.id)).filter(Boolean);
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = e.target.id;
        document.querySelectorAll('.algo-nav-item').forEach(n => n.classList.remove('algo-active'));
        const navItem = document.querySelector(`.algo-nav-item[data-target="${id}"]`);
        if (navItem) {
          navItem.classList.add('algo-active');
          navItem.scrollIntoView({ block: 'nearest' });
        }
        const sectionLabel = document.getElementById('algo-current-section');
        if (sectionLabel) sectionLabel.textContent = id;
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  sections.forEach(s => observer.observe(s));
}

function setupScrollTop() {
  const btn = document.getElementById('algo-scrolltop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('algo-show', window.scrollY > 400);
  });
}

window.toggleSidebar = function() {
  document.getElementById('algo-sidebar').classList.toggle('algo-open');
}

function setupSidebarToggle() {
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('algo-sidebar');
    const menuBtn = document.querySelector('.algo-menu-btn');
    if (sidebar.classList.contains('algo-open')) {
      if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
        sidebar.classList.remove('algo-open');
      }
    }
  });
  document.querySelectorAll('.algo-nav-item').forEach(link => {
    link.addEventListener('click', () => {
      const sidebar = document.getElementById('algo-sidebar');
      if (window.innerWidth <= 1024) {
        sidebar.classList.remove('algo-open');
      }
    });
  });
}

function buildStats() {
  const statsEl = document.getElementById('algo-stats-container');
  if (!statsEl) return;
  
  let algoCount = 0;
  let probCount = 0;
  
  LIST_DATA.forEach(topic => {
    if (topic.algos) {
      algoCount += topic.algos.length;
      topic.algos.forEach(algo => {
        if (algo.questions) {
          probCount += algo.questions.length;
        }
      });
    }
  });

  statsEl.innerHTML = `
    <span><strong>${LIST_DATA.length}</strong> Topics</span>
    <span><strong>${algoCount}</strong> Items</span>
  `;
}

/* ── COMMON HELPERS ── */
function openLeetCode(topic) {
  const URL = 'https://google.com/search?q=leetcode+';
  window.open(URL + encodeURIComponent(topic), '_blank', 'noopener,noreferrer');
}

function highlightJava(code) {
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const tokens = [];
  let idx = 0;
  html = html.replace(/(\/\/[^\n]*)|('(?:[^'\\]|\\.)')|(&amp;lt;|&amp;gt;|&amp;amp;)/g, (match, comment, chr, entity) => {
    const placeholder = `\x00${idx}\x00`;
    if (comment) tokens.push(`<span class="algo-code-cm">${comment}</span>`);
    else if (chr) tokens.push(`<span class="algo-code-str">${chr}</span>`);
    else if (entity) tokens.push(entity);
    idx++;
    return placeholder;
  });
  const kw = 'public|private|protected|static|final|void|int|boolean|char|long|double|float|short|byte|class|interface|extends|implements|new|return|if|else|while|for|do|switch|case|break|continue|try|catch|finally|throw|throws|this|super|null|true|false|import|package|abstract|synchronized|volatile|transient|native|enum|instanceof|const|let|var|function|export|import';
  html = html.replace(new RegExp(`\\b(${kw})\\b`, 'g'), '<span class="algo-code-kw">$1</span>');
  html = html.replace(/(?<!<[^>]*)\b([A-Z][A-Za-z0-9]*(?:&lt;[^&]*&gt;)?)\b/g, '<span class="algo-code-tp">$1</span>');
  html = html.replace(/\b(\d+)\b/g, '<span class="algo-code-num">$1</span>');
  html = html.replace(/\b([a-z][A-Za-z0-9]*)\s*(?=\()/g, '<span class="algo-code-fn">$1</span>');
  html = html.replace(/\x00(\d+)\x00/g, (_, i) => tokens[parseInt(i)]);
  return html;
}

function renderCodeLines(code) {
  if (!code) return '';
  const highlighted = highlightJava(code);
  const lines = highlighted.split('\n');
  return lines.map((line, i) =>
    `<div class="algo-code-line"><span class="algo-code-ln">${i + 1}</span><span class="algo-code-text">${line}</span></div>`
  ).join('');
}

window.copyCode = function(btn) {
  const block = btn.closest('.algo-code-wrapper').querySelector('.algo-code-block');
  const raw = block.dataset.raw;
  navigator.clipboard.writeText(raw).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('algo-copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('algo-copied'); }, 1800);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = raw;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = 'Copied!';
    btn.classList.add('algo-copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('algo-copied'); }, 1800);
  });
}
