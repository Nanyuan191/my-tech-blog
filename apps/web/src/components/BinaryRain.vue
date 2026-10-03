<template>
  <!-- 全屏背景画布：fixed 铺满、pointer-events:none（不挡任何点击）、z-index:-1（压在所有内容之下、页面背景之上） -->
  <canvas ref="canvasRef" class="binary-rain" aria-hidden="true"></canvas>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

/**
 * 二进制代码雨背景（0/1 不断下落）—— v1
 *
 * 实现要点（答辩可以讲）：
 * 1. 只用一个 <canvas>，不插任何 DOM 节点：比"几百个 span 做 CSS 动画"省内存得多，
 *    动画全部在一块画布上完成，浏览器只需合成一个图层。
 * 2. 「拖尾」不用半透明遮罩去盖（那样会把页面本身的渐变背景也盖掉），
 *    而是每帧用 globalCompositeOperation = 'destination-out'
 *    把画布上已有像素的透明度削掉一点 —— 画布始终保持透明底，
 *    雨滴自然越走越淡，页面的点阵 + 光斑背景照常透出来。
 * 3. requestAnimationFrame + 时间节流（约 20fps）：
 *    背景动画不需要 60fps，帧率减半 CPU 直接过半。
 * 4. visibilitychange：切到别的标签页就暂停绘制，回来再继续，不白烧电。
 */

const canvasRef = ref<HTMLCanvasElement | null>(null);

/** 每个字符占的格子边长（px），也是字号基准 */
const FONT_SIZE = 14;
/** 目标帧间隔：50ms ≈ 20fps，背景装饰足够顺滑 */
const FRAME_MS = 50;
/** 每帧把旧像素透明度削掉的比例：越小拖尾越长 */
const FADE_PER_FRAME = 0.06;
/** 字符基色：主题蓝，靠 CSS opacity 整体再压淡，避免抢内容 */
const HEAD_COLOR = 'rgba(64, 158, 255, 0.85)';

let ctx: CanvasRenderingContext2D | null = null;
/** 每一列雨的状态：下落到第几行 + 速度 */
let columns: { y: number; speed: number }[] = [];
let rafId = 0;
let lastTime = 0;
let running = false;

/** 窗口尺寸变化时：重设画布大小，并按新宽度重建列数 */
function resize() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const count = Math.ceil(canvas.width / FONT_SIZE);
  columns = Array.from({ length: count }, () => ({
    // 随机起始高度，避免所有列整整齐齐像"瀑布拉帘"
    y: Math.floor(Math.random() * (canvas.height / FONT_SIZE)),
    // 0.5~1.4 格/帧：快慢错落才有"雨"的感觉，全一致就成了扫描线
    speed: 0.5 + Math.random() * 0.9,
  }));
}

function drawFrame(time: number) {
  rafId = requestAnimationFrame(drawFrame);
  // 节流：距离上一帧不足 FRAME_MS 就跳过这一次回调
  if (time - lastTime < FRAME_MS) return;
  lastTime = time;

  const canvas = canvasRef.value;
  if (!ctx || !canvas) return;

  // 第 1 步：拖尾 —— 用 destination-out 削旧像素的 alpha（保持画布透明底）
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0, 0, 0, ${FADE_PER_FRAME})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 第 2 步：正常叠画这一帧的新字符（雨头）
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = `${FONT_SIZE - 2}px monospace`;
  ctx.textBaseline = 'top';

  const rows = Math.ceil(canvas.height / FONT_SIZE);
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    // 随机 0 或 1；也可以扩展成 0/1 之外再混少量字符
    const char = Math.random() > 0.5 ? '0' : '1';
    ctx.fillStyle = HEAD_COLOR;
    ctx.fillText(char, i * FONT_SIZE, col.y * FONT_SIZE);

    // 累积式前进：speed 是小数，跨满一格才真的挪一格（这是快慢差的来源）
    col.y += col.speed;
    // 落出屏幕后回到顶部，顺便换一个新速度
    if (col.y > rows) {
      col.y = 0;
      col.speed = 0.5 + Math.random() * 0.9;
    }
  }
}

function start() {
  if (running) return;
  running = true;
  lastTime = -FRAME_MS; // 让第一帧立即画，不用等 50ms
  rafId = requestAnimationFrame(drawFrame);
}

function stop() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

/**
 * 「减少动效」模式的降级：不放动画，但画一帧定格的散点雨。
 * 教训：无头浏览器和关闭了系统动画的 Windows 都会报告 reduce，
 * 如果直接 return 什么都不画，这些用户就会看到"空白背景"——
 * 降级应该是"静态版"，不是"消失"。
 */
function drawStatic() {
  const canvas = canvasRef.value;
  if (!ctx || !canvas) return;
  ctx.font = `${FONT_SIZE - 2}px monospace`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = HEAD_COLOR;
  const rows = Math.ceil(canvas.height / FONT_SIZE);
  for (let i = 0; i < columns.length; i++) {
    // 每列随机撒 2~3 个字符，模拟雨在某一瞬间被"拍下"的样子
    const count = 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < count; k++) {
      const char = Math.random() > 0.5 ? '0' : '1';
      const row = Math.floor(Math.random() * rows);
      ctx.fillText(char, i * FONT_SIZE, row * FONT_SIZE);
    }
  }
}

/** 切走标签页暂停、切回来继续 */
function onVisibilityChange() {
  if (document.hidden) {
    stop();
  } else {
    start();
  }
}

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resize();

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibilityChange);

  // 用户系统开了"减少动态效果"：不放动画，改画一帧静态雨（resize 时重画）
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    drawStatic();
    window.addEventListener('resize', drawStatic);
    return;
  }
  start();
});

onUnmounted(() => {
  stop();
  window.removeEventListener('resize', resize);
  window.removeEventListener('resize', drawStatic);
  document.removeEventListener('visibilitychange', onVisibilityChange);
});
</script>

<style scoped>
.binary-rain {
  position: fixed;
  inset: 0;
  z-index: -1; /* 负层级：在所有内容之下、body 背景之上 */
  pointer-events: none;
  /* 整体浓度：纯黑背景上可以开得比浅色背景更亮（0.55 → 0.75） */
  opacity: 0.75;
}
</style>
