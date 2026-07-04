import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Shared editorial layout for the public legal pages (Privacy Policy, Terms of
 * Service). Renders a sticky masthead, a Spanish and an English article
 * stacked with a language toggle, an entity-metadata grid, an auto-generated
 * table of contents, and numbered sections with an accent marker — mirroring
 * the approved design. Styling is a scoped <style> block (classes prefixed
 * `ld-`) so it never collides with Tailwind or global CSS.
 */

export interface LegalMetaItem {
  label: string;
  value: ReactNode;
}

export interface LegalSection {
  num: number;
  title: string;
  body: ReactNode;
}

export interface LegalVersion {
  /** Anchor for the language toggle, e.g. 'es' | 'en'. */
  lang: 'es' | 'en';
  docTitle: string;
  updatedLabel: string;
  tocLabel: string;
  meta: LegalMetaItem[];
  sections: LegalSection[];
  signature: ReactNode;
}

export interface LegalDocumentProps {
  /** Unique per page so anchors don't clash, e.g. 'priv' | 'terms'. */
  idPrefix: string;
  backHref: string;
  es: LegalVersion;
  en: LegalVersion;
  footer: ReactNode;
  /** Toggle labels + accessible back label, localized once. */
  labels: { spanish: string; english: string; back: string; kicker: string };
}

const STYLES = `
.ld-root {
  --ld-ground:#FCFBF9; --ld-panel:#FFFFFF; --ld-ink:#1A1917; --ld-ink-soft:#6E6A62;
  --ld-ink-faint:#9A958B; --ld-accent:#F97316; --ld-accent-deep:#C2410C;
  --ld-hairline:#E9E5DD; --ld-hairline-strong:#DCD6CB; --ld-note:#F6F4EF;
  --ld-serif:"Charter","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  --ld-sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  background:var(--ld-ground); color:var(--ld-ink); font-family:var(--ld-serif);
  font-size:17px; line-height:1.62; -webkit-font-smoothing:antialiased; min-height:100vh;
}
.ld-root *{box-sizing:border-box;}
.ld-wrap{max-width:780px; margin:0 auto; padding:0 24px;}
.ld-masthead{border-bottom:1px solid var(--ld-hairline-strong); background:var(--ld-panel); position:sticky; top:0; z-index:10;}
.ld-masthead .ld-wrap{display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 24px;}
.ld-brand{display:flex; align-items:baseline; gap:10px; font-family:var(--ld-sans);}
.ld-brand b{font-weight:700; font-size:19px; letter-spacing:-0.01em; color:var(--ld-ink);}
.ld-brand b::before{content:""; display:inline-block; width:9px; height:9px; margin-right:8px; border-radius:2px; background:var(--ld-accent); transform:translateY(-1px);}
.ld-brand span{font-size:12px; color:var(--ld-ink-soft); letter-spacing:0.02em;}
.ld-back{font-family:var(--ld-sans); font-size:13px; font-weight:550; color:var(--ld-ink-soft); text-decoration:none; padding:6px 12px; border-radius:7px;}
.ld-back:hover{color:var(--ld-accent-deep); background:var(--ld-note);}
.ld-toggle{display:flex; justify-content:flex-end; gap:10px; font-family:var(--ld-sans); font-size:13px; padding-top:28px;}
.ld-toggle a{color:var(--ld-ink-soft); text-decoration:none;}
.ld-toggle a:hover{color:var(--ld-accent-deep); text-decoration:underline;}
.ld-toggle span{color:var(--ld-ink-faint);}
.ld-article{padding-top:20px;}
.ld-article + .ld-article{margin-top:16px; padding-top:44px; border-top:2px solid var(--ld-ink);}
.ld-eyebrow{font-family:var(--ld-sans); font-size:11.5px; font-weight:650; letter-spacing:0.13em; text-transform:uppercase; color:var(--ld-accent-deep); margin:0 0 12px;}
.ld-title{font-family:var(--ld-sans); font-weight:720; font-size:clamp(27px,4.6vw,40px); line-height:1.06; letter-spacing:-0.022em; margin:0; text-wrap:balance;}
.ld-sub{font-family:var(--ld-sans); font-size:13px; color:var(--ld-ink-faint); margin:12px 0 0; font-variant-numeric:tabular-nums;}
.ld-meta{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; background:var(--ld-hairline); border:1px solid var(--ld-hairline); border-radius:12px; overflow:hidden; margin:28px 0 0; font-family:var(--ld-sans);}
.ld-meta > div{background:var(--ld-panel); padding:13px 16px;}
.ld-meta dt{font-size:10.5px; font-weight:640; letter-spacing:0.07em; text-transform:uppercase; color:var(--ld-ink-faint); margin:0 0 4px;}
.ld-meta dd{margin:0; font-size:13.5px; color:var(--ld-ink);}
.ld-toc{margin:26px 0 8px; padding:18px 20px; background:var(--ld-panel); border:1px solid var(--ld-hairline); border-radius:12px;}
.ld-toc p{font-family:var(--ld-sans); font-size:11px; font-weight:640; letter-spacing:0.08em; text-transform:uppercase; color:var(--ld-ink-faint); margin:0 0 12px;}
.ld-toc ol{margin:0; padding:0; list-style:none; columns:2; column-gap:28px; font-family:var(--ld-sans); font-size:13.5px;}
.ld-toc li{margin:0 0 7px; break-inside:avoid;}
.ld-toc a{color:var(--ld-ink-soft); text-decoration:none; display:flex; gap:8px;}
.ld-toc a:hover{color:var(--ld-accent-deep);}
.ld-toc a .ld-n{color:var(--ld-accent); font-variant-numeric:tabular-nums; font-weight:640; min-width:16px;}
.ld-sections section{padding:26px 0; border-bottom:1px solid var(--ld-hairline); scroll-margin-top:72px;}
.ld-sections section:last-child{border-bottom:none;}
.ld-sections h3{font-family:var(--ld-sans); font-weight:660; font-size:18px; letter-spacing:-0.01em; margin:0 0 12px; display:flex; gap:12px; align-items:baseline; text-wrap:balance;}
.ld-sections h3 .ld-num{color:var(--ld-accent); font-variant-numeric:tabular-nums; font-size:15px; font-weight:700; min-width:24px;}
.ld-sections p{margin:0 0 12px; max-width:68ch;}
.ld-sections p:last-child{margin-bottom:0;}
.ld-sections ul{margin:6px 0 12px; padding:0; list-style:none; max-width:68ch;}
.ld-sections ul li{position:relative; padding-left:20px; margin:0 0 9px;}
.ld-sections ul li::before{content:""; position:absolute; left:3px; top:11px; width:6px; height:6px; border-radius:50%; background:var(--ld-accent);}
.ld-sections strong{font-weight:640;}
.ld-caps{font-family:var(--ld-sans); font-size:13.5px; line-height:1.55; color:var(--ld-ink-soft); letter-spacing:0.01em; text-transform:uppercase;}
.ld-a{color:var(--ld-accent-deep); text-decoration:underline; text-underline-offset:2px;}
.ld-sig{font-family:var(--ld-sans); font-size:13.5px; color:var(--ld-ink-soft); margin-top:6px;}
.ld-sig b{color:var(--ld-ink); font-weight:640;}
.ld-foot{margin:56px 0 80px; padding-top:24px; border-top:1px solid var(--ld-hairline); font-family:var(--ld-sans); font-size:12.5px; color:var(--ld-ink-faint);}
@media (max-width:620px){.ld-meta{grid-template-columns:1fr;} .ld-toc ol{columns:1;}}
`;

