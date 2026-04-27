// Tiny canvas confetti burst. No deps, no bundler.
//
// Spawns N rectangular particles at (x, y), launches them upward in a
// fanned-out arc, applies gravity until each particle's life expires,
// then removes the canvas. Cheap, brief, and disposable - intended for
// "save succeeded" celebrations, not long-running effects.

const COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5', '#f15bb5', '#00bbf9'];

export function confettiBurst({ x, y, count = 90 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const particles = [];
    for (let i = 0; i < count; i++) {
        // Spread the burst into a 130-degree fan, biased upwards.
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 130 / 180);
        const speed = 7 + Math.random() * 9;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rot: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 0.4,
            w: 6 + Math.random() * 4,
            h: 10 + Math.random() * 6,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            gravity: 0.28 + Math.random() * 0.12,
            life: 0,
            maxLife: 90 + Math.random() * 40,
        });
    }

    let raf = 0;
    const frame = () => {
        ctx.clearRect(0, 0, W, H);
        let alive = false;
        for (const p of particles) {
            if (p.life >= p.maxLife) continue;
            alive = true;
            p.life++;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.992;
            p.rot += p.rotSpeed;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
        if (alive) {
            raf = requestAnimationFrame(frame);
        } else {
            cancelAnimationFrame(raf);
            canvas.remove();
        }
    };
    frame();
}
