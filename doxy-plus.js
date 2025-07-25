/*
Prefix: dp-
File Names: doxy-plus.*
*/

// doxy-plus.js
// @ts-nocheck
/* global store, DOC_ROOT */

; (function ($) {
  'use strict';

  // #region 🟩 CONSTANTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Storage Key: Origin Specific, stored directly in browser's localStorage without store.js
  const KEY__EXPIRED_DATA_PURGE_DATE = 'expired_data_purge_date';

  // Storage Keys: These keys are project specific
  const KEY__PREV_URL = 'prev_url'; // previous url key, used for restoring on startup
  const KEY__DUAL_NAV = 'dual_nav'; // dual nav enabled state key
  const KEY__PRI_WIDTH = 'pri_width'; // width of primary pane of dual nav
  const KEY__SEC_WIDTH = 'sec_width'; // width of secondary pane of dual nav
  const KEY__GEN_DATA = 'gen_data'; // doxygen generation data
  const KEY__PRI_TREE = 'pri_tree'; // dual nav primary tree
  const KEY__PRI_TREE_INDENTED = 'pri_tree_indented'; // dual nav primary tree indentation
  const KEY__PRI_NAV_EXPANDED_NODES = 'pri_nav_expanded_nodes'; // primary tree expanded nodes, to re-expanded on revisit


  // Constant Values
  const ICON_SIDE_NAV = 'doxy-plus-side-nav.png'; // name for the icon that shows the side nav symbol
  const ICON_DUAL_NAV = 'doxy-plus-dual-nav.png'; // name for the icon that shows the dual nav symbol
  const MIN_W = 25; // minimum width of either primary or secondary nav panes in dual nav configuration
  const GUTTER_W = 100; // right side gutter width in dual nav configuration
  const TIME_TO_LIVE = 30 * 24 * 60 * 60 * 1000; // 30 days, time for a storage variable to be considered stale. 7 * 24 * 60 * 60 * 1000 == 7 Days, 30 * 24 * 60 * 60 * 1000 == 30 Days
  const IS_HTML_END = /\.(?:xhtml|html)$/i; // case-insensitive check for a string ending in either .xhtml or .html
  const TIMEOUT_MS = 2000; // time milliseconds till timeout while waiting for an element in DOM

  const DOC_ROOT = (() => {
    // Determine the base path (DOC_ROOT) of the current documentation site.
    // This is useful for loading assets (e.g., CSS/JS) relative to the script location,
    // even when the script is located in a nested folder or executed in varied contexts.
    // ⚠️ NOTE: This is a IIFE (Immediately Invoked Function Expression) and it runs immediately
    // at defination time and the resulting string is stored in DOC_ROOT. Every time DOC_ROOT
    // is referenced afterward, it is getting that cached value, not re-running the function.

    // Helper function: Extracts the folder path from a full URL.
    // Example: "https://example.com/docs/js/script.js" -> "https://example.com/docs/js/"
    // Example: "file:///F:/Doxy/Z_Test/Test_5/html/script.js" -> "file:///F:/Doxy/Z_Test/Test_5/html/"
    const getDir = src => src.slice(0, src.lastIndexOf('/') + 1);
    // Primary method: Use 'document.currentScript' to get the <script> element currently executing.
    // This is the most accurate and modern way to locate the script's own path.
    const self = document.currentScript;
    if (self && self.src) {
      let dir = getDir(self.src); // The folder path of the script itself.
      return dir;
    }

    // Fallback: If 'currentScript' is unavailable (e.g., in older browsers or dynamic environments),
    // try to locate a known Doxygen-generated script like 'navtreedata.js'.
    // This file typically resides in the root documentation folder.
    const tree = document.querySelector('script[src$="navtreedata.js"]');
    if (tree && tree.src) {
      let dir = getDir(tree.src); // The folder path where 'navtreedata.js' is located.
      console.warn(`Root: ${dir} (Determined by navtreedata.js file)`);
      return dir;
    }

    // Final fallback: If both methods fail, fall back to the root of the current origin.
    // Example: If on "https://example.com/docs/page.html", this gives "https://example.com/"
    // ⚠️ NOTE: This will result in "file://" when opened directly from folder
    const dir = window.location.origin + '/';
    console.error(`Root: ${dir} (Ultimate Fallback)`);
    return dir;
  })();

  const IS_CLASS_OR_STRUCT_PAGE = (() => {
    // Determines if the current page is for a class or struct. If it is then its member signatures
    // will be shown in the secondary nav if dual nav is set to true. This value is used in the
    // function that generates member signatures to determine if it should run ot not.
    // ⚠️ NOTE: This is a IIFE (Immediately Invoked Function Expression) and it runs immediately
    // at defination time and the resulting string is stored in IS_CLASS_OR_STRUCT_PAGE. Every time
    // IS_CLASS_OR_STRUCT_PAGE is referenced afterwards, it is getting the cached value.
    const lastPart = window.location.pathname.split('/').pop().toLowerCase(); // grab last segment of the path after last /
    return lastPart.startsWith('class') || lastPart.startsWith('struct'); // test for “class…” or “struct…” at the very start of last segment
  })();

  const HTML_NAME = (() => {
    // just HTML name of current page e.g bar.com/proj/class_foo.html#abc -> class_foo
    // this name is used to store secondary pane's collapsed nodes
    return window.location.pathname.split('/').pop().toLowerCase().replace(/\..*$/, '');
  })();

  const PROJ_NAMESPACE = (() => {
    // project's namespace, this is almost same as DOC_ROOT except it is formatted to serve as
    // a namespace string

    // 1) Strip any trailing slashes
    let raw = DOC_ROOT.replace(/\/+$/, '');

    // 2) Remove protocol (e.g. “https://” or “file:///”)
    raw = raw.replace(/^[a-z]+:\/\//i, '');

    // 3) Drop any credentials before an “@”
    raw = raw.replace(/^[^\/@]+@/, '');

    // 4) Remove query string or fragment
    raw = raw.split(/[?#]/, 1)[0];

    // 5) For Windows drives, drop the colon after the letter (e.g. “F:” → “F”)
    raw = raw.replace(/^([A-Za-z]):/, '$1');

    // 6) Split on both “/” and “\”, filter out empty segments
    const parts = raw.split(/[\/\\]+/).filter(Boolean);

    // 7) Slugify each segment (allow only A–Z, a–z, 0–9, underscore, dash)
    const slugged = parts.map(seg =>
      seg
        .replace(/[^A-Za-z0-9_-]+/g, '-')  // invalid → “-”
        .replace(/-+/g, '-')               // collapse multiple “-”
        .replace(/^-+|-+$/g, '')           // trim leading/trailing “-”
    );

    // 8) Join with dash and return
    return slugged.join('-');
  })();

  const STORAGE = store.namespace(PROJ_NAMESPACE); // here "store" is a function from store.js, creating our own namespace

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 CONSTANTS

  // #region 🟩 GLOBAL VARIABLES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // numbers
  let _wPri = loadNum(KEY__PRI_WIDTH, 250); // width of primary pane of dual nav
  let _wSec = loadNum(KEY__SEC_WIDTH, 250); // width of secondary pane of dual nav

  // strings
  let _consoleObjectName = ''; // name by which some of the functions here can be run on browser's console
  let _secTreeRemarks = ''; // secondary tree generation remarks

  // booleans
  let _dualNav = load(KEY__DUAL_NAV, true); // dual nav enabled state
  let _priTreeIndented = false; // primary tree indentation

  // arrays and sets
  const _priTree = []; // primary tree of dual nav
  const _secTree = []; // secondary tree of dual nav
  const _priExpNodes = new Set(); // expanded nodes of primary tree
  const _secColNodes = new Set(); // collapsed nodes of secondary tree

  // saving so that expiry time will be updated
  save(KEY__DUAL_NAV, _dualNav);
  save(KEY__PRI_WIDTH, _wPri);
  save(KEY__SEC_WIDTH, _wSec);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 GLOBAL VARIABLES

  // #region 🟩 HELPERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  function save(key, val) {
    // saves the data using store.js
    STORAGE.set(key, val, Date.now() + TIME_TO_LIVE);
  }

  // For a value `val = undefined`
  // `val == null` is true but `val === null` is false
  // `val != null` is false but `val !== null` is true

  function load(key, defVal = null) {
    // loads the data store.js
    // returns undefined (which is slightly different than null) if the key does not exist or is expired
    const v = STORAGE.get(key);
    return v === undefined ? defVal : v;
  }

  function loadNum(key, defVal = null) {
    // loads the data using store.js
    // returns undefined (which is slightly different than null) if the key does not exist or is expired
    const v = STORAGE.get(key);
    if (v == null) return defVal; // == treats null and undefined as same but === does not
    const n = Number(v);
    return isNaN(n) ? defVal : n;
  }

  function debounce(fn, ms = 50) {
    // A way to “coalesce” a rapid burst of events into a single call after things have settled down.
    let debounceId, idleId, fallbackId;
    return (...args) => {
      clearTimeout(debounceId); // cancel the pending debounce
      if (idleId) cancelIdleCallback(idleId); // cancel any pending idle callback
      clearTimeout(fallbackId); // cancel any pending fallback timer
      debounceId = setTimeout(() => {
        if ('requestIdleCallback' in window) {
          idleId = requestIdleCallback(() => fn(...args), { timeout: 200 });
        } else {
          fallbackId = setTimeout(() => fn(...args), 0); // fallback into a zero-delay timeout
        }
      }, ms);
    };
  }


  function waitFor(selector) {
    // Waits for the first element matching any CSS selector.
    // selector: Any valid querySelector string.
    // Returns: Promise<Element>
    return new Promise((resolve, reject) => {
      // Immediate hit?
      const el = document.querySelector(selector);
      if (el) {
        //console.log(`Selector "${selector}" found immediately, no need for mutation observer`);
        return resolve(el);
      }

      // pre-declare the timer variable for the closure
      let timer;

      // Otherwise observe mutations until we find one
      // In MutationObserver, first argument '_' is an
      // intentionally unused parameter, by using '_'
      // it means we are watching for any change. The
      // second argument 'observer' is the own 'obs'
      // instance.
      const obs = new MutationObserver((_, observer) => {
        const found = document.querySelector(selector);
        if (found) {
          //console.log(`Selector "${selector}" found in mutation observer, Task Complete!`);
          observer.disconnect();
          clearTimeout(timer);
          resolve(found);
        }
        //else{
        //  console.log(`Selector "${selector}" NOT found in mutation observer, Looking...`);
        //}
      });
      obs.observe(document.body, { childList: true, subtree: true });

      // Give up after timeout
      timer = setTimeout(() => {
        obs.disconnect();
        console.log(`Timed out waiting for selector "${selector}" after ${TIMEOUT_MS} ms`);
        resolve(null);
      }, TIMEOUT_MS);
    });
  }

  function printTreeTableFormat(tree) {
    // prints a tree in table format. each item in tree should have 3 entries: name, path, kids
    function flattenTree(oldTree, preName = '', newTree = []) {
      for (let ii = 0; ii < oldTree.length; ++ii) {
        const newName = preName === '' ? oldTree[ii][0] : preName + " → " + oldTree[ii][0];
        if (Array.isArray(oldTree[ii][2]) && oldTree[ii][2].length > 0) {
          newTree.push({ Name: newName, Link: oldTree[ii][1], Kids: oldTree[ii][2].length });
          flattenTree(oldTree[ii][2], newName, newTree);
        }
        else {
          newTree.push({ Name: newName, Link: oldTree[ii][1], Kids: null });
        }
      }
      return newTree;
    }
    console.table(flattenTree(tree));
  }

  function printTreeGroupFormat(tree) {
    // prints a tree in group format. each item in tree should have 3 entries: name, path, kids
    tree.forEach(([name, href, kids]) => {
      if (Array.isArray(kids)) {
        if (kids.length > 0) {
          console.group(`${name} → ${href} → Kids: ${kids.length}`);
          printTreeGroupFormat(kids);
          console.groupEnd();
        }
        else {
          console.log(`${name} → ${href} → Kids: 0`);
        }
      }
      else {
        console.log(`${name} → ${href} → ${kids}`);
      }
    });
  }

  function isTreeIndented(tree) {
    // Checks whether a tree uses indentation. A valid tree item must have three entries—name, path, and kids. Indentation normally indicates sub-levels by adding extra left padding. However, when a tree has only two levels and each top-level item has sub-items and those sub-items have no further children, the top-level entries display expand/collapse buttons while the sub-items do not, and so we don't need indentation, saving space and improving readability. Although both primary and secondary trees meet this criterion and can omit indentation, this function prevents accidentally removing indentation when it’s needed.
    if (!Array.isArray(tree) || tree.length === 0) {
      return true;
    }
    for (let ii = 0; ii < tree.length; ++ii) {
      const kids = tree[ii][2];
      if (Array.isArray(kids) && kids.length > 0) {
        for (let jj = 0; jj < kids.length; ++jj) {
          if (kids[jj][2] != null) return true;
        }
      }
      else {
        return true;
      }
    }
    return false;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 HELPERS

  // #region 🟩 SEARCHBAR TWEAK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function searchbarTweak() {

    // Tweaks the search bar’s selector text to reflect the current search context. By default, the selector shows only a magnifying-glass icon; this function replaces it with the appropriate text label.

    async function update() {
      // Updates selector text by changing the '--dp-search-field' which is picked up by doxy-plus.css and applied

      const start = performance.now();
      while (!window.searchBox || !window.indexSectionLabels) {
        const elapsed = performance.now() - start;
        if (elapsed > TIMEOUT_MS) {
          console.error(`Searchbar Tweak - Update: Timed out waiting for selector "window.searchBox" and/or "window.indexSectionLabels" after ${elapsed} ms`);
          return;
        }
        //console.log(`Searchbar Tweak - Update: Waiting for "window.searchBox" and/or "window.indexSectionLabels" after ${elapsed} ms...`);
        await new Promise(requestAnimationFrame);
      }
      const label = window.indexSectionLabels[window.searchBox.searchIndex] || 'All';
      const root = document.documentElement;
      root.style.setProperty('--dp-search-field', `"${label}:"`);
      //console.log(`Searchbar Tweak - Update: SUCCESS "Search ${label}"`);
    }

    if (!window.searchBox || !window.searchBox.OnSelectItem) {
      // wait till required parts are available
      const startTimeOnSelectItem = performance.now();
      while (!window.searchBox || !window.searchBox.OnSelectItem) {
        const elapsed = performance.now() - startTimeOnSelectItem;
        if (elapsed > TIMEOUT_MS) {
          console.error(`Searchbar Tweak: Timed out waiting for selector "window.searchBox" and/or "window.searchBox.OnSelectItem" after ${elapsed} ms`);
          break;
        }
        //console.log(`Searchbar Tweak: Waiting for "window.searchBox" and/or "window.searchBox.OnSelectItem" after ${elapsed} ms...`);
        await new Promise(requestAnimationFrame);
      }
    }

    if (window.searchBox && window.searchBox.OnSelectItem && typeof window.searchBox.OnSelectItem === 'function') {
      // Connect so that update is called when user changes the selector from search dropdown
      const orig = window.searchBox.OnSelectItem;
      window.searchBox.OnSelectItem = function (id) {
        const ret = orig.call(this, id);
        //console.log('Searchbar Tweak: Update On Select Item Triggered');
        update();
        return ret;
      };
      //console.log('Searchbar Tweak: SUCCESS');
    }
    else {
      console.error('Searchbar Tweak: Unable to set on search item change');
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 SEARCHBAR TWEAK

  // #region 🟩 SIDEBAR TOGGLE BUTTON
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function sidebarToggleButton() {

    // This functions adds a sidebar toggle button on the right of the dark/light theme button added by the Doxygen Awesome theme. Since on every resize Doxygen removes and rebuilds the searchbar, which leads to rebuilding of dark/light theme button of Doxygen Awesome theme, we have to do the same with out button. When the button is clicked the value toggles between dual nav on or off. When dual nav is on, we set the 'dp-dual-nav-active' as true and it is picked up by doxy-plus.css file and changes are applied using css. When dual nav if off, we remove the 'dp-dual-nav-active' attribute and again the doxy-plus.css applies the correct layout.

    function setCssVariable() { // updates doxy-plus.css attribute
      if (_dualNav) document.body.setAttribute('dp-dual-nav-active', 'true');
      else document.body.removeAttribute('dp-dual-nav-active');
      //console.log('Sidebar Toggle Button: Set CSS Variable');
    }
    setCssVariable(); // run once in the beginning

    async function setup() {
      const itemSearchBox = await waitFor('#searchBoxPos2');

      if (!itemSearchBox) {
        console.error(`Sidebar Toggle Button - Setup: wait for "searchBoxPos2" timed out, not found`);
        return;
      }

      mo.disconnect();
      const winWidth = window.innerWidth || document.documentElement.clientWidth;
      if (winWidth >= 768) {
        let btn = itemSearchBox.querySelector('.dp-sidebar-toggle-btn');
        if (btn) {
          itemSearchBox.appendChild(btn);
          const icon = btn.querySelector("img");
          icon.src = DOC_ROOT + (_dualNav ? ICON_DUAL_NAV : ICON_SIDE_NAV);
          //console.log('Sidebar Toggle Button - Setup: Reposition');
        }
        else {
          btn = document.createElement('a');
          btn.className = 'dp-sidebar-toggle-btn';
          btn.href = '#';
          btn.title = 'Toggle Single/Double Navigation Sidebar';

          const img = document.createElement('img');
          img.width = 24;
          img.height = 24;
          img.alt = 'Dual Sidebar Toggle Icon';
          img.src = DOC_ROOT + (_dualNav ? ICON_DUAL_NAV : ICON_SIDE_NAV);
          btn.appendChild(img);

          btn.addEventListener('click', evt => {
            evt.preventDefault();
            _dualNav = !_dualNav;
            img.src = DOC_ROOT + (_dualNav ? ICON_DUAL_NAV : ICON_SIDE_NAV);
            save(KEY__DUAL_NAV, _dualNav);
            setCssVariable();
            //console.log(`Sidebar Toggle Button - Click: DualNav = ${_dualNav}`);
          });

          itemSearchBox.appendChild(btn);
          //console.log('Sidebar Toggle Button - Setup: New Button');
        }
      }
      //else {
      //  console.log('Sidebar Toggle Button - Setup: Width < 768');
      //}
      mo.observe(itemSearchBox, { childList: true });
    }
    const mo = new MutationObserver(setup);
    setup();
    //console.log('Sidebar Toggle Button: SUCCESS');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 SIDEBAR TOGGLE BUTTON

  // #region 🟩 SIDE NAV TWEAK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function sideNavTweak() {

    // We have to wait for the two parts and we do it simultaneously by using 'await Promise.all...'
    const sideNavPromise = waitFor('#side-nav');
    const firstLiPromise = waitFor('#side-nav #nav-tree-contents ul > li, #side-nav #nav-tree ul > li');
    const [sideNav, firstLi] = await Promise.all([sideNavPromise, firstLiPromise]);

    if (!sideNav) {
      console.error('Side Nav Tweak: wait for "#side-nav" timeed out, not found');
      return;
    }

    if (!firstLi) {
      console.error('Side Nav Tweak: wait for "#side-nav #nav-tree-contents ul > li, #side-nav #nav-tree ul > li" timed out, not found');
      return;
    }

    const sideNavTreeUl = firstLi.parentElement; // now we know the UL exists and has at least one LI

    // Bump all childs of the top level item to the top lebvel then remove the original top level
    // item which will be empty now. This is done because the default navigation tree generated by
    // Doxygen has only one top top level item (usually called "Main Page") and its children are
    // items like "Namespaces", "Concepts", "Classes", etc. Having only one top level item seems
    // useless, so I remove it and have all its child as top level items.
    // ⚠️ NOTE: If in future the top level item is needed then just comment out the below part.
    const nested = firstLi.querySelector('ul');
    if (nested) {
      for (const li of Array.from(nested.children)) { // for…of gives you callback-free, breakable loops
        sideNavTreeUl.appendChild(li);
      }
    }
    firstLi.remove();


    // This function swaps ►/▼ for ●/○ everywhere. By default Doxygen does not populate all
    // childs in the nav tree, only when a node is expanded that its children are shown. What below
    // section does is to listen to when the side-nav is changed i.e. a node is expanded/collapsed
    // then swaps ►/▼ for ●/○. This way the icons for expand/collapse is always ●/○.
    function replaceArrows() {
      mo.disconnect();
      sideNav.querySelectorAll('span.arrow').forEach(span => {
        const t = span.textContent.trim();
        if (t === '►') span.textContent = '\u25CF\uFE0F';
        else if (t === '▼') span.textContent = '\u25CB\uFE0F';
      });
      //console.log('Side Nav Tweak - Replace Arrows: SUCCESS');
      mo.observe(sideNav, { childList: true, subtree: true });
    }
    const mo = new MutationObserver(replaceArrows);
    replaceArrows(); // replace arrows initially

    //console.log('Side Nav Tweak: SUCCESS');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 SIDE NAV TWEAK

  // #region 🟩 DUAL NAV FUNCTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  function setDualPriNavWidth(w) {
    if (w !== _wPri) {
      _wPri = w;
      save(KEY__PRI_WIDTH, w);
      document.documentElement.style.setProperty('--dp-pri-width', `${w}px`);
    }
  }

  function setDualSecNavWidth(w) {
    if (w !== _wSec) {
      _wSec = w;
      save(KEY__SEC_WIDTH, w);
      document.documentElement.style.setProperty('--dp-sec-width', `${w}px`);
    }
  }

  function checkDualNavLayout(nPri = _wPri, nSec = _wSec) {
    const wWin = window.innerWidth;
    if (wWin > 767) {
      const maxTotal = wWin - GUTTER_W;
      if (_secTree.length > 0) {
        const total = nPri + nSec;
        if (total > maxTotal) {
          // compute proportional sizes
          const ratio = nPri / total;
          let nPri = Math.floor(maxTotal * ratio);
          let nSec = maxTotal - nPri;

          // enforce minimum on either one
          if (nPri < MIN_W) {
            nPri = MIN_W;
            nSec = maxTotal - nPri;
          }
          if (nSec < MIN_W) {
            nSec = MIN_W;
            nPri = maxTotal - nSec;
          }
        }
        setDualPriNavWidth(nPri);
        setDualSecNavWidth(nSec);
      }
      else {
        if (nPri > maxTotal) {
          nPri = maxTotal;
        }
        setDualPriNavWidth(nPri);
      }
    }
    //console.log(`Check Dual Nav Layout: ${_wPri} & ${_wSec}`);
  }

  function dualNavResizer(resizerId, getW) {

    // no args? wire both and return
    if (!resizerId) {
      dualNavResizer('dp-pri-nav-resizer', () => _wPri);
      dualNavResizer('dp-sec-nav-resizer', () => _wSec);
      return;
    }

    const maxTotal = () => window.innerWidth - GUTTER_W;
    const resizer = document.getElementById(resizerId);
    let startX = 0, startW = 0, raf = null;

    function onMove(ev) {
      ev.preventDefault();
      if (raf) return;
      raf = requestAnimationFrame(() => {
        let newW = startW + (ev.clientX - startX);
        if (resizerId === 'dp-sec-nav-resizer') {
          if (newW < MIN_W) {
            const over = MIN_W - newW;
            const secNew = MIN_W;
            const priNew = Math.max(MIN_W, _wPri - over);
            if (secNew != _wSec || priNew != _wPri) {
              checkDualNavLayout(priNew, secNew);
              startX = ev.clientX;
              startW = secNew;
            }
          }
          else {
            if (newW > (maxTotal() - _wPri))
              newW = maxTotal() - _wPri;
            if (newW != _wSec) {
              checkDualNavLayout(_wPri, newW);
            }
          }
        }
        else {
          if (_secTree.length > 0) {
            newW = Math.max(MIN_W, Math.min(maxTotal() - MIN_W, newW));
            if (newW != _wPri) {
              let newSec = _wSec;
              if (newW < _wPri) {
                newSec = (_wSec + (_wPri - newW));
              }
              else {
                if (newW + _wSec > maxTotal()) {
                  newSec = (maxTotal() - newW);
                }
                else if (_wSec > MIN_W) {
                  newSec = Math.max(MIN_W, _wSec - (newW - _wPri));
                }
              }
              checkDualNavLayout(newW, newSec);
            }
          }
          else {
            newW = Math.max(MIN_W, Math.min(maxTotal(), newW));
            if (newW != _wPri) {
              checkDualNavLayout(newW, _wSec);
            }
          }
        }
        raf = null;
      });
    }

    function onUp(evtUp) {
      evtUp.preventDefault();
      document.body.style.cursor = '';
      //resizer.releasePointerCapture(evtUp.pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    }

    resizer.addEventListener('pointerdown', evtDown => {
      evtDown.preventDefault();
      //resizer.setPointerCapture(evtDown.pointerId);
      startX = evtDown.clientX;
      startW = getW();
      document.body.style.cursor = 'ew-resize';
      document.addEventListener('pointermove', onMove, { passive: false });
      document.addEventListener('pointerup', onUp, { passive: false });
      document.addEventListener('pointercancel', onUp, { passive: false });
    }, { passive: false });
  }

  function dualNavInit() {
    document.documentElement.style.setProperty('--dp-pri-width', `${_wPri}px`);
    document.documentElement.style.setProperty('--dp-sec-width', `${_wSec}px`);
    dualNavResizer();
    window.addEventListener('resize', () => { checkDualNavLayout(); });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 DUAL NAV FUNCTIONS

  // #region 🟩 GEN DEF TREE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function genDefTree() {

    // wait until NAVTREE[0][2] exists and is a non-empty array
    const start = performance.now();
    while (
      !window.NAVTREE ||
      !Array.isArray(window.NAVTREE) ||
      window.NAVTREE.length === 0 ||
      !Array.isArray(window.NAVTREE[0]) ||
      window.NAVTREE[0].length < 3 ||
      !Array.isArray(window.NAVTREE[0][2])
    ) {
      const elapsed = performance.now() - start;
      if (elapsed > TIMEOUT_MS) {
        console.error(`Gen Def Tree: Timed out waiting for selector "NAVTREE[0][2]" after ${elapsed} ms`);
        return null;
      }
      //console.log(`Gen Def Tree: Waiting for "NAVTREE[0][2]" after ${elapsed} ms...`);
      await new Promise(requestAnimationFrame);
    }

    function cloneTree(tree) {
      return tree.map(([name, href, kids]) => {
        const clonedKids = Array.isArray(kids) ? cloneTree(kids) : kids;
        return [name, href, clonedKids];
      });
    }

    function loadScript(relUrl) {
      return new Promise((res, rej) => {
        const fullUrl = new URL(relUrl, DOC_ROOT).href; // build an absolute URL from a relative path and a base root.
        const s = document.createElement('script'); s.src = fullUrl; s.async = true; // create and configure a <script> tag.
        s.onload = () => res(); // when the script finishes loading, call resolve()
        s.onerror = err => rej(err); // if the script fails to load, call reject(err)
        document.head.appendChild(s); // insert the <script> tag into the page and kicks off the download.
      });
    }

    function loadChildren(tree) {
      const promises = [];
      tree.forEach(node => {
        const c = node[2];
        if (typeof c === 'string') {
          promises.push(
            loadScript(c + '.js')
              .then(() => {
                let arr = window[c];
                if (!Array.isArray(arr)) arr = window[c.split('/').pop()];
                node[2] = Array.isArray(arr) ? arr : [];
                return loadChildren(node[2]);
              })
              .catch(() => { node[2] = []; })
          );
        } else if (Array.isArray(c)) {
          promises.push(loadChildren(c));
        }
      });
      return Promise.all(promises);
    }

    // clone the default tree, load children, and return it
    const defTree = cloneTree(window.NAVTREE[0][2]);
    await loadChildren(defTree);
    //console.log('Gen Def Tree: SUCCESS');
    return defTree;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 GEN DEF TREE

  // #region 🟩 GEN PRI TREE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function genPriTree() {

    // setting the two array's lengths as 0 so that it is reinitialized
    // while maintaining previous links
    _priTree.length = 0;

    // read the previous stored doxygen time (returns null if nothing was stored)
    const prvDoxyTime = load(KEY__GEN_DATA);

    // read the stored arrays if current time is same as previous time
    if (prvDoxyTime != null && prvDoxyTime === window.DOXY_PLUS_DATE_TIME) {
      const priTree = load(KEY__PRI_TREE);
      if (priTree != null && Array.isArray(priTree) && priTree.length > 0) {
        // assign the primary tree
        _priTree.push(...priTree);
        _priTreeIndented = load(KEY__PRI_TREE_INDENTED, false);

        // saving so that expiry time is updated
        save(KEY__GEN_DATA, window.DOXY_PLUS_DATE_TIME);
        save(KEY__PRI_TREE, _priTree);
        save(KEY__PRI_TREE_INDENTED, _priTreeIndented);

        //(`Gen Pri Tree: Loaded from Session Storage`);

        // return since there is no need to process any further data in this function
        return;
      }
    }

    // flatAndPrune(tree, sep = '', filters = [])
    // Flattens a nested [name, path, kids] tree into a flat array of [prefixedName, path, null] entries.
    // Drops any node whose path contains “#”.
    // If `filters` is non-empty, only keeps nodes whose filename starts with one of the filter strings.
    // Returns null if no nodes survive.
    function flatAndPrune(tree, sep = '', filters = []) {

      const result = [];

      if (!Array.isArray(tree) || tree.length === 0) {
        return result;
      }

      const hasFilter = filters.length > 0;

      (function collect(branch, prefix = '') {
        for (const [name, path, kids] of branch) {
          // build the new hierarchical name
          const prefixedName = prefix ? `${prefix}${sep}${name}` : name;

          // only consider real HTML pages without anchors when there is either no filter or starts with filter
          if (typeof path === 'string') {
            const htmlName = path.split('/').pop();
            if (!htmlName.includes('#') && IS_HTML_END.test(htmlName) && (!hasFilter || filters.some(f => htmlName.startsWith(f)))) {
              result.push([prefixedName, path, null]);
            }
          }

          // recurse into children regardless—so deeper matches still appear
          if (Array.isArray(kids) && kids.length) {
            collect(kids, prefixedName);
          }
        }
      })(tree);

      return result;
    }

    function findNodeByNameList(tree, ...nameList) {
      if (!Array.isArray(tree) || nameList.length === 0) return null;
      let level = tree;
      let node = null;
      for (const name of nameList) {
        node = level.find(item => item[0] === name) || null;
        if (!node) return null;
        level = Array.isArray(node[2]) ? node[2] : [];
      }
      return node;
    }

    // get the default NAVTREE
    const defTree = await genDefTree();
    if (!Array.isArray(defTree) || defTree.length === 0) {
      console.warn('Gen Pri Tree: Default tree returned by "genDefTree" is either not an array or is empty');
      return;
    }

    const nsListNode = findNodeByNameList(defTree, 'Namespaces', 'Namespace List');
    if (nsListNode) {
      const [, href, kids] = nsListNode;
      if (typeof href === 'string' && IS_HTML_END.test(href) && Array.isArray(kids)) {
        const list = flatAndPrune(kids, '::', ['namespace']);
        if (list.length > 0) {
          _priTree.push(['Namespaces', href, list]);
        }
      }
    }

    const nsMemNode = findNodeByNameList(defTree, 'Namespaces', 'Namespace Members');
    if (nsMemNode) {
      const [, href, kids] = nsMemNode;
      if (Array.isArray(kids) && kids.length > 0) {
        let temp = flatAndPrune(kids, '::');
        if (temp.length > 0) {
          let idx = -1;
          for (let ii = 0; ii < temp.length; ++ii) {
            if (temp[ii][0] === 'All') {
              idx = ii;
              break;
            }
          }
          if (idx > -1) {
            let tempHref = temp[idx][1];
            temp.splice(idx, 1);
            if (typeof tempHref === 'string' && IS_HTML_END.test(tempHref) && temp.length > 0) {
              _priTree.push(['Globals', tempHref, temp]);
            }
          }
        }
      }
    }

    const conceptsNode = findNodeByNameList(defTree, 'Concepts');
    if (conceptsNode) {
      const [, href, kids] = conceptsNode;
      const list = flatAndPrune(kids, '::', ['concept'])
      if (typeof href === 'string' && IS_HTML_END.test(href) && list.length > 0) {
        _priTree.push(['Concepts', href, list]);
      }
    }

    let classListInserted = false;
    const classListNode = findNodeByNameList(defTree, 'Classes', 'Class List');
    if (classListNode) {
      const [, href, kids] = classListNode;
      const list = flatAndPrune(kids, '::', ['class', 'struct'])
      if (typeof href === 'string' && IS_HTML_END.test(href) && list.length > 0) {
        classListInserted = true;
        _priTree.push(['Classes', href, list]);
      }
    }

    if (classListInserted) {
      const classHierarchyNode = findNodeByNameList(defTree, 'Classes', 'Class Hierarchy');
      if (classHierarchyNode) {
        const [, href, kids] = classHierarchyNode;
        if (typeof href === 'string' && IS_HTML_END.test(href)) {
          _priTree[_priTree.length - 1][2].push(['[Hierarchy]', href, null]);
        }
      }

      const classIndexNode = findNodeByNameList(defTree, 'Classes', 'Class Index');
      if (classIndexNode) {
        const [, href, kids] = classIndexNode;
        if (typeof href === 'string' && IS_HTML_END.test(href)) {
          _priTree[_priTree.length - 1][2].push(['[Index]', href, null]);
        }
      }
    }

    const classMembersNode = findNodeByNameList(defTree, 'Classes', 'Class Members');
    if (classMembersNode) {
      const [, href, kids] = classMembersNode;
      if (Array.isArray(kids) && kids.length > 0) {
        let temp = flatAndPrune(kids, '::');
        if (temp.length > 0) {
          let idx = -1;
          for (let ii = 0; ii < temp.length; ++ii) {
            if (temp[ii][0] === 'All') {
              idx = ii;
              break;
            }
          }
          if (idx > -1) {
            let tempHref = temp[idx][1];
            temp.splice(idx, 1);
            if (typeof tempHref === 'string' && IS_HTML_END.test(tempHref) && temp.length > 0) {
              _priTree.push(['Class Members', tempHref, temp]);
            }
          }
        }
      }
    }

    const filesNode = findNodeByNameList(defTree, 'Files', 'File List');
    if (filesNode) {
      const [, href, kids] = filesNode;
      const list = flatAndPrune(kids, '/', ['_', 'dir_'])
      if (typeof href === 'string' && IS_HTML_END.test(href) && list.length > 0) {
        _priTree.push(['Files', href, list]);
      }
    }


    _priTree.push(['Ind A', null, null]);
    _priTree.push(['Ind B', null, null]);

    _priTree.push([
      'Level 0',
      null,
      [
        [  // ← child-array starts here
          'Level 1',
          null,
          [
            ['Level A', null, null],
            ['Level B', null, null],
            ['Level C', null, null],
            [
              'Level 2',
              null,
              [
                ['Level x', null, null],
                [
                  'Level 3',
                  null,
                  [
                    [
                      'Level 4',
                      null,
                      [
                        ['Level 5', null, null]
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ]
        ]  // ← end of children of Level 0
      ]
    ]);

    _priTree.push(['Ind C', null, null]);


    _priTreeIndented = isTreeIndented(_priTree);

    save(KEY__GEN_DATA, window.DOXY_PLUS_DATE_TIME);
    save(KEY__PRI_TREE, _priTree);
    save(KEY__PRI_TREE_INDENTED, _priTreeIndented);

    //console.log(`Gen Pri Tree: Generated`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 GEN PRI TREE

  // #region 🟩 GEN SEC TREE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function genSecTree() {

    _secTree.length = 0;
    _secTreeRemarks = '';

    if (!IS_CLASS_OR_STRUCT_PAGE) {
      _secTreeRemarks = 'Not a Class or Struct Page';
      //console.log('Gen Sec Tree: Not a Class or Struct Page');
      return;
    }

    const contents = await waitFor('div.contents, div.content, main');
    if (!contents) {
      console.error('Gen Sec Tree: wait for "div.contents, div.content, main" timed out, not found');
      return;
    }

    const tables = Array.from(contents.querySelectorAll("table.memberdecls"));
    if (tables.length === 0) {
      _secTreeRemarks = 'Empty "table.memberdecls" element array';
      //console.log('Gen Sec Tree: Empty "table.memberdecls" element array');
      return;
    }

    function formatSignature(text) {
      if (typeof text !== 'string') return text;

      return text
        // Remove space before *, &, &&
        .replace(/\s+([*&]{1,2})/g, '$1')
        // Ensure space after *, &, &&
        .replace(/([*&]{1,2})(?!\s)/g, '$1 ')

        // Remove spaces inside <...>
        .replace(/<\s+/g, '<')
        .replace(/\s+>/g, '>')
        .replace(/\s+<\s+/g, '<')
        .replace(/\s+>\s+/g, '>')

        // Remove space before commas, ensure one after
        .replace(/\s+,/g, ',')
        .replace(/,(?!\s)/g, ', ')

        // Remove space after ( and before )
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')

        // ❗ Remove space before (
        .replace(/\s+\(/g, '(')

        // Add space before and after = in special cases
        .replace(/\s*=\s*(default|delete|0)/g, ' = $1')

        // Collapse multiple spaces and trim
        .replace(/\s{2,}/g, ' ')

        // leading “}”
        .replace(/^\}+\s*/, '')

        // trailing “{”
        .replace(/\s*\{+$/, '')

        .trim();
    }

    const headers = Array.from(contents.querySelectorAll("h2.groupheader"));
    tables.forEach((table, idx) => {
      const grpSigs = [];
      const seenName = new Set();
      const seenHref = new Set();

      const headName = headers[idx]?.textContent.trim() || `Members ${idx + 1}`;

      const headerEl = headers[idx];
      const anchorEl = headerEl.querySelector("a[id], a[name]");
      const anchorId = anchorEl?.getAttribute("id") || anchorEl?.getAttribute("name") || null;
      const headHref = anchorId ? `#${anchorId}` : null;

      table.querySelectorAll("a[href^='#']").forEach(a => {
        if (a.closest("div.memdoc") || a.closest("td.mdescRight")) return;

        const leafHref = a.getAttribute("href");
        if (seenHref.has(leafHref)) {
          return;
        }

        const row = a.closest("tr");
        if (!row) {
          return;
        }
        const tds = row.querySelectorAll("td");
        if (tds.length < 2) {
          return;
        }

        const lftText = tds[0].innerText.replace(/\s+/g, ' ').trim();
        const ritText = tds[1].innerText.replace(/\s+/g, ' ').trim();
        let leafNameTemp = `${lftText} ${ritText}`.trim();
        let leafName = formatSignature(leafNameTemp);
        if (leafName.startsWith('enum')) {
          leafName = leafName.replace(/\s*\{[\s\S]*\}/, '').trim();
        }
        if (seenName.has(leafName)) {
          return;
        }

        seenHref.add(leafHref);
        seenName.add(leafName);

        grpSigs.push([leafName, leafHref, null]);
      });

      if (grpSigs.length > 0) {
        _secTree.push([headName, headHref, grpSigs]);
      }
    });

    if (_secTree.length > 0) {
      document.body.setAttribute('dp-sec-nav-active', 'true');
      _secTreeRemarks = 'Successfully generated member signatures';
      //console.log('Gen Sec Tree: Successfully generated member signatures');
    }
    else {
      _secTreeRemarks = 'No member signature found';
      //console.log('Gen Sec Tree: No member signature found');
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 GEN SEC TREE

  // #region 🟩 CHECK RELOAD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  function checkReload() {

    // Guard #1: only on a truly “fresh” tab
    const isFresh = (sessionStorage.getItem('is_fresh') !== 'true');
    sessionStorage.setItem('is_fresh', 'true');
    if (!isFresh) {
      //console.log('Check Reload: Not Fresh');
      return;
    }

    // Guard #2: we must have a populated tree
    if (!Array.isArray(_priTree) || !_priTree.length) {
      //console.log('Check Reload: _PriTree EMPTY');
      return;
    }

    // Guard #3: skip reload/back/forward
    let navType = 'navigate';
    const [navEntry] = performance.getEntriesByType('navigation');
    if (navEntry) {
      navType = navEntry.type;
    } else if (performance.navigation) {
      // fallback for older browsers (deprecated API)
      navType = performance.navigation.type === 1 ? 'reload' : 'navigate';
    }
    if (navType !== 'navigate') return;

    // Guard #4: storedUrl must exist and start with DOC_ROOT
    const storedUrl = load(KEY__PREV_URL);
    if (!storedUrl || !storedUrl.startsWith(DOC_ROOT)) {
      //console.log(`Check Reload: Store URL ${storedUrl}`);
      return;
    }

    // Guard #5: only run on your actual landing page
    const { pathname } = new URL(window.location.href);
    const isLanding = pathname.endsWith('/') || pathname.endsWith('/index.html');
    if (!isLanding) {
      //console.log(`Check Reload: Landing Page ${pathname}`);
      return;
    }

    // Finally: walk the tree and redirect
    const stack = [..._priTree];
    while (stack.length) {
      const [, href, kids] = stack.pop();
      if (typeof href === 'string' && IS_HTML_END.test(href) && storedUrl.includes(href)) {
        window.location.assign(storedUrl);
        return;  // stop after first match
      }
      if (Array.isArray(kids) && kids.length) {
        stack.push(...kids);
      }
    }
  }

  // Keep our “previous URL” up to date
  window.addEventListener('beforeunload', () => {
    save(KEY__PREV_URL, window.location.href);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 CHECK RELOAD

  // #region 🟩 DOC HEADER AND OBSERVERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function setupResizeObservers() {

    const [top, nav, btm, doc] = await Promise.all([waitFor('#top'), waitFor('#side-nav'), waitFor('#nav-path'), waitFor('#doc-content')]);

    let cln = null;
    if (doc && doc.parentElement) {
      const header = document.querySelector('#doc-content .header');
      if (header) {
        cln = header.cloneNode(true);
        cln.removeAttribute('id');
        doc.parentElement.insertBefore(cln, doc);
      }
    }

    if (!top && !nav && !btm && !cln) return;

    const ro = new ResizeObserver(entries => {
      for (const { target, contentRect } of entries) {
        if (target === top) {
          document.documentElement.style.setProperty('--dp-top-height', `${contentRect.height + 1}px`);
        } else if (target === nav) {
          document.documentElement.style.setProperty('--dp-nav-width', `${contentRect.width}px`);
        } else if (target === btm) {
          document.documentElement.style.setProperty('--dp-bottom-height', `${contentRect.height + 1}px`);
        } else if (target === cln) {
          document.documentElement.style.setProperty('--dp-doc-header-height', `${contentRect.height + 1}px`);
        }
      }
    });

    if (top) ro.observe(top);
    if (nav) ro.observe(nav);
    if (btm) ro.observe(btm);
    if (cln) ro.observe(cln);
  }

  async function searchResultWindowObserver() {
    const sWin = await waitFor('#MSearchResultsWindow');
    if (!sWin) {
      console.error('Search Result Window Observer: wait for "#MSearchResultsWindow" timed out, not found');
      return;
    }

    async function syncSize() {
      const parentId = window.innerWidth < 768 ? 'searchBoxPos1' : 'searchBoxPos2';
      const sBox = await waitFor(`#${parentId} #MSearchBox`);
      if (!sBox) return;
      const { left, width } = sBox.getBoundingClientRect();
      sWin.style.setProperty('left', `${left}px`, 'important');
      sWin.style.setProperty('width', `${width}px`, 'important');
      //console.log(`Search Result Window Observer - Sync Size: Set size X=${left}px & W=${width}px`);
    }

    let isDisplayed = getComputedStyle(sWin).display === 'block';

    const mo = new MutationObserver(records => {
      // only look for transitions into display:block
      for (const rec of records) {
        if (rec.attributeName !== 'style') continue;
        const nowDisplay = getComputedStyle(sWin).display === 'block';
        if (!isDisplayed && nowDisplay) {
          // just opened
          isDisplayed = true;
          syncSize();
        } else if (isDisplayed && !nowDisplay) {
          // just closed
          isDisplayed = false;
        }
        // otherwise ignore
      }
    });

    mo.observe(sWin, { attributes: true, attributeFilter: ['style'] });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 DOC HEADER AND OBSERVERS

  // #region 🟩 BUILD TREES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function buildTrees() {
    // Build and render both primary and secondary trees from _priTree and _secTree (if available),
    // then attach them to their respective containers.

    // Wait for both nav containers to be available in the DOM.
    const [priCon, secCon] = await Promise.all([waitFor('#dp-pri-nav'), waitFor('#dp-sec-nav')]);
    if (!priCon || !secCon) {
      console.error('Build Trees: Primary or Secondary panel is not available');
      return;
    }

    // remove any html value from primary and secondary containers
    priCon.innerHTML = '';
    secCon.innerHTML = '';

    // Configuration for primary vs. secondary tree behaviors and state storage.
    const CONFIG = {
      primary: { // container for primary tree
        data: _priTree, // primary tree main data source
        key: KEY__PRI_NAV_EXPANDED_NODES, // key by which expanded nodes in primary tree will be saved
        prefix: 'P:', // prefix to id that is assigned to all items in a tree
        mainSet: _priExpNodes, // a set containing ids of all expanded nodes in primary tree
        defaultOpen: false, // the default expanded state of a node
        setOpen: (id, isOpen) => isOpen ? _priExpNodes.add(id) : _priExpNodes.delete(id), // function to set expanded state of a node
        saveDebounced: debounce(() => save(KEY__PRI_NAV_EXPANDED_NODES, Array.from(_priExpNodes)), 500) // function to save changed expanded node set
      },
      secondary: { // container for secondary tree
        data: _secTree, // secondary tree main data source
        key: HTML_NAME, // the current html page name without the html ending, this is used as a key to store collapsed node data
        prefix: 'S:', // prefix to id that is assigned to all items in a tree
        mainSet: _secColNodes, // a set conatining ids of all collapsed nodes in secondary tree
        defaultOpen: true, // the default expanded state of a node
        setOpen: (id, isOpen) => isOpen ? _secColNodes.delete(id) : _secColNodes.add(id), // function to set expanded state of a node
        saveDebounced: debounce(() => save(HTML_NAME, Array.from(_secColNodes)), 500) // function to save changed collapsed node set
      }
    };

    // Build a UL/LI DOM tree for either 'primary' or 'secondary'.
    function build(kind = 'primary') {

      // verifying
      if (!CONFIG[kind]) {
        console.error(`Build Trees - Build: "${kind}" is not a valid parameter.`);
        return document.createDocumentFragment();
      }

      // get the correct config object
      const cfg = CONFIG[kind];

      // verifying that tree is array and has some entries in it
      const tree = cfg.data;
      if (!Array.isArray(tree) || tree.length === 0) {
        console.log(`Build Trees - Build: "${kind}" data empty or invalid. Returning.`);
        return document.createDocumentFragment();
      }

      // clear out any prior state for expanded/collapsed nodes
      cfg.mainSet.clear();

      // load previous expanded/collapsed nodes state in a separate set
      let prvAry = [];
      const rawAry = load(cfg.key, []);
      if (Array.isArray(rawAry)) prvAry = rawAry;
      else console.warn(`Expected array for "${cfg.key}", got:`, rawAry);
      const prvSet = new Set(prvAry);

      // Create root <ul> as the tree container.
      const rootUl = document.createElement('ul'); // a <ul> is a list, this will have items
      rootUl.classList.add('dp-tree-list'); // this name will be used in rhis and doxy-plus.css file to target the list
      rootUl.setAttribute('role', 'tree'); // assign the role as a tree to this <ul>
      rootUl.setAttribute('tabindex', '0');  // for keyboard nav

      // stack for iterative build
      const stack = [{ branch: tree, parentUl: rootUl, level: [] }];

      // continue building while there are entries in the stack
      while (stack.length) {

        // pop the top of the stack to build it
        const { branch, parentUl, level } = stack.pop();
        const fragment = document.createDocumentFragment();

        branch.forEach(([name, path, kids], idx) => {

          // Create the item <li> for this item
          const li = document.createElement('li'); // individual items
          li.classList.add('dp-tree-item'); // this name will be used to grab the item in this and doxy-plus.css file
          li.setAttribute('role', 'treeitem'); // assign the role as tree item

          // compute ID, each item has its unique id, this is so that it can be stored and so we can keep information of expanded/collapsed nodes
          const thisLevel = [...level, idx]; // generating the level value, this should generate something like 1.2.0
          const fileBase = (typeof path === 'string' && path.length > 0) ? (kind === 'primary' ? path.split('/').pop().replace(/\..*$/, '') : path) : null; // assigning file base
          const id = `${cfg.prefix}${thisLevel.join('.')}.${fileBase}`; // this for form an id of form e.g. P:1.2.0.file_name
          li.setAttribute('dp-item-id', id); // set the id

          // line container. This contains expand/collapse node and the link items.
          // This is made like this so that by targeting the dp-tree-line in doxy-plus.css file we target the base of the node and link.
          // We cannot target the li (dp-tree-item) because if this li has children then targeting dp-tree-item will also target those.
          const line = document.createElement('div'); // div class for the line
          line.classList.add('dp-tree-line');  // this name will be used to grab item -> line in this and doxy-plus.css file

          // toggle button. This button forms the expand/collapse node button. All items have it but only the ones that have children have it enabled
          // and visible, this way the left padding of all items remain the same.
          const node = document.createElement('button'); // button class for the node
          node.classList.add('dp-tree-node'); // this name will be used to grab item -> line -> node in this and doxy-plus.css file
          node.setAttribute('aria-expanded', 'false'); // this is for screen readers
          node.setAttribute('type', 'button'); // assign the type as button

          // link. This creates a clickable hyperlink that has a text.
          const link = document.createElement('a'); // creating a hyperlink class
          link.classList.add('dp-tree-link'); // this name will be used to grab item -> line -> link in this and doxy-plus.css file

          // primary tree need the DOC_ROOT to correctly open its links, since these are html files and requies full reload of tab.
          // secondary trees contains on-page links and so does not require any additional prefix or suffix.
          const href = (typeof path === 'string' && path.length > 0) ? (kind === 'primary' ? DOC_ROOT + path : path) : null;
          if (href) { // only assign if there is a value for the link
            link.href = href;
          } else { // if link is not available (can happen for empty node that is there just for its children)
            li.classList.add('dp-tree-no-href'); // add a class to the parent item so that it can be identified in this and doxy-plus.css file
            link.removeAttribute('href'); // remove the href attribute so that clicking on it does nothing
            link.setAttribute('aria-disabled', 'true'); // for screen readers
            link.setAttribute('tabindex', '-1'); // no tab index so that it cannot be reached by keyboard navigation
          }
          link.textContent = name; // assign the name, this will be displayed on screen

          // Get the current opened state of the node. For primary tree the default state is closed while for secondary tree it is opened.
          // For primary tree the stored set contains expanded nodes and for secondary tree stored set contains collapsed nodes.
          // So, if the stored set (i.e. prvSet) contains the id then it's open state is opposite of the default opened state for that tree.
          const isOpen = prvSet.has(id) ? !cfg.defaultOpen : cfg.defaultOpen;

          // assigning the text value for the node, this is what will be displayed.
          // '○' and '●' are choosen because it appears correctly on Windows and Android browsers (many other options do not appear correctly)
          node.textContent = isOpen ? '○' : '●';

          // Attach node and link to line, node and link can be accessed as line -> node and line -> link
          line.append(node, link);

          // Attach line to item <li>, it can now be accessed as item -> line
          li.appendChild(line);

          // If the item has children then it will have its own branch
          if (Array.isArray(kids) && kids.length) {

            // add a class to the item <li> so that it can be identified in this and doxy-plus.css that this item has children
            li.classList.add('dp-has-children');

            // Add the open state to the item <li>
            node.setAttribute('aria-expanded', String(isOpen)); // for screen readers
            if (isOpen) li.classList.add('dp-node-open'); // add a class if its open so that it can be identified in this and doxy-plus.css files
            cfg.setOpen(id, isOpen); // set the open value in its set, the set will be saved later after building is complete

            // Create child list <ul>
            const childUl = document.createElement('ul');
            childUl.classList.add('dp-tree-list'); // add the class name so that it can be identified in this and doxy-plus.css files
            childUl.setAttribute('role', 'group'); // set the role as group because it is a branch of a tree
            li.appendChild(childUl); // append the list to the item <li> as its child

            // push children for processing
            stack.push({ branch: kids, parentUl: childUl, level: thisLevel });
          }
          else {
            // If the item <li> has no child, then make the node hidden.
            // Hiding the node makes it non-interactive and invisible while reserving its space, this way all items are spaced correctly
            node.style.visibility = 'hidden';
          }

          // append the item <li> to its parent list <ul> fragment
          fragment.appendChild(li);
        });

        parentUl.appendChild(fragment);
      }

      cfg.saveDebounced(); // save initial state of expanded/collapsed nodes
      return rootUl; // return the built list <ul>
    }

    // Set the current item <li> for primary and secondary trees
    function setCurrentTreeItem(container, kind = 'primary') {
      // This function is called after the trees are built and placed in their respective containers

      // verifying
      if (!container || !CONFIG[kind]) {
        console.error(`Build Trees - Set Current Tree Item: Invalid parameter. Returning.`);
        return;
      }

      // get the correct config object
      const cfg = CONFIG[kind];

      // clear previous current item
      const prev = container.querySelector('.dp-current');
      if (prev) prev.classList.remove('dp-current');

      // Find new target. If the kind is primary we use the base url otherwise we use the on-page link (hash)
      const target = kind === 'primary' ? window.location.href.split('#')[0] : window.location.hash;
      if (!target) return; // if target cannot be found then return (can happen if has has become invalid in the new build)

      // Search for the item that has the target link
      for (const link of container.querySelectorAll('.dp-tree-link[href]')) {

        // If the link's href attribute matches the target then we have the correct link.
        // Note: for a link that has a hash href e.g. #abc, if we do link.href it will give current url + href
        // i.e. some.com/proj/file.html#abc and if we do link.getAttribute('href') then it will give only #abc
        // For a link that has full url (primary tree) both link.href and link.getAttribute('href') will return
        // the same value
        if (link.getAttribute('href') === target) {

          const item = link.closest('.dp-tree-item'); // find the parent item, since the relationship is item -> line -> link
          item.classList.add('dp-current'); // adding current class for identification in this and doxy-plus.css files
          item.classList.add('dp-visited'); // adding visited class for identifiaction in this and doxy-plus.css files

          // expand ancestors
          let parent = item.parentElement.closest('.dp-tree-item'); // find the parent item of the current item
          while (parent) {
            // keep expanding parent item as long as it is valid
            parent.classList.add('dp-node-open');

            // change the node text to reflect expanded state
            const btn = parent.querySelector(':scope > .dp-tree-line > .dp-tree-node');
            if (btn) {
              btn.textContent = '○';
              btn.setAttribute('aria-expanded', 'true');
            }

            // get the id so that its expanded state can be saved
            const id = parent.getAttribute('dp-item-id');
            cfg.setOpen(id, true);

            // recurse over its parent
            parent = parent.parentElement.closest('.dp-tree-item');
          }

          // scroll into view this item, "block: 'nearest'" will make sure it is in view vertically but will not
          // reposition if it is already in view. We do not scroll into view horizontally because horizontal
          // scroll is disabled, instead we use ellipsis to show that the text is longer than horizontal width.
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

          // break the loop since we have found the item
          break;
        }
      }

      // save the expanded/collapsed state
      cfg.saveDebounced();
    }

    function clickHandler(evt) {
      // Handles the click event for a node or link in a item <li>
      // evt is the event. The click handler is attached to the top
      // level tree and so we have to figure out exactly where in 
      // the list the user has clicked. For that we use the option
      // evt.target.matches(...)

      if (evt.target.matches('.dp-tree-node')) {
        // If the target where click happened has the dp-tree-node class then it means
        // the user clicked on a expand/collapse node. For a node that is hidden i.e.
        // for an item which does not have a child, this will not match since the node
        // itself is hidden.

        // find the parent item <li> since the relationship is item -> line -> node
        const li = evt.target.closest('.dp-tree-item');

        // if the parent item <li> is not found or if it doesn't have a child then return
        if (!li || !li.classList.contains('dp-has-children')) return;

        // get the id of the item <li> so that we can store its changed state of expand/collapse node
        const id = li.getAttribute('dp-item-id');

        // toggle the dp-node-open class on the item <li> this will flip its state and return the new value as a boolean
        const isOpen = li.classList.toggle('dp-node-open');

        // set the correct text on the node given is expand/collapse (or open/close) state
        evt.target.textContent = isOpen ? '○' : '●';

        // add the string for screen-readers
        evt.target.setAttribute('aria-expanded', String(isOpen));

        // get the correct config, since the id for primary tree config starts with "P:" and
        // for secondary tree config starts with "S:", we can determine the correct config from
        // the id
        const cfg = id.startsWith('P:') ? CONFIG.primary : CONFIG.secondary;

        // store the new expand/collapse (or open/close) state for the item <li>
        cfg.setOpen(id, isOpen);

        // call the save function so that new expand/collapse state is stored immediately
        cfg.saveDebounced();
      }
      else if (evt.target.matches('.dp-tree-link[href]')) {
        // If the target matches a link which has an href value (so empty link objects with no href
        // will not match) then it means uswer clicked on a link object. Since the link object is of
        // type hyperlink and has a href, the browser will automatically redirect. However, we are
        // storing the visited state for an item <li> so we update that here.
        evt.target.closest('.dp-tree-item').classList.add('dp-visited');
      }
    }

    function getVisibleSecTreeItems() {
      // Returns the currently visible items with non-empty links in the secondary container.
      // This will not include any children whose parent item is not expanded.

      // create an array that will store the list of items that are currently visible
      const result = [];

      function walk(ul) {
        // Walk the given list <ul> in order to grab all visible items

        // select all item which is identified by dp-tree-item class
        for (const li of ul.querySelectorAll(':scope > li.dp-tree-item')) {
          // grab the immediate link, if it exists
          const link = li.querySelector(':scope > .dp-tree-line > .dp-tree-link[href]:not([aria-disabled])');
          if (link) {
            result.push(li); // if the link exists and is not empty then add this item <li> to the results list
          }
          // recurse only into open branches
          if (li.classList.contains('dp-has-children') && li.classList.contains('dp-node-open')) {
            const childUl = li.querySelector(':scope > ul.dp-tree-list');
            if (childUl) walk(childUl);
          }
        }
      }

      // find all top-level tree-lists under the secondary container
      for (const topUl of secCon.querySelectorAll(':scope > ul.dp-tree-list')) {
        walk(topUl);
      }

      // return the result array
      return result;
    }

    function keyHandler(evt) {
      // Handles the key events such as arrow keys. This only is attached to secondary tree container.
      // Not having this for primary tree is because primary tree contains url's, clicking on any item
      // in primary tree will lead to full page loads and full execution of all files including this file.
      // As a reult when a primary tree link is clicked everything is reloaded and determining if last
      // click was on primary tree because more difficult.

      // focusables is the current list of all visible items in the secondary container
      const focusables = getVisibleSecTreeItems();

      // if focusables is not an array or if its length is just 0 or 1 then don't do anything
      // because there is no need for keyboard navigation in such case.
      if (!Array.isArray(focusables) || focusables.length < 2) return;

      // get the index of the current item in the focusables list
      const idx = focusables.indexOf(secCon.querySelector('.dp-current'));

      // if there is no current item then return because we will not be able to determine up or down items
      if (idx === -1) return;

      // get the config for the secondary tree
      const cfg = CONFIG.secondary;

      // based on key we do different things
      switch (evt.key) {
        case 'ArrowDown': {
          // Arrow Down key -> we move to item below that is visible, if there are no item below then we do nothing

          // so that the default action does not happen and the event is not forwarded to the container, if forwarded
          // then the container itself will scroll.
          evt.preventDefault();

          // next index, if next index is valid then simulate a click on its link object which can be obtained using line -> link
          const nIdx = idx + 1;
          if (nIdx < focusables.length) focusables[nIdx].querySelector('.dp-tree-line > .dp-tree-link').click();
          break;
        }
        case 'ArrowUp': {
          // Arrow Up key -> we move to item above that is visible, if there are no item above then we do nothing

          // so that the default action does not happen and the event is not forwarded to the container, if forwarded
          // then the container itself will scroll.
          evt.preventDefault();

          // previous index, if previous index is valid then simulate a click on its link object which can be obtained using line -> link
          const nIdx = idx - 1;
          if (nIdx >= 0) focusables[nIdx].querySelector('.dp-tree-line > .dp-tree-link').click();
          break;
        }
        case 'ArrowRight': {
          // Right Arrow Key -> This will expand the current item if it has children and it is not expanded.

          // prevent default to stop the event propagating to the parent container
          evt.preventDefault();

          // get the hasChildren, open state and node object
          const hasChildren = focusables[idx].classList.contains('dp-has-children');
          const isOpen = focusables[idx].classList.contains('dp-node-open');
          const node = focusables[idx].querySelector(':scope > .dp-tree-line > .dp-tree-node');

          // if it has children, the node object is valid and the item is not open then we open it
          if (hasChildren && node && !isOpen) {
            // get the id of the item so that its expanded state can be saved
            const id = focusables[idx].getAttribute('dp-item-id');

            // add the dp-node-open class to the item <li> so that it can be identified as open in this and doxy-plus.css files
            focusables[idx].classList.add('dp-node-open');

            // change the node's text to reflect its opened state
            node.textContent = '○';

            // set the correct string for screen readers
            node.setAttribute('aria-expanded', 'true');

            // set the opened state for the tree in its expand/collapse set
            cfg.setOpen(id, true);

            // save the expand/collapse set
            cfg.saveDebounced();
          }
          break;
        }
        case 'ArrowLeft': {
          // Arrow Left key -> we collapse the current item if it has children and is open, other wise we collapse
          // its parent item, if it exists.

          // prevent default to stop the event propagating to the parent container
          evt.preventDefault();

          // For the current item, check if it has children, is open and get its node and parent
          const hasChildren = focusables[idx].classList.contains('dp-has-children');
          const isOpen = focusables[idx].classList.contains('dp-node-open');
          const parLi = focusables[idx].parentElement.parentElement;
          const node = focusables[idx].querySelector(':scope > .dp-tree-line > .dp-tree-node');

          // if the item has children, and its node object is valid and it is expanded/open then we collapse it
          if (hasChildren && node && isOpen) {
            // get the id of the item so that its collapsed state can be saved
            const id = focusables[idx].getAttribute('dp-item-id');

            // remove the dp-node-open class from the item <li> so that it can be identified as collapsed in this and doxy-plus.css files
            focusables[idx].classList.remove('dp-node-open');

            // change the node's text to reflect its collapsed state
            node.textContent = '●';

            // set the correct string for screen readers
            node.setAttribute('aria-expanded', 'false');

            // set the collapsed state for the tree in its expand/collapse set
            cfg.setOpen(id, false);

            // save the expand/collapse set
            cfg.saveDebounced();
          }
          else if (parLi) {
            // If the item does not have children or is not expanded/open but has a parent item then we collapse its parent item

            // For the parent item we check if it has children, it is open and has a valid node object
            const parHasChildren = parLi.classList.contains('dp-has-children');
            const parIsOpen = parLi.classList.contains('dp-node-open');
            const parNode = parLi.querySelector(':scope > .dp-tree-line > .dp-tree-node');

            // if the parent item has children, and its node object is valid and it is expanded/open then we collapse it
            if (parHasChildren && parNode && parIsOpen) {
              // get the id of the parent item so that its collapsed state can be saved
              const id = parLi.getAttribute('dp-item-id');

              // remove the dp-node-open class from the parent item <li> so that it can be identified as collapsed in this and doxy-plus.css files
              parLi.classList.remove('dp-node-open');

              // change the parent item's node text to reflect its collapsed state
              parNode.textContent = '●';

              // set the correct string for screen readers
              parNode.setAttribute('aria-expanded', 'false');

              // set the collapsed state for the tree in its expand/collapse set
              cfg.setOpen(id, false);

              // save the expand/collapse set
              cfg.saveDebounced();

              // get the link object for the parent item so that we can navigate to it
              const link = parLi.querySelector(':scope > .dp-tree-line > .dp-tree-link');
              if (typeof link.href === 'string' && link.href.length > 0) {
                window.location.href = link.href;
              }
            }
          }
          break;
        }
        case 'Home': {
          // Home key -> Got to the first item in the list

          // prevent default to stop the event propagating to the parent container
          evt.preventDefault();

          // simulate a click on the first item in the focusables list
          focusables[0].querySelector('.dp-tree-line > .dp-tree-link').click();
          break;
        }
        case 'End': {
          // End key -> Got to the last item in the list

          // prevent default to stop the event propagating to the parent container
          evt.preventDefault();

          // simulate a click on the last item in the focusables list
          focusables[focusables.length - 1].querySelector('.dp-tree-line > .dp-tree-link').click();
          break;
        }
      }
    }

    // We remove the indentation of sub-items in a tree if the tree only has 2 levels and if
    // all items in the top levels have child items and if all child items have no children of
    // their own. This way since all child items has no children their node will be invisible
    // providing them an indentation and since all top level items have children, they will have
    // nodes and so will be easily disntinguished from child items and there will be no top level
    // item without a node. If the primary tree has indentation or not is determined when building
    // the primary tree, since the tree is saved and not build each time we also save its indentation
    // value and load it with the tree.
    // If the tree is indented add dp-indented-tree clas to its container so that it can be identified in this and doxy-plus.css files
    if (_priTreeIndented) priCon.classList.add('dp-indented-tree');
    const priTreeRoot = build('primary'); // build the tree ul->li structure
    priCon.appendChild(priTreeRoot); // add the built tree to the container
    setCurrentTreeItem(priCon, 'primary'); // set the current item for the primary tree
    priTreeRoot.addEventListener('click', clickHandler); // install the click listner

    // only proceed if the secondary is available, this tree is only available in a class or struct page
    if (_secTree.length > 0) {
      if (isTreeIndented(_secTree)) secCon.classList.add('dp-indented-tree'); // check if secondary tree should be indented, if yes add dp-indented-tree class to container
      const secTreeRoot = build('secondary'); // build the tree ul->li structure
      secCon.appendChild(secTreeRoot); // add the built tree to the container
      setCurrentTreeItem(secCon, 'secondary'); // set the current item for the secondary tree
      secTreeRoot.addEventListener('click', clickHandler); // install the click listner

      // install the hash changed listner for the secondary tree, so that it updates the current item
      // on hash change. This way whenever hash is changed by clicking a link in secondary tree or
      // in the default side-nav of doxygen the current item in secondary tree is always up to date.
      window.addEventListener('hashchange', () => { setCurrentTreeItem(secCon, 'secondary'); });

      // We check if the last portion clicked was the secondary tree, so that we can react to key
      // down events on secondary tree
      let secConActive = false; // by default the last portion clicked is not on secondary tree
      document.addEventListener('mousedown', evt => {
        // in the mouse down event on the entire page, we see get the point where mouse was clicked
        // and if it is over secondary container then we set secondary tree as active so that we
        // can react to key down events
        const hit = document.elementFromPoint(evt.clientX, evt.clientY);
        if (hit.closest('#dp-sec-nav')) secConActive = true;
        else secConActive = false;
      }, true);

      // listening to key down events, inside the event we check if secondary tree is active, and then react
      // to only a given set of keyboard keys by sending the event to our keyHandler function above
      document.addEventListener('keydown', evt => {
        if (secConActive) {
          if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evt.key)) return;
          keyHandler(evt)
        }
      });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 BUILD TREES

  // #region 🟩 DISPLAY DEF TREE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function displayDefTree(groupFormat = true) {
    // Generate and display the default Doxygen NAVTREE.
    // Use grouped view when groupFormat is true; otherwise, use table view.

    // generating the default Doxygen NAVTREE
    const defTree = await genDefTree();

    // If the tree has entries, render in the selected format
    if (Array.isArray(defTree) && defTree.length > 0) {
      if (groupFormat) {
        // Render NAVTREE in grouped format
        printTreeGroupFormat(defTree);
      }
      else {
        // Render NAVTREE in table format
        printTreeTableFormat(defTree);
      }
    }
    else {
      // Log an error if the default NAVTREE is EMPTY
      console.error('Default Doxygen NAVTREE Tree is EMPTY');
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 DISPLAY DEF TREE

  // #region 🟩 DISPLAY MISSED HTML PAGES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function displayMissedHtmlPages() {
    // Display any HTML pages present in the default Doxygen NAVTREE but missing from the Doxy-Plus primary tree.

    // Build a set of all HTML pages seen in the primary tree (_priTree).
    const seenHtml = new Set();
    if (Array.isArray(_priTree) && _priTree.length > 0) {
      (function markSeen(tree) {
        // Return if tree is empty or not an array
        if (!Array.isArray(tree) || tree.length === 0) return;
        for (const [, href, kids] of tree) {
          if (typeof href === 'string' && IS_HTML_END.test(href) && !seenHtml.has(href)) {
            // Add HTML links to the seenHtml set
            seenHtml.add(href);
          }
          if (Array.isArray(kids)) markSeen(kids); // Recurse into child nodes
        }
      })(_priTree);
    }

    // Generate the default Doxygen NAVTREE for comparison
    const defTree = await genDefTree();

    // If default tree is valid, compare and collect any missing pages
    if (Array.isArray(defTree) && defTree.length > 0) {
      const collected = new Set();
      let missedPages = [];

      (function collect(tree, parName = '') {
        // Return if tree is empty or not an array
        if (!Array.isArray(tree) || tree.length === 0) return;

        for (const [name, href, kids] of tree) {
          // Build full name path using arrows for nesting
          const fullName = parName === '' ? name : parName + " → " + name;

          if (typeof href === 'string') {
            // Strip on-page-link/fragment-identifiers from links
            const link = href.replace(/(\.html)#.*$/, '$1');
            // If link is HTML, unseen, and not already collected, record it
            if (IS_HTML_END.test(link) && !seenHtml.has(link) && !collected.has(link)) {
              collected.add(link);
              missedPages.push({ Name: fullName, Link: link });
            }
          }

          // Recurse into child nodes
          if (Array.isArray(kids)) collect(kids, fullName);
        }
      })(defTree);

      if (missedPages.length > 0) {
        // Display a table of missed pages in the console
        console.table(missedPages);
      }
      else {
        // Inform that there are no missing HTML pages
        console.log('Missed HTML Pages list is EMPTY');
      }
    }
    else {
      // Log an error if the default NAVTREE could not be retrieved
      console.error('Unable to get Default NAVTREE');
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 DISPLAY MISSED HTML PAGES

  // #region 🟩 PURGE EXPIRED DATA
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  function purgeExpiredData() {
    // Purges expired data stored by store.js for this origin, runs at most once per day.

    // Purges data for the entire origin. Origin is the url if hosted otherwise
    // if opened from local disk then all projects share the same local origin in browser

    // Determine today's date in YYYY-MM-DD format.
    const today = new Date().toISOString().slice(0, 10);

    // Get last purge date to avoid multiple purges in one day.
    const lastPurged = localStorage.getItem(KEY__EXPIRED_DATA_PURGE_DATE);
    if (lastPurged === today) return;

    // Actual purge logic: iterates all keys and removes expired entries.
    function purge() {
      const PRE = '__storejs___storejs_'; // Prefix used by store.js for localStorage keys
      const SEP = '_expire_mixin_';       // Separator indicating expiry metadata

      try {
        Object.keys(localStorage).forEach(fullKey => {
          // Only process keys matching the expiry pattern
          if (fullKey.startsWith(PRE) && fullKey.indexOf(SEP, PRE.length) !== -1) {
            // Extract namespace and actual key
            const [nsName, actualKey] = fullKey.slice(PRE.length).split(SEP, 2);
            // Accessing the key via store.js will remove it if expired
            store.namespace(nsName).get(actualKey);
          }
        });
      } catch (err) {
        // Log any errors encountered during purge
        console.warn('Purge Expired Data Error:', err);
      }

      // Record today's date as the last purge time
      localStorage.setItem(KEY__EXPIRED_DATA_PURGE_DATE, today);
    }

    // Schedule the purge during an idle period if available, otherwise use a timeout
    if ('requestIdleCallback' in window) {
      requestIdleCallback(purge, { timeout: 5000 });
    } else {
      setTimeout(purge, 5000);
    }
  }


  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 PURGE EXPIRED DATA

  // #region 🟩 CONSOLE OBJECT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const consoleObject = Object.create(null); // main object

  // ⚠️ In this section comments are provided as console.log values because it should also be displayed in console

  Object.defineProperty(consoleObject, 'project_root', { // Project Root Location
    get() {
      console.log(`${DOC_ROOT}\n\nIf the project is hosted on GitHub, the root is the origin URL plus the repository name; otherwise, it defaults to the local folder path on disk.`);
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'project_namespace', { // Project Namespace
    get() {
      console.log(`${PROJ_NAMESPACE}\n\nThis namespace is used by Doxy-Plus to store project data. Doxy-Plus uses store.js's (https://github.com/marcuswestin/store.js) namespace feature. Assigning each project its own namespace ensures that data remains isolated and cannot conflict with other projects.\n\nBy default, store.js uses the browser's localStorage, which namespaces data by origin. As a result, projects sharing the same origin (e.g. some.com/proj_a and some.com/proj_b) will share the same storage. Likewise, projects loaded from different disk locations (e.g. D:/file/proj_a and E:/other/proj_b) also end up using the same localStorage.`);
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'storage_clear_all', { // To clear all storage
    get() {
      localStorage.clear();
      sessionStorage.clear();
      console.log(`Storage Clear All: Done!\n\n All data stored at this origin (for example, both some.com/proj_a and some.com/proj_b have same origin and all projects on local disk e.g. D:/file/proj_a and E:/other/proj_b share same origin) have been cleared`);
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'storage_local', { // Browser localStorage
    get() {
      console.group('● Browser Local Storage');
      console.log(`Displays the current contents of the browser's localStorage, including default entries and data from all projects. The browser's localStorage persists on disk indefinitely until explicitly cleared.\n\nProject data saved by Doxy-Plus includes an expiration (using store.js: https://github.com/marcuswestin/store.js) and will be removed the next time it's accessed (for example, when opening a project on the same origin). Entries written by store.js use a special signature, so their raw values may appear as “garbage”. To decode them correctly, always read using ${_consoleObjectName}.storage_origin (for all projects) or ${_consoleObjectName}.storage_project (for this project).`);
      const table = [];
      Object.keys(localStorage).forEach(fullKey => {
        table.push({
          Key: fullKey,
          Value: localStorage.getItem(fullKey)
        })
      });
      if (table.length > 0) {
        console.table(table);
      }
      else {
        console.log('Browser Local Storage is EMPTY');
      }
      console.groupEnd();
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'storage_session', { // Browser sessionStorage
    get() {
      console.group('● Browser Session Storage Contents');
      console.log(`Browser sessionStorage: Displays the current contents of the browser's sessionStorage. The browser's sessionStorage persists for the lifetime of the tab—surviving reloads—but is cleared when the tab is closed. Doxy-Plus (through store.js: https://github.com/marcuswestin/store.js) uses it as a fallback storage location. By default there are no data stored by Doxy-Plus in browser's sessionStorage.`);
      const table = [];
      Object.keys(sessionStorage).forEach(fullKey => {
        table.push({
          Key: fullKey,
          Value: sessionStorage.getItem(fullKey)
        })
      });
      if (table.length > 0) {
        console.table(table);
      }
      else {
        console.log('Browser Session Storage is EMPTY');
      }
      console.groupEnd();
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'storage_project', { // Project Storage
    get() {
      console.group('● Project Storage Contents');
      console.log(`Displays the data stored by Doxy-Plus for the current project. Doxy-Plus uses store.js (https://github.com/marcuswestin/store.js) to save project data within a project-specific namespace in browser's localStorage and to enforce an expiry timeout. When a project opens, data from all projects on the same origin—for example, some.com/proj_a and some.com/proj_b, or local files D:/file/proj_a and E:/other/proj_b—is checked for expiry, and any expired entries are removed.`);
      const table = [];
      const PRE = '__storejs___storejs_';
      const SEP = '_expire_mixin_';
      Object.keys(localStorage).forEach(fullKey => {
        if (fullKey.startsWith(PRE) && fullKey.indexOf(SEP, PRE.length) !== -1) {
          const rem = fullKey.slice(PRE.length);
          const [nsName, actualKey] = rem.split(SEP, 2);
          if (nsName === PROJ_NAMESPACE) {
            const expiresAt = STORAGE.getExpiration(actualKey);
            const isExpired = expiresAt != null && Date.now() > expiresAt;
            table.push({
              Namespace: PROJ_NAMESPACE,
              Key: actualKey,
              Value: STORAGE.get(actualKey),
              Validity: expiresAt
                ? new Date(expiresAt).toLocaleString()   // local date/time
                : null,
              Expired: isExpired
            });
          }
        }
      });
      if (table.length > 0) {
        console.table(table);
      }
      else {
        console.log('Project Storage is EMPTY');
      }
      console.groupEnd();
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'storage_origin', { // Origin Storage
    get() {
      console.group('● Origin Storage Contents');
      console.log(`Displays the data stored by Doxy-Plus for all projects at the current origin. Projects share the same origin, for example, some.com/proj_a and some.com/proj_b share the same origin, or local files D:/file/proj_a and E:/other/proj_b share the same origin of being local. Doxy-Plus uses store.js (https://github.com/marcuswestin/store.js) to save project data within a project-specific namespace in browser's localStorage and to enforce an expiry timeout. When a project opens, data from all projects on the same origin is checked for expiry, and any expired entries are removed.`);
      const table = [];
      const PRE = '__storejs___storejs_';
      const SEP = '_expire_mixin_';
      Object.keys(localStorage).forEach(fullKey => {
        if (fullKey.startsWith(PRE) && fullKey.indexOf(SEP, PRE.length) !== -1) {
          const rem = fullKey.slice(PRE.length);
          const [nsName, actualkey] = rem.split(SEP, 2);
          const nsStore = store.namespace(nsName);
          const expiresAt = nsStore.getExpiration(actualkey);
          const isExpired = expiresAt != null && Date.now() > expiresAt;
          table.push({
            Namespace: nsName.length > 0 ? nsName : null,
            Key: actualkey,
            Value: nsStore.get(actualkey),
            Validity: expiresAt
              ? new Date(expiresAt).toLocaleString()   // local date/time
              : null,
            Expired: isExpired
          });
        }
      });
      if (table.length > 0) {
        console.table(table);
      }
      else {
        console.log('Origin Storage is EMPTY');
      }
      console.groupEnd();
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'navtree_doxygen_table_format', { // Doxygen NAVTREE Table Format
    get() {
      console.group('● Doxygen NAVTREE');
      console.log(`Displays the default NAVTREE generated by Doxygen in Table Format`);
      displayDefTree(false);
      console.groupEnd();
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'navtree_doxygen_group_format', { // Doxygen NAVTREE Group Format
    get() {
      console.group('● Doxygen NAVTREE');
      console.log(`Displays the default NAVTREE generated by Doxygen in Group Format`);
      displayDefTree(true);
      console.groupEnd();
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'primary_tree_table_format', { // Primary Tree Table Format
    get() {
      console.group('● Primary Tree');
      console.log(`Displays the modified version of default Doxygen NAVTREE generated by Doxy-Plus in table format. The modified NAVTREE has streamlined, flattened entries and includes all HTML pages from the default NAVTREE—it omits duplicate entries and excludes on-page links (e.g., links to functions and variables within a class). On-page links for classes and structs are generated in the Secondary Tree, which you can view using ${_consoleObjectName}.secondary_tree_table_format or ${_consoleObjectName}.secondary_tree_group_format.\n\nTo verify that no HTML pages are missing, use ${_consoleObjectName}.missed_html_pages.`);
      if (_priTree.length > 0) {
        printTreeTableFormat(_priTree);
      }
      else {
        console.log('Primary Tree is EMPTY');
      }
      console.groupEnd();
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'primary_tree_group_format', { // Primary Tree Group Format
    get() {
      console.group('● Primary Tree');
      console.log(`Displays the modified version of default Doxygen NAVTREE generated by Doxy-Plus in group format. The modified NAVTREE has streamlined, flattened entries and includes all HTML pages from the default NAVTREE—it omits duplicate entries and excludes on-page links (e.g., links to functions and variables within a class). On-page links for classes and structs are generated in the Secondary Tree, which you can view using ${_consoleObjectName}.secondary_tree_table_format or ${_consoleObjectName}.secondary_tree_group_format.\n\nTo verify that no HTML pages are missing, use ${_consoleObjectName}.missed_html_pages.`);
      if (_priTree.length > 0) {
        printTreeGroupFormat(_priTree);
      }
      else {
        console.log('Primary Tree is EMPTY');
      }
      console.groupEnd();
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'missed_html_pages', { // Missed HTML Pages
    get() {
      console.group('● Missed HTML Pages');
      console.log(`Displays a list of HTML pages that are present in the default NAVTREE generated by Doxygen but are not present in Primary Tree generated by Doxy-Plus.`);
      displayMissedHtmlPages();
      console.groupEnd();
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'secondary_tree_table_format', { // Secondary Tree Table Format
    get() {
      console.group('● Secondary Tree');
      console.log(`Displays the Secondary Tree generated by Doxy-Plus in Table Format. This tree is only generated for Classes and Structs and contains on-page links.`);
      if (_secTree.length > 0) {
        printTreeTableFormat(_secTree);
      }
      else {
        console.log(`Secondary Tree is EMPTY: ${_secTreeRemarks}`);
      }
      console.groupEnd();
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'secondary_tree_group_format', { // Secondary Tree Group Format
    get() {
      console.group('● Secondary Tree');
      console.log(`Displays the Secondary Tree generated by Doxy-Plus in Group Format. This tree is only generated for Classes and Structs and contains on-page links.`);
      if (_secTree.length > 0) {
        printTreeGroupFormat(_secTree);
      }
      else {
        console.log(`Secondary Tree is EMPTY: ${_secTreeRemarks}`);
      }
      console.groupEnd();
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'secondary_tree_remarks', { // Secondary Tree Remarks
    get() {
      console.log(`Secondary Tree Remarks: ${_secTreeRemarks}`);
    },
    configurable: true
  });

  Object.defineProperty(consoleObject, 'info', { // Info
    // Defines a info property that can be called in browser console
    get() {
      console.group('● Doxy Plus Debug Information:');

      console.log(`● ${_consoleObjectName}.info\n\nThis information ouput`);

      console.log(`● ${_consoleObjectName}.project_root\n\nProject root location: If the project is hosted on GitHub, the root is the origin URL plus the repository name; otherwise, it defaults to the local folder path on disk.`);

      console.log(`● ${_consoleObjectName}.project_namespace\n\nProject Namespace: This namespace is used by Doxy-Plus to store project data. Doxy-Plus uses store.js's (https://github.com/marcuswestin/store.js) namespace feature. Assigning each project its own namespace ensures that data remains isolated and cannot conflict with other projects.\n\nBy default, store.js uses the browser's localStorage, which namespaces data by origin. As a result, projects sharing the same origin (e.g. some.com/proj_a and some.com/proj_b) will share the same storage. Likewise, projects loaded from different disk locations (e.g. D:/file/proj_a and E:/other/proj_b) also end up using the same localStorage.`);

      console.log(`● ${_consoleObjectName}.storage_clear_all\n\nClears all storage for this origin. Removes any data stored by projects under this origin—for example, both some.com/proj_a and some.com/proj_b share the same origin, or local files D:/file/proj_a and E:/other/proj_b share the same origin, and both would have their data cleared.`)

      console.log(`● ${_consoleObjectName}.storage_local\n\nDisplays the current contents of the browser's localStorage, including default entries and data from all projects. The browser's localStorage persists on disk indefinitely until explicitly cleared.\n\nProject data saved by Doxy-Plus includes an expiration (using store.js: https://github.com/marcuswestin/store.js) and will be removed the next time it's accessed (for example, when opening a project on the same origin). Entries written by store.js use a special signature, so their raw values may appear as “garbage”. To decode them correctly, always read using ${_consoleObjectName}.storage_origin (for all projects) or ${_consoleObjectName}.storage_project (for this project).`);

      console.log(`● ${_consoleObjectName}.storage_session\n\nDisplays the current contents of the browser's sessionStorage. The browser's sessionStorage persists for the lifetime of the tab—surviving reloads—but is cleared when the tab is closed. Doxy-Plus (through store.js: https://github.com/marcuswestin/store.js) uses it as a fallback storage location. By default there are no data stored by Doxy-Plus in browser's sessionStorage.`);

      console.log(`● ${_consoleObjectName}.storage_project\n\nDisplays the data stored by Doxy-Plus for the current project. Doxy-Plus uses store.js (https://github.com/marcuswestin/store.js) to save project data within a project-specific namespace in browser's localStorage and to enforce an expiry timeout. When a project opens, data from all projects on the same origin—for example, some.com/proj_a and some.com/proj_b, or local files D:/file/proj_a and E:/other/proj_b—is checked for expiry, and any expired entries are removed.`);

      console.log(`● ${_consoleObjectName}.storage_origin\n\nDisplays the data stored by Doxy-Plus for all projects at the current origin. Projects share the same origin, for example, some.com/proj_a and some.com/proj_b share the same origin, or local files D:/file/proj_a and E:/other/proj_b share the same origin of being local. Doxy-Plus uses store.js (https://github.com/marcuswestin/store.js) to save project data within a project-specific namespace in browser's localStorage and to enforce an expiry timeout. When a project opens, data from all projects on the same origin is checked for expiry, and any expired entries are removed.`);

      console.log(`● ${_consoleObjectName}.navtree_doxygen_table_format\n\nDisplays the default NAVTREE generated by Doxygen in Table Format`);

      console.log(`● ${_consoleObjectName}.navtree_doxygen_group_format\n\nDisplays the default NAVTREE generated by Doxygen in Group Format`);

      console.log(`● ${_consoleObjectName}.primary_tree_table_format\n\nDisplays the modified version of default Doxygen NAVTREE generated by Doxy-Plus in table format. The modified NAVTREE has streamlined, flattened entries and includes all HTML pages from the default NAVTREE—it omits duplicate entries and excludes on-page links (e.g., links to functions and variables within a class). On-page links for classes and structs are generated in the Secondary Tree, which you can view using ${_consoleObjectName}.secondary_tree_table_format or ${_consoleObjectName}.secondary_tree_group_format.\n\nTo verify that no HTML pages are missing, use ${_consoleObjectName}.missed_html_pages.`);

      console.log(`● ${_consoleObjectName}.primary_tree_group_format\n\nDisplays the modified version of default Doxygen NAVTREE generated by Doxy-Plus in group format. The modified NAVTREE has streamlined, flattened entries and includes all HTML pages from the default NAVTREE—it omits duplicate entries and excludes on-page links (e.g., links to functions and variables within a class). On-page links for classes and structs are generated in the Secondary Tree, which you can view using ${_consoleObjectName}.secondary_tree_table_format or ${_consoleObjectName}.secondary_tree_group_format.\n\nTo verify that no HTML pages are missing, use ${_consoleObjectName}.missed_html_pages.`);

      console.log(`● ${_consoleObjectName}.missed_html_pages\n\nDisplays a list of HTML pages that are present in the default NAVTREE generated by Doxygen but are not present in Primary Tree generated by Doxy-Plus.`);

      console.log(`● ${_consoleObjectName}.secondary_tree_table_format\n\nDisplays the Secondary Tree generated by Doxy-Plus in Table Format. This tree is only generated for Classes and Structs and contains on-page links.`);

      console.log(`● ${_consoleObjectName}.secondary_tree_group_format\n\nDisplays the Secondary Tree generated by Doxy-Plus in Group Format. This tree is only generated for Classes and Structs and contains on-page links.`);

      console.log(`● ${_consoleObjectName}.secondary_tree_remarks\n\n Remarks made by Doxy-Plus for secondary tree generation.`);
      console.groupEnd();
    },
    configurable: true
  });

  // Assign "dp" as the object for window so that it can be used as debug handler in console,
  // if "dp" is not available then we use "debugDoxyPlus". This can be used in browser console
  // to call the above attached properties.
  // window.dp = Object.create(null); // if set below else will be executed, this is just to
  if (window.dp !== undefined) {
    console.log('● Full Reload: "dp" already defined - "debugDoxyPlus" is the console debug handler');
    window.debugDoxyPlus = consoleObject;
    _consoleObjectName = 'debugDoxyPlus';
  }
  else {
    console.log('● Full Reload: "dp" is the console debug handler');
    window.dp = consoleObject;
    _consoleObjectName = 'dp';
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 CONSOLE OBJECT

  // #region 🟩 DOCUMENT DOM LOADING CALLS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function docOnReady() {
    // Runs when the DOM is available, much earlier than window.addEventListener('load').
    // Maintain this sequence of calls; order is crucial for correct behavior.
    searchbarTweak();               // Sets search selector text instead of a magnifying-glass icon.
    sidebarToggleButton();          // Adds the sidebar-toggle button next to the search bar.
    sideNavTweak();                 // Removes default top entry and updates expand/collapse toggle.
    dualNavInit();                  // Initializes dual nav panes and attaches the resize handler.
    await genPriTree();             // Generates the primary tree from the default Doxygen NAVTREE.
    checkReload();                  // Redirects the URL if necessary; primary tree must be ready first.
    await genSecTree();             // Generates the secondary tree for class or struct pages.
    setupResizeObservers();         // Observes element size changes per values in doxy-plus.css.
    searchResultWindowObserver();   // Matches search-result window’s position/width to the search bar.
    buildTrees();                   // Builds the display trees for primary and secondary panes.
    purgeExpiredData();             // Removes any expired stored data for this origin.
  }


  // Fires as soon as the browser has parsed the HTML and built the DOM (Document Object Model) tree — before images, 
  // stylesheets, iframes, etc., have all finished loading.
  // ⚠️ Fires much earlier than 'window.addEventListener('load', function ()...'
  // ⚠️ Guranteed that 'docOnReady()' will fire once DOM has been prased and is available 
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', docOnReady);
  } else {
    docOnReady();
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 DOCUMENT LOADING CALLS

  // #region 🟩 WINDOW ON LOAD CALL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /*
  window.addEventListener('load', function () {
    // Fires after the entire page is “loaded” — HTML parsed and all external resources (images, styles, frames, fonts,
    // scripts, etc.) have finished downloading.
    // ⚠️ Always happens later than DOMContentLoaded.
  });
  */

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // #endregion 🟥 WINDOW ON LOAD CALL


})(jQuery);