function Version({ v, idPrefix }: { v: LegalVersion; idPrefix: string }) {
  return (
    <article className="ld-article" id={`${idPrefix}-${v.lang}`}>
      <h1 className="ld-title">{v.docTitle}</h1>
      <p className="ld-sub">{v.updatedLabel}</p>

      <dl className="ld-meta">
        {v.meta.map((m) => (
          <div key={m.label}>
            <dt>{m.label}</dt>
            <dd>{m.value}</dd>
          </div>
        ))}
      </dl>

      <nav className="ld-toc" aria-label={v.tocLabel}>
        <p>{v.tocLabel}</p>
        <ol>
          {v.sections.map((s) => (
            <li key={s.num}>
              <a href={`#${idPrefix}-${v.lang}-${s.num}`}>
                <span className="ld-n">{s.num}</span>
                <span>{s.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="ld-sections">
        {v.sections.map((s) => (
          <section key={s.num} id={`${idPrefix}-${v.lang}-${s.num}`}>
            <h3>
              <span className="ld-num">{s.num}</span>
              <span>{s.title}</span>
            </h3>
            {s.body}
          </section>
        ))}
        <section>
          <p className="ld-sig">{v.signature}</p>
        </section>
      </div>
    </article>
  );
}

export function LegalDocument({ idPrefix, backHref, es, en, footer, labels }: LegalDocumentProps) {
  return (
    <div className="ld-root">
      <style>{STYLES}</style>

      <header className="ld-masthead">
        <div className="ld-wrap">
          <div className="ld-brand">
            <b>BuildTrack</b>
            <span>{labels.kicker}</span>
          </div>
          <Link to={backHref} className="ld-back">{labels.back}</Link>
        </div>
      </header>

      <div className="ld-wrap">
        <div className="ld-toggle">
          <a href={`#${idPrefix}-es`}>{labels.spanish}</a>
          <span>|</span>
          <a href={`#${idPrefix}-en`}>{labels.english}</a>
        </div>

        <Version v={es} idPrefix={idPrefix} />
        <Version v={en} idPrefix={idPrefix} />

        <footer className="ld-foot">{footer}</footer>
      </div>
    </div>
  );
}
