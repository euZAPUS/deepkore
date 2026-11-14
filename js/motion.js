// Gentle, Apple-like motion. Everything is skipped when the user prefers reduced motion.

const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let observer = null;

// Fade + rise elements marked .reveal as they enter the viewport, staggered by order.
export function revealIn(root) {
  const items = [...root.querySelectorAll(".reveal")];
  if (reduce() || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      let batch = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.style.setProperty("--i", e.target.dataset.i ?? batch++);
        e.target.classList.add("is-in");
        observer.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );
  items.forEach((el) => observer.observe(el));
}

// Glass header gets a hairline once the page scrolls.
export function watchHeader(header) {
  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 4);
  window.addEventListener("scroll", update, { passive: true });
  update();
}

// Pill that slides behind the active nav link (desktop / tablet).
export function moveNavIndicator(list) {
  let pill = list.querySelector(".nav-indicator");
  if (!pill) {
    pill = document.createElement("li");
    pill.className = "nav-indicator";
    pill.setAttribute("aria-hidden", "true");
    list.prepend(pill);
  }
  const active = list.querySelector('a[aria-current="page"]');
  if (!active) {
    pill.style.opacity = "0";
    return;
  }
  const a = active.getBoundingClientRect();
  const l = list.getBoundingClientRect();
  pill.style.width = `${a.width}px`;
  pill.style.transform = `translateX(${a.left - l.left}px)`;
  pill.style.opacity = "1";
}

// Re-order children of `container` (each has data-key) to match `keys`, animating the move (FLIP).
export function flipReorder(container, keys) {
  const items = new Map([...container.children].map((el) => [el.dataset.key, el]));
  const before = new Map([...items].map(([k, el]) => [k, el.getBoundingClientRect().top]));
  keys.forEach((k) => items.get(k) && container.appendChild(items.get(k)));
  if (reduce()) return;
  items.forEach((el, k) => {
    const dy = before.get(k) - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;
    el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
      duration: 600,
      easing: "cubic-bezier(.22,.8,.2,1)",
    });
  });
}
