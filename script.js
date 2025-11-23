document.addEventListener("DOMContentLoaded", () => {
  const yearSpan = document.getElementById("yearSpan");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  initLoader();
  initGlobalCanvasDrawing();
  initPixelPhotographer();
  initToolbarCollapse();
});

function initLoader() {
  const overlay = document.getElementById("loaderOverlay");
  const lines = Array.from(document.querySelectorAll(".loader-line"));
  const percentLabel = document.getElementById("loaderPercent");
  if (!overlay || lines.length === 0 || !percentLabel) return;

  let step = 0;
  const totalSteps = lines.length;
  const duration = 5200; // ms
  const interval = duration / totalSteps;

  const timer = setInterval(() => {
    if (lines[step]) {
      lines[step].classList.add("active");
      const pct = Math.min(100, Math.round(((step + 1) / totalSteps) * 100));
      percentLabel.textContent = pct + "%";
    }
    step++;
    if (step >= totalSteps) {
      clearInterval(timer);
    }
  }, interval);

  // Remove overlay after animation
  setTimeout(() => {
    overlay.classList.add("hidden");
    setTimeout(() => {
      overlay.style.display = "none";
    }, 650);
  }, duration + 700);
}

function initToolbarCollapse() {
  const toolbar = document.getElementById("floatingToolbar");
  const collapseBtn = document.getElementById("collapseToolbar");
  if (!toolbar || !collapseBtn) return;

  collapseBtn.addEventListener("click", () => {
    toolbar.classList.toggle("collapsed");
  });
}

