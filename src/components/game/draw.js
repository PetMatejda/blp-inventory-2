// Canvas drawing shared by the games.

/** A simple walking silhouette standing on footY. */
export function drawPerson(ctx, x, footY, h, color, { phase = 0, moving = false, armUp = false } = {}) {
  const swing = moving ? Math.sin(phase) * h * 0.16 : h * 0.06;
  const hip = footY - h * 0.42;
  const shoulder = footY - h * 0.74;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = h * 0.1;
  ctx.beginPath(); // legs
  ctx.moveTo(x, hip); ctx.lineTo(x + swing, footY);
  ctx.moveTo(x, hip); ctx.lineTo(x - swing, footY);
  ctx.stroke();
  ctx.lineWidth = h * 0.08;
  ctx.beginPath(); // arms
  if (armUp) {
    ctx.moveTo(x, shoulder); ctx.lineTo(x + h * 0.1, shoulder - h * 0.2);
    ctx.moveTo(x, shoulder); ctx.lineTo(x - h * 0.12, hip);
  } else {
    ctx.moveTo(x, shoulder); ctx.lineTo(x - swing * 0.8, hip);
    ctx.moveTo(x, shoulder); ctx.lineTo(x + swing * 0.8, hip);
  }
  ctx.stroke();
  ctx.lineWidth = h * 0.2;
  ctx.beginPath(); ctx.moveTo(x, shoulder); ctx.lineTo(x, hip); ctx.stroke(); // body
  ctx.beginPath(); ctx.arc(x, footY - h * 0.9, h * 0.1, 0, Math.PI * 2); ctx.fill(); // head
}
