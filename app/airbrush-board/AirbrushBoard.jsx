"use client";

import { useEffect, useRef, useState } from "react";

const CANVAS_HEIGHT = 520;
const SPRAY_INTERVAL_MS = 30;
const MIN_DOT_SIZE = 0.45;
const DOT_SIZE_BASE_FACTOR = 0.05;
const DOT_SIZE_RANDOM_FACTOR = 0.08;
const MIN_ALPHA = 0.05;
const ALPHA_RANDOM_RANGE = 0.18;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function AirbrushBoard() {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const contextRef = useRef(null);
  const intervalRef = useRef(null);
  const isDrawingRef = useRef(false);
  const pointerRef = useRef(null);
  const brushSizeRef = useRef(22);
  const densityRef = useRef(28);
  const colorRef = useRef("#ffffff");

  const [brushSize, setBrushSize] = useState(22);
  const [sprayDensity, setSprayDensity] = useState(28);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    brushSizeRef.current = brushSize;
  }, [brushSize]);

  useEffect(() => {
    densityRef.current = sprayDensity;
  }, [sprayDensity]);

  useEffect(() => {
    colorRef.current = brushColor;
  }, [brushColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return undefined;

    function resizeCanvas() {
      const previousCanvas = document.createElement("canvas");
      previousCanvas.width = canvas.width;
      previousCanvas.height = canvas.height;
      const previousContext = previousCanvas.getContext("2d");
      if (previousContext && canvas.width > 0 && canvas.height > 0) {
        previousContext.drawImage(canvas, 0, 0);
      }

      const nextWidth = Math.max(320, Math.floor(wrapper.clientWidth));
      const nextHeight = CANVAS_HEIGHT;
      const ratio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(nextWidth * ratio);
      canvas.height = Math.floor(nextHeight * ratio);
      canvas.style.width = `${nextWidth}px`;
      canvas.style.height = `${nextHeight}px`;

      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, nextWidth, nextHeight);
      context.drawImage(previousCanvas, 0, 0, nextWidth, nextHeight);
      contextRef.current = context;
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  useEffect(
    () => () => {
      window.clearInterval(intervalRef.current);
    },
    []
  );

  function getCanvasPoint(event) {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const bounds = canvas.getBoundingClientRect();
    return {
      x: clamp(event.clientX - bounds.left, 0, bounds.width),
      y: clamp(event.clientY - bounds.top, 0, bounds.height)
    };
  }

  function sprayAtPoint(point) {
    const context = contextRef.current;
    if (!context || !point) return;

    const dots = densityRef.current;
    const radius = brushSizeRef.current;
    context.fillStyle = colorRef.current;

    for (let index = 0; index < dots; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      const x = point.x + Math.cos(angle) * distance;
      const y = point.y + Math.sin(angle) * distance;
      const dotSize = Math.max(
        MIN_DOT_SIZE,
        radius * (DOT_SIZE_BASE_FACTOR + Math.random() * DOT_SIZE_RANDOM_FACTOR)
      );
      const alpha = MIN_ALPHA + Math.random() * ALPHA_RANDOM_RANGE;

      context.globalAlpha = alpha;
      context.beginPath();
      context.arc(x, y, dotSize, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 1;
  }

  function beginSpray(point) {
    pointerRef.current = point;
    sprayAtPoint(point);
    window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      sprayAtPoint(pointerRef.current);
    }, SPRAY_INTERVAL_MS);
  }

  function endSpray() {
    isDrawingRef.current = false;
    setIsDrawing(false);
    pointerRef.current = null;
    window.clearInterval(intervalRef.current);
  }

  function handlePointerDown(event) {
    event.preventDefault();
    const point = getCanvasPoint(event);
    if (!point) return;

    isDrawingRef.current = true;
    setIsDrawing(true);
    beginSpray(point);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!isDrawingRef.current) return;

    const point = getCanvasPoint(event);
    if (!point) return;
    pointerRef.current = point;
    sprayAtPoint(point);
  }

  function handleClearCanvas() {
    const context = contextRef.current;
    const canvas = canvasRef.current;
    if (!context || !canvas) return;

    const { width, height } = canvas.getBoundingClientRect();
    context.clearRect(0, 0, width, height);
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "airbrush-board.png";
    link.click();
  }

  return (
    <section className="airbrush-shell">
      <div className="airbrush-controls">
        <label>
          Brush color
          <input
            type="color"
            value={brushColor}
            onChange={(event) => setBrushColor(event.target.value)}
            aria-label="Brush color"
          />
        </label>
        <label>
          Radius: {brushSize}px
          <input
            type="range"
            min="6"
            max="60"
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
            aria-label="Brush radius"
          />
        </label>
        <label>
          Spray density: {sprayDensity}
          <input
            type="range"
            min="8"
            max="70"
            value={sprayDensity}
            onChange={(event) => setSprayDensity(Number(event.target.value))}
            aria-label="Spray density"
          />
        </label>
        <div className="airbrush-actions">
          <button type="button" onClick={handleClearCanvas}>Clear</button>
          <button type="button" onClick={handleDownload}>Save PNG</button>
        </div>
      </div>

      <div className="airbrush-board-wrapper" ref={wrapperRef}>
        <canvas
          ref={canvasRef}
          className={`airbrush-canvas${isDrawing ? " is-drawing" : ""}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endSpray}
          onPointerCancel={endSpray}
          onPointerLeave={endSpray}
          role="img"
          aria-label="Interactive air brush painting board"
        />
      </div>

      <p className="airbrush-help">
        Press and drag on the board to paint spray marks.
      </p>
    </section>
  );
}