function initGlobalCanvasDrawing() {
  const canvas = document.getElementById("globalCanvas");
  const toolbar = document.getElementById("floatingToolbar");
  const toggleDrawBtn = document.getElementById("toggleDraw");
  const colorPicker = document.getElementById("colorPicker");
  const sizePicker = document.getElementById("sizePicker");
  const glowPicker = document.getElementById("glowPicker");
  const clearBtn = document.getElementById("clearCanvas");

  if (!canvas || !toolbar || !toggleDrawBtn) return;
  const ctx = canvas.getContext("2d");

  let drawEnabled = false;
  let drawing = false;
  let tool = "brush";
  let color = (colorPicker && colorPicker.value) || "#f97316";
  let size = sizePicker ? Number(sizePicker.value) : 10;
  let glow = glowPicker ? Number(glowPicker.value) : 18;

  let startX = 0;
  let startY = 0;
  let snapshot = null;

  // Canvas sizing
  function resizeCanvas() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const oldWidth = canvas.width || 1;
    const oldHeight = canvas.height || 1;
    let old = null;
    try {
      old = ctx.getImageData(0, 0, oldWidth, oldHeight);
    } catch (e) {
      old = null;
    }
    canvas.width = w;
    canvas.height = h;
    if (old) {
      ctx.putImageData(old, 0, 0);
    }
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Toggle draw mode
  toggleDrawBtn.addEventListener("click", () => {
    drawEnabled = !drawEnabled;
    toggleDrawBtn.classList.toggle("active", drawEnabled);
    const label = toggleDrawBtn.querySelector(".toggle-label");
    if (label) label.textContent = `Draw: ${drawEnabled ? "On" : "Off"}`;
    document.body.setAttribute("data-draw", drawEnabled ? "on" : "off");

    // If turning off, also collapse toolbar
    if (!drawEnabled) {
      toolbar.classList.add("collapsed");
    }
  });

  // Tool selection
  toolbar.addEventListener("click", (e) => {
    const btn = e.target.closest(".tool-btn");
    if (!btn || !btn.dataset.tool) return;
    tool = btn.dataset.tool;
    document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.body.setAttribute("data-tool", tool);
  });

  // Controls
  if (colorPicker) {
    colorPicker.addEventListener("input", () => {
      color = colorPicker.value;
    });
  }
  if (sizePicker) {
    sizePicker.addEventListener("input", () => {
      size = Number(sizePicker.value);
    });
  }
  if (glowPicker) {
    glowPicker.addEventListener("input", () => {
      glow = Number(glowPicker.value);
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  }

  // Drawing helpers
  function setStroke(mode) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (mode === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = size * 1.6;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = size;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
      if (mode === "pen") {
        ctx.shadowBlur = glow * 0.4;
      }
      if (mode === "marker") {
        ctx.globalAlpha = 0.85;
      } else {
        ctx.globalAlpha = 1;
      }
    }
  }

  function saveSnapshot() {
    try {
      snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {
      snapshot = null;
    }
  }

  function restoreSnapshot() {
    if (!snapshot) return;
    ctx.putImageData(snapshot, 0, 0);
  }

  function getPos(evt) {
    return {
      x: evt.clientX,
      y: evt.clientY,
    };
  }

  function startDrawing(evt) {
    if (!drawEnabled) return;
    if (evt.button !== undefined && evt.button !== 0) return;

    const isToolbarClick = evt.target.closest && evt.target.closest("#floatingToolbar");
    const isLoader = evt.target.closest && evt.target.closest("#loaderOverlay");
    if (isToolbarClick || isLoader) return;

    evt.preventDefault();
    const pos = getPos(evt);
    drawing = true;
    startX = pos.x;
    startY = pos.y;

    if (["brush", "pen", "marker", "eraser", "spray"].includes(tool)) {
      setStroke(tool === "eraser" ? "eraser" : tool);
      if (tool !== "spray") {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      } else {
        sprayDot(pos.x, pos.y);
      }
    } else {
      saveSnapshot();
    }
  }

  function moveDrawing(evt) {
    if (!drawing || !drawEnabled) return;
    const pos = getPos(evt);

    if (["brush", "pen", "marker"].includes(tool)) {
      setStroke(tool);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (tool === "eraser") {
      setStroke("eraser");
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (tool === "spray") {
      setStroke("brush");
      sprayDot(pos.x, pos.y);
    } else {
      restoreSnapshot();
      setStroke("brush");
      drawShape(tool, startX, startY, pos.x, pos.y);
    }
  }

  function endDrawing(evt) {
    if (!drawing) return;
    drawing = false;

    if (["line", "rect", "circle"].includes(tool)) {
      const pos = getPos(evt);
      restoreSnapshot();
      setStroke("brush");
      drawShape(tool, startX, startY, pos.x, pos.y);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  function drawShape(shape, x1, y1, x2, y2) {
    const w = x2 - x1;
    const h = y2 - y1;

    if (shape === "line") {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (shape === "rect") {
      ctx.beginPath();
      ctx.strokeRect(x1, y1, w, h);
    } else if (shape === "circle") {
      const radius = Math.sqrt(w * w + h * h) / 2;
      const cx = x1 + w / 2;
      const cy = y1 + h / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function sprayDot(x, y) {
    const density = 12;
    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * (size * 1.6);
      const offsetX = Math.cos(angle) * radius;
      const offsetY = Math.sin(angle) * radius;
      ctx.beginPath();
      ctx.arc(x + offsetX, y + offsetY, 0.7 + Math.random() * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowBlur = glow * 0.4;
      ctx.shadowColor = color;
      ctx.fill();
    }
  }

  // Mouse events on document
  document.addEventListener("mousedown", startDrawing);
  document.addEventListener("mousemove", moveDrawing);
  document.addEventListener("mouseup", endDrawing);
  document.addEventListener("mouseleave", endDrawing);

  // Touch support
  document.addEventListener(
    "touchstart",
    (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      startDrawing(touch);
    },
    { passive: false }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      moveDrawing(touch);
    },
    { passive: false }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      const touch = e.changedTouches ? e.changedTouches[0] : e;
      if (!touch) return;
      endDrawing(touch);
    },
    { passive: false }
  );
}

function initPixelPhotographer() {
  const pix = document.getElementById("pixelPhotographer");
  const shutterSound = document.getElementById("shutterSound");
  if (!pix) return;

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;
  let walkTimeout = null;

  // Track cursor
  document.addEventListener("mousemove", (e) => {
    targetX = e.clientX + 10;
    targetY = e.clientY + 10;

    // Walking animation toggle
    pix.classList.add("walking");
    if (walkTimeout) clearTimeout(walkTimeout);
    walkTimeout = setTimeout(() => {
      pix.classList.remove("walking");
    }, 250);
  });

  // Smooth follow using rAF
  function animate() {
    const lerp = 0.2;
    currentX += (targetX - currentX) * lerp;
    currentY += (targetY - currentY) * lerp;

    pix.style.setProperty("--px-x", currentX + "px");
    pix.style.setProperty("--px-y", currentY + "px");
    pix.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    requestAnimationFrame(animate);
  }
  animate();

  // Click to take photo
  document.addEventListener("click", (e) => {
    const isToolbarClick = e.target.closest && e.target.closest("#floatingToolbar");
    const isLoader = e.target.closest && e.target.closest("#loaderOverlay");
    if (isToolbarClick || isLoader) return;

    // Flash
    const flash = document.createElement("div");
    flash.className = "flash-burst";
    flash.style.left = `${e.clientX - 30}px`;
    flash.style.top = `${e.clientY - 30}px`;
    document.body.appendChild(flash);
    flash.addEventListener("animationend", () => {
      flash.remove();
    });

    // Character shoot bump
    pix.classList.remove("shoot");
    void pix.offsetWidth; // reflow
    pix.classList.add("shoot");

    // Shutter sound (use any royalty-free shutter.mp3)
    if (shutterSound) {
      try {
        shutterSound.currentTime = 0;
        shutterSound.play().catch(() => {});
      } catch (err) {
        // ignore
      }
    }
  });
}
