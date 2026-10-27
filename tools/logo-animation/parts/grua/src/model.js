      /* ───────────── MODELO (puro y determinista: todo es función del tiempo t) ─────────────
         Nada de Math.random ni relojes: las chispas usan un LCG con semilla fija. */
      const T_END = 5.6;
      const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
      const sm = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
      const EZ = {
        lin: (u) => u,
        sIO: (u) => 0.5 - 0.5 * Math.cos(Math.PI * u),
        sI: (u) => 1 - Math.cos((Math.PI * u) / 2),
        sO: (u) => Math.sin((Math.PI * u) / 2),
        p2I: (u) => u * u,
        p2O: (u) => 1 - (1 - u) * (1 - u),
        p2IO: (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)),
        p3I: (u) => u * u * u,
        p3O: (u) => 1 - Math.pow(1 - u, 3),
        p3IO: (u) => (u < 0.5 ? 4 * u * u * u : 1 - 4 * Math.pow(1 - u, 3)),
        backO: (u) => { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
      };

      // pista continua por tramos: cada paso [t0, t1, destino, ease]; el origen de cada tramo es el destino del anterior
      function chain(init, steps) {
        const segs = [];
        let cur = init, last = -1;
        for (const s of steps) {
          const [t0, t1, to, ez] = s;
          if (t0 < last - 1e-6) console.warn('tramos solapados', t0, last);
          segs.push({ t0, t1, from: cur, to, ez: ez || EZ.sIO });
          cur = to; last = t1;
        }
        return (t) => {
          let v = init;
          for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            if (t >= s.t1) v = s.to;
            else { if (t >= s.t0) v = s.from + (s.to - s.from) * s.ez((t - s.t0) / (s.t1 - s.t0)); break; }
          }
          return v;
        };
      }
      const at = (t, t0) => (t >= t0 ? 1 : 0);
      const pulse = (t, t0, dur) => { const u = (t - t0) / dur; return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u); };

      // LCG determinista para chispas y polvo
      function makeRng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

      // ───── escenario ─────
      const ORDER = ['d', 'Ts', 'Tb', 'r', 'Ao', 'As'];
      const PIVOT_Y = 72, LUG_DROP = 40, LC_CARRY = 6, LC_UP = 3;
      const HY_OUT = 292;                    // cabeza completamente bajo el suelo
      const JIB_LEN = 668, CJ_LEN = 148;

      // montaje (0.15 – 1.35 s) y desmontaje (4.6 – 5.3 s)
      const T_MAST0 = 0.20, T_MAST1 = 0.86;
      const T_OUT0 = 4.58;
      const hy = chain(HY_OUT, [
        [T_MAST0, T_MAST1, -2.5, EZ.p2IO], [T_MAST1, T_MAST1 + 0.14, 0, EZ.sIO],
        [4.89, 4.96, -3, EZ.sO], [4.96, 5.22, HY_OUT, EZ.p2I],
      ]);
      const jibOff = chain(JIB_LEN, [[0.58, 1.14, 0, EZ.sO], [T_OUT0, T_OUT0 + 0.44, JIB_LEN, EZ.sIO]]);
      const cjOff = chain(-CJ_LEN, [[0.90, 1.20, 0, EZ.p3O], [T_OUT0 + 0.20, T_OUT0 + 0.46, -CJ_LEN, EZ.p2I]]);
      const catS = chain(0.001, [[0.98, 1.22, 1, EZ.backO], [T_OUT0 + 0.26, T_OUT0 + 0.46, 0.001, EZ.p2I]]);
      const tieOff = (i) => chain(1, [[1.12 + 0.04 * i, 1.30 + 0.04 * i, 0, EZ.p2O], [T_OUT0 + 0.02 + 0.03 * i, T_OUT0 + 0.22 + 0.03 * i, 1, EZ.p2I]]);
      const footS = chain(0.001, [[0.10, 0.34, 1, EZ.backO], [5.00, 5.23, 0.001, EZ.p2I]]);
      const shadowO = chain(0, [[0.10, 0.40, 1, EZ.sO], [5.00, 5.23, 0, EZ.sIO]]);

      // calendario de piezas: salen de la fila de espera (de izquierda a derecha) y se posan en su sitio
      //   dep: empieza a correr el carro · arr: llega sobre su sitio · low0: empieza a bajar · land: toca la losa
      const SCHED = {
        d:  { dep: 1.46, arr: 1.96, low0: 2.02, land: 2.30, hx: 627 },
        Ts: { dep: 1.80, arr: 2.30, low0: 2.36, land: 2.52, hx: 662.1, clear: [2.58, 2.72, 637] },
        Tb: { dep: 2.30, arr: 2.74, low0: 2.78, land: 2.98, hx: 662.15 },
        r:  { dep: 2.90, arr: 3.34, low0: 3.38, land: 3.62, hx: 699.5, ax: 6 },
        Ao: { dep: 3.30, arr: 3.72, low0: 3.84, land: 4.08, hx: 735.0, clear: [4.14, 4.26, 727] },
        As: { dep: 3.50, arr: 3.96, low0: 4.12, land: 4.36, hx: 755.55, ax: 3.2 },
      };
      const FULL_T = SCHED.Tb.land + 0.14;       // la T entera sustituye a sus dos piezas
      const FULL_A = SCHED.As.land + 0.20;       // la a entera sustituye al óvalo y al palo (tras la soldadura)

      const lcLand = (k) => PIECES[k].top - (PIVOT_Y + LUG_DROP);
      const rigX = {}, rigLc = {};
      ORDER.forEach((k) => {
        const s = SCHED[k], p = PIECES[k];
        // las piezas que bajan pegadas a una vecina se acercan con un desvío (ax) y encajan en el último instante
        const ax = s.ax || 0, slide = ax ? 0.12 : 0;
        const steps = [[s.dep, s.arr, s.hx + ax, EZ.sIO]];
        if (ax) steps.push([s.land - slide, s.land, p.hang, EZ.sIO]); else steps.push([s.low0, s.land, p.hang, EZ.p2O]);
        if (s.clear) steps.push([s.clear[0], s.clear[1], s.clear[2], EZ.sIO]);
        const base = chain(ROW[k], steps);
        rigX[k] = (t) => base(t) + jibOff(t);
        rigLc[k] = chain(LC_CARRY, [[s.low0, s.land, lcLand(k), EZ.p2O], [s.land + 0.06, s.land + 0.30, LC_UP, EZ.p2IO]]);
      });

      // ───── péndulo: la carga cuelga del carro y reacciona a su aceleración (integración fija a 480 Hz) ─────
      function simulate(k) {
        const s = SCHED[k], p = PIECES[k], xf = rigX[k], lf = rigLc[k];
        const dt = 1 / 480, N = Math.ceil(T_END / dt) + 2;
        const th = new Float32Array(N);
        const G = 6200, Z = 0.2, KC = 0.05, CAP = 0.24;
        const hHalf = (p.bot - p.top) / 2;
        let a = 0, w = 0;
        for (let i = 0; i < N; i++) {
          const t = i * dt;
          const acc = (xf(t + dt) - 2 * xf(t) + xf(t - dt)) / (dt * dt);
          const loaded = t < s.land;
          const L = lf(t) + 22 + (loaded ? 18 + hHalf : 0);
          const om2 = G / L, om = Math.sqrt(om2);
          const win = t < s.land ? sm((s.land - t) / 0.26) : sm((t - s.land) / 0.14);
          const z = Z + 0.9 * (1 - win);
          w += (-om2 * Math.sin(a) + (KC * acc / L) * Math.cos(a) - 2 * z * om * w) * dt;
          a += w * dt;
          if (a > CAP) { a = CAP; w = Math.min(w, 0); } else if (a < -CAP) { a = -CAP; w = Math.max(w, 0); }
          th[i] = a * win;
        }
        return (t) => {
          const f = clamp(t / dt, 0, N - 2), i = Math.floor(f), u = f - i;
          return (th[i] * (1 - u) + th[i + 1] * u) * 180 / Math.PI;
        };
      }
      const rigTh = {};
      ORDER.forEach((k) => { rigTh[k] = simulate(k); });
