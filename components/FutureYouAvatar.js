'use client';

import React, { useRef, useEffect } from 'react';

/**
 * @file components/FutureYouAvatar.js
 * Realistic, stylish 3D procedural human model avatar representing "Future You".
 * Renders with 3D depth, specular lighting, natural eye blinking, subtle head sway,
 * and dynamic lip-sync mouth articulation whenever Future You is speaking.
 */
export default function FutureYouAvatar({
  isSpeaking = false,
  isPaused = false,
  size = 130,
  className = ''
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let startTime = performance.now();
    let nextBlinkTime = startTime + 2500 + Math.random() * 2000;
    let blinkDuration = 180; // ms
    let isBlinking = false;
    let blinkStart = 0;

    const render = (time) => {
      const elapsed = (time - startTime) / 1000; // seconds

      // Handle natural eye blinking
      if (!isBlinking && time >= nextBlinkTime) {
        isBlinking = true;
        blinkStart = time;
      }
      let blinkProgress = 0; // 0 = open, 1 = fully closed
      if (isBlinking) {
        const bElapsed = time - blinkStart;
        if (bElapsed >= blinkDuration) {
          isBlinking = false;
          nextBlinkTime = time + 2500 + Math.random() * 3000;
        } else {
          // Parabolic blink curve
          blinkProgress = Math.sin((bElapsed / blinkDuration) * Math.PI);
        }
      }

      // Mouth opening calculation for lip-sync
      const activelyTalking = isSpeaking && !isPaused;
      let mouthOpen = 0;
      let mouthWidthMod = 0;
      if (activelyTalking) {
        // Multi-frequency wave to simulate natural speech syllables
        const s1 = Math.sin(elapsed * 12);
        const s2 = Math.sin(elapsed * 7.5);
        const s3 = Math.cos(elapsed * 18);
        mouthOpen = Math.max(0, (s1 * 0.4 + s2 * 0.4 + s3 * 0.2 + 0.3) * 14);
        mouthWidthMod = (s2 * 0.2) * 4;
      }

      // Subtle breathing & head nod
      const nod = activelyTalking ? Math.sin(elapsed * 6) * 1.5 : Math.sin(elapsed * 1.5) * 0.8;
      const sway = Math.cos(elapsed * 1.2) * 1.2;

      // Clear Canvas
      ctx.clearRect(0, 0, size, size);

      const centerX = size / 2;
      const centerY = size / 2;
      const scale = size / 140;

      ctx.save();
      ctx.scale(scale, scale);

      // 1. Audio Resonance Rings (when speaking)
      if (activelyTalking) {
        const ringPulse = (elapsed * 2) % 1;
        const ringRadius = 55 + ringPulse * 16;
        const ringAlpha = Math.max(0, 0.4 - ringPulse * 0.4);

        ctx.beginPath();
        ctx.arc(70, 70, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(27, 127, 92, ${ringAlpha})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        const ringRadius2 = 50 + ((elapsed * 2 + 0.5) % 1) * 16;
        const ringAlpha2 = Math.max(0, 0.3 - ((elapsed * 2 + 0.5) % 1) * 0.3);
        ctx.beginPath();
        ctx.arc(70, 70, ringRadius2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(232, 137, 12, ${ringAlpha2})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 2. Torso / Shoulders in Deep Green Blazer (#0E5A44)
      ctx.save();
      ctx.translate(70 + sway * 0.3, 118 + nod * 0.5);

      // Blazer shoulders
      const blazerGrad = ctx.createLinearGradient(-48, 0, 48, 25);
      blazerGrad.addColorStop(0, '#093E2F');
      blazerGrad.addColorStop(0.5, '#0E5A44');
      blazerGrad.addColorStop(1, '#083729');

      ctx.beginPath();
      ctx.moveTo(-46, 22);
      ctx.quadraticCurveTo(-44, 2, -20, -4);
      ctx.lineTo(20, -4);
      ctx.quadraticCurveTo(44, 2, 46, 22);
      ctx.closePath();
      ctx.fillStyle = blazerGrad;
      ctx.fill();

      // Shirt collar (crisp off-white)
      ctx.beginPath();
      ctx.moveTo(-16, -4);
      ctx.lineTo(0, 14);
      ctx.lineTo(16, -4);
      ctx.lineTo(10, -5);
      ctx.lineTo(0, 8);
      ctx.lineTo(-10, -5);
      ctx.closePath();
      ctx.fillStyle = '#F4EFE6';
      ctx.fill();

      // Golden saffron lapel accent
      ctx.beginPath();
      ctx.arc(0, 11, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#E8890C';
      ctx.fill();
      ctx.restore();

      // 3. Neck with 3D gradient shadow
      ctx.save();
      ctx.translate(70 + sway * 0.5, 96 + nod);
      const neckGrad = ctx.createLinearGradient(0, -10, 0, 16);
      neckGrad.addColorStop(0, '#CCA483');
      neckGrad.addColorStop(0.4, '#DEB797');
      neckGrad.addColorStop(1, '#B88E6D');

      ctx.beginPath();
      ctx.rect(-11, -6, 22, 18);
      ctx.fillStyle = neckGrad;
      ctx.fill();
      ctx.restore();

      // 4. Head with 3D Perspective & Skin Gradient
      ctx.save();
      ctx.translate(70 + sway, 65 + nod);

      // Head 3D Sphere/Oval Gradient
      const headGrad = ctx.createRadialGradient(-6, -8, 6, 0, 0, 36);
      headGrad.addColorStop(0, '#FFE8D6');
      headGrad.addColorStop(0.5, '#F5CDAE');
      headGrad.addColorStop(0.85, '#E2B18E');
      headGrad.addColorStop(1, '#C8936E');

      ctx.beginPath();
      // Slightly mature, defined jawline
      ctx.moveTo(0, -34);
      ctx.bezierCurveTo(26, -34, 30, -5, 27, 16);
      ctx.bezierCurveTo(24, 32, 12, 38, 0, 38);
      ctx.bezierCurveTo(-12, 38, -24, 32, -27, 16);
      ctx.bezierCurveTo(-30, -5, -26, -34, 0, -34);
      ctx.closePath();
      ctx.fillStyle = headGrad;
      ctx.shadowColor = 'rgba(20, 32, 27, 0.18)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // 5. Sophisticated Styled Hair (Mature dark charcoal with subtle warm highlights)
      const hairGrad = ctx.createLinearGradient(-26, -35, 26, -10);
      hairGrad.addColorStop(0, '#1E2522');
      hairGrad.addColorStop(0.5, '#2D3832');
      hairGrad.addColorStop(1, '#18201C');

      ctx.beginPath();
      ctx.moveTo(-29, -10);
      ctx.bezierCurveTo(-32, -32, -18, -44, 4, -43);
      ctx.bezierCurveTo(24, -42, 32, -28, 28, -8);
      ctx.bezierCurveTo(26, -16, 18, -32, 2, -34);
      ctx.bezierCurveTo(-14, -36, -24, -24, -29, -10);
      ctx.closePath();
      ctx.fillStyle = hairGrad;
      ctx.fill();

      // Hair texture swoop
      ctx.beginPath();
      ctx.moveTo(-16, -34);
      ctx.quadraticCurveTo(2, -38, 20, -25);
      ctx.strokeStyle = '#3D4A43';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 6. Intelligent Eyebrows
      ctx.strokeStyle = '#27332C';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';

      // Left eyebrow
      ctx.beginPath();
      ctx.moveTo(-20, -11 + (activelyTalking ? -1 : 0));
      ctx.quadraticCurveTo(-13, -15, -6, -12);
      ctx.stroke();

      // Right eyebrow
      ctx.beginPath();
      ctx.moveTo(6, -12);
      ctx.quadraticCurveTo(13, -15, 20, -11 + (activelyTalking ? -1 : 0));
      ctx.stroke();

      // 7. Expressive 3D Eyes
      const renderEye = (eyeX) => {
        ctx.save();
        ctx.translate(eyeX, -3);

        if (blinkProgress > 0.8) {
          // Closed eyelid line
          ctx.beginPath();
          ctx.moveTo(-7, 0);
          ctx.quadraticCurveTo(0, 2, 7, 0);
          ctx.strokeStyle = '#7D5239';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Eye White
          ctx.beginPath();
          ctx.ellipse(0, 0, 6.5, 4.2 * (1 - blinkProgress * 0.9), 0, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = 'rgba(125, 82, 57, 0.4)';
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // Iris (Warm rich brown)
          ctx.beginPath();
          ctx.arc(0.5, 0, 2.8 * (1 - blinkProgress * 0.8), 0, Math.PI * 2);
          ctx.fillStyle = '#3E2415';
          ctx.fill();

          // Pupil & Specular Light Catch
          ctx.beginPath();
          ctx.arc(0.5, 0, 1.4 * (1 - blinkProgress * 0.8), 0, Math.PI * 2);
          ctx.fillStyle = '#0F0905';
          ctx.fill();

          // Catchlight
          ctx.beginPath();
          ctx.arc(1.5, -1, 0.9, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
        }
        ctx.restore();
      };

      renderEye(-13);
      renderEye(13);

      // 8. 3D Nose Bridge & Tip
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(1, 9);
      ctx.quadraticCurveTo(3, 11, 0, 12);
      ctx.quadraticCurveTo(-3, 11, -1, 9);
      ctx.strokeStyle = 'rgba(180, 120, 85, 0.5)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Nose tip soft highlight
      ctx.beginPath();
      ctx.arc(0, 10, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 240, 225, 0.4)';
      ctx.fill();
      ctx.restore();

      // 9. Articulated Speaking Mouth (Lip-Sync)
      ctx.save();
      ctx.translate(0, 23);

      if (mouthOpen > 1.5) {
        // Open speaking mouth
        const mW = 12 + mouthWidthMod;
        const mH = mouthOpen;

        // Dark interior of mouth
        ctx.beginPath();
        ctx.ellipse(0, mH * 0.35, mW * 0.8, mH * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#441416';
        ctx.fill();

        // Upper teeth
        ctx.beginPath();
        ctx.rect(-mW * 0.5, 0, mW, Math.min(3.5, mH * 0.35));
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // Upper lip
        ctx.beginPath();
        ctx.moveTo(-mW, 0);
        ctx.quadraticCurveTo(0, -2.5, mW, 0);
        ctx.strokeStyle = '#B86558';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Lower lip
        ctx.beginPath();
        ctx.moveTo(-mW * 0.85, mH * 0.7);
        ctx.quadraticCurveTo(0, mH + 2, mW * 0.85, mH * 0.7);
        ctx.strokeStyle = '#C57265';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      } else {
        // Rest state: serene, confident smile
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.quadraticCurveTo(0, 4, 10, 0);
        ctx.strokeStyle = '#B05E51';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Subtle lower lip fullness
        ctx.beginPath();
        ctx.moveTo(-5, 4);
        ctx.quadraticCurveTo(0, 6.5, 5, 4);
        ctx.strokeStyle = 'rgba(180, 95, 80, 0.45)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.restore();

      ctx.restore(); // end head

      ctx.restore(); // end scale

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isSpeaking, isPaused, size]);

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* 3D Human Avatar Canvas */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="w-full h-full drop-shadow-md transition-transform duration-300"
        style={{ width: `${size}px`, height: `${size}px` }}
      />

      {/* Floating Status Indicator Pill */}
      {isSpeaking && !isPaused && (
        <div className="absolute -bottom-2 bg-surface/90 backdrop-blur-md border border-primary/30 text-primary text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 animate-fadeIn">
          {/* Animated Audio Equalizer Bars */}
          <div className="flex items-center gap-0.5 h-2.5">
            <span className="w-0.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-0.5 h-3 bg-accent-saffron rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-0.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>Future You</span>
        </div>
      )}
    </div>
  );
}
