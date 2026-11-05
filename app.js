(() => {
  'use strict';

  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const isTyping = target => target.closest?.('input, textarea, select, [contenteditable="true"]');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const scrollBehavior = () => reducedMotion?.matches ? 'auto' : 'smooth';
  const journeyReveals = new Map();
  let refreshCaseIndex = () => {};
  document.documentElement.classList.remove('no-js');

  const atlas = document.getElementById('lyubo-launch');
  if (atlas) {
    let press = null, dragged = false;
    atlas.classList.add('can-pan');
    atlas.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || event.shiftKey ||
          !event.target.closest('.launch-composition') || atlas.scrollWidth <= atlas.clientWidth) return;
      press = {id:event.pointerId, x:event.clientX, left:atlas.scrollLeft};
      dragged = false;
      atlas.classList.add('pan-pressed');
    });
    atlas.addEventListener('dragstart', event => { if (press) event.preventDefault(); });
    window.addEventListener('pointermove', event => {
      if (!press || press.id !== event.pointerId) return;
      if (!(event.buttons & 1)) { endPan(); return; }
      const dx = event.clientX - press.x;
      if (!dragged && Math.abs(dx) < 5) return;
      if (!dragged) {
        dragged = true;
        atlas.setPointerCapture(event.pointerId);
        atlas.classList.add('is-panning');
      }
      atlas.scrollLeft = press.left - dx;
    });
    function endPan(event) {
      if (!press || (event?.pointerId != null && event.pointerId !== press.id)) return;
      const id = press.id;
      press = null;
      atlas.classList.remove('pan-pressed', 'is-panning');
      if (atlas.hasPointerCapture(id)) atlas.releasePointerCapture(id);
      setTimeout(() => { dragged = false; }, 0);
    }
    window.addEventListener('pointerup', endPan);
    window.addEventListener('pointercancel', endPan);
    window.addEventListener('blur', endPan);
    atlas.addEventListener('lostpointercapture', endPan);
    atlas.addEventListener('click', event => {
      if (dragged && event.detail) { event.preventDefault(); event.stopPropagation(); }
    }, true);
  }

  // Original publication slides: native swipe, keyboard, buttons and image zoom.
  all('[data-publication-reader]').forEach(reader => {
    const track = reader.querySelector('.reader-track');
    const slides = all('[data-reader-slide]', reader);
    if (!track || !slides.length) return;
    const prev = reader.querySelector('[data-reader-prev]');
    const next = reader.querySelector('[data-reader-next]');
    const count = reader.querySelector('[data-reader-count]');
    track.id = `reader-${reader.dataset.publicationReader}`;
    [prev, next].forEach(button => button?.setAttribute('aria-controls', track.id));
    const position = slide => slide.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
    const current = () => slides.reduce((best, slide, i) => Math.abs(position(slide) - track.scrollLeft) < Math.abs(position(slides[best]) - track.scrollLeft) ? i : best, 0);
    function sync() {
      const at = current();
      if (count) count.textContent = `${at + 1} / ${slides.length}`;
      if (prev) prev.disabled = at === 0;
      if (next) next.disabled = at === slides.length - 1;
      slides.forEach((slide, i) => {
        if (i !== at) all('video', slide).forEach(video => video.pause());
        all('button, video', slide).forEach(control => { control.tabIndex = i === at ? 0 : -1; });
      });
    }
    function move(direction) {
      const focusedSlide = document.activeElement?.closest('[data-reader-slide]');
      const transferFocus = focusedSlide && track.contains(focusedSlide);
      const at = Math.max(0, Math.min(slides.length - 1, current() + direction));
      track.scrollTo({left:position(slides[at]), behavior:'instant'});
      sync();
      if (transferFocus) (slides[at].querySelector('button, video') || track).focus({preventScroll:true});
      if (reader.closest('main')) requestAnimationFrame(() => {
        const bounds = reader.getBoundingClientRect();
        const sticky = document.querySelector('.case-index')?.getBoundingClientRect().bottom || 80;
        if (bounds.top < sticky || bounds.bottom > innerHeight - 8) reader.scrollIntoView({block:'start', behavior:'instant'});
      });
    }
    prev?.addEventListener('click', () => move(-1));
    next?.addEventListener('click', () => move(1));
    track.addEventListener('scroll', sync, {passive:true});
    track.addEventListener('keydown', event => {
      if (isTyping(event.target) || event.target.closest('video') || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1);
      }
    });
    window.addEventListener('resize', sync, {passive:true});
    sync();
  });

  // Skill filters are reflected in the URL so a view can be shared or revisited.
  const skillButtons = all('[data-skill]');
  if (skillButtons.length) {
    const validSkills = new Set(skillButtons.map(button => button.dataset.skill));
    const results = all('.skill-results .skill-result');
    const defaultSkill = validSkills.has('editing') ? 'editing' : skillButtons[0].dataset.skill;

    function applySkill(requested, updateURL = false) {
      const skill = validSkills.has(requested) ? requested : defaultSkill;
      skillButtons.forEach(button => {
        const active = button.dataset.skill === skill;
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('active', active);
      });
      results.forEach(result => {
        const matches = (result.dataset.skills || '').split(/\s+/).includes(skill);
        result.hidden = !matches;
        if (!matches) all('video', result).forEach(video => video.pause());
      });
      if (updateURL) {
        const url = new URL(window.location.href);
        url.searchParams.set('skill', skill);
        url.hash = 'skills';
        if (url.href !== window.location.href) window.history.pushState(null, '', url);
      }
    }

    const syncSkill = () => {
      let target = null;
      try { target = document.getElementById(decodeURIComponent(window.location.hash.slice(1))); } catch {}
      const panel = target?.closest('.skill-panel');
      applySkill(panel?.dataset.skills || new URL(window.location.href).searchParams.get('skill'));
    };
    skillButtons.forEach(button => button.addEventListener('click', event => {
      event.preventDefault();
      applySkill(button.dataset.skill, true);
      const catalogue = button.closest('#skills');
      if (catalogue && catalogue.getBoundingClientRect().top < 0) catalogue.scrollIntoView({block: 'start', behavior: 'instant'});
    }));
    window.addEventListener('popstate', syncSkill);
    window.addEventListener('hashchange', syncSkill);
    syncSkill();
  }

  function hashTarget(hash = window.location.hash) {
    if (!hash || hash === '#') return null;
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch { return null; }
  }

  function openTargetAncestors(target) {
    for (let ancestor = target; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === 'DETAILS') ancestor.open = true;
    }
  }

  // Opening the ancestors first makes links into collapsed chapters usable.
  let revealRequest = 0;
  function revealTarget(target, focus = false, canReveal = () => true) {
    if (!target) return;
    const request = ++revealRequest;
    openTargetAncestors(target);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (request !== revealRequest || !canReveal()) return;
      target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
      const step = target.closest('.journey-step');
      const track = step?.closest('.journey-track');
      if (track) journeyReveals.get(track)?.(step, 'instant');
      if (focus) {
        const destination = target.tagName === 'DETAILS' ? target.querySelector('summary') || target : target;
        if (!destination.hasAttribute('tabindex') && !destination.matches('a, button, input, select, textarea, summary')) destination.tabIndex = -1;
        destination.focus({ preventScroll: true });
      }
      refreshCaseIndex();
    }));
  }
  const revealHash = (hash = window.location.hash) => {
    cancelInitialReveal();
    revealTarget(hashTarget(hash));
  };

  // Native initial fragment scrolling can finish after deferred scripts. Open
  // details now, then align the nested destination once load and fonts settle.
  // A visitor's first interaction or later navigation cancels this correction.
  const initialHash = window.location.hash;
  const initialTarget = hashTarget(initialHash);
  const initialInputEvents = ['pointerdown', 'wheel', 'touchstart', 'keydown'];
  let initialRevealPending = Boolean(initialTarget);
  function cancelInitialReveal() {
    initialRevealPending = false;
    window.removeEventListener('load', revealInitialHash);
    initialInputEvents.forEach(type => window.removeEventListener(type, cancelInitialReveal, true));
  }
  function revealInitialHash() {
    Promise.resolve(document.fonts?.ready).catch(() => {}).then(() => {
      if (!initialRevealPending) return;
      revealTarget(initialTarget, false, () => {
        const allowed = initialRevealPending && window.location.hash === initialHash;
        cancelInitialReveal();
        return allowed;
      });
    });
  }
  if (initialTarget) {
    openTargetAncestors(initialTarget);
    initialInputEvents.forEach(type => window.addEventListener(type, cancelInitialReveal, { capture: true, passive: true }));
    if (document.readyState === 'complete') revealInitialHash();
    else window.addEventListener('load', revealInitialHash, { once: true });
  }

  const caseControls = all('[data-case-target]');
  const caseTarget = control => hashTarget('#' + (control.dataset.caseTarget || '').replace(/^#/, ''));
  function syncCaseControls() {
    caseControls.forEach(control => {
      const target = caseTarget(control);
      if (!target) return;
      control.setAttribute('aria-controls', target.id);
      const details = [];
      for (let ancestor = target; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor.tagName === 'DETAILS') details.push(ancestor);
      }
      if (details.length) control.setAttribute('aria-expanded', String(details.every(detail => detail.open)));
    });
  }
  caseControls.forEach(control => control.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = caseTarget(control);
    if (!target) return;
    event.preventDefault();
    cancelInitialReveal();
    const url = new URL(window.location.href);
    url.hash = target.id;
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    revealTarget(target, event.detail === 0);
    syncCaseControls();
  }));
  all('.amlab-inline-system').forEach(panel => {
    panel.querySelector('summary')?.addEventListener('click', () => {
      if (!panel.open) return;
      requestAnimationFrame(() => { if (!panel.open) caseControls.find(control => caseTarget(control) === panel)?.focus({preventScroll:true}); });
    });
  });
  document.addEventListener('toggle', syncCaseControls, true);
  syncCaseControls();
  window.addEventListener('hashchange', () => revealHash());
  window.addEventListener('popstate', () => revealHash());
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search && url.hash) {
      const target = hashTarget(url.hash);
      if (!target) return;
      event.preventDefault();
      cancelInitialReveal();
      if (url.href !== window.location.href) window.history.pushState(null, '', url);
      revealTarget(target, event.detail === 0);
    }
  });

  // A journey has real ends; horizontal links and arrows keep the same card in view.
  all('[data-journey]').forEach((journey, number) => {
    const track = journey.querySelector('.journey-track');
    const steps = track ? all('.journey-step', track) : [];
    if (!track || !steps.length) return;
    const previous = journey.querySelector('[data-journey-prev]');
    const next = journey.querySelector('[data-journey-next]');
    if (!track.id) track.id = `journey-track-${number + 1}`;
    if (!track.hasAttribute('tabindex')) track.tabIndex = 0;
    [previous, next].forEach(button => button?.setAttribute('aria-controls', track.id));
    const position = step => step.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
    let intended = null;
    let settleTimer;
    const nearest = () => steps.reduce((best, step, i) => Math.abs(position(step) - track.scrollLeft) < Math.abs(position(steps[best]) - track.scrollLeft) ? i : best, 0);
    function updateButtons() {
      const at = intended ?? nearest();
      if (previous) previous.disabled = at === 0 || track.scrollLeft <= 1;
      if (next) next.disabled = at === steps.length - 1 || track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
    }
    function showStep(step, behavior = scrollBehavior()) {
      intended = steps.indexOf(step);
      const left = Math.max(0, Math.min(position(step), track.scrollWidth - track.clientWidth));
      track.scrollTo({ left, behavior });
      updateButtons();
    }
    function move(direction) {
      const index = Math.max(0, Math.min((intended ?? nearest()) + direction, steps.length - 1));
      showStep(steps[index]);
    }
    journeyReveals.set(track, showStep);
    previous?.addEventListener('click', () => move(-1));
    next?.addEventListener('click', () => move(1));
    journey.addEventListener('keydown', event => {
      if (isTyping(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        move(event.key === 'ArrowRight' ? 1 : -1);
      }
    });
    const settle = () => { intended = null; updateButtons(); };
    track.addEventListener('scroll', () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 140);
      updateButtons();
    }, { passive: true });
    track.addEventListener('scrollend', settle);
    window.addEventListener('resize', updateButtons);
    if ('ResizeObserver' in window) new ResizeObserver(updateButtons).observe(track);
    updateButtons();
  });

  // Native scrolling handles swipes and trackpads; copies make either end continuous.
  all('[data-loop-carousel]').forEach((carousel, number) => {
    const track = carousel.querySelector('[data-carousel-track]');
    const originals = track ? all('.carousel-item', track).filter(item => !item.hasAttribute('data-carousel-clone')) : [];
    if (!track || !originals.length) return;
    const previous = carousel.querySelector('[data-carousel-prev]');
    const next = carousel.querySelector('[data-carousel-next]');
    if (!track.id) track.id = `carousel-track-${number + 1}`;
    if (!track.hasAttribute('tabindex')) track.tabIndex = 0;
    [previous, next].forEach(button => {
      if (button) { button.disabled = originals.length < 2; button.setAttribute('aria-controls', track.id); }
    });
    if (originals.length < 2) return;
    const position = item => item.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
    const inlineBehavior = track.style.scrollBehavior;
    const inlineSnap = track.style.scrollSnapType;
    let base = 0, cycle = 0, intended = null, current = 0, settleTimer;
    function jumpTo(left) {
      track.style.scrollBehavior = 'auto';
      track.style.scrollSnapType = 'none';
      track.scrollLeft = left;
      requestAnimationFrame(() => {
        track.style.scrollBehavior = inlineBehavior;
        track.style.scrollSnapType = inlineSnap;
      });
    }
    function copyItem(original, index) {
      const copy = original.cloneNode(true);
      copy.setAttribute('data-carousel-clone', '');
      copy.setAttribute('aria-hidden', 'true');
      copy.removeAttribute('id');
      all('[id]', copy).forEach(element => element.removeAttribute('id'));
      all('a, button, input, select, textarea, [tabindex]', copy).forEach(element => { element.tabIndex = -1; });
      const sourceButtons = all('.media-button', original);
      all('.media-button', copy).forEach((button, i) => {
        button.addEventListener('mousedown', event => event.preventDefault());
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          jumpTo(position(originals[index]));
          sourceButtons[i]?.click();
        });
      });
      return copy;
    }
    const before = document.createDocumentFragment();
    const after = document.createDocumentFragment();
    originals.forEach((item, index) => before.append(copyItem(item, index)));
    originals.forEach((item, index) => after.append(copyItem(item, index)));
    const firstAfter = after.firstElementChild;
    track.prepend(before);
    track.append(after);
    function nearest() {
      if (!cycle) return 0;
      const relative = ((track.scrollLeft - base) % cycle + cycle) % cycle;
      return originals.reduce((best, item, i) => {
        const distance = value => Math.min(Math.abs(value - relative), cycle - Math.abs(value - relative));
        return distance(position(item) - base) < distance(position(originals[best]) - base) ? i : best;
      }, 0);
    }
    function normalize() {
      if (!cycle) return;
      current = nearest();
      intended = null;
      const left = base + ((track.scrollLeft - base) % cycle + cycle) % cycle;
      if (Math.abs(left - track.scrollLeft) > 1) jumpTo(left);
    }
    function measure() {
      if (!track.clientWidth) return;
      base = position(originals[0]);
      cycle = position(firstAfter) - base;
      if (cycle > 0) jumpTo(position(originals[current]));
    }
    function move(direction) {
      if (!cycle) measure();
      if (!cycle) return;
      const index = ((intended ?? nearest()) + direction + originals.length) % originals.length;
      let left = position(originals[index]);
      if (direction > 0) while (left <= track.scrollLeft + 1) left += cycle;
      else while (left >= track.scrollLeft - 1) left -= cycle;
      intended = index;
      track.scrollTo({ left, behavior: scrollBehavior() });
    }
    previous?.addEventListener('click', () => move(-1));
    next?.addEventListener('click', () => move(1));
    carousel.addEventListener('keydown', event => {
      if (isTyping(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        move(event.key === 'ArrowRight' ? 1 : -1);
      }
    });
    track.addEventListener('scroll', () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(normalize, 160);
      if (track.scrollLeft <= 1 || track.scrollLeft >= track.scrollWidth - track.clientWidth - 1) normalize();
    }, { passive: true });
    track.addEventListener('scrollend', normalize);
    track.addEventListener('wheel', () => { intended = null; }, { passive: true });
    track.addEventListener('pointerdown', () => { intended = null; }, { passive: true });
    window.addEventListener('resize', measure);
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(track);
    requestAnimationFrame(measure);
  });

  // Endpoints follow the original images on load, resize and hover.
  all('[data-connected-board]').forEach(board => {
    const svg = board.querySelector('[data-connectors]');
    if (!svg) return;
    const pairs = JSON.parse(svg.dataset.connectors);
    const nodes = new Map(all('[data-node]', board).map(node => [node.dataset.node, node]));
    const paths = pairs.map(() => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svg.append(path); return path;
    });
    function rect(key) {
      const node = nodes.get(key);
      return (node?.querySelector('img') || node)?.getBoundingClientRect();
    }

    function draw() {
      const origin = board.getBoundingClientRect();
      if (!origin.width || !origin.height) return;
      svg.setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`);
      pairs.forEach(([from, to], i) => {
        const a = rect(from), b = rect(to);
        if (!a || !b || !a.width || !b.width) { paths[i].setAttribute('d', ''); return; }
        const dx = b.x + b.width/2 - a.x - a.width/2;
        const dy = b.y + b.height/2 - a.y - a.height/2;
        const scaleA = 1 / Math.max(Math.abs(dx)/(a.width/2), Math.abs(dy)/(a.height/2), 1);
        const scaleB = 1 / Math.max(Math.abs(dx)/(b.width/2), Math.abs(dy)/(b.height/2), 1);
        const x1 = a.x + a.width/2 + dx*scaleA - origin.x;
        const y1 = a.y + a.height/2 + dy*scaleA - origin.y;
        const x2 = b.x + b.width/2 - dx*scaleB - origin.x;
        const y2 = b.y + b.height/2 - dy*scaleB - origin.y;
        const horizontal = Math.abs(dx) > Math.abs(dy);
        const mx = (x1+x2)/2, my = (y1+y2)/2;
        paths[i].setAttribute('d', horizontal
          ? `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
          : `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`);
      });
    }
    let frame = 0, animateUntil = 0;
    function schedule(duration = 0) {
      animateUntil = Math.max(animateUntil, performance.now() + duration);
      if (frame) return;
      function tick() {
        draw();
        frame = performance.now() < animateUntil ? requestAnimationFrame(tick) : 0;
      }
      frame = requestAnimationFrame(tick);
    }
    const observer = new ResizeObserver(() => schedule());
    observer.observe(board);
    nodes.forEach(node => observer.observe(node));
    all('img', board).forEach(img => img.addEventListener('load', () => schedule()));
    ['pointerover', 'pointerout'].forEach(type => board.addEventListener(type, () => schedule(400)));
    document.fonts?.ready.then(() => schedule());
    window.addEventListener('resize', () => schedule(), {passive:true});
    schedule();
  });

  all('[data-book]').forEach(book => {
    const pages = all('.book-page', book);
    if (!pages.length) return;
    const previous = book.querySelector('[data-book-prev]');
    const next = book.querySelector('[data-book-next]');
    const count = book.querySelector('.book-count');
    const label = book.querySelector('.book-label');
    const edges = all('[data-book-edge]', book);
    let current = 0;
    if (!book.hasAttribute('tabindex')) book.tabIndex = 0;
    if (count) count.setAttribute('aria-live', 'polite');

    function showPage(index) {
      const focusedControl = document.activeElement;
      const focusedPage = document.activeElement?.closest('.book-page');
      current = Math.max(0, Math.min(index, pages.length - 1));
      pages.forEach((page, position) => { page.hidden = position !== current; });
      if (previous) previous.disabled = current === 0;
      if (next) next.disabled = current === pages.length - 1;
      if (count) count.textContent = `${current + 1} / ${pages.length}`;
      edges.forEach(button => { button.disabled = Number(button.dataset.bookEdge) < 0 ? current === 0 : current === pages.length - 1; });
      if (focusedPage && book.contains(focusedPage)) pages[current].querySelector('button')?.focus({preventScroll:true});
      else if (book.contains(focusedControl) && focusedControl.disabled) book.focus({preventScroll:true});
      if (label) {
        const page = pages[current];
        const pageLabel = page.dataset.label || page.dataset.caption;
        if (pageLabel) label.textContent = pageLabel;
      }
    }
    function turnPage(index) {
      showPage(index);
    }
    previous?.addEventListener('click', () => turnPage(current - 1));
    next?.addEventListener('click', () => turnPage(current + 1));
    edges.forEach(button => button.addEventListener('click', () => turnPage(current + Number(button.dataset.bookEdge))));
    book.addEventListener('keydown', event => {
      if (isTyping(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        turnPage(current + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    showPage(0);
  });

  const dialog = document.querySelector('.lightbox');
  const triggers = all('.media-button').filter(button => !button.closest('[data-carousel-clone]') && button.querySelector('img'));
  const dialogImage = dialog?.querySelector('.lightbox-inner img') || dialog?.querySelector('img');
  if (dialog && dialogImage && typeof dialog.showModal === 'function') {
    const previous = dialog.querySelector('.lightbox-prev');
    const next = dialog.querySelector('.lightbox-next');
    const count = dialog.querySelector('.lightbox-count');
    let caption = dialog.querySelector('.lightbox-caption-text');
    if (!caption) {
      const captionContainer = dialog.querySelector('.lightbox-caption');
      if (captionContainer) {
        caption = document.createElement('span');
        caption.className = 'lightbox-caption-text';
        captionContainer.prepend(caption);
      }
    }
    const inner = dialog.querySelector('.lightbox-inner');
    let gallery = [];
    let current = 0;
    let returnFocus = null;
    if (count) count.setAttribute('aria-live', 'polite');

    function galleryKey(button) {
      const owner = button.closest('[data-gallery]');
      return owner?.dataset.gallery || owner || button;
    }
    function showImage(index) {
      current = (index + gallery.length) % gallery.length;
      const button = gallery[current];
      const source = button.querySelector('img');
      dialogImage.src = button.dataset.full || source.dataset.full || source.currentSrc || source.src;
      dialogImage.alt = source.alt;
      const crop = button.dataset.crop?.split(',').map(Number);
      dialog.classList.toggle('is-crop', Boolean(crop));
      if (crop) {
        const [x,y,w,h,sw] = crop;
        dialog.style.setProperty('--crop-w',w);
        dialog.style.setProperty('--crop-h',h);
        dialog.style.setProperty('--source-width',sw/w*100+'%');
        dialog.style.setProperty('--source-left',-x/w*100+'%');
        dialog.style.setProperty('--source-top',-y/h*100+'%');
      }
      if (count) count.textContent = `${current + 1} / ${gallery.length}`;
      if (caption) caption.textContent = button.dataset.caption || button.closest('figure')?.querySelector('figcaption')?.textContent.trim() || source.alt;
      if (previous) previous.disabled = gallery.length < 2;
      if (next) next.disabled = gallery.length < 2;
    }
    triggers.forEach(button => button.addEventListener('click', () => {
      const key = galleryKey(button);
      gallery = triggers.filter(candidate => galleryKey(candidate) === key);
      returnFocus = button;
      showImage(gallery.indexOf(button));
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('dialog-open');
    }));
    dialog.querySelector('.lightbox-close')?.addEventListener('click', () => dialog.close());
    previous?.addEventListener('click', () => showImage(current - 1));
    next?.addEventListener('click', () => showImage(current + 1));
    dialog.addEventListener('keydown', event => {
      if (!gallery.length || isTyping(event.target)) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        showImage(current + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target === inner) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('dialog-open');
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    });
  }

  // Background clips stay muted, stop offscreen, and retain a visitor's pause choice.
  const videoPolicies = new Map();
  const videoObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => videoPolicies.get(entry.target)?.setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.15));
  }, { threshold: [0, 0.15] }) : null;
  all('video.background-video').forEach((video, number) => {
    const hero = video.closest('.video-hero');
    const toggle = hero?.querySelector('[data-video-toggle]');
    let status = hero?.querySelector('[data-video-status]');
    let manualChoice = null;
    let visible = false;
    let pendingPlay = null;
    let autoplayBlocked = false;
    let hasError = false;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = false;
    video.setAttribute('muted', '');
    video.pause();
    if (!video.id) video.id = `background-video-${number + 1}`;
    if (toggle) toggle.setAttribute('aria-controls', video.id);
    function updateButton() {
      const playing = !video.paused && !video.ended;
      if (toggle) {
        const label = playing ? 'Остановить видео' : 'Включить видео';
        toggle.textContent = label;
        toggle.setAttribute('aria-label', label);
        toggle.setAttribute('aria-pressed', String(playing));
      }
      video.dataset.playback = hasError ? 'error' : playing ? 'playing' : 'paused';
    }
    function reportError() {
      hasError = true;
      video.pause();
      if (!status && hero) {
        status = document.createElement('p');
        status.className = 'video-status';
        status.setAttribute('data-video-status', '');
        status.setAttribute('role', 'status');
        hero.append(status);
      }
      if (status) {
        status.setAttribute('role', 'status');
        status.hidden = false;
        status.textContent = 'Видео не загрузилось. Обновите страницу, чтобы повторить.';
      }
      updateButton();
    }
    const shouldPlay = () => visible && !document.hidden && manualChoice !== 'pause' && (manualChoice === 'play' || (!reducedMotion?.matches && !autoplayBlocked));
    function requestPlay(manual = false) {
      if (pendingPlay || (!video.paused && !video.ended)) return;
      video.muted = true;
      if (manual && video.error) video.load();
      let promise;
      try { promise = video.play(); }
      catch (error) { promise = Promise.reject(error); }
      pendingPlay = Promise.resolve(promise).then(() => {
        hasError = false;
        if (status) status.hidden = true;
        if (!shouldPlay()) video.pause();
      }).catch(error => {
        if (error?.name === 'NotAllowedError') {
          autoplayBlocked = true;
        } else if (error?.name !== 'AbortError') {
          reportError();
        }
      }).finally(() => { pendingPlay = null; updateButton(); });
    }
    function applyPolicy() {
      if (shouldPlay() && !hasError) requestPlay();
      else video.pause();
      updateButton();
    }
    function measureVisibility(reconcile = true) {
      const rect = video.getBoundingClientRect();
      const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      visible = rect.width > 0 && rect.height > 0 && width * height / (rect.width * rect.height) >= 0.15;
      if (reconcile) applyPolicy();
    }
    videoPolicies.set(video, {
      setVisible(value) { visible = value; applyPolicy(); },
      applyPolicy
    });
    toggle?.addEventListener('click', () => {
      if (!video.paused || pendingPlay) {
        manualChoice = 'pause';
        video.pause();
      } else {
        manualChoice = 'play';
        autoplayBlocked = false;
        hasError = false;
        if (status) status.hidden = true;
        measureVisibility(false);
        requestPlay(true);
      }
      updateButton();
    });
    ['play', 'pause', 'ended'].forEach(event => video.addEventListener(event, updateButton));
    video.addEventListener('error', reportError);
    video.addEventListener('playing', () => { hasError = false; if (status) status.hidden = true; updateButton(); });
    if (videoObserver) videoObserver.observe(video);
    else window.addEventListener('scroll', measureVisibility, { passive: true });
    window.addEventListener('resize', measureVisibility);
    measureVisibility();
  });
  const refreshVideoPolicies = () => videoPolicies.forEach(policy => policy.applyPolicy());
  document.addEventListener('visibilitychange', refreshVideoPolicies);
  if (reducedMotion?.addEventListener) reducedMotion.addEventListener('change', refreshVideoPolicies);
  else reducedMotion?.addListener?.(refreshVideoPolicies);

  const indexLinks = all('.case-index a').map(link => ({ link, target: hashTarget(link.hash) })).filter(item => item.target);
  if (indexLinks.length) {
    let pending = false;
    let lastSelected = null;

    function revealIndexLink(link) {
      const nav = link.closest('nav');
      if (!nav || nav.scrollWidth <= nav.clientWidth + 1) return;
      const bounds = nav.getBoundingClientRect();
      const item = link.getBoundingClientRect();
      let left = nav.scrollLeft;
      if (item.left < bounds.left + 12) left += item.left - bounds.left - 12;
      else if (item.right > bounds.right - 12) left += item.right - bounds.right + 12;
      left = Math.max(0, Math.min(left, nav.scrollWidth - nav.clientWidth));
      if (Math.abs(left - nav.scrollLeft) > 1) nav.scrollTo({ left, behavior: scrollBehavior() });
    }

    function updateIndex() {
      const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
      const navBounds = document.querySelector('.case-index nav')?.getBoundingClientRect();
      const stickyNavBottom = navBounds && navBounds.top <= headerBottom + 24 && navBounds.bottom - navBounds.top < 120 ? navBounds.bottom : 0;
      const offset = Math.max(150, headerBottom + 24, stickyNavBottom + 20);
      const visible = indexLinks.filter(item => item.target.getClientRects().length).map(item => ({ ...item, bounds: item.target.getBoundingClientRect() }));
      let selected = visible[0];
      for (const item of visible) {
        if (item.bounds.top <= offset) selected = item;
      }
      // A hash can land a few pixels below the reading line due to scroll margins.
      // Give it priority only while its section still contains that visible band.
      const hash = hashTarget();
      const linkedSection = hash && visible.find(item => item.target === hash || item.target.contains(hash));
      if (linkedSection && linkedSection.bounds.top <= offset + 24 && linkedSection.bounds.bottom > offset) selected = linkedSection;
      indexLinks.forEach(({ link, target }) => {
        const active = target === selected?.target;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      if (selected && selected.target !== lastSelected) revealIndexLink(selected.link);
      lastSelected = selected?.target;
      pending = false;
    }
    function scheduleIndex() {
      if (!pending) { pending = true; requestAnimationFrame(updateIndex); }
    }
    refreshCaseIndex = scheduleIndex;
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(scheduleIndex, { rootMargin: '-100px 0px -55% 0px', threshold: 0 });
      indexLinks.forEach(({ target }) => observer.observe(target));
    }
    window.addEventListener('scroll', scheduleIndex, { passive: true });
    window.addEventListener('resize', scheduleIndex);
    document.addEventListener('toggle', scheduleIndex, true);
    updateIndex();
  }
})();
