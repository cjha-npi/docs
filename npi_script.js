
; (function () {
  'use strict';

  // —————————————————————————————————————————————
  // Debounce
  // —————————————————————————————————————————————
  // Debouncing is a simple way to “coalesce” a rapid burst of events into a single call after things have settled down.

  function debounce(fn, ms) {
    let t;                      // holds the pending timeout ID
    return (...args) => {       // returns a wrapped version of `fn`
      clearTimeout(t);          // cancel any previous scheduled call
      t = setTimeout(() =>      // schedule a new one
        fn(...args),            // —that actually calls `fn` with the latest args—
        ms                      // —after `ms` milliseconds have elapsed
      );
    };
  }

  // —————————————————————————————————————————————
  // NAV TREE TWEAKS: ARROWS + PRUNE
  // —————————————————————————————————————————————

  // Once pruning is done it doesn't need to fire up again, so we store its done state
  let pruned = false;

  // 1) Swap ►/▼ for ●/○ everywhere
  function replaceArrows() {
    const sideNav = document.getElementById('side-nav');
    sideNav.querySelectorAll('span.arrow').forEach(span => {
      const t = span.textContent.trim();
      if (t === '►') span.textContent = '\u25CF\uFE0F';
      else if (t === '▼') span.textContent = '\u25CB\uFE0F';
    });
  }

  // 2) Prune the root LI under whichever tree container exists
  function pruneNav() {
    const sideNav = document.getElementById('side-nav');
    if (!sideNav)
      return false;

    // support both Doxygen-Awesome IDs
    const tree = sideNav.querySelector('#nav-tree-contents, #nav-tree');
    if (!tree)
      return false;

    const ul = tree.querySelector('ul');
    if (!ul || !ul.firstElementChild)
      return false;

    const firstLi = ul.firstElementChild;
    const nested = firstLi.querySelector('ul');
    if (nested) {
      Array.from(nested.children).forEach(li => {
        ul.appendChild(li);
      });
    }
    firstLi.remove();
    return true;
  }

  // 3) Wire up a MutationObserver against #side-nav
  function initNavTweaks() {
    const sideNav = document.getElementById('side-nav');
    if (!sideNav) return;

    // run immediately (in case tree is already there)
    replaceArrows();
    pruned = pruneNav();

    // then observe for any new insertions/changes
    const mo = new MutationObserver(() => {
      if (pruned) { // first we prune and wait for it to be done
        mo.disconnect(); // disconnect otherwise it first again because of changing the icons
        replaceArrows();
        mo.observe(sideNav, { childList: true, subtree: true }); // reconnect
      }
      else {
        pruned = pruneNav();
      }
    });
    mo.observe(sideNav, { childList: true, subtree: true });
  }


  // —————————————————————————————————————————————
  // SEARCH BAR TWEAK
  // —————————————————————————————————————————————

  function initSearchPlaceholder(attempt = 0) {

    // Wait for the contents to load so that search bar can be tweaked
    const field = document.getElementById('MSearchField');
    if (!field || !window.searchBox || !window.indexSectionNames || !window.indexSectionLabels) {
      if (attempt < 20) {
        return setTimeout(() => initSearchPlaceholder(attempt + 1), 50); // retry in 50 ms
      } else {
        console.warn('Giving up initSearchPlaceholder() after 20 tries');
        return;
      }
    }

    // Update the search bar by adding what is being searched to the placeholder
    function updatePlaceholder() {
      const idx = searchBox.searchIndex;
      const label = indexSectionLabels[idx] || 'All';
      const ph = `Search ${label}`;
      document.getElementById('MSearchField').setAttribute('placeholder', ph);
    }

    // run once right away to pick up whatever the default is
    updatePlaceholder();

    // Run the updatePlaceholder again when user changes the from search dropdown
    if (typeof searchBox.OnSelectItem === 'function') {
      const orig = searchBox.OnSelectItem;
      searchBox.OnSelectItem = function (id) {
        const ret = orig.call(this, id);
        updatePlaceholder();
        return ret;
      };
    }

    // The search bar updates when resizing, so listen to it, debounce till it settles and then call updatePlaceholder
    window.addEventListener('resize', debounce(updatePlaceholder, 200));
  }

  // —————————————————————————————————————————————
  // DOM IS READY
  // —————————————————————————————————————————————

  // This function is executed when the DOM content has been loaded
  function onReady() {
    initNavTweaks();
    initSearchPlaceholder();
  }

  // Listen to document content load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

})();  // ← this () invokes the outer IIFE