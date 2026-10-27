
      /* ───────────── ESCENA: une el modelo con el DOM ─────────────
         Cada propiedad animada es UN tween de toda la duración cuyo ease devuelve el valor absoluto en ese instante
         (función pura del tiempo): el render puede saltar a cualquier fotograma y sale idéntico. */
      const tl = gsap.timeline({ paused: true });
      // pivotes en el origen local de cada grupo (el origen por defecto de GSAP en SVG es la esquina de su caja)
      gsap.set('[id^="gru-sw-"], #gru-cathead, #gru-foot, #gru-anemR, [id^="gru-sp"], [id^="gru-du"], [id^="gru-sm"], [id^="gru-lampG"], [id^="gru-ts-"], [id^="gru-hs-"], #gru-drum, #gru-flT, #gru-flA, #gru-flA2', { svgOrigin: '0 0' });
      function D(sel, prop, fn) {
        const from = {}, to = {};
        if (prop.indexOf('attr:') === 0) { const k = prop.slice(5); from.attr = { [k]: 0 }; to.attr = { [k]: 1 }; }
        else { from[prop] = 0; to[prop] = 1; }
        to.duration = T_END;
        to.ease = (p) => fn(p * T_END);
        tl.fromTo(sel, from, to, 0);
      }
      const flash = (t, t0, att, dec) => { const u = t - t0; if (u < 0) return 0; if (u < att) return u / att; const e = Math.exp(-(u - att) / dec) - 0.0067; return e > 0 ? e / 0.9933 : 0; };

      // ── montaje: zapata, mástil que crece, cabeza que sube con él, pluma que sale, tirantes ──
      D('#gru-foot', 'scaleY', footS);
      D('#gru-foot', 'opacity', (t) => at(t, 0.099) * (1 - at(t, 5.235)));
      D('#gru-shadow', 'opacity', shadowO);
      D('#gru-head', 'y', hy);
      D('#gru-clMastR', 'attr:y', (t) => 80 + hy(t));
      D('#gru-jibX', 'x', jibOff);
      D('#gru-cjibX', 'x', cjOff);
      D('#gru-cathead', 'scaleY', catS);
      D('#gru-cathead', 'opacity', (t) => (t >= 0.97 && t < T_OUT0 + 0.45 ? 1 : 0));
      for (let i = 1; i <= 4; i++) {
        D('#gru-tie' + i + ' path', 'strokeDashoffset', tieOff(i - 1));
        D('#gru-tt' + i, 'opacity', (t) => at(t, 1.36 + 0.04 * i) * (1 - at(t, T_OUT0 + 0.02)));
      }

      // ── carros, ganchos y cargas ──
      ORDER.forEach((k) => {
        const s = SCHED[k];
        D('#gru-rig-' + k, 'x', rigX[k]);
        D('#gru-sw-' + k, 'rotation', rigTh[k]);
        D('.gru-cab-' + k, 'attr:y2', rigLc[k]);
        D('#gru-hb-' + k, 'y', rigLc[k]);
        D('#gru-ts-' + k, 'rotation', (t) => rigLc[k](t) / 3.1 * 57.3);
        D('#gru-hs-' + k, 'rotation', (t) => -rigLc[k](t) / 2.7 * 57.3);
        D('#gru-c-' + k, 'opacity', (t) => 1 - at(t, s.land));
        D('#gru-slk-' + k, 'opacity', (t) => (t >= s.land && t < s.land + 0.22 ? 1 - sm((t - s.land - 0.06) / 0.16) : 0));
      });
      const thud = (t, t0) => { const u = (t - t0) / 0.13; return u <= 0 || u >= 1 ? 0 : 1.1 * Math.sin(Math.PI * Math.pow(u, 0.7)) * (1 - u * 0.4); };
      ['d', 'Ts', 'Tb', 'r', 'Ao', 'As'].forEach((k) => D('#gru-L-' + k, 'y', (t) => thud(t, SCHED[k].land)));
      D('#gru-L-d', 'opacity', (t) => at(t, SCHED.d.land));
      D('#gru-L-Ts', 'opacity', (t) => at(t, SCHED.Ts.land) * (1 - at(t, FULL_T)));
      D('#gru-L-Tb', 'opacity', (t) => at(t, SCHED.Tb.land) * (1 - at(t, FULL_T)));
      D('#gru-L-T', 'opacity', (t) => at(t, FULL_T));
      D('#gru-L-r', 'opacity', (t) => at(t, SCHED.r.land));
      D('#gru-L-Ao', 'opacity', (t) => at(t, SCHED.Ao.land) * (1 - at(t, FULL_A)));
      D('#gru-L-As', 'opacity', (t) => at(t, SCHED.As.land) * (1 - at(t, FULL_A)));
      D('#gru-L-a', 'opacity', (t) => at(t, FULL_A));

      // ── vida: luces de aviso, operario, reflejo del cristal, anemómetro, humo ──
      const blink = (t, ph) => {
        if (t < 1.25 || t > 5.0) return 0;
        const u = (((t - ph) % 0.9) + 0.9) % 0.9 / 0.9;
        return sm(u / 0.1) * (1 - sm((u - 0.38) / 0.12));
      };
      [[1, 0], [2, 0.3], [3, 0.6]].forEach(([i, ph]) => {
        D('#gru-lampG' + i, 'opacity', (t) => 0.95 * blink(t, ph));
        D('#gru-lampG' + i, 'scale', (t) => 0.7 + 0.45 * blink(t, ph));
        D('#gru-lampC' + i, 'opacity', (t) => 0.9 * blink(t, ph));
      });
      const nod = (t) => ORDER.reduce((a, k) => a + 0.9 * pulse(t, SCHED[k].land - 0.04, 0.3), 0);
      D('#gru-drum', 'rotation', (t) => ORDER.reduce((a, k) => a + rigLc[k](t), 0) / 4.4 * 57.3 * 0.5);
      D('#gru-op', 'y', (t) => nod(t));
      D('#gru-op', 'x', (t) => 0.9 * Math.sin(t * 2.1));
      D('#gru-glare', 'x', (t) => -26 + 66 * ((((t - 0.2) / 2.4) % 1 + 1) % 1));
      D('#gru-anemR', 'rotation', (t) => t * 840);
      for (let i = 0; i < 6; i++) {
        const t0 = 1.3 + 0.45 * i, P = 2.7, LIFE = 1.25;
        const ph = (t) => { if (t < t0 || t > 4.85) return -1; const u = ((t - t0) % P) / LIFE; return u > 1 ? -1 : u; };
        D('#gru-sm' + i, 'x', (t) => 1336 + 4 * Math.max(ph(t), 0) + 1.4 * Math.sin(t * 5 + i));
        D('#gru-sm' + i, 'y', (t) => 27 - 24 * EZ.p2O(Math.max(ph(t), 0)));
        D('#gru-sm' + i, 'scale', (t) => 0.45 + 1.5 * Math.max(ph(t), 0));
        D('#gru-sm' + i, 'opacity', (t) => { const u = ph(t); return u < 0 ? 0 : 0.6 * Math.pow(Math.sin(Math.PI * u), 0.8); });
      }

      // ── polvo: se reparte de un banco de círculos ──
      let duN = 0;
      const rngD = makeRng(7);
      function dust(t0, x, y, count, spread, rise, life) {
        for (let j = 0; j < count; j++) {
          const i = duN++;
          const f = count > 1 ? j / (count - 1) * 2 - 1 : 0;
          const dx = f * spread * (0.7 + 0.5 * rngD()), up = rise * (0.45 + 0.55 * rngD());
          const sc = 0.5 + 0.8 * rngD(), L = life * (0.8 + 0.4 * rngD());
          const tt = t0 + 0.02 * rngD();
          const u = (t) => clamp((t - tt) / L, 0, 1);
          const el = '#gru-du' + i;
          D(el, 'x', (t) => x + dx * EZ.p2O(u(t)));
          D(el, 'y', (t) => y - up * EZ.p2O(u(t)));
          D(el, 'scale', (t) => sc * (0.35 + 0.95 * EZ.p2O(u(t))));
          D(el, 'opacity', (t) => (t < tt || t > tt + L ? 0 : 0.85 * Math.pow(1 - u(t), 1.4) * Math.min(1, (t - tt) / 0.03)));
        }
      }
      dust(0.12, 1240, 321.5, 7, 78, 9, 0.62);
      dust(SCHED.d.land, 611.3, 288.5, 6, 26, 8, 0.5);
      dust(SCHED.Ts.land, 662.1, 288.5, 4, 14, 6, 0.45);
      dust(SCHED.r.land, 701.2, 288.5, 5, 20, 7, 0.48);
      dust(SCHED.Ao.land, 734.6, 288.5, 5, 22, 7, 0.48);
      dust(SCHED.As.land, 755.5, 288.5, 4, 14, 6, 0.45);
      dust(4.93, 1240, 321.5, 6, 74, 8, 0.26);

      // ── chispas (parábolas con gravedad, orientadas según su velocidad) ──
      let spN = 0;
      const rngS = makeRng(31);
      function spark(t0, x0, y0, vx, vy, life, g) {
        const i = spN++, el = '#gru-sp' + i;
        const u = (t) => clamp(t - t0, 0, life);
        D(el, 'x', (t) => x0 + vx * u(t));
        D(el, 'y', (t) => y0 + vy * u(t) + 0.5 * g * u(t) * u(t));
        D(el, 'rotation', (t) => Math.atan2(vy + g * u(t), vx) * 180 / Math.PI);
        D(el, 'scale', (t) => 0.55 + 0.45 * (1 - u(t) / life));
        D(el, 'opacity', (t) => { const f = (t - t0) / life; return f < 0 || f > 1 ? 0 : Math.min(1, f / 0.06) * Math.pow(1 - f, 0.7); });
      }
      // T: la barra baja sobre el palo y se suelda por las dos esquinas
      const tW = SCHED.Tb.land;
      for (let j = 0; j < 16; j++) {
        const side = j % 2 ? 1 : -1, sp = 70 + 190 * rngS();
        const ang = (-8 - 70 * rngS()) * Math.PI / 180;
        spark(tW + 0.01 * j, 662.1 + side * 5.2, 243.6, side * sp * Math.cos(ang), sp * Math.sin(ang) * 1.5 - 50, 0.34 + 0.2 * rngS(), 620);
      }
      // a: la soldadura corre por la junta del palo con el óvalo, de arriba abajo
      const aW = SCHED.As.land;
      for (let j = 0; j < 32; j++) {
        const f = j / 31, side = j % 2 ? 1 : -1, sp = 60 + 230 * rngS();
        const ang = (-10 - 80 * rngS()) * Math.PI / 180;
        spark(aW + 0.17 * f, 751 + side * 1.2, 247 + 43 * f, side * sp * Math.cos(ang), sp * Math.sin(ang) * 1.4 - 30, 0.36 + 0.24 * rngS(), 650);
      }

      // ── destellos de soldadura ──
      D('#gru-flT', 'opacity', (t) => 0.95 * flash(t, tW, 0.025, 0.1));
      D('#gru-flT', 'scale', (t) => 0.35 + 1.25 * sm((t - tW) / 0.3));
      D('#gru-hiT', 'opacity', (t) => 0.8 * flash(t, tW, 0.02, 0.07));
      D('#gru-seamT', 'opacity', (t) => 0.95 * flash(t, tW, 0.015, 0.08));
      D('#gru-flA', 'opacity', (t) => 0.95 * flash(t, aW, 0.04, 0.16));
      D('#gru-flA', 'scale', (t) => 0.3 + 1.4 * sm((t - aW) / 0.42));
      D('#gru-flA2', 'opacity', (t) => (t < aW ? 0 : t > aW + 0.24 ? 0 : 1) * (0.55 + 0.45 * Math.sin(t * 220)));
      D('#gru-flA2', 'y', (t) => 43 * sm((t - aW) / 0.17));
      D('#gru-hiA', 'opacity', (t) => 0.85 * flash(t, aW + 0.02, 0.05, 0.075));
      D('#gru-seamA', 'attr:height', (t) => 44.8 * sm((t - aW) / 0.17));
      D('#gru-seamA', 'opacity', (t) => 0.95 * flash(t, aW, 0.02, 0.16));

      window.__timelines = window.__timelines || {};
      window.__timelines['main'] = tl;
