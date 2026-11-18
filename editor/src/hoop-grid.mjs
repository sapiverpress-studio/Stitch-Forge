import { fitsHoop, layerGeometry, threadColours } from './design.mjs';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const ticks = value => Math.round(value * 10);
const angleAt = (x, y, centre) => Math.atan2(y - centre.y, x - centre.x) * 180 / Math.PI;
const wrapAngle = angle => (Math.round(angle) + 540) % 360 - 180;

function segmentDistanceSquared(x, y, [ax, ay, bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? clamp(((x - ax) * dx + (y - ay) * dy) / length, 0, 1) : 0;
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
}

export class HoopGrid {
  constructor(canvas, { handle, select, move, rotate, snap }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.handle = handle;
    this.select = select;
    this.move = move;
    this.rotate = rotate;
    this.snap = snap;
    this.zoom = 1;
    this.centre = { x: 0, y: 0 };
    this.cache = new WeakMap();
    this.items = [];
    this.hoop = { width: 100, height: 100 };

    new ResizeObserver(() => this.schedule()).observe(canvas);
    canvas.addEventListener('pointerdown', event => this.pointerDown(event));
    handle.addEventListener('pointerdown', event => this.rotationDown(event));
    handle.addEventListener('click', event => {
      if (event.detail === 0 && this.selected?.source) this.rotate(this.selected, wrapAngle(this.selected.angle + 15));
    });
    for (const target of [canvas, handle]) {
      target.addEventListener('pointermove', event => this.pointerMove(event));
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        target.addEventListener(type, event => this.finishDrag(event));
      }
    }
    canvas.addEventListener('keydown', event => this.keyDown(event));
  }

  setDesign(layers, selected, hoop) {
    this.hoop = hoop;
    this.selected = selected;
    this.items = layers.filter(layer => layer.source).map(layer => {
      let local = this.cache.get(layer);
      if (!local || local.source !== layer.source || local.angle !== layer.angle) {
        local = { ...layerGeometry({ ...layer, x: 0, y: 0 }), source: layer.source, angle: layer.angle };
        this.cache.set(layer, local);
      }
      const x = ticks(layer.x), y = ticks(layer.y);
      const { left, top, right, bottom } = local.bounds;
      return { layer, local, x, y, bounds: { left: left + x, right: right + x, top: top + y, bottom: bottom + y } };
    });
    this.schedule();
    if (!this.items.length) return null;
    const bounds = {
      left: Math.min(...this.items.map(item => item.bounds.left)),
      right: Math.max(...this.items.map(item => item.bounds.right)),
      top: Math.min(...this.items.map(item => item.bounds.top)),
      bottom: Math.max(...this.items.map(item => item.bounds.bottom))
    };
    return {
      bounds,
      width: (bounds.right - bounds.left) / 10,
      height: (bounds.bottom - bounds.top) / 10,
      count: this.items.reduce((sum, item) => sum + item.local.count, 0),
      outside: !fitsHoop(bounds, hoop)
    };
  }

  setZoom(scale) {
    this.zoom = clamp(scale, 1, 4);
    if (this.zoom === 1) this.centre = { x: 0, y: 0 };
    else if (this.selected && !this.drag) this.centre = { x: this.selected.x, y: this.selected.y };
    this.schedule();
  }

  schedule() {
    if (!this.frame) this.frame = requestAnimationFrame(() => {
      try {
        if (this.pendingPointer) {
          const point = this.pendingPointer;
          this.pendingPointer = null;
          this.applyDrag(point);
        }
        this.draw();
      } finally {
        this.frame = 0;
      }
    });
  }

  draw() {
    const { canvas, ctx, hoop } = this;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) {
      this.view = null;
      this.handle.hidden = true;
      return;
    }
    const pixelRatio = Math.min(devicePixelRatio || 1, 2.5);
    const pixelWidth = Math.round(width * pixelRatio), pixelHeight = Math.round(height * pixelRatio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const pad = Math.min(width < 450 ? 29 : 38, Math.min(width, height) / 4);
    const scale = Math.min((width - pad * 2) / hoop.width, (height - pad * 2) / hoop.height) * this.zoom;
    const x0 = width / 2 - this.centre.x * scale, y0 = height / 2 - this.centre.y * scale;
    this.view = { scale, x0, y0 };
    const x = mm => x0 + mm * scale;
    const y = mm => y0 + mm * scale;
    const left = -hoop.width / 2, right = hoop.width / 2;
    const top = -hoop.height / 2, bottom = hoop.height / 2;
    ctx.fillStyle = '#e7ede6';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fffdf3';
    ctx.fillRect(x(left), y(top), hoop.width * scale, hoop.height * scale);

    const step = scale < 1.8 ? 10 : 5;
    const labelStep = scale < 3 ? 20 : 10;
    ctx.font = `${width < 450 ? 9 : 10}px ui-monospace, monospace`;
    ctx.lineWidth = 1;
    for (let v = Math.ceil(left / step) * step; v <= right; v += step) {
      ctx.strokeStyle = v === 0 ? '#94ab9a' : v % 10 === 0 ? '#d4dfd0' : '#e9eee2';
      ctx.beginPath();
      ctx.moveTo(x(v), y(top));
      ctx.lineTo(x(v), y(bottom));
      ctx.stroke();
      if (v % labelStep === 0) {
        ctx.fillStyle = '#60756a';
        ctx.textAlign = 'center';
        ctx.fillText(String(v), x(v), y(top) - 7);
      }
    }
    for (let v = Math.ceil(top / step) * step; v <= bottom; v += step) {
      ctx.strokeStyle = v === 0 ? '#94ab9a' : v % 10 === 0 ? '#d4dfd0' : '#e9eee2';
      ctx.beginPath();
      ctx.moveTo(x(left), y(v));
      ctx.lineTo(x(right), y(v));
      ctx.stroke();
      if (v % labelStep === 0) {
        ctx.fillStyle = '#60756a';
        ctx.textAlign = 'right';
        ctx.fillText(String(v), x(left) - 6, y(v) + 3);
      }
    }
    ctx.strokeStyle = '#68917e';
    ctx.strokeRect(x(left), y(top), hoop.width * scale, hoop.height * scale);

    ctx.lineWidth = clamp(scale / 3, .68, 1.45);
    ctx.lineCap = 'round';
    for (const item of this.items) {
      const colours = threadColours(item.layer);
      for (const [index, run] of item.local.runs.entries()) {
        ctx.strokeStyle = colours[index];
        ctx.beginPath();
        for (const [ax, ay, bx, by] of run) {
          ctx.moveTo(x((ax + item.x) / 10), y((ay + item.y) / 10));
          ctx.lineTo(x((bx + item.x) / 10) + (ax === bx && ay === by ? .05 : 0), y((by + item.y) / 10));
        }
        ctx.stroke();
      }
    }
    const active = this.items.find(item => item.layer === this.selected);
    this.handle.hidden = !active;
    if (active) {
      const box = active.bounds;
      const outline = {
        left: x(box.left / 10) - 5, top: y(box.top / 10) - 5,
        right: x(box.right / 10) + 5, bottom: y(box.bottom / 10) + 5
      };
      ctx.strokeStyle = fitsHoop(box, hoop) ? '#326f61' : '#a13e27';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(outline.left, outline.top, outline.right - outline.left, outline.bottom - outline.top);
      ctx.setLineDash([]);
      this.drawRotationHandle(outline, width, height, { x: x(active.x / 10), y: y(active.y / 10) });
    }
  }

  drawRotationHandle(box, width, height, centre) {
    const inset = 23, gap = 25;
    const middleX = (box.left + box.right) / 2, middleY = (box.top + box.bottom) / 2;
    const positions = [[middleX, box.top - gap], [middleX, box.bottom + gap],
      [box.right + gap, middleY], [box.left - gap, middleY]];
    const zoomControls = this.handle.closest('.board').querySelector('.zoom-tools').getBoundingClientRect();
    const canvas = this.canvas.getBoundingClientRect();
    const clearsZoom = (x, y) => canvas.left + x + inset < zoomControls.left || canvas.left + x - inset > zoomControls.right ||
      canvas.top + y + inset < zoomControls.top || canvas.top + y - inset > zoomControls.bottom;
    const minX = Math.min(inset, width / 2), minY = Math.min(inset, height / 2);
    const inside = ([x, y]) => x >= minX && x <= width - minX && y >= minY && y <= height - minY;
    const usable = ([x, y]) => Math.hypot(x - centre.x, y - centre.y) >= 18 && clearsZoom(x, y);
    const clamped = positions.map(([x, y]) => [clamp(x, minX, width - minX), clamp(y, minY, height - minY)]);
    const [x, y] = positions.find(point => inside(point) && usable(point)) ?? clamped.find(usable) ?? clamped[1];
    this.handle.style.left = `${x}px`;
    this.handle.style.top = `${y}px`;
    this.ctx.beginPath();
    this.ctx.moveTo(clamp(x, box.left, box.right), clamp(y, box.top, box.bottom));
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  hitItem(x, y, touch) {
    const margin = (touch ? 15 : 8) * 10 / this.view.scale;
    const exact = (4 * 10 / this.view.scale) ** 2;
    let closest = null, distance = margin ** 2;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i], bounds = item.bounds;
      if (x < bounds.left - margin || x > bounds.right + margin || y < bounds.top - margin || y > bounds.bottom + margin) continue;
      for (const run of item.local.runs) {
        for (const segment of run) {
          const squared = segmentDistanceSquared(x - item.x, y - item.y, segment);
          if (squared <= exact) return item;
          if (squared < distance) {
            closest = item;
            distance = squared;
          }
        }
      }
    }
    if (closest) return closest;
    // A selected motif can also be grabbed through the gaps in its stitches.
    return this.items.find(({ layer, bounds }) => layer === this.selected && !layer.frame &&
      x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom);
  }

  pointerDown(event) {
    if (!this.view || this.drag || event.button !== 0) return;
    const { left, top } = this.canvas.getBoundingClientRect();
    const { scale, x0, y0 } = this.view;
    const x = (event.clientX - left - x0) * 10 / scale;
    const y = (event.clientY - top - y0) * 10 / scale;
    const item = this.hitItem(x, y, event.pointerType === 'touch');
    if (!item && this.zoom === 1) return;
    const layer = item?.layer;
    if (layer) this.select(layer);
    const origin = layer || this.centre;
    this.startDrag(event, { layer, x: origin.x, y: origin.y, scale });
  }

  rotationDown(event) {
    if (!this.view || this.drag || event.button !== 0 || !this.selected?.source) return;
    const layer = this.selected;
    const { left, top } = this.canvas.getBoundingClientRect();
    const { x0, y0, scale } = this.view;
    const centre = { x: left + x0 + layer.x * scale, y: top + y0 + layer.y * scale };
    const startAngle = angleAt(event.clientX, event.clientY, centre);
    this.startDrag(event, { layer, centre, startAngle, rotation: layer.angle });
  }

  startDrag(event, state) {
    event.preventDefault();
    const target = event.currentTarget;
    this.drag = { ...state, target, clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId,
      threshold: event.pointerType === 'touch' ? 5 : 3, moved: false };
    target.focus({ preventScroll: true });
    target.setPointerCapture(event.pointerId);
    target.classList.add('dragging');
  }

  pointerMove(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    this.pendingPointer = { x: event.clientX, y: event.clientY };
    this.schedule();
  }

  applyDrag({ x, y }) {
    const drag = this.drag;
    const dx = x - drag.clientX, dy = y - drag.clientY;
    if (!drag.moved && Math.hypot(dx, dy) < drag.threshold) return;
    drag.moved = true;
    if (drag.centre) {
      if (Math.hypot(x - drag.centre.x, y - drag.centre.y) < 10) return;
      const angle = wrapAngle(drag.rotation + angleAt(x, y, drag.centre) - drag.startAngle);
      if (angle !== drag.layer.angle) this.rotate(drag.layer, angle);
    } else if (drag.layer) {
      const step = this.snap() ? 5 : .1;
      const snap = (start, delta) => delta === 0 ? start : clamp(Math.round((start + delta) / step) * step, -500, 500);
      const nextX = snap(drag.x, dx / drag.scale), nextY = snap(drag.y, dy / drag.scale);
      if (nextX !== drag.layer.x || nextY !== drag.layer.y) this.move(drag.layer, nextX, nextY);
    } else {
      this.centre = { x: clamp(drag.x - dx / drag.scale, -500, 500), y: clamp(drag.y - dy / drag.scale, -500, 500) };
      this.schedule();
    }
  }

  finishDrag(event) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (event.type === 'pointerup') {
      this.applyDrag({ x: event.clientX, y: event.clientY });
      if (drag.centre && !drag.moved) this.rotate(drag.layer, wrapAngle(drag.rotation + 15));
    } else if (this.pendingPointer) {
      this.applyDrag(this.pendingPointer);
    }
    this.pendingPointer = null;
    this.drag = null;
    drag.target.classList.remove('dragging');
  }

  keyDown(event) {
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const vector = directions[event.key], layer = this.selected;
    if (!vector || !layer) return;
    event.preventDefault();
    const step = event.altKey ? .1 : event.shiftKey || this.snap() ? 5 : 1;
    this.move(layer, clamp(layer.x + step * vector[0], -500, 500), clamp(layer.y + step * vector[1], -500, 500));
  }
}
