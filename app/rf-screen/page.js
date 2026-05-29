import { neon } from '@neondatabase/serverless'

export const revalidate = 30

export default async function ScreenPage() {
  const sql = neon(process.env.DATABASE_URL)
  const slides = await sql`SELECT * FROM rf_slides WHERE active = true ORDER BY id`

  return (
    <html>
      <head>
        <meta httpEquiv="refresh" content="30" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #0a0a0a; color: #fff; font-family: sans-serif; height: 100vh; overflow: hidden; }
          .screen { width: 100vw; height: 100vh; position: relative; }
          .topbar { position: absolute; top: 0; left: 0; right: 0; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.6); z-index: 10; }
          .logo { font-size: 16px; font-weight: 500; letter-spacing: 0.05em; }
          .logo span { color: #E8002D; }
          .clock { font-size: 14px; color: rgba(255,255,255,0.6); font-variant-numeric: tabular-nums; }
          .slide { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 80px 60px 40px; opacity: 0; transition: opacity 0.8s ease; }
          .slide.active { opacity: 1; }
          .slide-label { font-size: 11px; letter-spacing: 0.12em; color: rgba(255,255,255,0.4); text-transform: uppercase; margin-bottom: 16px; }
          .slide-title { font-size: 48px; font-weight: 500; line-height: 1.15; margin-bottom: 20px; }
          .slide-body { font-size: 22px; color: rgba(255,255,255,0.75); line-height: 1.6; max-width: 800px; }
          .slide-weather { background: linear-gradient(135deg, #0d1b2a 0%, #1a3a5c 100%); }
          .slide-program { background: #111; }
          .slide-hours { background: #0d0d0d; }
          .slide-message { background: #0f0f0f; }
          .progress { position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: rgba(255,255,255,0.1); }
          .progress-bar { height: 100%; background: #E8002D; width: 0%; }
          .dots { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; }
          .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.25); transition: background 0.3s; }
          .dot.active { background: #fff; }
          .type-label { display: inline-block; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #FF6B00; margin-bottom: 12px; }
        `}</style>
      </head>
      <body>
        <div class="screen">
          <div class="topbar">
            <div class="logo">RF<span>●</span>PRESSECENTER</div>
            <div class="clock" id="clock">--:--:--</div>
          </div>

          {slides.map((slide, i) => (
            <div key={slide.id} class={`slide slide-${slide.type}${i === 0 ? ' active' : ''}`} id={`slide-${i}`}>
              <div class="type-label">{slide.type === 'weather' ? 'Vejr' : slide.type === 'program' ? 'Program' : slide.type === 'hours' ? 'Åbningstider' : 'Meddelelse'}</div>
              <div class="slide-title">{slide.title || 'Ingen titel'}</div>
              {slide.body && <div class="slide-body">{slide.body}</div>}
            </div>
          ))}

          <div class="dots" id="dots">
            {slides.map((_, i) => (
              <div key={i} class={`dot${i === 0 ? ' active' : ''}`} id={`dot-${i}`}></div>
            ))}
          </div>

          <div class="progress"><div class="progress-bar" id="progress"></div></div>
        </div>

        <script dangerouslySetInnerHTML={{__html: `
          const slides = document.querySelectorAll('.slide');
          const dots = document.querySelectorAll('.dot');
          const DURATION = 8000;
          let current = 0;
          let start = null;
          let raf = null;

          function showSlide(idx) {
            slides[current].classList.remove('active');
            dots[current].classList.remove('active');
            current = (idx + slides.length) % slides.length;
            slides[current].classList.add('active');
            dots[current].classList.add('active');
            start = null;
          }

          function animate(ts) {
            if (!start) start = ts;
            const pct = Math.min(((ts - start) / DURATION) * 100, 100);
            document.getElementById('progress').style.width = pct + '%';
            if (pct >= 100) showSlide(current + 1);
            raf = requestAnimationFrame(animate);
          }

          requestAnimationFrame(animate);

          function updateClock() {
            const now = new Date();
            document.getElementById('clock').textContent = now.toLocaleTimeString('da-DK', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
          }
          setInterval(updateClock, 1000);
          updateClock();
        `}} />
      </body>
    </html>
  )
}
